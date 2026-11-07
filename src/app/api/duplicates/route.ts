import { NextResponse } from 'next/server';
import { orchestrator } from '@/lib/scanner/orchestrator';

export async function GET() {
  orchestrator.ensureInitialized();
  return NextResponse.json(orchestrator.cachedClusters);
}
