from fastapi import APIRouter, HTTPException, Query, Body, Response
from fastapi.responses import HTMLResponse, PlainTextResponse
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from ..scanner.orchestrator import ObservabilityOrchestrator
from ..analytics.blast_radius import BlastRadiusEngine
from ..analytics.remediation_engine import RemediationEngine
from ..analytics.report_generator import ReportGenerator
from ..analytics.security_linter import SecurityLinter
from ..models.schemas import (
    ObservabilitySummary, AnsibleAsset, DuplicateCluster,
    BlastRadiusGraph, RiskFlagItem, RiskLevel, ScriptType,
    SecurityComplianceSummary, SecurityFinding, CanonicalRemediation,
    QualityGateConfig, QualityGateResult
)
from ..config import DEFAULT_DEMO_REPOS, DEMO_CI_LOGS_DIR

router = APIRouter()

# Global orchestrator instance initialized with demo data
orchestrator = ObservabilityOrchestrator()

# Initialize with demo repos if available
if any(True for r in DEFAULT_DEMO_REPOS):
    orchestrator.scan_repositories(DEFAULT_DEMO_REPOS, DEMO_CI_LOGS_DIR)

class ScanRequest(BaseModel):
    repos: Optional[List[str]] = None
    ci_logs: Optional[str] = None
    use_demo: bool = False

@router.get("/summary", response_model=ObservabilitySummary)
def get_summary():
    """Retrieve executive overview metrics, health score, and fragmentation counts."""
    if not orchestrator.cached_summary:
        orchestrator.scan_repositories(DEFAULT_DEMO_REPOS, DEMO_CI_LOGS_DIR)
    return orchestrator.cached_summary

@router.get("/inventory", response_model=List[AnsibleAsset])
def get_inventory(
    repo: Optional[str] = None,
    asset_type: Optional[ScriptType] = None,
    risk_level: Optional[RiskLevel] = None,
    search: Optional[str] = None
):
    """Search and filter the complete catalog of playbooks, roles, and tasks."""
    assets = orchestrator.cached_assets
    if repo:
        assets = [a for a in assets if a.repo_name.lower() == repo.lower()]
    if asset_type:
        assets = [a for a in assets if a.asset_type == asset_type]
    if risk_level:
        assets = [a for a in assets if a.risk_level == risk_level]
    if search:
        s = search.lower()
        assets = [a for a in assets if s in a.name.lower() or s in a.relative_path.lower() or s in a.repo_name.lower()]
    return assets

@router.get("/inventory/{asset_id:path}")
def get_asset_detail(asset_id: str):
    """Retrieve deep structure, AST tasks, git churn, and executions for a specific asset."""
    asset = next((a for a in orchestrator.cached_assets if a.id == asset_id), None)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # Also attach blast radius simulation
    impact = BlastRadiusEngine.simulate_blast_impact(asset.id, orchestrator.cached_assets)
    return {
        "asset": asset,
        "impact_simulation": impact
    }

@router.get("/duplicates", response_model=List[DuplicateCluster])
def get_duplicate_clusters():
    """Retrieve duplicate and divergent functionality clusters across repositories."""
    return orchestrator.cached_clusters

@router.get("/duplicates/{cluster_id}")
def get_duplicate_cluster_detail(cluster_id: str):
    """Get granular parameter comparison and side-by-side diffs for a duplicate cluster."""
    cluster = next((c for c in orchestrator.cached_clusters if c.cluster_id == cluster_id), None)
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")

    # Gather matching task pairs with parameter diffs
    matching_pairs = [
        p for p in orchestrator.cached_pairs
        if any(v["task_id"] in [p.task_a.id, p.task_b.id] for v in cluster.variants)
    ]

    return {
        "cluster": cluster,
        "detailed_pairs": matching_pairs
    }

@router.get("/blast-radius", response_model=BlastRadiusGraph)
def get_blast_radius_graph():
    """Get the full cross-project DAG of playbooks, roles, and tasks with blast scores."""
    if not orchestrator.cached_graph:
        orchestrator.cached_graph = BlastRadiusEngine.calculate_dependencies_and_blast_radius(orchestrator.cached_assets)
    return orchestrator.cached_graph

@router.get("/blast-radius/simulate")
def simulate_blast_radius(asset_id: str = Query(..., description="Target Asset ID")):
    """Simulate change impact on downstream projects and environments if this script changes."""
    return BlastRadiusEngine.simulate_blast_impact(asset_id, orchestrator.cached_assets)

