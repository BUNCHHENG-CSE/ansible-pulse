import { NextRequest, NextResponse } from 'next/server';
import { orchestrator } from '@/lib/scanner/orchestrator';
import { BlastRadiusEngine } from '@/lib/analytics/blast-radius';

export async function GET(request: NextRequest) {
  orchestrator.ensureInitialized();
  const assetId = request.nextUrl.searchParams.get('asset_id');
  if (!assetId) {
    return NextResponse.json({ error: 'asset_id query parameter is required' }, { status: 400 });
  }

  const result = BlastRadiusEngine.simulateBlastImpact(assetId, orchestrator.cachedAssets);
  return NextResponse.json(result);
}
