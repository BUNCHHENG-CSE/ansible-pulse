#!/usr/bin/env python3
"""
TCT AnsiblePulse CLI - Read-Only Observability & Blast Radius Intelligence Layer
for Fragmented Ansible & IaC Repositories.
"""
import os
import sys
import argparse
import json
from pathlib import Path
from typing import List

# Ensure backend package is in python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from backend.app.scanner.orchestrator import ObservabilityOrchestrator
from backend.app.analytics.blast_radius import BlastRadiusEngine
from backend.app.analytics.security_linter import SecurityLinter
from backend.app.analytics.remediation_engine import RemediationEngine
from backend.app.analytics.report_generator import ReportGenerator

def get_demo_paths():
    base_dir = os.path.abspath(os.path.dirname(__file__))
    demo_dir = os.path.join(base_dir, "demo_repos")
    repos = [
        os.path.join(demo_dir, "platform-core-infra"),
        os.path.join(demo_dir, "ecommerce-frontend"),
        os.path.join(demo_dir, "data-pipeline-k8s"),
        os.path.join(demo_dir, "payments-gateway"),
    ]
    ci_log_dir = os.path.join(demo_dir, "ci_logs")
    return [r for r in repos if os.path.exists(r)], ci_log_dir

def cmd_scan(args):
    orchestrator = ObservabilityOrchestrator()
    if args.demo:
        repos, ci_log_dir = get_demo_paths()
    else:
        repos = args.repos
        ci_log_dir = args.ci_logs

    if not repos:
        print("[!] Error: No repositories specified. Use --demo or provide --repos <path1> <path2>...")
        sys.exit(1)

    print(f"\n[*] Scanning {len(repos)} repositories with TCT AnsiblePulse...")
    summary = orchestrator.scan_repositories(repos, ci_log_dir)

    if args.json:
        print(json.dumps(summary.model_dump(), indent=2))
        return

    print("\n" + "=" * 65)
    print("           TCT ANSIBLEPULSE OBSERVABILITY AUDIT REPORT")
    print("=" * 65)
    print(f" Scan Completed        : {summary.last_scan_time}")
    print(f" Overall Health Score  : {summary.overall_health_score} / 100")
    print(f" Repositories Scanned  : {summary.total_repos_scanned}")
    print(f" Playbooks Found       : {summary.total_playbooks}")
    print(f" Roles Discovered      : {summary.total_roles}")
    print(f" Total Structured Tasks: {summary.total_tasks}")
    print("-" * 65)
    print(f" [!] High Risk Assets  : {summary.high_risk_assets_count}")
    print(f" [!] Zombie Core Assets: {summary.zombie_core_assets_count} (High Blast Radius + Unmaintained)")
    print(f" [~] Duplicate Clusters: {summary.duplicate_clusters_count} functional groups ({summary.duplicate_tasks_count} task pairs)")
    print("=" * 65)

    print("\n[+] TOP HIGH RISK ASSETS:")
    for item in orchestrator.cached_risks[:5]:
        print(f"  * [{item.risk_level.upper()}] {item.asset_name} ({item.repo_name})")
        print(f"    - Risk Reason   : {item.primary_risk_flag}")
        print(f"    - Blast Radius  : {item.blast_radius} dependent playbooks/services")
        print(f"    - Staleness     : {item.staleness_days} days since last commit")
        print(f"    - Last Run      : {item.last_execution_status.value.upper()}")
        print(f"    - Recommendation: {item.suggested_action}\n")

    print("[+] DUPLICATE & DIVERGENT SCRIPT CLUSTERS:")
    for cluster in orchestrator.cached_clusters:
        print(f"  * {cluster.functionality_name} (Similarity: {int(cluster.similarity_score * 100)}%)")
        print(f"    - Variants: {len(cluster.variants)} implementations across teams")
        print(f"    - Divergence: {cluster.divergence_summary}")
        print(f"    - Recommended Canonical: {cluster.canonical_recommendation}\n")

