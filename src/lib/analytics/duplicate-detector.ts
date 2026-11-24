import type {
  AnsibleAsset, AnsibleTask, DuplicateCluster,
  DuplicateTaskPair, ParameterDiff
} from '../types';

export const EQUIVALENT_MODULE_GROUPS: Set<string>[] = [
  new Set(['apt', 'yum', 'dnf', 'package']),
  new Set(['service', 'systemd']),
  new Set(['copy', 'template']),
  new Set(['command', 'shell', 'raw']),
];

export function getModuleGroup(mod: string): string {
  for (let i = 0; i < EQUIVALENT_MODULE_GROUPS.length; i++) {
    if (EQUIVALENT_MODULE_GROUPS[i].has(mod)) {
      return `group_${i}`;
    }
  }
  return mod;
}

export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  if (s1 === s2) return 1.0;

  // Bigram Dice coefficient
  const getBigrams = (str: string) => {
    const bigrams = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const bigram = str.substring(i, i + 2);
      bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
    }
    return bigrams;
  };

  const bg1 = getBigrams(s1);
  const bg2 = getBigrams(s2);
  let intersection = 0;

  for (const [key, count] of bg1.entries()) {
    if (bg2.has(key)) {
      intersection += Math.min(count, bg2.get(key)!);
    }
  }

  const total = (s1.length - 1) + (s2.length - 1);
  return total > 0 ? (2.0 * intersection) / total : 0.0;
}

export class DuplicateDetector {
  static compareParameters(
    paramsA: Record<string, any>,
    paramsB: Record<string, any>
  ): [number, ParameterDiff[]] {
    const keysA = new Set(Object.keys(paramsA).filter(k => k !== '_raw'));
    const keysB = new Set(Object.keys(paramsB).filter(k => k !== '_raw'));
    const allKeys = new Set([...keysA, ...keysB]);

    if (allKeys.size === 0) {
      const rawA = String(paramsA._raw || '').trim();
      const rawB = String(paramsB._raw || '').trim();
      if (!rawA && !rawB) return [1.0, []];
      const ratio = stringSimilarity(rawA, rawB);
      const diffs: ParameterDiff[] = [];
      if (ratio < 0.99) {
        diffs.push({
          param_name: 'command_raw',
          status: 'differing_value',
          val_a: rawA,
          val_b: rawB
        });
      }
      return [ratio, diffs];
    }

    const diffs: ParameterDiff[] = [];
    let matchingScore = 0.0;

    for (const k of allKeys) {
      const inA = keysA.has(k);
      const inB = keysB.has(k);

      if (inA && inB) {
        const valA = paramsA[k];
        const valB = paramsB[k];
        if (String(valA).trim() === String(valB).trim()) {
          matchingScore += 1.0;
        } else {
          matchingScore += 0.5;
          diffs.push({
            param_name: k,
            status: 'differing_value',
            val_a: valA,
            val_b: valB
          });
        }
      } else if (inA) {
        diffs.push({
          param_name: k,
          status: 'only_in_a',
          val_a: paramsA[k],
          val_b: null
        });
      } else {
        diffs.push({
          param_name: k,
          status: 'only_in_b',
          val_a: null,
          val_b: paramsB[k]
        });
      }
    }

    const similarity = Math.round((matchingScore / allKeys.size) * 100) / 100;
    return [similarity, diffs];
  }

