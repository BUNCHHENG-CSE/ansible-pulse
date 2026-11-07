from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, DateTime, Text, JSON,
    ForeignKey, Index, Boolean
)
from sqlalchemy.orm import relationship
from .base import Base

class ScanRunModel(Base):
    __tablename__ = "scan_runs"

    id = Column(String(64), primary_key=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    total_repos_scanned = Column(Integer, default=0)
    total_playbooks = Column(Integer, default=0)
    total_roles = Column(Integer, default=0)
    total_tasks = Column(Integer, default=0)
    duplicate_clusters_count = Column(Integer, default=0)
    duplicate_tasks_count = Column(Integer, default=0)
    high_risk_assets_count = Column(Integer, default=0)
    zombie_core_assets_count = Column(Integer, default=0)
    diverged_forks_count = Column(Integer, default=0)
    overall_health_score = Column(Float, default=100.0)
    status = Column(String(32), default="completed")

    # Relationships
    assets = relationship("AssetModel", back_populates="scan_run", cascade="all, delete-orphan")
    duplicate_clusters = relationship("DuplicateClusterModel", back_populates="scan_run", cascade="all, delete-orphan")
    blast_edges = relationship("BlastEdgeModel", back_populates="scan_run", cascade="all, delete-orphan")
    risk_flags = relationship("RiskFlagModel", back_populates="scan_run", cascade="all, delete-orphan")

class AssetModel(Base):
    __tablename__ = "assets"

    id = Column(String(256), primary_key=True)
    scan_id = Column(String(64), ForeignKey("scan_runs.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String(128), nullable=False)
    repo_name = Column(String(128), index=True, nullable=False)
    relative_path = Column(String(512), nullable=False)
    full_path = Column(String(1024), nullable=False)
    asset_type = Column(String(32), index=True, nullable=False)  # playbook, role, task_file
    tasks_count = Column(Integer, default=0)
    target_hosts = Column(String(256), nullable=True)
    blast_radius_score = Column(Integer, default=0, index=True)
    downstream_dependents = Column(JSON, default=list)
    upstream_dependencies = Column(JSON, default=list)
    risk_level = Column(String(32), default="low", index=True)  # critical, high, medium, low
    risk_score = Column(Float, default=0.0)
    risk_flags = Column(JSON, default=list)
    git_metadata = Column(JSON, default=dict)
    execution_metadata = Column(JSON, default=dict)

    scan_run = relationship("ScanRunModel", back_populates="assets")
    tasks = relationship("TaskModel", back_populates="asset", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_asset_scan_risk", "scan_id", "risk_level"),
        Index("ix_asset_scan_repo", "scan_id", "repo_name"),
        Index("ix_asset_scan_blast", "scan_id", "blast_radius_score"),
    )

class TaskModel(Base):
    __tablename__ = "tasks"

    id = Column(String(256), primary_key=True)
    scan_id = Column(String(64), index=True, nullable=False)
    asset_id = Column(String(256), ForeignKey("assets.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String(256), nullable=False)
    module = Column(String(64), index=True, nullable=False)
    parameters = Column(JSON, default=dict)
    line_number = Column(Integer, default=1)
    when_condition = Column(Text, nullable=True)
    tags = Column(JSON, default=list)
    notify = Column(JSON, default=list)
    normalized_signature = Column(String(256), index=True)

    asset = relationship("AssetModel", back_populates="tasks")

    __table_args__ = (
        Index("ix_task_sig_mod", "normalized_signature", "module"),
        Index("ix_task_scan_mod", "scan_id", "module"),
    )

class DuplicateClusterModel(Base):
    __tablename__ = "duplicate_clusters"

    id = Column(String(256), primary_key=True)
    scan_id = Column(String(64), ForeignKey("scan_runs.id", ondelete="CASCADE"), index=True, nullable=False)
    cluster_id = Column(String(64), nullable=False)
    functionality_name = Column(String(256), nullable=False)
    primary_module = Column(String(64), index=True, nullable=False)
    similarity_score = Column(Float, default=0.0)
    canonical_recommendation = Column(Text, nullable=True)
    variants = Column(JSON, default=list)
    divergence_summary = Column(Text, default="")
    risk_assessment = Column(Text, default="")

    scan_run = relationship("ScanRunModel", back_populates="duplicate_clusters")

class BlastEdgeModel(Base):
    __tablename__ = "blast_edges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scan_id = Column(String(64), ForeignKey("scan_runs.id", ondelete="CASCADE"), index=True, nullable=False)
    source_id = Column(String(256), index=True, nullable=False)
    target_id = Column(String(256), index=True, nullable=False)
    edge_relationship = Column("relationship", String(64), nullable=False)

    scan_run = relationship("ScanRunModel", back_populates="blast_edges")

    __table_args__ = (
        Index("ix_edge_src_tgt", "scan_id", "source_id", "target_id"),
    )

class RiskFlagModel(Base):
    __tablename__ = "risk_flags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scan_id = Column(String(64), ForeignKey("scan_runs.id", ondelete="CASCADE"), index=True, nullable=False)
    asset_id = Column(String(256), index=True, nullable=False)
    asset_name = Column(String(128), nullable=False)
    repo_name = Column(String(128), nullable=False)
    asset_type = Column(String(32), nullable=False)
    risk_level = Column(String(32), index=True, nullable=False)
    risk_score = Column(Float, default=0.0)
    blast_radius = Column(Integer, default=0)
    staleness_days = Column(Integer, default=0)
    authors_count = Column(Integer, default=0)
    last_execution_status = Column(String(32), default="never_run")
    primary_risk_flag = Column(String(256), nullable=False)
    detailed_reasons = Column(JSON, default=list)
    suggested_action = Column(Text, default="")

    scan_run = relationship("ScanRunModel", back_populates="risk_flags")