def cmd_risks(args):
    orchestrator = ObservabilityOrchestrator()
    repos, ci_log_dir = get_demo_paths() if args.demo else (args.repos, args.ci_logs)
    orchestrator.scan_repositories(repos, ci_log_dir)

    print("\n" + "=" * 60)
    print("             HIGH-RISK ASSET REGISTRY")
    print("=" * 60)
    for r in orchestrator.cached_risks:
        badge = f"[{r.risk_level.value.upper()}]"
        print(f"{badge:10} {r.asset_name:25} Repo: {r.repo_name}")
        print(f"           Flag: {r.primary_risk_flag}")
        print(f"           Blast Radius: {r.blast_radius} | Unmaintained: {r.staleness_days} days")
        print(f"           Action: {r.suggested_action}")
        print("-" * 60)

def cmd_blast_radius(args):
    orchestrator = ObservabilityOrchestrator()
    repos, ci_log_dir = get_demo_paths() if args.demo else (args.repos, args.ci_logs)
    orchestrator.scan_repositories(repos, ci_log_dir)

    if not args.asset:
        print("\nAvailable Assets:")
        for a in orchestrator.cached_assets:
            print(f"  - {a.id} (Blast: {a.blast_radius_score}, Staleness: {a.git.days_since_last_commit}d)")
        return

    impact = BlastRadiusEngine.simulate_blast_impact(args.asset, orchestrator.cached_assets)
    print(json.dumps(impact, indent=2))

def cmd_serve(args):
    import uvicorn
    print(f"\n[*] Starting TCT AnsiblePulse API & UI Server on http://{args.host}:{args.port}")
    uvicorn.run("backend.app.main:app", host=args.host, port=args.port, reload=args.reload)

def cmd_db_status(args):
    from backend.app.db.session import check_db_health
    status = check_db_health()
    print("\n" + "=" * 60)
    print("         POSTGRESQL DATABASE HEALTH & POOL STATUS")
    print("=" * 60)
    print(f" Status        : {status.get('status', 'unknown').upper()}")
    print(f" Connected     : {status.get('connected')}")
    print(f" Database URL  : {status.get('database_url')}")
    if status.get("connected"):
        print(f" Engine/Dialect: {status.get('dialect')}")
        print(f" Latency       : {status.get('latency_ms')} ms")
        print(f" Version       : {status.get('version')}")
        pool = status.get("pool", {})
        print(f" Pool Size     : {pool.get('size')} (Checked-in: {pool.get('checkedin')}, Checked-out: {pool.get('checkedout')})")
    else:
        print(f" Error         : {status.get('error')}")
    print("=" * 60 + "\n")

def cmd_db_history(args):
    from backend.app.db.repository import ObservabilityRepository
    history = ObservabilityRepository.get_scan_history(limit=args.limit)
    print("\n" + "=" * 70)
    print("             HISTORICAL SCAN AUDITS (POSTGRESQL)")
    print("=" * 70)
    if not history:
        print("  No scan history recorded in PostgreSQL yet.")
    for h in history:
        print(f" [{h['created_at']}] Scan ID: {h['scan_id'][:8]}... Health: {h['health_score']}/100")
        print(f"   Repos: {h['total_repos']} | Playbooks: {h['total_playbooks']} | Roles: {h['total_roles']} | Tasks: {h['total_tasks']}")
        print(f"   Zombies: {h['zombie_core_assets']} | High Risk: {h['high_risk_assets']} | Duplicate Groups: {h['duplicate_clusters']}")
        print("-" * 70)
    print("")

