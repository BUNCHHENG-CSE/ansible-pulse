import type { AnsibleAsset, DuplicateCluster, RiskFlagItem } from '../types';

export class RiskScorer {
  static evaluateRisks(
    assets: AnsibleAsset[],
    duplicateClusters: DuplicateCluster[]
  ): RiskFlagItem[] {
    const riskItems: RiskFlagItem[] = [];

    const clusterAssetIds = new Set<string>();
    for (const c of duplicateClusters) {
      for (const v of c.variants) {
        const taskId = v.task_id || '';
        for (const a of assets) {
          if (taskId.startsWith(a.relative_path) || (v.repo_name === a.repo_name && a.name.includes(v.task_name))) {
            clusterAssetIds.add(a.id);
          }
        }
      }
    }

    for (const asset of assets) {
      let score = 0.0;
      const reasons: string[] = [];
      const flags: string[] = [];
      let primaryFlag = 'Low Risk Script';
      let suggestedAction = 'No action needed.';

      // 1. Blast Radius Risk Factor (0 - 40 points)
      const br = asset.blast_radius_score;
      if (br >= 5) {
        score += 40.0;
        reasons.push(`Massive Blast Radius: Referenced by ${br} downstream playbooks/services.`);
      } else if (br >= 3) {
        score += 30.0;
        reasons.push(`High Blast Radius: Referenced by ${br} downstream playbooks/services.`);
      } else if (br >= 1) {
        score += 15.0;
        reasons.push(`Moderate Blast Radius: Referenced by ${br} dependent asset(s).`);
      }

      // 2. Staleness & Abandonment Factor (0 - 35 points)
      const daysUnmaintained = asset.git.days_since_last_commit;
      if (daysUnmaintained >= 365) {
        score += 35.0;
        reasons.push(`Severely unmaintained: Zero commits in ${daysUnmaintained} days (> 1 year).`);
      } else if (daysUnmaintained >= 180) {
        score += 25.0;
        reasons.push(`Stale asset: Zero commits in ${daysUnmaintained} days (> 6 months).`);
      } else if (daysUnmaintained >= 90) {
        score += 10.0;
        reasons.push(`Untouched for ${daysUnmaintained} days.`);
      }

      // SPECIFIC FLAG: "Referenced by many projects but unmaintained recently"
      if (br >= 2 && daysUnmaintained >= 180) {
        flags.push('ZOMBIE_CORE_ASSET');
        primaryFlag = 'Zombie Core Asset (High Blast + Unmaintained)';
        suggestedAction = `Audit ${asset.name} immediately. It anchors ${br} downstream assets but hasn't been updated in ${daysUnmaintained} days. Assign an active owner and verify CI test coverage.`;
      }

      // 3. Execution Health Risk Factor (0 - 15 points)
      if (asset.execution.last_status === 'failed' || asset.execution.last_status === 'unreachable') {
        score += 15.0;
        reasons.push(`Execution Failure: Last CI run status was '${asset.execution.last_status}'.`);
        flags.push('EXECUTION_FAILURE');
        if (primaryFlag === 'Low Risk Script') {
          primaryFlag = 'Recent Execution Failure in CI/CD';
          suggestedAction = 'Inspect recent Ansible run logs; resolve failed task or host connectivity.';
        }
      } else if (asset.execution.last_status === 'never_run' && br > 0) {
        score += 10.0;
        reasons.push('Referenced asset has no record of verified CI execution.');
      }

      // 4. Duplicate Sprawl & Drift Factor (0 - 10 points)
      if (clusterAssetIds.has(asset.id)) {
        score += 10.0;
        reasons.push('Identified as part of a divergent duplicate functionality cluster.');
        flags.push('DRIFTED_DUPLICATE');
        if (primaryFlag === 'Low Risk Script') {
          primaryFlag = 'Fragmented / Duplicate Implementation';
          suggestedAction = 'Consolidate into canonical shared role and parameterize variations.';
        }
      }

      // 5. Volatility / Author Churn
      if (asset.git.author_count >= 4 && asset.git.commits_last_90d >= 5) {
        score += 10.0;
        reasons.push(`High Churn Volatility: Edited by ${asset.git.author_count} different authors recently.`);
        flags.push('HIGH_CHURN');
      }

      const totalScore = Math.min(100.0, Math.round(score * 10) / 10);
      asset.risk_score = totalScore;
      asset.risk_flags = flags;

      if (totalScore >= 65) {
        asset.risk_level = 'critical';
      } else if (totalScore >= 45) {
        asset.risk_level = 'high';
      } else if (totalScore >= 25) {
        asset.risk_level = 'medium';
      } else {
        asset.risk_level = 'low';
      }

      if (asset.risk_level === 'critical' || asset.risk_level === 'high' || asset.risk_level === 'medium') {
        riskItems.push({
          asset_id: asset.id,
          asset_name: asset.name,
          repo_name: asset.repo_name,
          asset_type: asset.asset_type,
          risk_level: asset.risk_level,
          risk_score: totalScore,
          blast_radius: asset.blast_radius_score,
          staleness_days: asset.git.days_since_last_commit,
          authors_count: asset.git.author_count,
          last_execution_status: asset.execution.last_status,
          primary_risk_flag: primaryFlag,
          detailed_reasons: reasons,
          suggested_action: suggestedAction
        });
      }
    }

    riskItems.sort((a, b) => b.risk_score - a.risk_score);
    return riskItems;
  }
}