  static compareTasks(
    tA: AnsibleTask,
    tB: AnsibleTask,
    repoA: string,
    repoB: string
  ): DuplicateTaskPair | null {
    if (tA.id === tB.id) return null;

    const modGroupA = getModuleGroup(tA.module);
    const modGroupB = getModuleGroup(tB.module);
    const moduleMatch = tA.module === tB.module;
    const groupMatch = modGroupA === modGroupB;

    if (!groupMatch) return null;

    const targetA = tA.parameters.name || tA.parameters.pkg || tA.parameters.dest || tA.parameters.service;
    const targetB = tB.parameters.name || tB.parameters.pkg || tB.parameters.dest || tB.parameters.service;

    const strTargetA = String(targetA || '').trim().toLowerCase();
    const strTargetB = String(targetB || '').trim().toLowerCase();

    const titleSim = stringSimilarity(tA.name, tB.name);

    let targetMatches = false;
    if (strTargetA && strTargetB && (strTargetA === strTargetB || strTargetA.includes(strTargetB) || strTargetB.includes(strTargetA))) {
      targetMatches = true;
    } else if (titleSim > 0.70) {
      targetMatches = true;
    } else if (tA.normalized_signature === tB.normalized_signature) {
      targetMatches = true;
    }

    if (!targetMatches) return null;

    const [paramSim, diffs] = this.compareParameters(tA.parameters, tB.parameters);
    const totalScore = Math.round((0.4 * (moduleMatch ? 1.0 : 0.8) + 0.3 * titleSim + 0.3 * paramSim) * 100) / 100;

    if (totalScore < 0.65) return null;

    let reason = 'Identical functionality with parameter divergence';
    if (diffs.length === 0) {
      reason = 'Exact duplicate task copied across scripts';
    } else if (diffs.some(d => ['state', 'version', 'update_cache'].includes(d.param_name))) {
      reason = 'Divergent deployment state/version configuration';
    }

    return {
      task_a: tA,
      task_b: tB,
      repo_a: repoA,
      repo_b: repoB,
      similarity_score: totalScore,
      divergence_reason: reason,
      parameter_diffs: diffs
    };
  }

  static detectDuplicates(assets: AnsibleAsset[]): [DuplicateCluster[], DuplicateTaskPair[]] {
    const allTasksWithRepo: [AnsibleTask, AnsibleAsset][] = [];
    for (const asset of assets) {
      for (const task of asset.tasks) {
        allTasksWithRepo.push([task, asset]);
      }
    }

    const duplicatePairs: DuplicateTaskPair[] = [];
    const seenPairs = new Set<string>();

    for (let i = 0; i < allTasksWithRepo.length; i++) {
      const [taskA, assetA] = allTasksWithRepo[i];
      for (let j = i + 1; j < allTasksWithRepo.length; j++) {
        const [taskB, assetB] = allTasksWithRepo[j];

        if (assetA.id === assetB.id) continue;

        const pairKey = [taskA.id, taskB.id].sort().join('::');
        if (seenPairs.has(pairKey)) continue;

        const pair = this.compareTasks(taskA, taskB, assetA.repo_name, assetB.repo_name);
        if (pair) {
          seenPairs.add(pairKey);
          duplicatePairs.push(pair);
        }
      }
    }

    // Cluster into semantic groups
    const clustersMap: Record<string, DuplicateTaskPair[]> = {};
    for (const pair of duplicatePairs) {
      const target = pair.task_a.parameters.name || pair.task_a.parameters.pkg || pair.task_b.parameters.name || pair.task_a.module;
      const key = `${pair.task_a.module}::${target}`;
      if (!clustersMap[key]) clustersMap[key] = [];
      clustersMap[key].push(pair);
    }

    const clusters: DuplicateCluster[] = [];
    let clusterIdCounter = 1;

    for (const [clusterKey, pairs] of Object.entries(clustersMap)) {
      const variantDict: Record<string, any> = {};
      for (const p of pairs) {
        for (const [t, r] of [[p.task_a, p.repo_a], [p.task_b, p.repo_b]] as [AnsibleTask, string][]) {
          if (!variantDict[t.id]) {
            variantDict[t.id] = {
              task_id: t.id,
              task_name: t.name,
              module: t.module,
              file_path: t.file_path,
              repo_name: r,
              parameters: t.parameters,
              tags: t.tags
            };
          }
        }
      }

      const variantsList = Object.values(variantDict);
      if (variantsList.length < 2) continue;

      const primaryMod = variantsList[0].module;
      const targetName = clusterKey.split('::').pop() || '';
      let funcName = `Manage ${targetName} (${primaryMod})`;
      const keyLower = clusterKey.toLowerCase();
      if (keyLower.includes('docker')) funcName = 'Docker Runtime & Daemon Setup';
      else if (keyLower.includes('nginx')) funcName = 'Nginx Web Server & Proxy Config';
      else if (keyLower.includes('user') || keyLower.includes('ssh')) funcName = 'User Provisioning & SSH Hardening';
      else if (keyLower.includes('sysctl') || keyLower.includes('limit')) funcName = 'Kernel & System Limits Configuration';

      const avgSim = Math.round((pairs.reduce((sum, p) => sum + p.similarity_score, 0) / pairs.length) * 100) / 100;

      let canonical: string | null = null;
      let bestScore = -1;
      for (const v of variantsList) {
        let score = 0;
        if (!['shell', 'command', 'raw'].includes(v.module)) score += 5;
        score += Object.keys(v.parameters).length;
        if (score > bestScore) {
          bestScore = score;
          canonical = `${v.repo_name} -> ${v.file_path} (${v.task_name})`;
        }
      }

      const differingParams = new Set<string>();
      for (const p of pairs) {
        for (const d of p.parameter_diffs) {
          differingParams.add(d.param_name);
        }
      }

      const repoCount = new Set(variantsList.map((v: any) => v.repo_name)).size;
      let divSummary = `${variantsList.length} divergent implementations across ${repoCount} repos.`;
      if (differingParams.size > 0) {
        divSummary += ` Differing parameters: ${Array.from(differingParams).sort().join(', ')}.`;
      }

      let riskEval = 'Medium: Configuration drift can lead to inconsistent environment states.';
      if (variantsList.length >= 3) {
        riskEval = 'High: High fragmentation across multiple engineering teams. Inconsistent security/runtime flags.';
      }

      clusters.push({
        cluster_id: `cluster-${clusterIdCounter}`,
        functionality_name: funcName,
        primary_module: primaryMod,
        similarity_score: avgSim,
        canonical_recommendation: canonical,
        variants: variantsList,
        divergence_summary: divSummary,
        risk_assessment: riskEval
      });
      clusterIdCounter++;
    }

    // Role-level duplicates
    this.detectRoleLevelDuplicates(assets, clusters, clusterIdCounter);

    return [clusters, duplicatePairs];
  }

