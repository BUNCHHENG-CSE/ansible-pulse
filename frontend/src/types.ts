export type ScriptType = 'playbook' | 'role' | 'task_file' | 'handler_file' | 'vars_file';
export type ExecutionStatus = 'success' | 'changed' | 'failed' | 'unreachable' | 'never_run';
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface GitMetadata {
  last_commit_date: string | null;
  days_since_last_commit: number;
  total_commits: number;
  commits_last_90d: number;
  authors: string[];
  author_count: number;
  churn_lines_added: number;
  churn_lines_deleted: number;
  staleness_score: number;
}

export interface ExecutionMetadata {
  last_run_timestamp: string | null;
  days_since_last_run: number | null;
  last_status: ExecutionStatus;
  run_count_30d: number;
  failure_rate_30d: number;
  active_in_production: boolean;
  last_environment: string | null;
  recent_hosts_targeted: string[];
}

export interface AnsibleTask {
  id: string;
  name: string;
  module: string;
  parameters: Record<string, any>;
  file_path: string;
  line_number: number;
  when: string | null;
  tags: string[];
  notify: string[];
  normalized_signature: string;
}

export interface AnsibleAsset {
  id: string;
  name: string;
  repo_name: string;
  relative_path: string;
  full_path: string;
  asset_type: ScriptType;
  tasks_count: number;
  tasks: AnsibleTask[];
  included_roles: string[];
  included_tasks: string[];
  imported_playbooks: string[];
  target_hosts: string | null;
  git: GitMetadata;
  execution: ExecutionMetadata;
  blast_radius_score: number;
  downstream_dependents: string[];
  upstream_dependencies: string[];
  risk_level: RiskLevel;
  risk_score: number;
  risk_flags: string[];
}

export interface ParameterDiff {
  param_name: string;
  status: 'differing_value' | 'only_in_a' | 'only_in_b';
  val_a: any;
  val_b: any;
}

export interface DuplicateVariant {
  task_id: string;
  task_name: string;
  module: string;
  file_path: string;
  repo_name: string;
  parameters: Record<string, any>;
  tags: string[];
}

export interface DuplicateCluster {
  cluster_id: string;
  functionality_name: string;
  primary_module: string;
  similarity_score: number;
  canonical_recommendation: string | null;
  variants: DuplicateVariant[];
  divergence_summary: string;
  risk_assessment: string;
}

export interface BlastRadiusNode {
  id: string;
  label: string;
  repo: string;
  type: ScriptType;
  blast_radius: number;
  staleness_days: number;
  risk_level: RiskLevel;
  last_status: ExecutionStatus;
}

export interface BlastRadiusEdge {
  source: string;
  target: string;
  relationship: string;
}

export interface BlastRadiusGraph {
  nodes: BlastRadiusNode[];
  edges: BlastRadiusEdge[];
}

export interface RiskFlagItem {
  asset_id: string;
  asset_name: string;
  repo_name: string;
  asset_type: ScriptType;
  risk_level: RiskLevel;
  risk_score: number;
  blast_radius: number;
  staleness_days: number;
  authors_count: number;
  last_execution_status: ExecutionStatus;
  primary_risk_flag: string;
  detailed_reasons: string[];
  suggested_action: string;
}

export interface ObservabilitySummary {
  total_repos_scanned: number;
  total_playbooks: number;
  total_roles: number;
  total_tasks: number;
  duplicate_clusters_count: number;
  duplicate_tasks_count: number;
  high_risk_assets_count: number;
  zombie_core_assets_count: number;
  diverged_forks_count: number;
  overall_health_score: number;
  security_compliance_score?: number;
  security_findings_count?: number;
  last_scan_time: string;
}

export interface ImpactSimulation {
  target_asset: {
    id: string;
    name: string;
    repo: string;
    staleness_days: number;
    blast_radius_score: number;
  };
  impact_severity: string;
  affected_repo_count: number;
  affected_repos: string[];
  affected_environments: string[];
  direct_dependents: { id: string; name: string; repo: string; type: string }[];
  indirect_dependents: { id: string; name: string; repo: string; type: string }[];
  recommendation: string;
}

export interface DbStatus {
  status: string;
  connected: boolean;
  dialect?: string;
  version?: string;
  latency_ms?: number;
  active_connections?: number;
  database_url?: string;
  pool?: {
    size: number;
    checkedin?: number;
    checkedout?: number;
    overflow?: number;
    total?: number;
  };
  error?: string;
}

export interface ScanHistoryItem {
  scan_id: string;
  created_at: string;
  total_repos: number;
  total_playbooks: number;
  total_roles: number;
  total_tasks: number;
  duplicate_clusters: number;
  high_risk_assets: number;
  zombie_core_assets: number;
  health_score: number;
  status: string;
}

export interface SecurityFinding {
  id: string;
  rule_id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  asset_id: string;
  repo_name: string;
  file_path: string;
  line_number: number;
  task_name?: string;
  module?: string;
  offending_snippet?: string;
  remediation_advice: string;
}

export interface SecurityComplianceSummary {
  overall_score: number;
  grade: string;
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  rule_breakdown: Record<string, number>;
  findings: SecurityFinding[];
}

export interface CanonicalRemediation {
  cluster_id: string;
  functionality_name: string;
  suggested_role_name: string;
  canonical_task_yaml: string;
  defaults_yaml: string;
  git_patch_diff: string;
  consolidated_variables: string[];
  impacted_repos: string[];
  refactoring_notes: string[];
}

export interface QualityGateResult {
  passed: boolean;
  health_score: number;
  security_score: number;
  zombie_count: number;
  critical_risk_count: number;
  duplicate_count: number;
  violations: string[];
  recommendations: string[];
}

