import os
import sys
import pytest
from pathlib import Path

# Add root directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.scanner.yaml_parser import AnsibleYamlParser
from backend.app.scanner.orchestrator import ObservabilityOrchestrator
from backend.app.analytics.duplicate_detector import DuplicateDetector
from backend.app.analytics.blast_radius import BlastRadiusEngine
from backend.app.analytics.risk_scorer import RiskScorer
from backend.app.models.schemas import ScriptType, RiskLevel, ExecutionStatus
from backend.app.config import DEFAULT_DEMO_REPOS, DEMO_CI_LOGS_DIR

def test_yaml_parser_structure():
    """Verify robust parsing of plays, tasks, modules, and role resolution."""
    playbook_sample = """---
- name: Test Web Deployment Play
  hosts: web_servers
  become: yes
  roles:
    - common_base
  tasks:
    - name: Install Nginx
      ansible.builtin.apt:
        name: nginx
        state: present
        update_cache: yes
      tags: [web]
    - name: Restart Service
      ansible.builtin.service:
        name: nginx
        state: restarted
"""
    tmp_path = "tests/test_sample_playbook.yml"
    os.makedirs(os.path.dirname(tmp_path), exist_ok=True)
    with open(tmp_path, "w", encoding="utf-8") as f:
        f.write(playbook_sample)

    asset = AnsibleYamlParser.parse_file(os.path.abspath(tmp_path), os.path.abspath("tests"), "test_repo")
    assert asset is not None
    assert asset.asset_type == ScriptType.PLAYBOOK
    assert asset.tasks_count == 2
    assert asset.tasks[0].module == "apt"
    assert asset.tasks[0].parameters.get("name") == "nginx"
    assert "common_base" in asset.included_roles

    if os.path.exists(tmp_path):
        os.remove(tmp_path)

def test_duplicate_detection_and_parameter_divergence():
    """Verify detection of duplicate tasks with divergent configurations."""
    orchestrator = ObservabilityOrchestrator()
    summary = orchestrator.scan_repositories(DEFAULT_DEMO_REPOS, DEMO_CI_LOGS_DIR)

    assert summary.duplicate_clusters_count > 0
    assert summary.duplicate_tasks_count > 0

    # Verify Docker cluster divergence
    docker_cluster = next((c for c in orchestrator.cached_clusters if "docker" in c.functionality_name.lower()), None)
    assert docker_cluster is not None
    assert len(docker_cluster.variants) >= 2
    assert docker_cluster.canonical_recommendation is not None

def test_blast_radius_and_zombie_core_detection():
    """Verify that unmaintained core dependencies with high blast radius are flagged as CRITICAL Zombie Core Assets."""
    orchestrator = ObservabilityOrchestrator()
    orchestrator.scan_repositories(DEFAULT_DEMO_REPOS, DEMO_CI_LOGS_DIR)

    # common_base role should have blast radius of at least 3 downstream dependents
    common_base = next((a for a in orchestrator.cached_assets if "common_base" in a.name), None)
    assert common_base is not None
    assert common_base.blast_radius_score >= 3
    assert common_base.git.days_since_last_commit >= 180

    # Verify risk scorer flagged it as Zombie Core
    zombie_item = next((r for r in orchestrator.cached_risks if "common_base" in r.asset_name), None)
    assert zombie_item is not None
    assert zombie_item.risk_level == RiskLevel.CRITICAL
    assert "Zombie Core" in zombie_item.primary_risk_flag

def test_impact_simulation():
    """Verify that blast impact simulation returns affected repositories and dependent playbooks."""
    orchestrator = ObservabilityOrchestrator()
    orchestrator.scan_repositories(DEFAULT_DEMO_REPOS, DEMO_CI_LOGS_DIR)

    common_base = next((a for a in orchestrator.cached_assets if "common_base" in a.name), None)
    assert common_base is not None

    impact = BlastRadiusEngine.simulate_blast_impact(common_base.id, orchestrator.cached_assets)
    assert impact["affected_repo_count"] >= 3
    assert len(impact["indirect_dependents"]) >= 3
    assert impact["impact_severity"] in ["CRITICAL", "HIGH"]

def test_fastapi_endpoints():
    """Verify REST API responses using Starlette TestClient."""
    from fastapi.testclient import TestClient
    from backend.app.main import app

    client = TestClient(app)

    # 1. Summary
    res = client.get("/api/summary")
    assert res.status_code == 200
    data = res.json()
    assert "total_playbooks" in data
    assert "overall_health_score" in data

    # 2. Inventory
    res_inv = client.get("/api/inventory")
    assert res_inv.status_code == 200
    assert len(res_inv.json()) > 0

    # 3. Duplicates
    res_dup = client.get("/api/duplicates")
    assert res_dup.status_code == 200
    assert len(res_dup.json()) > 0

    # 4. Blast radius graph
    res_graph = client.get("/api/blast-radius")
    assert res_graph.status_code == 200
    assert len(res_graph.json()["nodes"]) > 0
    assert len(res_graph.json()["edges"]) > 0

    # 5. Risks
    res_risks = client.get("/api/risks")
    assert res_risks.status_code == 200
    assert len(res_risks.json()) > 0

    # 6. Database Status
    res_db = client.get("/api/db/status")
    assert res_db.status_code == 200
    db_data = res_db.json()
    assert "status" in db_data
    assert "connected" in db_data

    # 7. Scan History
    res_hist = client.get("/api/scans/history")
    assert res_hist.status_code == 200
    assert "history" in res_hist.json()