  private static detectRoleLevelDuplicates(
    assets: AnsibleAsset[],
    clusters: DuplicateCluster[],
    startId: number
  ): void {
    const roles = assets.filter(a => a.asset_type === 'role');
    const seenRoles = new Set<string>();
    let idCounter = startId;

    for (let i = 0; i < roles.length; i++) {
      const rA = roles[i];
      for (let j = i + 1; j < roles.length; j++) {
        const rB = roles[j];
        if (rA.repo_name === rB.repo_name && rA.id === rB.id) continue;

        const pairKey = [rA.id, rB.id].sort().join('::');
        if (seenRoles.has(pairKey)) continue;

        const sigsA = new Set(rA.tasks.map(t => t.normalized_signature).filter(Boolean));
        const sigsB = new Set(rB.tasks.map(t => t.normalized_signature).filter(Boolean));

        if (sigsA.size === 0 || sigsB.size === 0) continue;

        const intersection = new Set([...sigsA].filter(x => sigsB.has(x)));
        const union = new Set([...sigsA, ...sigsB]);
        const jaccard = union.size > 0 ? Math.round((intersection.size / union.size) * 100) / 100 : 0.0;

        if (jaccard >= 0.50) {
          seenRoles.add(pairKey);
          const variants = [
            {
              task_id: rA.id,
              task_name: `Role: ${rA.name}`,
              module: 'role_bundle',
              file_path: rA.relative_path,
              repo_name: rA.repo_name,
              parameters: { tasks_count: rA.tasks.length, git_author_count: rA.git.author_count },
              tags: []
            },
            {
              task_id: rB.id,
              task_name: `Role: ${rB.name}`,
              module: 'role_bundle',
              file_path: rB.relative_path,
              repo_name: rB.repo_name,
              parameters: { tasks_count: rB.tasks.length, git_author_count: rB.git.author_count },
              tags: []
            }
          ];

          const canonical = rA.git.days_since_last_commit < rB.git.days_since_last_commit
            ? `${rA.repo_name}::${rA.name}`
            : `${rB.repo_name}::${rB.name}`;

          clusters.push({
            cluster_id: `cluster-${idCounter}`,
            functionality_name: `Role Drift: ${rA.name} vs ${rB.name}`,
            primary_module: 'role',
            similarity_score: jaccard,
            canonical_recommendation: canonical,
            variants,
            divergence_summary: `Roles share ${Math.round(jaccard * 100)}% structural tasks across ${rA.repo_name} and ${rB.repo_name}.`,
            risk_assessment: 'High: Cross-repo role forking without upstream synchronization.'
          });
          idCounter++;
        }
      }
    }
  }
}
