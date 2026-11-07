import type {
  ObservabilitySummary, AnsibleAsset, DuplicateCluster,
  BlastRadiusGraph, RiskFlagItem, ImpactSimulation,
  SecurityComplianceSummary, SecurityFinding, CanonicalRemediation,
  QualityGateResult
} from './types';

const API_BASE = '/api';

export async function fetchSummary(): Promise<ObservabilitySummary> {
  const res = await fetch(`${API_BASE}/summary`);
  if (!res.ok) throw new Error('Failed to fetch summary');
  return res.json();
}

export async function fetchInventory(params?: {
  repo?: string;
  asset_type?: string;
  risk_level?: string;
  search?: string;
}): Promise<AnsibleAsset[]> {
  const query = new URLSearchParams();
  if (params?.repo) query.set('repo', params.repo);
  if (params?.asset_type) query.set('asset_type', params.asset_type);
  if (params?.risk_level) query.set('risk_level', params.risk_level);
  if (params?.search) query.set('search', params.search);

  const res = await fetch(`${API_BASE}/inventory?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch inventory');
  return res.json();
}

export async function fetchAssetDetail(assetId: string): Promise<{ asset: AnsibleAsset; impact_simulation: ImpactSimulation }> {
  const res = await fetch(`${API_BASE}/inventory/${encodeURIComponent(assetId)}`);
  if (!res.ok) throw new Error('Failed to fetch asset detail');
  return res.json();
}

export async function fetchDuplicates(): Promise<DuplicateCluster[]> {
  const res = await fetch(`${API_BASE}/duplicates`);
  if (!res.ok) throw new Error('Failed to fetch duplicates');
  return res.json();
}

export async function fetchDuplicateDetail(clusterId: string): Promise<{ cluster: DuplicateCluster; detailed_pairs: any[] }> {
  const res = await fetch(`${API_BASE}/duplicates/${clusterId}`);
  if (!res.ok) throw new Error('Failed to fetch duplicate cluster detail');
  return res.json();
}

export async function fetchBlastRadiusGraph(): Promise<BlastRadiusGraph> {
  const res = await fetch(`${API_BASE}/blast-radius`);
  if (!res.ok) throw new Error('Failed to fetch blast radius graph');
  return res.json();
}

export async function simulateImpact(assetId: string): Promise<ImpactSimulation> {
  const res = await fetch(`${API_BASE}/blast-radius/simulate?asset_id=${encodeURIComponent(assetId)}`);
  if (!res.ok) throw new Error('Failed to simulate blast radius');
  return res.json();
}

export async function fetchRisks(): Promise<RiskFlagItem[]> {
  const res = await fetch(`${API_BASE}/risks`);
  if (!res.ok) throw new Error('Failed to fetch risks');
  return res.json();
}

export async function triggerScan(useDemo = true): Promise<any> {
  const res = await fetch(`${API_BASE}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ use_demo: useDemo })
  });
  if (!res.ok) throw new Error('Failed to trigger scan');
  return res.json();
}

export async function fetchDbStatus(): Promise<import('./types').DbStatus> {
  const res = await fetch(`${API_BASE}/db/status`);
  if (!res.ok) throw new Error('Failed to fetch database status');
  return res.json();
}

export async function fetchScanHistory(limit = 10): Promise<{ history: import('./types').ScanHistoryItem[]; count: number }> {
  const res = await fetch(`${API_BASE}/scans/history?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch scan history');
  return res.json();
}

export async function fetchSecuritySummary(): Promise<SecurityComplianceSummary> {
  const res = await fetch(`${API_BASE}/security/summary`);
  if (!res.ok) throw new Error('Failed to fetch security summary');
  return res.json();
}

export async function fetchSecurityFindings(params?: {
  severity?: string;
  rule_id?: string;
  repo?: string;
}): Promise<SecurityFinding[]> {
  const query = new URLSearchParams();
  if (params?.severity) query.set('severity', params.severity);
  if (params?.rule_id) query.set('rule_id', params.rule_id);
  if (params?.repo) query.set('repo', params.repo);

  const res = await fetch(`${API_BASE}/security/findings?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch security findings');
  return res.json();
}

export async function fetchRemediation(clusterId: string): Promise<CanonicalRemediation> {
  const res = await fetch(`${API_BASE}/remediation/cluster/${encodeURIComponent(clusterId)}`);
  if (!res.ok) throw new Error('Failed to fetch canonical remediation');
  return res.json();
}

export async function fetchExecutiveReport(format: 'markdown' | 'html' | 'json' = 'markdown'): Promise<string | any> {
  const res = await fetch(`${API_BASE}/reports/executive?format=${format}`);
  if (!res.ok) throw new Error('Failed to fetch executive report');
  if (format === 'json') return res.json();
  return res.text();
}

export async function evaluateQualityGate(config?: any): Promise<QualityGateResult> {
  const res = await fetch(`${API_BASE}/gate/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config || {})
  });
  if (!res.ok) throw new Error('Failed to evaluate quality gate');
  return res.json();
}

