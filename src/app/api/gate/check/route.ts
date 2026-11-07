import { NextRequest, NextResponse } from 'next/server';
import { orchestrator } from '@/lib/scanner/orchestrator';
import { SecurityLinter } from '@/lib/analytics/security-linter';
import type { QualityGateConfig, QualityGateResult } from '@/lib/types';

export async function POST(request: NextRequest) {
  orchestrator.ensureInitialized();
  if (!orchestrator.cachedSecurity) {
    orchestrator.cachedSecurity = SecurityLinter.auditAssets(orchestrator.cachedAssets);
  }

  const config: QualityGateConfig = await request.json().catch(() => ({}));
  const minHealth = config.min_health_score ?? 75.0;
  const minSec = config.min_security_score ?? 80.0;
  const failOnZombies = config.fail_on_zombies ?? true;
  const maxCrit = config.max_critical_risks ?? 0;
  const maxDup = config.max_duplicate_clusters ?? 10;

  const summary = orchestrator.cachedSummary!;
  const sec = orchestrator.cachedSecurity;
  const violations: string[] = [];
  const recommendations: string[] = [];

  // Check 1: Health score
  if (summary.overall_health_score < minHealth) {
    violations.push(`Overall health score ${summary.overall_health_score} is below required threshold ${minHealth}.`);
    recommendations.push('Address duplicate clusters and unmaintained core roles to raise health score.');
  }

  // Check 2: Security score
  if (sec.overall_score < minSec) {
    violations.push(`Security compliance score ${sec.overall_score} (${sec.grade}) is below required threshold ${minSec}.`);
    recommendations.push(`Remediate ${sec.critical_count} critical and ${sec.high_count} high severity security findings.`);
  }

  // Check 3: Zombie core assets
  if (failOnZombies && summary.zombie_core_assets_count > 0) {
    violations.push(`Detected ${summary.zombie_core_assets_count} Zombie Core asset(s) with high downstream blast radius and stale commits.`);
    recommendations.push('Assign active maintainers to Zombie Core roles or consolidate with canonical alternatives.');
  }

  // Check 4: Critical risks
  const critRisks = orchestrator.cachedRisks.filter(r => r.risk_level === 'critical').length;
  if (critRisks > maxCrit) {
    violations.push(`Found ${critRisks} critical risk item(s), exceeding allowed limit of ${maxCrit}.`);
  }

  // Check 5: Duplicate clusters
  if (summary.duplicate_clusters_count > maxDup) {
    violations.push(`Found ${summary.duplicate_clusters_count} duplicate clusters, exceeding threshold of ${maxDup}.`);
  }

  const passed = violations.length === 0;

  const result: QualityGateResult = {
    passed,
    health_score: summary.overall_health_score,
    security_score: sec.overall_score,
    zombie_count: summary.zombie_core_assets_count,
    critical_risk_count: critRisks,
    duplicate_count: summary.duplicate_clusters_count,
    violations,
    recommendations
  };

  return NextResponse.json(result);
}