@router.get("/risks", response_model=List[RiskFlagItem])
def get_high_risk_assets():
    """Retrieve high-risk assets, prioritizing unmaintained zombie core dependencies."""
    return orchestrator.cached_risks

@router.post("/scan")
def trigger_scan(req: ScanRequest = Body(...)):
    """Trigger a re-scan of specific repositories or reset to demo testbed."""
    if req.use_demo or not req.repos:
        repos = DEFAULT_DEMO_REPOS
        ci_logs = DEMO_CI_LOGS_DIR
    else:
        repos = req.repos
        ci_logs = req.ci_logs

    summary = orchestrator.scan_repositories(repos, ci_logs)
    return {
        "status": "success",
        "message": f"Scanned {len(repos)} repositories successfully.",
        "summary": summary
    }

@router.get("/executions")
def get_execution_insights():
    """List execution health, active script versions, and CI history."""
    runs = []
    for a in orchestrator.cached_assets:
        runs.append({
            "asset_id": a.id,
            "name": a.name,
            "repo": a.repo_name,
            "last_status": a.execution.last_status,
            "days_since_last_run": a.execution.days_since_last_run,
            "last_run_timestamp": a.execution.last_run_timestamp,
            "active_in_production": a.execution.active_in_production,
            "environment": a.execution.last_environment,
            "failure_rate_30d": a.execution.failure_rate_30d,
            "total_runs_30d": a.execution.run_count_30d
        })
    return runs

@router.get("/db/status")
def get_database_status():
    """Retrieve live PostgreSQL connection status, pool metrics, and latency."""
    try:
        from ..db.session import check_db_health
        return check_db_health()
    except Exception as e:
        return {
            "status": "error",
            "connected": False,
            "error": str(e)
        }

@router.get("/scans/history")
def get_scan_history(limit: int = 10):
    """Retrieve historical scan runs to track health score evolution and drift over time."""
    try:
        from ..db.repository import ObservabilityRepository
        history = ObservabilityRepository.get_scan_history(limit=limit)
        return {
            "history": history,
            "count": len(history)
        }
    except Exception as e:
        return {
            "history": [],
            "count": 0,
            "error": str(e)
        }

@router.get("/prisma/status")
def get_prisma_status():
    """Retrieve Prisma Rust Query Engine connection status, latency, and model record counts."""
    try:
        from ..db.prisma_service import PrismaService
        return PrismaService.check_health()
    except Exception as e:
        return {
            "status": "error",
            "orm": "Prisma ORM",
            "connected": False,
            "error": str(e)
        }

@router.get("/prisma/history")
def get_prisma_history(limit: int = 10):
    """Query historical scan runs using Prisma ORM with optimized column selection."""
    try:
        from ..db.prisma_service import PrismaService
        history = PrismaService.get_scan_history(limit=limit)
        return {
            "orm": "Prisma ORM",
            "history": history,
            "count": len(history)
        }
    except Exception as e:
        return {
            "orm": "Prisma ORM",
            "history": [],
            "count": 0,
            "error": str(e)
        }

@router.get("/prisma/risks")
def get_prisma_high_risks(limit: int = 20):
    """Query prioritized high-risk assets using Prisma's indexed filter."""
    try:
        from ..db.prisma_service import PrismaService
        risks = PrismaService.get_high_risk_assets(limit=limit)
        return {
            "orm": "Prisma ORM",
            "assets": risks,
            "count": len(risks)
        }
    except Exception as e:
        return {
            "orm": "Prisma ORM",
            "assets": [],
            "count": 0,
            "error": str(e)
        }

@router.get("/security/summary", response_model=SecurityComplianceSummary)
def get_security_summary():
    """Retrieve security compliance score, letter grade, and rule breakdown."""
    if not orchestrator.cached_security:
        orchestrator.cached_security = SecurityLinter.audit_assets(orchestrator.cached_assets)
    return orchestrator.cached_security

@router.get("/security/findings", response_model=List[SecurityFinding])
def get_security_findings(
    severity: Optional[str] = None,
    rule_id: Optional[str] = None,
    repo: Optional[str] = None
):
    """Filter granular security and compliance findings across playbooks and roles."""
    if not orchestrator.cached_security:
        orchestrator.cached_security = SecurityLinter.audit_assets(orchestrator.cached_assets)
    findings = orchestrator.cached_security.findings
    if severity:
        findings = [f for f in findings if f.severity.value.lower() == severity.lower()]
    if rule_id:
        findings = [f for f in findings if f.rule_id.lower() == rule_id.lower()]
    if repo:
        findings = [f for f in findings if f.repo_name.lower() == repo.lower()]
    return findings

