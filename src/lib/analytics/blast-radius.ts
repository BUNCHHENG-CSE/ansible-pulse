import type {
  AnsibleAsset, BlastRadiusGraph, BlastRadiusNode,
  BlastRadiusEdge, ImpactSimulation
} from '../types';

export class BlastRadiusEngine {
  static calculateDependenciesAndBlastRadius(assets: AnsibleAsset[]): BlastRadiusGraph {
    const roleNameToAssetIds: Record<string, string[]> = {};
    const filePathToAssetIds: Record<string, string[]> = {};

    for (const a of assets) {
      if (a.asset_type === 'role') {
        const cleanRoleName = a.name.replace('role:', '');
        if (!roleNameToAssetIds[cleanRoleName]) roleNameToAssetIds[cleanRoleName] = [];
        roleNameToAssetIds[cleanRoleName].push(a.id);
        if (!roleNameToAssetIds[a.name]) roleNameToAssetIds[a.name] = [];
        roleNameToAssetIds[a.name].push(a.id);
      }

      const cleanRel = a.relative_path.replace(/\\/g, '/').toLowerCase();
      if (!filePathToAssetIds[cleanRel]) filePathToAssetIds[cleanRel] = [];
      filePathToAssetIds[cleanRel].push(a.id);

      const cleanName = a.name.toLowerCase();
      if (!filePathToAssetIds[cleanName]) filePathToAssetIds[cleanName] = [];
      filePathToAssetIds[cleanName].push(a.id);
    }

    const forwardDeps: Record<string, Set<string>> = {};
    const reverseDeps: Record<string, Set<string>> = {};
    const edges: BlastRadiusEdge[] = [];

    for (const asset of assets) {
      if (!forwardDeps[asset.id]) forwardDeps[asset.id] = new Set();
      if (!reverseDeps[asset.id]) reverseDeps[asset.id] = new Set();
    }

    for (const asset of assets) {
      // 1. Included roles
      for (const roleRef of asset.included_roles) {
        const cleanRef = roleRef.replace('role:', '');
        const targets = roleNameToAssetIds[cleanRef] || roleNameToAssetIds[roleRef] || [];
        for (const targetId of targets) {
          if (targetId !== asset.id) {
            forwardDeps[asset.id]?.add(targetId);
            if (!reverseDeps[targetId]) reverseDeps[targetId] = new Set();
            reverseDeps[targetId].add(asset.id);
            edges.push({
              source: asset.id,
              target: targetId,
              relationship: 'includes_role'
            });
          }
        }
      }

      // 2. Included tasks
      for (const taskRef of asset.included_tasks) {
        const cleanRef = taskRef.replace(/\\/g, '/').toLowerCase();
        let targets = filePathToAssetIds[cleanRef] || [];
        if (targets.length === 0) {
          const baseRef = cleanRef.split('/').pop() || '';
          targets = Object.entries(filePathToAssetIds)
            .filter(([k]) => k.endsWith(baseRef))
            .flatMap(([, aids]) => aids);
        }

        for (const targetId of targets) {
          if (targetId !== asset.id) {
            forwardDeps[asset.id]?.add(targetId);
            if (!reverseDeps[targetId]) reverseDeps[targetId] = new Set();
            reverseDeps[targetId].add(asset.id);
            edges.push({
              source: asset.id,
              target: targetId,
              relationship: 'includes_task'
            });
          }
        }
      }

      // 3. Imported playbooks
      for (const pbRef of asset.imported_playbooks) {
        const cleanRef = pbRef.replace(/\\/g, '/').toLowerCase();
        const targets = filePathToAssetIds[cleanRef] || [];
        for (const targetId of targets) {
          if (targetId !== asset.id) {
            forwardDeps[asset.id]?.add(targetId);
            if (!reverseDeps[targetId]) reverseDeps[targetId] = new Set();
            reverseDeps[targetId].add(asset.id);
            edges.push({
              source: asset.id,
              target: targetId,
              relationship: 'imports_playbook'
            });
          }
        }
      }
    }

    // Transitive blast radius computation
    for (const asset of assets) {
      // Downstream dependents (who calls me)
      const visitedDownstream = new Set<string>();
      const queue = Array.from(reverseDeps[asset.id] || []);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (!visitedDownstream.has(curr) && curr !== asset.id) {
          visitedDownstream.add(curr);
          const nextDeps = reverseDeps[curr];
          if (nextDeps) {
            for (const nd of nextDeps) queue.push(nd);
          }
        }
      }

      asset.downstream_dependents = Array.from(visitedDownstream);
      asset.blast_radius_score = visitedDownstream.size;

      // Upstream dependencies (who do I call)
      const visitedUpstream = new Set<string>();
      const uQueue = Array.from(forwardDeps[asset.id] || []);
      while (uQueue.length > 0) {
        const curr = uQueue.shift()!;
        if (!visitedUpstream.has(curr) && curr !== asset.id) {
          visitedUpstream.add(curr);
          const nextUps = forwardDeps[curr];
          if (nextUps) {
            for (const nu of nextUps) uQueue.push(nu);
          }
        }
      }

      asset.upstream_dependencies = Array.from(visitedUpstream);
    }

