import yaml
import re
from typing import Dict, List, Any, Optional
from ..models.schemas import DuplicateCluster, CanonicalRemediation, AnsibleAsset

class RemediationEngine:
    """
    Automated Consolidation & Refactoring Engine.
    Converts fragmented, duplicate tasks across disparate repositories into
    a single, standardized Canonical Ansible Role with variable abstraction,
    defaults/main.yml, and unified Git patch diffs.
    """

    @classmethod
    def generate_canonical_role(
        cls,
        cluster: DuplicateCluster,
        all_assets: List[AnsibleAsset]
    ) -> CanonicalRemediation:
        # Determine normalized role name from functionality name
        raw_name = cluster.functionality_name.lower()
        role_slug = re.sub(r"[^a-z0-9_]+", "_", raw_name).strip("_")
        if not role_slug.startswith("role_"):
            role_slug = f"common_{role_slug}"

        variants = cluster.variants or []
        impacted_repos = list(set(v.get("repo", "unknown") for v in variants))

        # Gather parameter keys across variants
        param_keys_frequency: Dict[str, int] = {}
        param_values: Dict[str, List[Any]] = {}

        for v in variants:
            task_params = v.get("parameters") or {}
            for k, val in task_params.items():
                param_keys_frequency[k] = param_keys_frequency.get(k, 0) + 1
                if k not in param_values:
                    param_values[k] = []
                param_values[k].append(val)

        # Build defaults/main.yml and canonical tasks/main.yml
        defaults_dict: Dict[str, Any] = {}
        canonical_params: Dict[str, Any] = {}
        consolidated_vars: List[str] = []

        # Find the canonical variant as base
        canonical_variant = next(
            (v for v in variants if cluster.canonical_recommendation and cluster.canonical_recommendation in v.get("asset_name", "")),
            variants[0] if variants else {}
        )
        base_params = canonical_variant.get("parameters") or {}

        for k, v in base_params.items():
            # If parameter has differing values across variants, parameterize it
            distinct_vals = set(str(x) for x in param_values.get(k, []))
            if len(distinct_vals) > 1:
                var_name = f"{role_slug}_{k}"
                defaults_dict[var_name] = v
                canonical_params[k] = f"{{{{ {var_name} }}}}"
                consolidated_vars.append(var_name)
            else:
                canonical_params[k] = v

        # If empty, add standard default state
        if "state" not in canonical_params and cluster.primary_module in ["apt", "package", "service", "pip"]:
            var_name = f"{role_slug}_state"
            defaults_dict[var_name] = "present"
            canonical_params["state"] = f"{{{{ {var_name} }}}}"
            consolidated_vars.append(var_name)

        # Generate canonical task structure
        module_fqcn = f"ansible.builtin.{cluster.primary_module}"
        canonical_task = {
            "name": f"Configure {cluster.functionality_name} (Canonical Unified Standard)",
            module_fqcn: canonical_params,
            "tags": [role_slug, "iac_observability"]
        }

        # Format YAML strings cleanly
        tasks_yaml = "---\n# Generated automatically by TCT AnsiblePulse Remediation Engine\n"
        tasks_yaml += yaml.dump([canonical_task], sort_keys=False, default_flow_style=False)

        defaults_yaml = "---\n# Default variables for " + role_slug + "\n"
        defaults_yaml += yaml.dump(defaults_dict, sort_keys=False, default_flow_style=False)

        # Generate Unified Git Patch Diff showing how to refactor variant into role invocation
        git_patch_diff = cls._generate_git_patch(cluster, role_slug, variants)

        refactoring_notes = [
            f"Consolidates {len(variants)} fragmented variants across {len(impacted_repos)} repositories.",
            f"Extracted {len(consolidated_vars)} variable override(s) into defaults/main.yml to maintain flexibility.",
            f"Adopted module '{module_fqcn}' with declarative parameter standards.",
            "Can be safely imported into downstream playbooks using `include_role`."
        ]

        return CanonicalRemediation(
            cluster_id=cluster.cluster_id,
            functionality_name=cluster.functionality_name,
            suggested_role_name=role_slug,
            canonical_task_yaml=tasks_yaml,
            defaults_yaml=defaults_yaml,
            git_patch_diff=git_patch_diff,
            consolidated_variables=consolidated_vars,
            impacted_repos=impacted_repos,
            refactoring_notes=refactoring_notes
        )

    @classmethod
    def _generate_git_patch(
        cls,
        cluster: DuplicateCluster,
        role_slug: str,
        variants: List[Dict[str, Any]]
    ) -> str:
        """Create a synthetic unified git diff for replacing a duplicate task with the canonical role."""
        if not variants:
            return ""

        target_variant = variants[1] if len(variants) > 1 else variants[0]
        file_path = target_variant.get("relative_path", "playbooks/site.yml")
        task_name = target_variant.get("task_name", "Legacy Duplicate Task")

        diff = f"""--- a/{file_path}
+++ b/{file_path}
@@ -12,8 +12,4 @@
-    - name: {task_name}
-      {cluster.primary_module}:
-        state: present
+    - name: Invoke Canonical {cluster.functionality_name} Role
+      ansible.builtin.include_role:
+        name: {role_slug}
"""
        return diff