def cmd_prisma_status(args):
    from backend.app.db.prisma_service import PrismaService
    health = PrismaService.check_health()
    print("\n" + "=" * 65)
    print("           PRISMA ORM & RUST QUERY ENGINE STATUS")
    print("=" * 65)
    print(f" Status        : {health.get('status', 'unknown').upper()}")
    print(f" ORM           : {health.get('orm')}")
    print(f" Connected     : {health.get('connected')}")
    print(f" Query Latency : {health.get('latency_ms')} ms")
    print(f" Engine Binary : {health.get('engine')}")
    if health.get("counts"):
        c = health["counts"]
        print("-" * 65)
        print(" Model Record Counts (PostgreSQL):")
        print(f"   • Scan Runs          : {c.get('scan_runs')}")
        print(f"   • Registered Assets  : {c.get('assets')}")
        print(f"   • Indexed Tasks      : {c.get('tasks')}")
        print(f"   • Duplicate Clusters : {c.get('duplicate_clusters')}")
        print(f"   • Risk Flag Registry : {c.get('risk_flags')}")
    elif health.get("error"):
        print(f" Error         : {health.get('error')}")
    print("=" * 65 + "\n")

def cmd_prisma_history(args):
    from backend.app.db.prisma_service import PrismaService
    history = PrismaService.get_scan_history(limit=args.limit)
    print("\n" + "=" * 70)
    print("           PRISMA ORM: HISTORICAL AUDITS (OPTIMIZED QUERY)")
    print("=" * 70)
    if not history:
        print("  No scan history recorded via Prisma yet.")
    for h in history:
        print(f" [{h['created_at']}] Scan ID: {h['scan_id'][:8]}... Health: {h['health_score']}/100")
        print(f"   Repos: {h['total_repos']} | Playbooks: {h['total_playbooks']} | Roles: {h['total_roles']} | Tasks: {h['total_tasks']}")
        print(f"   Zombies: {h['zombie_core_assets']} | High Risk: {h['high_risk_assets']} | Duplicate Groups: {h['duplicate_clusters']}")
        print("-" * 70)
    print("")

def cmd_prisma_risks(args):
    from backend.app.db.prisma_service import PrismaService
    risks = PrismaService.get_high_risk_assets(limit=args.limit)
    print("\n" + "=" * 70)
    print("         PRISMA ORM: INDEXED HIGH-RISK ASSETS QUERY")
    print("=" * 70)
    for r in risks:
        print(f" [{r['risk_level'].upper()}] {r['name']} ({r['repo_name']})")
        print(f"   Score: {r['risk_score']} | Blast Radius: {r['blast_radius']} dependents | Tasks: {r['tasks_count']}")
        print("-" * 70)
    print("")

def cmd_prisma_studio(args):
    import subprocess
    print("\n[*] Starting Prisma Studio on http://localhost:5555 ...")
    subprocess.run([sys.executable, "-m", "prisma", "studio", "--port", str(args.port)])

def cmd_security(args):
    orchestrator = ObservabilityOrchestrator()
    repos, ci_log_dir = get_demo_paths() if args.demo else (args.repos, args.ci_logs)
    orchestrator.scan_repositories(repos, ci_log_dir)
    sec = orchestrator.cached_security or SecurityLinter.audit_assets(orchestrator.cached_assets)

    print("\n" + "=" * 65)
    print("       TCT ANSIBLEPULSE SECURITY & BEST-PRACTICE COMPLIANCE")
    print("=" * 65)
    print(f" Security Compliance Score: {sec.overall_score} / 100 (Grade: {sec.grade})")
    print(f" Total Violations Detected: {sec.total_findings}")
    print(f" Critical: {sec.critical_count} | High: {sec.high_count} | Medium: {sec.medium_count} | Low: {sec.low_count}")
    print("-" * 65)

    if not sec.findings:
        print(" [OK] No security anti-patterns detected. Great job!")
    else:
        for f in sec.findings:
            badge = f"[{f.severity.value.upper()}]"
            print(f" {badge:10} {f.title}")
            print(f"            Rule    : {f.rule_id} in {f.repo_name}::{f.file_path}:{f.line_number}")
            if f.offending_snippet:
                print(f"            Offender: {f.offending_snippet}")
            print(f"            Fix     : {f.remediation_advice}\n")
    print("=" * 65 + "\n")

