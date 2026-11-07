from typing import List, Dict, Set
from collections import defaultdict
from ..models.schemas import (
    AnsibleAsset, BlastRadiusGraph, BlastRadiusNode,
    BlastRadiusEdge, RiskLevel, ScriptType
)

class BlastRadiusEngine:
    @classmethod
    def calculate_dependencies_and_blast_radius(cls, assets: List[AnsibleAsset]) -> BlastRadiusGraph:
        """
        Build cross-project dependency graph and compute blast radius for each asset.
        """
        asset_map: Dict[str, AnsibleAsset] = {a.id: a for a in assets}
        
        # Name-based indexing to resolve includes/roles across repos
        role_name_to_asset_ids: Dict[str, List[str]] = defaultdict(list)
        file_path_to_asset_ids: Dict[str, List[str]] = defaultdict(list)

        for a in assets:
            if a.asset_type == ScriptType.ROLE:
                clean_role_name = a.name.replace("role:", "")
                role_name_to_asset_ids[clean_role_name].append(a.id)
                role_name_to_asset_ids[a.name].append(a.id)
            
            clean_rel = a.relative_path.replace("\\", "/").lower()
            file_path_to_asset_ids[clean_rel].append(a.id)
            file_path_to_asset_ids[a.name.lower()].append(a.id)

        # Adjacency: callers -> callees (forward) and callees -> callers (reverse)
        forward_deps: Dict[str, Set[str]] = defaultdict(set)
        reverse_deps: Dict[str, Set[str]] = defaultdict(set)
        edges: List[BlastRadiusEdge] = []

        for asset in assets:
            # Check included roles
            for role_ref in asset.included_roles:
                clean_ref = role_ref.replace("role:", "")
                targets = role_name_to_asset_ids.get(clean_ref) or role_name_to_asset_ids.get(role_ref)
                if targets:
                    for target_id in targets:
                        if target_id != asset.id:
                            forward_deps[asset.id].add(target_id)
                            reverse_deps[target_id].add(asset.id)
                            edges.append(BlastRadiusEdge(
                                source=asset.id,
                                target=target_id,
                                relationship="includes_role"
                            ))

            # Check included tasks
            for task_ref in asset.included_tasks:
                clean_ref = task_ref.replace("\\", "/").lower()
                targets = file_path_to_asset_ids.get(clean_ref)
                if not targets:
                    # Try partial match on filename
                    base_ref = clean_ref.split("/")[-1]
                    targets = [aid for k, aids in file_path_to_asset_ids.items() if k.endswith(base_ref) for aid in aids]

                if targets:
                    for target_id in targets:
                        if target_id != asset.id:
                            forward_deps[asset.id].add(target_id)
                            reverse_deps[target_id].add(asset.id)
                            edges.append(BlastRadiusEdge(
                                source=asset.id,
                                target=target_id,
                                relationship="includes_task"
                            ))

            # Check imported playbooks
            for pb_ref in asset.imported_playbooks:
                clean_ref = pb_ref.replace("\\", "/").lower()
                targets = file_path_to_asset_ids.get(clean_ref)
                if targets:
                    for target_id in targets:
                        if target_id != asset.id:
                            forward_deps[asset.id].add(target_id)
                            reverse_deps[target_id].add(asset.id)
                            edges.append(BlastRadiusEdge(
                                source=asset.id,
                                target=target_id,
                                relationship="imports_playbook"
                            ))

        # Transitive blast radius computation
        for asset in assets:
            # Downstream dependents (who calls me, directly and transitively)
            visited_downstream: Set[str] = set()
            queue = list(reverse_deps.get(asset.id, []))
            while queue:
                curr = queue.pop(0)
                if curr not in visited_downstream and curr != asset.id:
                    visited_downstream.add(curr)
                    queue.extend(reverse_deps.get(curr, []))

            asset.downstream_dependents = list(visited_downstream)
            asset.blast_radius_score = len(visited_downstream)

            # Upstream dependencies (who do I call)
            visited_upstream: Set[str] = set()
            u_queue = list(forward_deps.get(asset.id, []))
            while u_queue:
                curr = u_queue.pop(0)
                if curr not in visited_upstream and curr != asset.id:
                    visited_upstream.add(curr)
                    u_queue.extend(forward_deps.get(curr, []))

            asset.upstream_dependencies = list(visited_upstream)

        # Build Graph representation
        nodes: List[BlastRadiusNode] = []
        for a in assets:
            nodes.append(BlastRadiusNode(
                id=a.id,
                label=a.name,
                repo=a.repo_name,
                type=a.asset_type,
                blast_radius=a.blast_radius_score,
                staleness_days=a.git.days_since_last_commit,
                risk_level=a.risk_level,
                last_status=a.execution.last_status
            ))

        # Deduplicate edges
        unique_edges: List[BlastRadiusEdge] = []
        seen_edges = set()
        for e in edges:
            key = (e.source, e.target, e.relationship)
            if key not in seen_edges:
                seen_edges.add(key)
                unique_edges.append(e)

        return BlastRadiusGraph(nodes=nodes, edges=unique_edges)

    @classmethod
    def simulate_blast_impact(cls, asset_id: str, assets: List[AnsibleAsset]) -> Dict:
        """Simulate the blast radius if an asset is modified, deprecated, or fails."""
        target_asset = next((a for a in assets if a.id == asset_id), None)
        if not target_asset:
            return {"error": "Asset not found"}

        direct_dependents = []
        indirect_dependents = []
        affected_repos = set()
        environments = set()

        for dep_id in target_asset.downstream_dependents:
            dep_asset = next((a for a in assets if a.id == dep_id), None)
            if dep_asset:
                affected_repos.add(dep_asset.repo_name)
                if dep_asset.execution.last_environment:
                    environments.add(dep_asset.execution.last_environment)
                
                # Check if direct
                if any(asset_id in dep_asset.included_roles or asset_id in dep_asset.included_tasks for _ in [1]):
                    direct_dependents.append({
                        "id": dep_asset.id,
                        "name": dep_asset.name,
                        "repo": dep_asset.repo_name,
                        "type": dep_asset.asset_type
                    })
                else:
                    indirect_dependents.append({
                        "id": dep_asset.id,
                        "name": dep_asset.name,
                        "repo": dep_asset.repo_name,
                        "type": dep_asset.asset_type
                    })

        severity = "LOW"
        if target_asset.blast_radius_score >= 5:
            severity = "CRITICAL"
        elif target_asset.blast_radius_score >= 3:
            severity = "HIGH"
        elif target_asset.blast_radius_score >= 1:
            severity = "MEDIUM"

        return {
            "target_asset": {
                "id": target_asset.id,
                "name": target_asset.name,
                "repo": target_asset.repo_name,
                "staleness_days": target_asset.git.days_since_last_commit,
                "blast_radius_score": target_asset.blast_radius_score,
            },
            "impact_severity": severity,
            "affected_repo_count": len(affected_repos),
            "affected_repos": list(affected_repos),
            "affected_environments": list(environments) or ["staging", "production"],
            "direct_dependents": direct_dependents,
            "indirect_dependents": indirect_dependents,
            "recommendation": (
                "DO NOT modify directly without regression testing across all dependent repos. "
                "Consider establishing a versioned contract or splitting role."
                if severity in ["CRITICAL", "HIGH"] else "Safe to modify with standard repo CI."
            )
        }
