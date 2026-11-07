import { NextRequest, NextResponse } from 'next/server';
import { orchestrator } from '@/lib/scanner/orchestrator';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cluster_id: string }> }
) {
  orchestrator.ensureInitialized();
  const { cluster_id } = await params;

  const cluster = orchestrator.cachedClusters.find(c => c.cluster_id === cluster_id);
  if (!cluster) {
    return NextResponse.json({ error: 'Cluster not found' }, { status: 404 });
  }

  const variantTaskIds = new Set(cluster.variants.map(v => v.task_id));
  const matchingPairs = orchestrator.cachedPairs.filter(p =>
    variantTaskIds.has(p.task_a.id) || variantTaskIds.has(p.task_b.id)
  );

  return NextResponse.json({
    cluster,
    detailed_pairs: matchingPairs
  });
}