def cmd_remediate(args):
    orchestrator = ObservabilityOrchestrator()
    repos, ci_log_dir = get_demo_paths() if args.demo else (args.repos, args.ci_logs)
    orchestrator.scan_repositories(repos, ci_log_dir)

    if not orchestrator.cached_clusters:
        print("[!] No duplicate clusters found to remediate.")
        return

    target_cluster = None
    if args.cluster:
        target_cluster = next((c for c in orchestrator.cached_clusters if c.cluster_id == args.cluster or args.cluster.lower() in c.functionality_name.lower()), None)
    if not target_cluster:
        target_cluster = orchestrator.cached_clusters[0]

    remediation = RemediationEngine.generate_canonical_role(target_cluster, orchestrator.cached_assets)

    print("\n" + "=" * 70)
    print(f"  TCT ANSIBLEPULSE AUTOMATED CANONICAL REMEDIATION: {remediation.functionality_name.upper()}")
    print("=" * 70)
    print(f" Suggested Role Name : {remediation.suggested_role_name}")
    print(f" Consolidated Repos  : {', '.join(remediation.impacted_repos)}")
    print(f" Variable Overrides  : {', '.join(remediation.consolidated_variables) or 'None'}")
    print("-" * 70)

    print("\n--- [tasks/main.yml] ---")
    print(remediation.canonical_task_yaml)

    print("--- [defaults/main.yml] ---")
    print(remediation.defaults_yaml)

    print("--- [Unified Git Refactoring Patch] ---")
    print(remediation.git_patch_diff)

    if args.output_dir:
        out_path = Path(args.output_dir)
        role_tasks_dir = out_path / remediation.suggested_role_name / "tasks"
        role_defaults_dir = out_path / remediation.suggested_role_name / "defaults"
        role_tasks_dir.mkdir(parents=True, exist_ok=True)
        role_defaults_dir.mkdir(parents=True, exist_ok=True)

        with open(role_tasks_dir / "main.yml", "w", encoding="utf-8") as f:
            f.write(remediation.canonical_task_yaml)
        with open(role_defaults_dir / "main.yml", "w", encoding="utf-8") as f:
            f.write(remediation.defaults_yaml)
        with open(out_path / f"{remediation.suggested_role_name}.patch", "w", encoding="utf-8") as f:
            f.write(remediation.git_patch_diff)

        print(f"[OK] Exported canonical role files and patch to: {out_path.resolve()}\n")

def cmd_report(args):
    orchestrator = ObservabilityOrchestrator()
    repos, ci_log_dir = get_demo_paths() if args.demo else (args.repos, args.ci_logs)
    summary = orchestrator.scan_repositories(repos, ci_log_dir)
    sec = orchestrator.cached_security or SecurityLinter.audit_assets(orchestrator.cached_assets)

    fmt = (args.format or "markdown").lower()
    if fmt == "html":
        content = ReportGenerator.generate_html(summary, orchestrator.cached_risks, orchestrator.cached_clusters, sec)
    elif fmt == "json":
        content = json.dumps({
            "summary": summary.model_dump(),
            "security": sec.model_dump(),
            "risks": [r.model_dump() for r in orchestrator.cached_risks],
            "duplicate_clusters": [c.model_dump() for c in orchestrator.cached_clusters]
        }, indent=2)
    else:
        content = ReportGenerator.generate_markdown(summary, orchestrator.cached_risks, orchestrator.cached_clusters, sec)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[OK] Executive audit report ({fmt}) written to: {args.output}")
    else:
        print(content)

