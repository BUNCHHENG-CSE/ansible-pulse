import fs from 'fs';
import path from 'path';
import { AnsibleYamlParser } from './yaml-parser';
import { GitMiner } from './git-miner';
import { CILogParser } from './ci-log-parser';
import { BlastRadiusEngine } from '../analytics/blast-radius';
import { DuplicateDetector } from '../analytics/duplicate-detector';
import { RiskScorer } from '../analytics/risk-scorer';
import { SecurityLinter } from '../analytics/security-linter';
import { prisma } from '../prisma';
import type { Prisma } from '@prisma/client';
import type {
  AnsibleAsset, DuplicateCluster, DuplicateTaskPair,
  BlastRadiusGraph, RiskFlagItem, ObservabilitySummary,
  SecurityComplianceSummary
} from '../types';

export class ObservabilityOrchestrator {
  private ciParser: CILogParser;
  public cachedAssets: AnsibleAsset[] = [];
  public cachedClusters: DuplicateCluster[] = [];
  public cachedPairs: DuplicateTaskPair[] = [];
  public cachedGraph: BlastRadiusGraph | null = null;
  public cachedRisks: RiskFlagItem[] = [];
  public cachedSecurity: SecurityComplianceSummary | null = null;
  public cachedSummary: ObservabilitySummary | null = null;
  public lastScanTime: string | null = null;

  constructor(logDirectory?: string | null) {
    this.ciParser = new CILogParser(logDirectory);
  }

  getDefaultDemoRepos(): string[] {
    const cwd = process.cwd();
    return [
      path.join(cwd, 'demo_repos', 'data-pipeline-k8s'),
      path.join(cwd, 'demo_repos', 'ecommerce-frontend'),
      path.join(cwd, 'demo_repos', 'payments-gateway'),
      path.join(cwd, 'demo_repos', 'platform-core-infra'),
    ];
  }

  getDefaultCILogsDir(): string {
    return path.join(process.cwd(), 'demo_repos', 'ci_logs');
  }

