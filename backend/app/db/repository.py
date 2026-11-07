import uuid
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, select, func

from .session import _SessionFactory, _is_connected, init_db_engine
from .models import (
    ScanRunModel, AssetModel, TaskModel,
    DuplicateClusterModel, BlastEdgeModel, RiskFlagModel
)
from ..models.schemas import (
    ObservabilitySummary, AnsibleAsset, AnsibleTask, DuplicateCluster,
    BlastRadiusGraph, BlastRadiusNode, BlastRadiusEdge, RiskFlagItem,
    ScriptType, RiskLevel, ExecutionStatus, GitMetadata, ExecutionMetadata
)

class ObservabilityRepository:
    @staticmethod
    def is_db_available() -> bool:
        global _is_connected
        if not _is_connected:
            init_db_engine()
        return _is_connected

    @classmethod
    def save_scan(
        cls,
        summary: ObservabilitySummary,
        assets: List[AnsibleAsset],
        clusters: List[DuplicateCluster],
        graph: Optional[BlastRadiusGraph],
        risks: List[RiskFlagItem]
    ) -> Optional[str]:
        """Persist an entire scan run and all indexed assets into PostgreSQL inside a single transaction."""
        if not cls.is_db_available() or not _SessionFactory:
            return None

        scan_id = str(uuid.uuid4())
        session: Session = _SessionFactory()

        try:
            # 1. Create ScanRun
            scan_run = ScanRunModel(
                id=scan_id,
                created_at=datetime.now(timezone.utc),
                total_repos_scanned=summary.total_repos_scanned,
                total_playbooks=summary.total_playbooks,
                total_roles=summary.total_roles,
                total_tasks=summary.total_tasks,
                duplicate_clusters_count=summary.duplicate_clusters_count,
                duplicate_tasks_count=summary.duplicate_tasks_count,
                high_risk_assets_count=summary.high_risk_assets_count,
                zombie_core_assets_count=summary.zombie_core_assets_count,
                diverged_forks_count=summary.diverged_forks_count,
                overall_health_score=summary.overall_health_score,
                status="completed"
            )
            session.add(scan_run)
            session.flush()

            # 2. Bulk Add Assets and Tasks
            asset_models = []
            task_models = []

            for a in assets:
                db_asset_id = f"{scan_id}::{a.id}"
                asset_models.append(AssetModel(
                    id=db_asset_id,
                    scan_id=scan_id,
                    name=a.name,
                    repo_name=a.repo_name,
                    relative_path=a.relative_path,
                    full_path=a.full_path,
                    asset_type=a.asset_type.value,
                    tasks_count=a.tasks_count,
                    target_hosts=a.target_hosts,
                    blast_radius_score=a.blast_radius_score,
                    downstream_dependents=a.downstream_dependents,
                    upstream_dependencies=a.upstream_dependencies,
                    risk_level=a.risk_level.value,
                    risk_score=a.risk_score,
                    risk_flags=a.risk_flags,
                    git_metadata=a.git.model_dump(),
                    execution_metadata=a.execution.model_dump()
                ))

                for t in a.tasks:
                    task_models.append(TaskModel(
                        id=f"{scan_id}::{t.id}",
                        scan_id=scan_id,
                        asset_id=db_asset_id,
                        name=t.name,
                        module=t.module,
                        parameters=t.parameters,
                        line_number=t.line_number,
                        when_condition=t.when,
                        tags=t.tags,
                        notify=t.notify,
                        normalized_signature=t.normalized_signature
                    ))

            session.bulk_save_objects(asset_models)
            session.flush()
            session.bulk_save_objects(task_models)

            # 3. Bulk Add Duplicate Clusters
            cluster_models = []
            for c in clusters:
                cluster_models.append(DuplicateClusterModel(
                    id=f"{scan_id}::{c.cluster_id}",
                    scan_id=scan_id,
                    cluster_id=c.cluster_id,
                    functionality_name=c.functionality_name,
                    primary_module=c.primary_module,
                    similarity_score=c.similarity_score,
                    canonical_recommendation=c.canonical_recommendation,
                    variants=c.variants,
                    divergence_summary=c.divergence_summary,
                    risk_assessment=c.risk_assessment
                ))
            session.bulk_save_objects(cluster_models)

            # 4. Bulk Add Blast Edges
            if graph and graph.edges:
                edge_models = []
                for e in graph.edges:
                    edge_models.append(BlastEdgeModel(
                        scan_id=scan_id,
                        source_id=e.source,
                        target_id=e.target,
                        edge_relationship=e.relationship
                    ))
                session.bulk_save_objects(edge_models)

            # 5. Bulk Add Risk Flags
            risk_models = []
            for r in risks:
                risk_models.append(RiskFlagModel(
                    scan_id=scan_id,
                    asset_id=r.asset_id,
                    asset_name=r.asset_name,
                    repo_name=r.repo_name,
                    asset_type=r.asset_type.value,
                    risk_level=r.risk_level.value,
                    risk_score=r.risk_score,
                    blast_radius=r.blast_radius,
                    staleness_days=r.staleness_days,
                    authors_count=r.authors_count,
                    last_execution_status=r.last_execution_status.value,
                    primary_risk_flag=r.primary_risk_flag,
                    detailed_reasons=r.detailed_reasons,
                    suggested_action=r.suggested_action
                ))
            session.bulk_save_objects(risk_models)

            session.commit()
            return scan_id

        except Exception as e:
            session.rollback()
            print(f"[!] Error persisting scan to PostgreSQL: {e}")
            return None
        finally:
            session.close()

    @classmethod
    def get_scan_history(cls, limit: int = 10) -> List[Dict[str, Any]]:
        """Retrieve recent scan runs to track health trends and drift evolution."""
        if not cls.is_db_available() or not _SessionFactory:
            return []

        session: Session = _SessionFactory()
        try:
            runs = (
                session.query(ScanRunModel)
                .order_by(desc(ScanRunModel.created_at))
                .limit(limit)
                .all()
            )
            return [
                {
                    "scan_id": r.id,
                    "created_at": r.created_at.strftime("%Y-%m-%d %H:%M:%S UTC"),
                    "total_repos": r.total_repos_scanned,
                    "total_playbooks": r.total_playbooks,
                    "total_roles": r.total_roles,
                    "total_tasks": r.total_tasks,
                    "duplicate_clusters": r.duplicate_clusters_count,
                    "high_risk_assets": r.high_risk_assets_count,
                    "zombie_core_assets": r.zombie_core_assets_count,
                    "health_score": r.overall_health_score,
                    "status": r.status
                }
                for r in runs
            ]
        finally:
            session.close()

    @classmethod
    def get_latest_scan_id(cls) -> Optional[str]:
        if not cls.is_db_available() or not _SessionFactory:
            return None
        session: Session = _SessionFactory()
        try:
            latest = session.query(ScanRunModel.id).order_by(desc(ScanRunModel.created_at)).first()
            return latest[0] if latest else None
        finally:
            session.close()
