import { NextRequest, NextResponse } from 'next/server';
import { orchestrator } from '@/lib/scanner/orchestrator';
import { BlastRadiusEngine } from '@/lib/analytics/blast-radius';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string[] }> }
) {
  orchestrator.ensureInitialized();
  const resolvedParams = await params;
  const assetId = decodeURIComponent(resolvedParams.id.join('/'));

  const asset = orchestrator.cachedAssets.find(a => a.id === assetId || a.id.endsWith(assetId));
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const impact = BlastRadiusEngine.simulateBlastImpact(asset.id, orchestrator.cachedAssets);

  return NextResponse.json({
    asset,
    impact_simulation: impact
  });
}