    // Build Graph Nodes
    const nodes: BlastRadiusNode[] = assets.map(a => ({
      id: a.id,
      label: a.name,
      repo: a.repo_name,
      type: a.asset_type,
      blast_radius: a.blast_radius_score,
      staleness_days: a.git.days_since_last_commit,
      risk_level: a.risk_level,
      last_status: a.execution.last_status
    }));

    // Deduplicate edges
    const seenEdges = new Set<string>();
    const uniqueEdges: BlastRadiusEdge[] = [];
    for (const e of edges) {
      const key = `${e.source}->${e.target}::${e.relationship}`;
      if (!seenEdges.has(key)) {
        seenEdges.add(key);
        uniqueEdges.push(e);
      }
    }

    return { nodes, edges: uniqueEdges };
  }

  static simulateBlastImpact(assetId: string, assets: AnsibleAsset[]): ImpactSimulation | { error: string } {
    const targetAsset = assets.find(a => a.id === assetId);
    if (!targetAsset) {
      return { error: 'Asset not found' };
    }

    const directDependents: { id: string; name: string; repo: string; type: string }[] = [];
    const indirectDependents: { id: string; name: string; repo: string; type: string }[] = [];
    const affectedRepos = new Set<string>();
    const environments = new Set<string>();

    for (const depId of targetAsset.downstream_dependents) {
      const depAsset = assets.find(a => a.id === depId);
      if (depAsset) {
        affectedRepos.add(depAsset.repo_name);
        if (depAsset.execution.last_environment) {
          environments.add(depAsset.execution.last_environment);
        }

        const isDirect = depAsset.included_roles.some(r => r.includes(targetAsset.name) || targetAsset.id.includes(r)) ||
                         depAsset.included_tasks.some(t => targetAsset.relative_path.includes(t));

        if (isDirect) {
          directDependents.push({
            id: depAsset.id,
            name: depAsset.name,
            repo: depAsset.repo_name,
            type: depAsset.asset_type
          });
        } else {
          indirectDependents.push({
            id: depAsset.id,
            name: depAsset.name,
            repo: depAsset.repo_name,
            type: depAsset.asset_type
          });
        }
      }
    }

    let severity = 'LOW';
    if (targetAsset.blast_radius_score >= 5) severity = 'CRITICAL';
    else if (targetAsset.blast_radius_score >= 3) severity = 'HIGH';
    else if (targetAsset.blast_radius_score >= 1) severity = 'MEDIUM';

    return {
      target_asset: {
        id: targetAsset.id,
        name: targetAsset.name,
        repo: targetAsset.repo_name,
        staleness_days: targetAsset.git.days_since_last_commit,
        blast_radius_score: targetAsset.blast_radius_score
      },
      impact_severity: severity,
      affected_repo_count: affectedRepos.size,
      affected_repos: Array.from(affectedRepos),
      affected_environments: environments.size > 0 ? Array.from(environments) : ['staging', 'production'],
      direct_dependents: directDependents,
      indirect_dependents: indirectDependents,
      recommendation: (severity === 'CRITICAL' || severity === 'HIGH')
        ? 'DO NOT modify directly without regression testing across all dependent repos. Consider establishing a versioned contract or splitting role.'
        : 'Safe to modify with standard repo CI.'
    };
  }
}
