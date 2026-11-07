import { NextResponse } from 'next/server';
import { orchestrator } from '@/lib/scanner/orchestrator';

export async function GET() {
  orchestrator.ensureInitialized();
  const runs = orchestrator.cachedAssets.map(a => ({
    asset_id: a.id,
    name: a.name,
    repo: a.repo_name,
    last_status: a.execution.last_status,
    days_since_last_run: a.execution.days_since_last_run,
    last_run_timestamp: a.execution.last_run_timestamp,
    active_in_production: a.execution.active_in_production,
    environment: a.execution.last_environment,
    failure_rate_30d: a.execution.failure_rate_30d,
    total_runs_30d: a.execution.run_count_30d
  }));

  return NextResponse.json(runs);
}
