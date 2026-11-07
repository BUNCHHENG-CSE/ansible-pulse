import { NextRequest, NextResponse } from 'next/server';
import { orchestrator } from '@/lib/scanner/orchestrator';
import { SecurityLinter } from '@/lib/analytics/security-linter';

export async function GET(request: NextRequest) {
  orchestrator.ensureInitialized();
  if (!orchestrator.cachedSecurity) {
    orchestrator.cachedSecurity = SecurityLinter.auditAssets(orchestrator.cachedAssets);
  }

  const searchParams = request.nextUrl.searchParams;
  const severity = searchParams.get('severity');
  const ruleId = searchParams.get('rule_id');
  const repo = searchParams.get('repo');

  let findings = orchestrator.cachedSecurity.findings;

  if (severity) {
    findings = findings.filter(f => f.severity.toLowerCase() === severity.toLowerCase());
  }
  if (ruleId) {
    findings = findings.filter(f => f.rule_id.toLowerCase() === ruleId.toLowerCase());
  }
  if (repo) {
    findings = findings.filter(f => f.repo_name.toLowerCase() === repo.toLowerCase());
  }

  return NextResponse.json(findings);
}
