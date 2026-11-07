import { NextRequest, NextResponse } from 'next/server';
import { orchestrator } from '@/lib/scanner/orchestrator';

export async function GET(request: NextRequest) {
  orchestrator.ensureInitialized();
  const searchParams = request.nextUrl.searchParams;
  const repo = searchParams.get('repo');
  const assetType = searchParams.get('asset_type');
  const riskLevel = searchParams.get('risk_level');
  const search = searchParams.get('search');

  let assets = orchestrator.cachedAssets;

  if (repo) {
    assets = assets.filter(a => a.repo_name.toLowerCase() === repo.toLowerCase());
  }
  if (assetType) {
    assets = assets.filter(a => a.asset_type === assetType);
  }
  if (riskLevel) {
    assets = assets.filter(a => a.risk_level === riskLevel);
  }
  if (search) {
    const s = search.toLowerCase();
    assets = assets.filter(a =>
      a.name.toLowerCase().includes(s) ||
      a.relative_path.toLowerCase().includes(s) ||
      a.repo_name.toLowerCase().includes(s)
    );
  }

  return NextResponse.json(assets);
}