@router.get("/remediation/cluster/{cluster_id}", response_model=CanonicalRemediation)
def get_cluster_remediation(cluster_id: str):
    """Generate consolidated canonical Ansible role YAML, defaults, and Git patch for a cluster."""
    cluster = next((c for c in orchestrator.cached_clusters if c.cluster_id == cluster_id), None)
    if not cluster:
        raise HTTPException(status_code=404, detail="Duplicate cluster not found")
    return RemediationEngine.generate_canonical_role(cluster, orchestrator.cached_assets)

@router.get("/reports/executive")
def get_executive_report(format: str = Query("markdown", description="Format: markdown, html, or json")):
    """Generate an executive compliance & governance audit report."""
    if not orchestrator.cached_summary:
        orchestrator.scan_repositories(DEFAULT_DEMO_REPOS, DEMO_CI_LOGS_DIR)
    if not orchestrator.cached_security:
        orchestrator.cached_security = SecurityLinter.audit_assets(orchestrator.cached_assets)

    if format.lower() == "html":
        html_content = ReportGenerator.generate_html(
            orchestrator.cached_summary,
            orchestrator.cached_risks,
            orchestrator.cached_clusters,
            orchestrator.cached_security
        )
        return HTMLResponse(content=html_content)
    elif format.lower() == "json":
        return {
            "summary": orchestrator.cached_summary,
            "security": orchestrator.cached_security,
            "top_risks": orchestrator.cached_risks[:10],
            "duplicate_clusters": orchestrator.cached_clusters
        }
    else:
        md_content = ReportGenerator.generate_markdown(
            orchestrator.cached_summary,
            orchestrator.cached_risks,
            orchestrator.cached_clusters,
            orchestrator.cached_security
        )
        return PlainTextResponse(content=md_content, media_type="text/markdown")

@router.post("/gate/check", response_model=QualityGateResult)
def evaluate_quality_gate(config: QualityGateConfig = Body(default_factory=QualityGateConfig)):
    """Evaluate CI/CD Quality Gate policies against the current inventory."""
    if not orchestrator.cached_summary:
        orchestrator.scan_repositories(DEFAULT_DEMO_REPOS, DEMO_CI_LOGS_DIR)
    if not orchestrator.cached_security:
        orchestrator.cached_security = SecurityLinter.audit_assets(orchestrator.cached_assets)

    summary = orchestrator.cached_summary
    sec = orchestrator.cached_security
    violations = []
    recommendations = []

    # Check 1: Health score
    if summary.overall_health_score < config.min_health_score:
        violations.append(
            f"Overall health score {summary.overall_health_score} is below required threshold {config.min_health_score}."
        )
        recommendations.append("Address duplicate clusters and unmaintained core roles to raise health score.")

    # Check 2: Security score
    if sec.overall_score < config.min_security_score:
        violations.append(
            f"Security compliance score {sec.overall_score} ({sec.grade}) is below required threshold {config.min_security_score}."
        )
        recommendations.append(f"Remediate {sec.critical_count} critical and {sec.high_count} high severity security findings.")

    # Check 3: Zombie core assets
    if config.fail_on_zombies and summary.zombie_core_assets_count > 0:
        violations.append(
            f"Detected {summary.zombie_core_assets_count} Zombie Core asset(s) with high downstream blast radius and stale commits."
        )
        recommendations.append("Assign active maintainers to Zombie Core roles or consolidate with canonical alternatives.")

    # Check 4: Critical risks
    crit_risks = sum(1 for r in orchestrator.cached_risks if r.risk_level == RiskLevel.CRITICAL)
    if crit_risks > config.max_critical_risks:
        violations.append(f"Found {crit_risks} critical risk item(s), exceeding allowed limit of {config.max_critical_risks}.")

    # Check 5: Duplicate clusters
    if summary.duplicate_clusters_count > config.max_duplicate_clusters:
        violations.append(
            f"Found {summary.duplicate_clusters_count} duplicate clusters, exceeding threshold of {config.max_duplicate_clusters}."
        )

    passed = len(violations) == 0

    return QualityGateResult(
        passed=passed,
        health_score=summary.overall_health_score,
        security_score=sec.overall_score,
        zombie_count=summary.zombie_core_assets_count,
        critical_risk_count=crit_risks,
        duplicate_count=summary.duplicate_clusters_count,
        violations=violations,
        recommendations=recommendations
    )

