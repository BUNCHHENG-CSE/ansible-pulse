import YAML from 'yaml';
import type { DuplicateCluster, CanonicalRemediation, AnsibleAsset } from '../types';

export class RemediationEngine {
  static generateCanonicalRole(
    cluster: DuplicateCluster,
    allAssets: AnsibleAsset[]
  ): CanonicalRemediation {
    const rawName = cluster.functionality_name.toLowerCase();
    let roleSlug = rawName.replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (!roleSlug.startsWith('role_')) {
      roleSlug = `common_${roleSlug}`;
    }

    const variants = cluster.variants || [];
    const impactedRepos = Array.from(new Set(variants.map(v => v.repo_name || 'unknown')));

    const paramValues: Record<string, any[]> = {};
    for (const v of variants) {
      const taskParams = v.parameters || {};
      for (const [k, val] of Object.entries(taskParams)) {
        if (!paramValues[k]) paramValues[k] = [];
        paramValues[k].push(val);
      }
    }

    const defaultsDict: Record<string, any> = {};
    const canonicalParams: Record<string, any> = {};
    const consolidatedVars: string[] = [];

    const canonicalVariant = variants.find(v =>
      cluster.canonical_recommendation && cluster.canonical_recommendation.includes(v.file_path)
    ) || variants[0] || { parameters: {} };

    const baseParams = canonicalVariant.parameters || {};

    for (const [k, v] of Object.entries(baseParams)) {
      const distinctVals = new Set((paramValues[k] || []).map(x => String(x)));
      if (distinctVals.size > 1) {
        const varName = `${roleSlug}_${k}`;
        defaultsDict[varName] = v;
        canonicalParams[k] = `{{ ${varName} }}`;
        consolidatedVars.push(varName);
      } else {
        canonicalParams[k] = v;
      }
    }

    if (!('state' in canonicalParams) && ['apt', 'package', 'service', 'pip'].includes(cluster.primary_module)) {
      const varName = `${roleSlug}_state`;
      defaultsDict[varName] = 'present';
      canonicalParams.state = `{{ ${varName} }}`;
      consolidatedVars.push(varName);
    }

    const moduleFqcn = `ansible.builtin.${cluster.primary_module}`;
    const canonicalTask = {
      name: `Configure ${cluster.functionality_name} (Canonical Unified Standard)`,
      [moduleFqcn]: canonicalParams,
      tags: [roleSlug, 'iac_observability']
    };

    let tasksYaml = "---\n# Generated automatically by TCT AnsiblePulse Remediation Engine\n";
    tasksYaml += YAML.stringify([canonicalTask]);

    let defaultsYaml = `---\n# Default variables for ${roleSlug}\n`;
    defaultsYaml += YAML.stringify(defaultsDict);

    const gitPatchDiff = this.generateGitPatch(cluster, roleSlug, variants);

    const refactoringNotes = [
      `Consolidates ${variants.length} fragmented variants across ${impactedRepos.length} repositories.`,
      `Extracted ${consolidatedVars.length} variable override(s) into defaults/main.yml to maintain flexibility.`,
      `Adopted module '${moduleFqcn}' with declarative parameter standards.`,
      'Can be safely imported into downstream playbooks using `include_role`.'
    ];

    return {
      cluster_id: cluster.cluster_id,
      functionality_name: cluster.functionality_name,
      suggested_role_name: roleSlug,
      canonical_task_yaml: tasksYaml,
      defaults_yaml: defaultsYaml,
      git_patch_diff: gitPatchDiff,
      consolidated_variables: consolidatedVars,
      impacted_repos: impactedRepos,
      refactoring_notes: refactoringNotes
    };
  }

  private static generateGitPatch(
    cluster: DuplicateCluster,
    roleSlug: string,
    variants: any[]
  ): string {
    if (!variants || variants.length === 0) return '';

    const targetVariant = variants.length > 1 ? variants[1] : variants[0];
    const filePath = targetVariant.file_path || 'playbooks/site.yml';
    const taskName = targetVariant.task_name || 'Legacy Duplicate Task';

    return `--- a/${filePath}
+++ b/${filePath}
@@ -12,8 +12,4 @@
-    - name: ${taskName}
-      ${cluster.primary_module}:
-        state: present
+    - name: Invoke Canonical ${cluster.functionality_name} Role
+      ansible.builtin.include_role:
+        name: ${roleSlug}
`;
  }
}
