import { NextResponse } from 'next/server';
import { orchestrator } from '@/lib/scanner/orchestrator';
import { SecurityLinter } from '@/lib/analytics/security-linter';

export async function GET() {
  orchestrator.ensureInitialized();
  if (!orchestrator.cachedSecurity) {
    orchestrator.cachedSecurity = SecurityLinter.auditAssets(orchestrator.cachedAssets);
  }
  return NextResponse.json(orchestrator.cachedSecurity);
}
