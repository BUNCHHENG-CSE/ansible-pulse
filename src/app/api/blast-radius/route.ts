import { NextResponse } from 'next/server';
import { orchestrator } from '@/lib/scanner/orchestrator';
import { BlastRadiusEngine } from '@/lib/analytics/blast-radius';

export async function GET() {
  orchestrator.ensureInitialized();
  if (!orchestrator.cachedGraph) {
    orchestrator.cachedGraph = BlastRadiusEngine.calculateDependenciesAndBlastRadius(orchestrator.cachedAssets);
  }
  return NextResponse.json(orchestrator.cachedGraph);
}
