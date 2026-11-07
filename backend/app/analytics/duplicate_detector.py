from typing import List, Dict, Any, Tuple, Optional
from collections import defaultdict
import difflib
from ..models.schemas import (
    AnsibleAsset, AnsibleTask, DuplicateCluster,
    DuplicateTaskPair, ParameterDiff, ScriptType
)

EQUIVALENT_MODULE_GROUPS = [
    {"apt", "yum", "dnf", "package"},
    {"service", "systemd"},
    {"copy", "template"},
    {"command", "shell", "raw"},
]

def get_module_group(mod: str) -> str:
    for i, group in enumerate(EQUIVALENT_MODULE_GROUPS):
        if mod in group:
            return f"group_{i}"
    return mod

class DuplicateDetector:
    @staticmethod
    def compare_parameters(params_a: Dict[str, Any], params_b: Dict[str, Any]) -> Tuple[float, List[ParameterDiff]]:
        """Compare two task parameter sets and generate granular parameter diffs."""
        keys_a = set(params_a.keys()) - {"_raw"}
        keys_b = set(params_b.keys()) - {"_raw"}
        all_keys = keys_a.union(keys_b)

        if not all_keys:
            # Check raw string similarity if both were raw commands/strings
            raw_a = str(params_a.get("_raw", "")).strip()
            raw_b = str(params_b.get("_raw", "")).strip()
            if not raw_a and not raw_b:
                return 1.0, []
            ratio = difflib.SequenceMatcher(None, raw_a, raw_b).ratio()
            diffs = []
            if ratio < 0.99:
                diffs.append(ParameterDiff(
                    param_name="command_raw",
                    status="differing_value",
                    val_a=raw_a,
                    val_b=raw_b
                ))
            return ratio, diffs

        diffs: List[ParameterDiff] = []
        matching_score = 0.0

        for k in all_keys:
            in_a = k in keys_a
            in_b = k in keys_b
            if in_a and in_b:
                val_a = params_a[k]
                val_b = params_b[k]
                if str(val_a).strip() == str(val_b).strip():
                    matching_score += 1.0
                else:
                    matching_score += 0.5  # Key matched, value differed
                    diffs.append(ParameterDiff(
                        param_name=k,
                        status="differing_value",
                        val_a=val_a,
                        val_b=val_b
                    ))
            elif in_a:
                diffs.append(ParameterDiff(
                    param_name=k,
                    status="only_in_a",
                    val_a=params_a[k],
                    val_b=None
                ))
            else:
                diffs.append(ParameterDiff(
                    param_name=k,
                    status="only_in_b",
                    val_a=None,
                    val_b=params_b[k]
                ))

        similarity = round(matching_score / len(all_keys), 2)
        return similarity, diffs

    @classmethod
    def compare_tasks(cls, t_a: AnsibleTask, t_b: AnsibleTask, repo_a: str, repo_b: str) -> Optional[DuplicateTaskPair]:
        # Don't compare a task to itself
        if t_a.id == t_b.id:
            return None

        # Check module equivalence
        mod_group_a = get_module_group(t_a.module)
        mod_group_b = get_module_group(t_b.module)

        module_match = (t_a.module == t_b.module)
        group_match = (mod_group_a == mod_group_b)

        if not group_match:
            return None

        # Extract primary targets
        target_a = t_a.parameters.get("name") or t_a.parameters.get("pkg") or t_a.parameters.get("dest") or t_a.parameters.get("service")
        target_b = t_b.parameters.get("name") or t_b.parameters.get("pkg") or t_b.parameters.get("dest") or t_b.parameters.get("service")

        str_target_a = str(target_a or "").strip().lower()
        str_target_b = str(target_b or "").strip().lower()

        # If both have names and they don't match, check task title similarity
        title_sim = difflib.SequenceMatcher(None, t_a.name.lower(), t_b.name.lower()).ratio()

        target_matches = False
        if str_target_a and str_target_b and (str_target_a == str_target_b or str_target_a in str_target_b or str_target_b in str_target_a):
            target_matches = True
        elif title_sim > 0.70:
            target_matches = True
        elif t_a.normalized_signature == t_b.normalized_signature:
            target_matches = True

        if not target_matches:
            return None

        param_sim, diffs = cls.compare_parameters(t_a.parameters, t_b.parameters)
        
        # Overall task similarity
        total_score = round(0.4 * (1.0 if module_match else 0.8) + 0.3 * title_sim + 0.3 * param_sim, 2)
        
        if total_score < 0.65:
            return None

        reason = "Identical functionality with parameter divergence"
        if len(diffs) == 0:
            reason = "Exact duplicate task copied across scripts"
        elif any(d.param_name in ["state", "version", "update_cache"] for d in diffs):
            reason = "Divergent deployment state/version configuration"

        return DuplicateTaskPair(
            task_a=t_a,
            task_b=t_b,
            repo_a=repo_a,
            repo_b=repo_b,
            similarity_score=total_score,
            divergence_reason=reason,
            parameter_diffs=diffs
        )

    @classmethod
    def detect_duplicates(cls, assets: List[AnsibleAsset]) -> Tuple[List[DuplicateCluster], List[DuplicateTaskPair]]:
        """Scan all assets, compute duplicate pairs, and aggregate into semantic clusters."""
        all_tasks_with_repo: List[Tuple[AnsibleTask, AnsibleAsset]] = []
        for asset in assets:
            for task in asset.tasks:
                all_tasks_with_repo.append((task, asset))

        duplicate_pairs: List[DuplicateTaskPair] = []
        seen_pairs = set()

        for i in range(len(all_tasks_with_repo)):
            task_a, asset_a = all_tasks_with_repo[i]
            for j in range(i + 1, len(all_tasks_with_repo)):
                task_b, asset_b = all_tasks_with_repo[j]
                
                # Compare across files
                if asset_a.id == asset_b.id:
                    continue

                pair_key = tuple(sorted([task_a.id, task_b.id]))
                if pair_key in seen_pairs:
                    continue

                pair = cls.compare_tasks(task_a, task_b, asset_a.repo_name, asset_b.repo_name)
                if pair:
                    seen_pairs.add(pair_key)
                    duplicate_pairs.append(pair)

        # Cluster duplicate pairs into semantic functional groups
        clusters_map: Dict[str, List[DuplicateTaskPair]] = defaultdict(list)
        for pair in duplicate_pairs:
            # Group key by primary module or target
            target = (pair.task_a.parameters.get("name") or pair.task_a.parameters.get("pkg") or 
                      pair.task_b.parameters.get("name") or pair.task_a.module)
            key = f"{pair.task_a.module}::{target}"
            clusters_map[key].append(pair)

        clusters: List[DuplicateCluster] = []
        cluster_id_counter = 1

        for cluster_key, pairs in clusters_map.items():
            # Collect unique variants
            variant_dict: Dict[str, Dict[str, Any]] = {}
            for p in pairs:
                for t, r in [(p.task_a, p.repo_a), (p.task_b, p.repo_b)]:
                    if t.id not in variant_dict:
                        variant_dict[t.id] = {
                            "task_id": t.id,
                            "task_name": t.name,
                            "module": t.module,
                            "file_path": t.file_path,
                            "repo_name": r,
                            "parameters": t.parameters,
                            "tags": t.tags,
                        }

            variants_list = list(variant_dict.values())
            if len(variants_list) < 2:
                continue

            primary_mod = variants_list[0]["module"]
            # Human readable name
            target_name = cluster_key.split("::")[-1]
            func_name = f"Manage {target_name} ({primary_mod})"
            if "docker" in cluster_key.lower():
                func_name = "Docker Runtime & Daemon Setup"
            elif "nginx" in cluster_key.lower():
                func_name = "Nginx Web Server & Proxy Config"
            elif "user" in cluster_key.lower() or "ssh" in cluster_key.lower():
                func_name = "User Provisioning & SSH Hardening"
            elif "sysctl" in cluster_key.lower() or "limit" in cluster_key.lower():
                func_name = "Kernel & System Limits Configuration"

            avg_similarity = round(sum(p.similarity_score for p in pairs) / len(pairs), 2)

            # Recommend canonical variant (prefer declarative module over shell/raw, or cleanest params)
            canonical = None
            best_score = -1
            for v in variants_list:
                score = 0
                if v["module"] not in ["shell", "command", "raw"]:
                    score += 5
                score += len(v["parameters"])
                if score > best_score:
                    best_score = score
                    canonical = f"{v['repo_name']} -> {v['file_path']} ({v['task_name']})"

            # Summarize divergence
            differing_params = set()
            for p in pairs:
                for d in p.parameter_diffs:
                    differing_params.add(d.param_name)

            div_summary = f"{len(variants_list)} divergent implementations across {len(set(v['repo_name'] for v in variants_list))} repos."
            if differing_params:
                div_summary += f" Differing parameters: {', '.join(sorted(differing_params))}."

            risk_eval = "Medium: Configuration drift can lead to inconsistent environment states."
            if len(variants_list) >= 3:
                risk_eval = "High: High fragmentation across multiple engineering teams. Inconsistent security/runtime flags."

            clusters.append(DuplicateCluster(
                cluster_id=f"cluster-{cluster_id_counter}",
                functionality_name=func_name,
                primary_module=primary_mod,
                similarity_score=avg_similarity,
                canonical_recommendation=canonical,
                variants=variants_list,
                divergence_summary=div_summary,
                risk_assessment=risk_eval
            ))
            cluster_id_counter += 1

        # Also detect Role-level duplicates (roles with high task overlap)
        cls._detect_role_level_duplicates(assets, clusters, cluster_id_counter)

        return clusters, duplicate_pairs

    @classmethod
    def _detect_role_level_duplicates(cls, assets: List[AnsibleAsset], clusters: List[DuplicateCluster], start_id: int):
        roles = [a for a in assets if a.asset_type == ScriptType.ROLE]
        seen_roles = set()

        for i in range(len(roles)):
            r_a = roles[i]
            for j in range(i + 1, len(roles)):
                r_b = roles[j]
                if r_a.repo_name == r_b.repo_name and r_a.id == r_b.id:
                    continue

                pair_key = tuple(sorted([r_a.id, r_b.id]))
                if pair_key in seen_roles:
                    continue

                # Check task signatures Jaccard overlap
                sigs_a = set(t.normalized_signature for t in r_a.tasks if t.normalized_signature)
                sigs_b = set(t.normalized_signature for t in r_b.tasks if t.normalized_signature)

                if not sigs_a or not sigs_b:
                    continue

                intersection = sigs_a.intersection(sigs_b)
                union = sigs_a.union(sigs_b)
                jaccard = round(len(intersection) / len(union), 2) if union else 0.0

                if jaccard >= 0.50:
                    seen_roles.add(pair_key)
                    variants = [
                        {
                            "task_id": r_a.id,
                            "task_name": f"Role: {r_a.name}",
                            "module": "role_bundle",
                            "file_path": r_a.relative_path,
                            "repo_name": r_a.repo_name,
                            "parameters": {"tasks_count": len(r_a.tasks), "git_author_count": r_a.git.author_count},
                            "tags": []
                        },
                        {
                            "task_id": r_b.id,
                            "task_name": f"Role: {r_b.name}",
                            "module": "role_bundle",
                            "file_path": r_b.relative_path,
                            "repo_name": r_b.repo_name,
                            "parameters": {"tasks_count": len(r_b.tasks), "git_author_count": r_b.git.author_count},
                            "tags": []
                        }
                    ]

                    clusters.append(DuplicateCluster(
                        cluster_id=f"cluster-{start_id}",
                        functionality_name=f"Role Drift: {r_a.name} vs {r_b.name}",
                        primary_module="role",
                        similarity_score=jaccard,
                        canonical_recommendation=f"{r_a.repo_name}::{r_a.name}" if r_a.git.days_since_last_commit < r_b.git.days_since_last_commit else f"{r_b.repo_name}::{r_b.name}",
                        variants=variants,
                        divergence_summary=f"Roles share {int(jaccard * 100)}% structural tasks across {r_a.repo_name} and {r_b.repo_name}.",
                        risk_assessment="High: Cross-repo role forking without upstream synchronization."
                    ))
                    start_id += 1