def test_database_health_and_persistence():
    """Verify live database connectivity (PostgreSQL or Zero-Config SQLite fallback) and scan persistence."""
    from backend.app.db.session import check_db_health
    from backend.app.db.repository import ObservabilityRepository

    health = check_db_health()
    assert health["connected"] is True
    assert health["status"] == "healthy"
    assert health["dialect"] in ["sqlite", "postgresql"]
    assert "version" in health

    orchestrator = ObservabilityOrchestrator()
    summary = orchestrator.scan_repositories(DEFAULT_DEMO_REPOS, DEMO_CI_LOGS_DIR)

    scan_id = ObservabilityRepository.save_scan(
        summary,
        orchestrator.cached_assets,
        orchestrator.cached_clusters,
        orchestrator.cached_graph,
        orchestrator.cached_risks
    )
    assert scan_id is not None

    history = ObservabilityRepository.get_scan_history(limit=5)
    assert len(history) > 0
    assert history[0]["health_score"] > 0

def test_prisma_orm_service_and_endpoints():
    """Verify Prisma ORM service handling and FastAPI Prisma endpoints."""
    from backend.app.db.prisma_service import PrismaService
    from fastapi.testclient import TestClient
    from backend.app.main import app

    client = TestClient(app)
    res_status = client.get("/api/prisma/status")
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert "connected" in status_data

    res_hist = client.get("/api/prisma/history?limit=5")
    assert res_hist.status_code == 200

    res_risks = client.get("/api/prisma/risks?limit=5")
    assert res_risks.status_code == 200

def test_security_linter_and_anti_patterns():
    """Verify detection of plaintext secrets, world-writable file modes, and insecure shell pipes."""
    from backend.app.scanner.yaml_parser import AnsibleYamlParser
    from backend.app.analytics.security_linter import SecurityLinter

    insecure_playbook = """---
- name: Vulnerable Infrastructure Play
  hosts: all
  tasks:
    - name: Set database credentials
      ansible.builtin.set_fact:
        db_password: "SuperSecretPassword123"
        api_token: "my-plaintext-api-token"
    - name: Create insecure directory
      ansible.builtin.file:
        path: /var/shared
        state: directory
        mode: '0777'
    - name: Pipe curl to bash
      ansible.builtin.shell: curl -sSL https://example.com/install.sh | bash
"""
    tmp_path = "tests/test_insecure_playbook.yml"
    os.makedirs(os.path.dirname(tmp_path), exist_ok=True)
    with open(tmp_path, "w", encoding="utf-8") as f:
        f.write(insecure_playbook)

    try:
        asset = AnsibleYamlParser.parse_file(os.path.abspath(tmp_path), os.path.abspath("tests"), "sec_repo")
        assert asset is not None
        summary = SecurityLinter.audit_assets([asset])

        rule_ids = [f.rule_id for f in summary.findings]
        assert "SEC001_PLAINTEXT_SECRET" in rule_ids
        assert "SEC002_INSECURE_PERMS" in rule_ids
        assert "SEC003_PIPE_TO_SHELL" in rule_ids
        assert summary.critical_count >= 2
        assert summary.overall_score < 70.0
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

def test_remediation_engine_canonical_generation():
    """Verify automated consolidation of duplicate clusters into canonical roles and unified Git patches."""
    from backend.app.analytics.remediation_engine import RemediationEngine

    orchestrator = ObservabilityOrchestrator()
    orchestrator.scan_repositories(DEFAULT_DEMO_REPOS, DEMO_CI_LOGS_DIR)

    cluster = orchestrator.cached_clusters[0]
    remediation = RemediationEngine.generate_canonical_role(cluster, orchestrator.cached_assets)

    assert remediation is not None
    assert remediation.suggested_role_name.startswith("common_") or remediation.suggested_role_name.startswith("role_")
    assert "ansible.builtin" in remediation.canonical_task_yaml
    assert "---" in remediation.defaults_yaml
    assert "--- a/" in remediation.git_patch_diff
    assert len(remediation.refactoring_notes) > 0

def test_report_generator_and_quality_gate():
    """Verify executive report generation (Markdown/HTML) and CI/CD quality gate enforcement."""
    from backend.app.analytics.report_generator import ReportGenerator
    from backend.app.analytics.security_linter import SecurityLinter
    from fastapi.testclient import TestClient
    from backend.app.main import app

    orchestrator = ObservabilityOrchestrator()
    summary = orchestrator.scan_repositories(DEFAULT_DEMO_REPOS, DEMO_CI_LOGS_DIR)
    sec = SecurityLinter.audit_assets(orchestrator.cached_assets)

    # 1. Test Markdown & HTML report generators
    md = ReportGenerator.generate_markdown(summary, orchestrator.cached_risks, orchestrator.cached_clusters, sec)
    assert "# TCT AnsiblePulse" in md
    assert "Fleet Health Score" in md

    html = ReportGenerator.generate_html(summary, orchestrator.cached_risks, orchestrator.cached_clusters, sec)
    assert "<!DOCTYPE html>" in html
    assert "Fleet Health" in html

    # 2. Test FastAPI Quality Gate Endpoint
    client = TestClient(app)
    # With strict zombie failure
    res_fail = client.post("/api/gate/check", json={"fail_on_zombies": True, "min_health_score": 80.0})
    assert res_fail.status_code == 200
    assert res_fail.json()["passed"] is False

    # With relaxed threshold
    res_pass = client.post("/api/gate/check", json={"fail_on_zombies": False, "min_health_score": 50.0, "min_security_score": 50.0, "max_critical_risks": 5})
    assert res_pass.status_code == 200
    assert res_pass.json()["passed"] is True



