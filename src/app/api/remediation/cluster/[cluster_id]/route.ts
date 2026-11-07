import { NextRequest, NextResponse } from 'next/server';
import { orchestrator } from '@/lib/scanner/orchestrator';
import { RemediationEngine } from '@/lib/analytics/remediation-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cluster_id: string }> }
) {
  orchestrator.ensureInitialized();
  const { cluster_id } = await params;

  const cluster = orchestrator.cachedClusters.find(c => c.cluster_id === cluster_id);
  if (!cluster) {
    return NextResponse.json({ error: 'Duplicate cluster not found' }, { status: 404 });
  }

  const remediation = RemediationEngine.generateCanonicalRole(cluster, orchestrator.cachedAssets);
  return NextResponse.json(remediation);
}