def cmd_gate(args):
    orchestrator = ObservabilityOrchestrator()
    repos, ci_log_dir = get_demo_paths() if args.demo else (args.repos, args.ci_logs)
    summary = orchestrator.scan_repositories(repos, ci_log_dir)
    sec = orchestrator.cached_security or SecurityLinter.audit_assets(orchestrator.cached_assets)

    violations = []
    if summary.overall_health_score < args.min_health:
        violations.append(f"Fleet health score {summary.overall_health_score} < minimum {args.min_health}")
    if sec.overall_score < args.min_security:
        violations.append(f"Security score {sec.overall_score} ({sec.grade}) < minimum {args.min_security}")
    if not args.allow_zombies and summary.zombie_core_assets_count > 0:
        violations.append(f"Detected {summary.zombie_core_assets_count} unmaintained Zombie Core dependency asset(s)")
    if summary.duplicate_clusters_count > args.max_duplicates:
        violations.append(f"Detected {summary.duplicate_clusters_count} duplicate clusters > max allowed {args.max_duplicates}")

    print("\n" + "=" * 65)
    print("             TCT ANSIBLEPULSE CI/CD QUALITY GATE")
    print("=" * 65)
    print(f" Fleet Health Score   : {summary.overall_health_score} (Threshold: {args.min_health})")
    print(f" Security Score       : {sec.overall_score} [{sec.grade}] (Threshold: {args.min_security})")
    print(f" Zombie Core Assets   : {summary.zombie_core_assets_count} (Allowed: {'Ignored' if args.allow_zombies else '0'})")
    print(f" Duplicate Clusters   : {summary.duplicate_clusters_count} (Threshold: {args.max_duplicates})")
    print("-" * 65)

    if violations:
        print(" [FAILED] QUALITY GATE FAILED! The following policies were violated:")
        for v in violations:
            print(f"      - {v}")
        print("\n [!] Fix the issues above or adjust threshold policies in your CI/CD configuration.")
        print("=" * 65 + "\n")
        sys.exit(1)
    else:
        print(" [PASSED] QUALITY GATE PASSED! All infrastructure governance policies met.")
        print("=" * 65 + "\n")
        sys.exit(0)


