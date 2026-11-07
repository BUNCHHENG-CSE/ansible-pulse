import os
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple
from pathlib import Path

from ..models.schemas import (
    AnsibleAsset, DuplicateCluster, DuplicateTaskPair,
    BlastRadiusGraph, RiskFlagItem, ObservabilitySummary,
    ScriptType, RiskLevel
)
from .yaml_parser import AnsibleYamlParser
from .git_miner import GitMiner
from .ci_log_parser import CILogParser
from ..analytics.duplicate_detector import DuplicateDetector
from ..analytics.blast_radius import BlastRadiusEngine
from ..analytics.risk_scorer import RiskScorer
from ..analytics.security_linter import SecurityLinter
from ..models.schemas import SecurityComplianceSummary

class ObservabilityOrchestrator:
    def __init__(self, log_directory: Optional[str] = None):
        self.ci_parser = CILogParser(log_directory)
        self.cached_assets: List[AnsibleAsset] = []
        self.cached_clusters: List[DuplicateCluster] = []
        self.cached_pairs: List[DuplicateTaskPair] = []
        self.cached_graph: Optional[BlastRadiusGraph] = None
        self.cached_risks: List[RiskFlagItem] = []
        self.cached_security: Optional[SecurityComplianceSummary] = None
        self.cached_summary: Optional[ObservabilitySummary] = None
        self.last_scan_time: Optional[str] = None

    def scan_repositories(self, repo_paths: List[str], log_dir: Optional[str] = None) -> ObservabilitySummary:
        """Scan a list of repository roots or subdirectories and build full observability model."""
        if log_dir:
            self.ci_parser.load_execution_history(log_dir)

        discovered_assets: List[AnsibleAsset] = []

        for repo_path in repo_paths:
            if not os.path.exists(repo_path):
                continue
            
            repo_path_abs = os.path.abspath(repo_path)
            repo_name = os.path.basename(repo_path_abs)

            # Walk all .yml / .yaml files
            for root, _, files in os.walk(repo_path_abs):
                for f in files:
                    if f.endswith((".yml", ".yaml")):
                        full_file_path = os.path.join(root, f)
                        asset = AnsibleYamlParser.parse_file(full_file_path, repo_path_abs, repo_name)
                        if asset:
                            # 1. Attach Git metrics
                            asset.git = GitMiner.get_git_metadata(full_file_path, repo_path_abs)
                            
                            # 2. Attach CI/CD execution status
                            asset.execution = self.ci_parser.match_execution_for_asset(
                                asset.relative_path, asset.name
                            )
                            discovered_assets.append(asset)

        self.cached_assets = discovered_assets

        # 3. Compute blast radius and dependencies DAG
        self.cached_graph = BlastRadiusEngine.calculate_dependencies_and_blast_radius(discovered_assets)

        # 4. Detect duplicates and parameter divergences
        clusters, pairs = DuplicateDetector.detect_duplicates(discovered_assets)
        self.cached_clusters = clusters
        self.cached_pairs = pairs

        # 5. Evaluate risk flags and scores
        self.cached_risks = RiskScorer.evaluate_risks(discovered_assets, clusters)

        # 5b. Evaluate Security & Best Practice Compliance
        self.cached_security = SecurityLinter.audit_assets(discovered_assets)

        # 6. Generate Executive Summary
        total_tasks = sum(a.tasks_count for a in discovered_assets)
        total_playbooks = sum(1 for a in discovered_assets if a.asset_type == ScriptType.PLAYBOOK)
        total_roles = sum(1 for a in discovered_assets if a.asset_type == ScriptType.ROLE)
        high_risk_count = sum(1 for a in discovered_assets if a.risk_level in [RiskLevel.CRITICAL, RiskLevel.HIGH])
        zombie_count = sum(1 for r in self.cached_risks if "ZOMBIE_CORE_ASSET" in getattr(r, "primary_risk_flag", "") or "Zombie" in r.primary_risk_flag)
        diverged_count = len(clusters)

        # Health score: 100 minus penalties for zombies, duplicates, failures
        penalty = (zombie_count * 12.0) + (high_risk_count * 5.0) + (diverged_count * 4.0)
        overall_health = max(15.0, round(100.0 - penalty, 1))

        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        self.last_scan_time = now_str

        summary = ObservabilitySummary(
            total_repos_scanned=len(repo_paths),
            total_playbooks=total_playbooks,
            total_roles=total_roles,
            total_tasks=total_tasks,
            duplicate_clusters_count=len(clusters),
            duplicate_tasks_count=len(pairs),
            high_risk_assets_count=high_risk_count,
            zombie_core_assets_count=zombie_count,
            diverged_forks_count=diverged_count,
            overall_health_score=overall_health,
            security_compliance_score=self.cached_security.overall_score if self.cached_security else 100.0,
            security_findings_count=self.cached_security.total_findings if self.cached_security else 0,
            last_scan_time=now_str
        )
        self.cached_summary = summary

        # 7. Persist to PostgreSQL if available
        try:
            from ..db.repository import ObservabilityRepository
            ObservabilityRepository.save_scan(
                summary,
                self.cached_assets,
                self.cached_clusters,
                self.cached_graph,
                self.cached_risks
            )
        except Exception:
            pass

        return summary