  scanRepositories(repoPaths: string[], logDir?: string | null): ObservabilitySummary {
    if (logDir) {
      this.ciParser.loadExecutionHistory(logDir);
    }

    const discoveredAssets: AnsibleAsset[] = [];

    for (const repoPath of repoPaths) {
      if (!fs.existsSync(repoPath)) continue;
      const repoPathAbs = path.resolve(repoPath);
      const repoName = path.basename(repoPathAbs);

      const walkDir = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
              walkDir(fullPath);
            }
          } else if (entry.isFile()) {
            if (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml')) {
              const asset = AnsibleYamlParser.parseFile(fullPath, repoPathAbs, repoName);
              if (asset) {
                // 1. Attach Git metrics
                asset.git = GitMiner.getGitMetadata(fullPath, repoPathAbs);

                // 2. Attach CI/CD execution status
                asset.execution = this.ciParser.matchExecutionForAsset(
                  asset.relative_path,
                  asset.name
                );

                discoveredAssets.push(asset);
              }
            }
          }
        }
      };

      walkDir(repoPathAbs);
    }

    this.cachedAssets = discoveredAssets;

    // 3. Compute blast radius and dependencies DAG
    this.cachedGraph = BlastRadiusEngine.calculateDependenciesAndBlastRadius(discoveredAssets);

    // 4. Detect duplicates and parameter divergences
    const [clusters, pairs] = DuplicateDetector.detectDuplicates(discoveredAssets);
    this.cachedClusters = clusters;
    this.cachedPairs = pairs;

    // 5. Evaluate risk flags and scores
    this.cachedRisks = RiskScorer.evaluateRisks(discoveredAssets, clusters);

    // 5b. Evaluate Security & Best Practice Compliance
    this.cachedSecurity = SecurityLinter.auditAssets(discoveredAssets);

    // 6. Generate Executive Summary
    const totalTasks = discoveredAssets.reduce((sum, a) => sum + a.tasks_count, 0);
    const totalPlaybooks = discoveredAssets.filter(a => a.asset_type === 'playbook').length;
    const totalRoles = discoveredAssets.filter(a => a.asset_type === 'role').length;
    const highRiskCount = discoveredAssets.filter(a => a.risk_level === 'critical' || a.risk_level === 'high').length;
    const zombieCount = this.cachedRisks.filter(r =>
      r.primary_risk_flag.includes('ZOMBIE_CORE_ASSET') || r.primary_risk_flag.includes('Zombie')
    ).length;
    const divergedCount = clusters.length;

    const penalty = (zombieCount * 12.0) + (highRiskCount * 5.0) + (divergedCount * 4.0);
    const overallHealth = Math.max(15.0, Math.round((100.0 - penalty) * 10) / 10);

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    this.lastScanTime = nowStr;

    const summary: ObservabilitySummary = {
      total_repos_scanned: repoPaths.length,
      total_playbooks: totalPlaybooks,
      total_roles: totalRoles,
      total_tasks: totalTasks,
      duplicate_clusters_count: clusters.length,
      duplicate_tasks_count: pairs.length,
      high_risk_assets_count: highRiskCount,
      zombie_core_assets_count: zombieCount,
      diverged_forks_count: divergedCount,
      overall_health_score: overallHealth,
      security_compliance_score: this.cachedSecurity?.overall_score ?? 100.0,
      security_findings_count: this.cachedSecurity?.total_findings ?? 0,
      last_scan_time: nowStr
    };

    this.cachedSummary = summary;

    // 7. Persist to Prisma asynchronously
    this.persistScanToPrisma(summary).catch(err => {
      console.warn('[Orchestrator] Prisma persistence warning:', err.message);
    });

    return summary;
  }

  private async persistScanToPrisma(summary: ObservabilitySummary): Promise<void> {
    try {
      const scanId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      await prisma.scanRun.create({
        data: {
          id: scanId,
          totalReposScanned: summary.total_repos_scanned,
          totalPlaybooks: summary.total_playbooks,
          totalRoles: summary.total_roles,
          totalTasks: summary.total_tasks,
          duplicateClustersCount: summary.duplicate_clusters_count,
          duplicateTasksCount: summary.duplicate_tasks_count,
          highRiskAssetsCount: summary.high_risk_assets_count,
          zombieCoreAssetsCount: summary.zombie_core_assets_count,
          divergedForksCount: summary.diverged_forks_count,
          overallHealthScore: summary.overall_health_score,
          status: 'completed',
          createdAt: new Date()
        }
      });

      const toJson = (v: unknown) => v as Prisma.InputJsonValue;

      const assetRows: Prisma.AssetCreateManyInput[] = [];
      const taskRows: Prisma.TaskCreateManyInput[] = [];
      for (const a of this.cachedAssets) {
        const dbAssetId = `${scanId}::${a.id}`;
        assetRows.push({
          id: dbAssetId,
          scanId,
          name: a.name,
          repoName: a.repo_name,
          relativePath: a.relative_path,
          fullPath: a.full_path,
          assetType: a.asset_type,
          tasksCount: a.tasks_count,
          targetHosts: a.target_hosts,
          blastRadiusScore: a.blast_radius_score,
          downstreamDependents: toJson(a.downstream_dependents),
          upstreamDependencies: toJson(a.upstream_dependencies),
          riskLevel: a.risk_level,
          riskScore: a.risk_score,
          riskFlags: toJson(a.risk_flags),
          gitMetadata: toJson(a.git),
          executionMetadata: toJson(a.execution)
        });
        for (const t of a.tasks) {
          taskRows.push({
            id: `${scanId}::${t.id}`,
            scanId,
            assetId: dbAssetId,
            name: t.name,
            module: t.module,
            parameters: toJson(t.parameters),
            lineNumber: t.line_number,
            whenCondition: t.when,
            tags: toJson(t.tags),
            notify: toJson(t.notify),
            normalizedSignature: t.normalized_signature
          });
        }
      }

      const clusterRows: Prisma.DuplicateClusterCreateManyInput[] = this.cachedClusters.map(c => ({
        id: `${scanId}::${c.cluster_id}`,
        scanId,
        clusterId: c.cluster_id,
        functionalityName: c.functionality_name,
        primaryModule: c.primary_module,
        similarityScore: c.similarity_score,
        canonicalRecommendation: c.canonical_recommendation,
        variants: toJson(c.variants),
        divergenceSummary: c.divergence_summary,
        riskAssessment: c.risk_assessment
      }));

      const edgeRows: Prisma.BlastEdgeCreateManyInput[] = (this.cachedGraph?.edges ?? []).map(e => ({
        scanId,
        sourceId: e.source,
        targetId: e.target,
        relationship: e.relationship
      }));

      const riskRows: Prisma.RiskFlagCreateManyInput[] = this.cachedRisks.map(r => ({
        scanId,
        assetId: r.asset_id,
        assetName: r.asset_name,
        repoName: r.repo_name,
        assetType: r.asset_type,
        riskLevel: r.risk_level,
        riskScore: r.risk_score,
        blastRadius: r.blast_radius,
        stalenessDays: r.staleness_days,
        authorsCount: r.authors_count,
        lastExecutionStatus: r.last_execution_status,
        primaryRiskFlag: r.primary_risk_flag,
        detailedReasons: toJson(r.detailed_reasons),
        suggestedAction: r.suggested_action
      }));

      // Chunk to stay under SQLite/Postgres bind-parameter limits
      const chunk = <T,>(rows: T[], size = 200): T[][] => {
        const out: T[][] = [];
        for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
        return out;
      };

      await prisma.$transaction([
        ...chunk(assetRows).map(data => prisma.asset.createMany({ data })),
        ...chunk(taskRows).map(data => prisma.task.createMany({ data })),
        ...chunk(clusterRows).map(data => prisma.duplicateCluster.createMany({ data })),
        ...chunk(edgeRows).map(data => prisma.blastEdge.createMany({ data })),
        ...chunk(riskRows).map(data => prisma.riskFlag.createMany({ data })),
      ]);
    } catch (e: any) {
      console.warn('[Orchestrator] Database write bypassed:', e.message);
    }
  }

  ensureInitialized(): void {
    if (!this.cachedSummary) {
      this.scanRepositories(this.getDefaultDemoRepos(), this.getDefaultCILogsDir());
    }
  }
}

// Global orchestrator singleton across hot-reloads
declare global {
  var orchestratorGlobal: ObservabilityOrchestrator | undefined;
}

export const orchestrator = globalThis.orchestratorGlobal ?? new ObservabilityOrchestrator();

if (process.env.NODE_ENV !== 'production') {
  globalThis.orchestratorGlobal = orchestrator;
}