def main():
    parser = argparse.ArgumentParser(
        description="TCT AnsiblePulse - Observability Layer for Fragmented Ansible & IaC Scripts"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # scan
    p_scan = subparsers.add_parser("scan", help="Scan playbooks and roles for fragmentation and risks")
    p_scan.add_argument("--repos", nargs="+", default=[], help="Paths to repository root directories")
    p_scan.add_argument("--ci-logs", default=None, help="Directory containing CI logs or execution JSONs")
    p_scan.add_argument("--demo", action="store_true", help="Scan built-in realistic multi-repo testbed")
    p_scan.add_argument("--json", action="store_true", help="Output raw JSON results")
    p_scan.set_defaults(func=cmd_scan)

    # risks
    p_risks = subparsers.add_parser("risks", help="Display prioritized high-risk script assets")
    p_risks.add_argument("--repos", nargs="+", default=[])
    p_risks.add_argument("--ci-logs", default=None)
    p_risks.add_argument("--demo", action="store_true")
    p_risks.set_defaults(func=cmd_risks)

    # blast-radius
    p_blast = subparsers.add_parser("blast-radius", help="Calculate blast radius and simulate change impact")
    p_blast.add_argument("--asset", default=None, help="Asset ID to inspect")
    p_blast.add_argument("--repos", nargs="+", default=[])
    p_blast.add_argument("--ci-logs", default=None)
    p_blast.add_argument("--demo", action="store_true")
    p_blast.set_defaults(func=cmd_blast_radius)

    # serve
    p_serve = subparsers.add_parser("serve", help="Launch the Web Dashboard and REST API")
    p_serve.add_argument("--host", default="127.0.0.1", help="Host interface")
    p_serve.add_argument("--port", type=int, default=8000, help="Port to bind")
    p_serve.add_argument("--reload", action="store_true", help="Enable live auto-reload")
    p_serve.set_defaults(func=cmd_serve)

    # db-status
    p_db = subparsers.add_parser("db-status", help="Check PostgreSQL connection, pool stats, and latency")
    p_db.set_defaults(func=cmd_db_status)

    # db-history
    p_hist = subparsers.add_parser("db-history", help="List historical scan runs persisted in PostgreSQL")
    p_hist.add_argument("--limit", type=int, default=10, help="Max history rows to show")
    p_hist.set_defaults(func=cmd_db_history)

    # prisma-status
    p_prisma_stat = subparsers.add_parser("prisma-status", help="Check Prisma Rust query engine health & model record counts")
    p_prisma_stat.set_defaults(func=cmd_prisma_status)

    # prisma-history
    p_prisma_hist = subparsers.add_parser("prisma-history", help="List historical scan audits via Prisma ORM optimized query")
    p_prisma_hist.add_argument("--limit", type=int, default=10, help="Max history rows to show")
    p_prisma_hist.set_defaults(func=cmd_prisma_history)

    # prisma-risks
    p_prisma_risk = subparsers.add_parser("prisma-risks", help="Query high-risk assets using Prisma indexed filter")
    p_prisma_risk.add_argument("--limit", type=int, default=15, help="Max high-risk assets to show")
    p_prisma_risk.set_defaults(func=cmd_prisma_risks)

    # prisma-studio
    p_prisma_stu = subparsers.add_parser("prisma-studio", help="Launch Prisma Studio web UI to visually explore PostgreSQL data")
    p_prisma_stu.add_argument("--port", type=int, default=5555, help="Port to bind Prisma Studio")
    p_prisma_stu.set_defaults(func=cmd_prisma_studio)

    # security
    p_sec = subparsers.add_parser("security", help="Audit playbooks for hardcoded secrets, insecure perms, and anti-patterns")
    p_sec.add_argument("--repos", nargs="+", default=[])
    p_sec.add_argument("--ci-logs", default=None)
    p_sec.add_argument("--demo", action="store_true")
    p_sec.set_defaults(func=cmd_security)

    # remediate
    p_rem = subparsers.add_parser("remediate", help="Generate canonical consolidated role and Git patch for duplicates")
    p_rem.add_argument("--cluster", default=None, help="Cluster ID or name to remediate")
    p_rem.add_argument("--output-dir", default=None, help="Directory to export canonical role files and patch")
    p_rem.add_argument("--repos", nargs="+", default=[])
    p_rem.add_argument("--ci-logs", default=None)
    p_rem.add_argument("--demo", action="store_true")
    p_rem.set_defaults(func=cmd_remediate)

    # report
    p_rep = subparsers.add_parser("report", help="Generate executive audit report in markdown, HTML, or JSON")
    p_rep.add_argument("--format", choices=["markdown", "html", "json"], default="markdown")
    p_rep.add_argument("--output", default=None, help="File path to save the generated report")
    p_rep.add_argument("--repos", nargs="+", default=[])
    p_rep.add_argument("--ci-logs", default=None)
    p_rep.add_argument("--demo", action="store_true")
    p_rep.set_defaults(func=cmd_report)

    # gate
    p_gate = subparsers.add_parser("gate", help="Evaluate CI/CD Quality Gate policies (returns exit code 0 or 1)")
    p_gate.add_argument("--min-health", type=float, default=70.0, help="Minimum fleet health score required")
    p_gate.add_argument("--min-security", type=float, default=70.0, help="Minimum security score required")
    p_gate.add_argument("--allow-zombies", action="store_true", default=False, help="Do not fail build if Zombie Core assets exist")
    p_gate.add_argument("--max-duplicates", type=int, default=10, help="Maximum allowed duplicate clusters")
    p_gate.add_argument("--repos", nargs="+", default=[])
    p_gate.add_argument("--ci-logs", default=None)
    p_gate.add_argument("--demo", action="store_true")
    p_gate.set_defaults(func=cmd_gate)

    parsed = parser.parse_args()
    parsed.func(parsed)

if __name__ == "__main__":
    main()
