from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum

class ScriptType(str, Enum):
    PLAYBOOK = "playbook"
    ROLE = "role"
    TASK_FILE = "task_file"
    HANDLER_FILE = "handler_file"
    VARS_FILE = "vars_file"

class ExecutionStatus(str, Enum):
    SUCCESS = "success"
    CHANGED = "changed"
    FAILED = "failed"
    UNREACHABLE = "unreachable"
    NEVER_RUN = "never_run"

class RiskLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class AnsibleTask(BaseModel):
    id: str
    name: str
    module: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    file_path: str
    line_number: int = 1
    when: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    notify: List[str] = Field(default_factory=list)
    normalized_signature: str = ""

class GitMetadata(BaseModel):
    last_commit_date: Optional[str] = None
    days_since_last_commit: int = 0
    total_commits: int = 0
    commits_last_90d: int = 0
    authors: List[str] = Field(default_factory=list)
    author_count: int = 0
    churn_lines_added: int = 0
    churn_lines_deleted: int = 0
    staleness_score: float = 0.0  # 0.0 = very fresh, 1.0 = stale (>180 days)

class ExecutionMetadata(BaseModel):
    last_run_timestamp: Optional[str] = None
    days_since_last_run: Optional[int] = None
    last_status: ExecutionStatus = ExecutionStatus.NEVER_RUN
    run_count_30d: int = 0
    failure_rate_30d: float = 0.0
    active_in_production: bool = False
    last_environment: Optional[str] = None
    recent_hosts_targeted: List[str] = Field(default_factory=list)

class AnsibleAsset(BaseModel):
    id: str
    name: str
    repo_name: str
    relative_path: str
    full_path: str
    asset_type: ScriptType
    tasks_count: int = 0
    tasks: List[AnsibleTask] = Field(default_factory=list)
    included_roles: List[str] = Field(default_factory=list)
    included_tasks: List[str] = Field(default_factory=list)
    imported_playbooks: List[str] = Field(default_factory=list)
    target_hosts: Optional[str] = None
    git: GitMetadata = Field(default_factory=GitMetadata)
    execution: ExecutionMetadata = Field(default_factory=ExecutionMetadata)
    blast_radius_score: int = 0  # Number of dependent playbooks / services
    downstream_dependents: List[str] = Field(default_factory=list)
    upstream_dependencies: List[str] = Field(default_factory=list)
    risk_level: RiskLevel = RiskLevel.LOW
    risk_score: float = 0.0  # 0 to 100
    risk_flags: List[str] = Field(default_factory=list)

class ParameterDiff(BaseModel):
    param_name: str
    status: str  # "differing_value", "only_in_a", "only_in_b"
    val_a: Any
    val_b: Any

class DuplicateTaskPair(BaseModel):
    task_a: AnsibleTask
    task_b: AnsibleTask
    repo_a: str
    repo_b: str
    similarity_score: float  # 0.0 - 1.0
    divergence_reason: str
    parameter_diffs: List[ParameterDiff] = Field(default_factory=list)

class DuplicateCluster(BaseModel):
    cluster_id: str
    functionality_name: str
    primary_module: str
    similarity_score: float  # e.g. 0.88 (88%)
    canonical_recommendation: Optional[str] = None
    variants: List[Dict[str, Any]] = Field(default_factory=list)
    divergence_summary: str = ""
    risk_assessment: str = ""

class BlastRadiusNode(BaseModel):
    id: str
    label: str
    repo: str
    type: ScriptType
    blast_radius: int
    staleness_days: int
    risk_level: RiskLevel
    last_status: ExecutionStatus

class BlastRadiusEdge(BaseModel):
    source: str
    target: str
    relationship: str  # "includes_role", "imports_playbook", "includes_task"

class BlastRadiusGraph(BaseModel):
    nodes: List[BlastRadiusNode]
    edges: List[BlastRadiusEdge]

class RiskFlagItem(BaseModel):
    asset_id: str
    asset_name: str
    repo_name: str
    asset_type: ScriptType
    risk_level: RiskLevel
    risk_score: float
    blast_radius: int
    staleness_days: int
    authors_count: int
    last_execution_status: ExecutionStatus
    primary_risk_flag: str
    detailed_reasons: List[str]
    suggested_action: str

class ObservabilitySummary(BaseModel):
    total_repos_scanned: int
    total_playbooks: int
    total_roles: int
    total_tasks: int
    duplicate_clusters_count: int
    duplicate_tasks_count: int
    high_risk_assets_count: int
    zombie_core_assets_count: int  # High blast radius + unmaintained
    diverged_forks_count: int
    overall_health_score: float  # 0 to 100
    security_compliance_score: float = 100.0  # 0 to 100
    security_findings_count: int = 0
    last_scan_time: str

class SecuritySeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class SecurityFinding(BaseModel):
    id: str
    rule_id: str
    severity: SecuritySeverity
    title: str
    description: str
    asset_id: str
    repo_name: str
    file_path: str
    line_number: int = 1
    task_name: Optional[str] = None
    module: Optional[str] = None
    offending_snippet: Optional[str] = None
    remediation_advice: str

class SecurityComplianceSummary(BaseModel):
    overall_score: float  # 0 to 100
    grade: str  # A, B, C, D, F
    total_findings: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    rule_breakdown: Dict[str, int] = Field(default_factory=dict)
    findings: List[SecurityFinding] = Field(default_factory=list)

class CanonicalRemediation(BaseModel):
    cluster_id: str
    functionality_name: str
    suggested_role_name: str
    canonical_task_yaml: str
    defaults_yaml: str
    git_patch_diff: str
    consolidated_variables: List[str] = Field(default_factory=list)
    impacted_repos: List[str] = Field(default_factory=list)
    refactoring_notes: List[str] = Field(default_factory=list)

class QualityGateConfig(BaseModel):
    min_health_score: float = 70.0
    min_security_score: float = 70.0
    fail_on_zombies: bool = True
    max_critical_risks: int = 0
    max_duplicate_clusters: int = 10

class QualityGateResult(BaseModel):
    passed: bool
    health_score: float
    security_score: float
    zombie_count: int
    critical_risk_count: int
    duplicate_count: int
    violations: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)

