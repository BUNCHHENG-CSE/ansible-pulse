from typing import List, Tuple
from ..models.schemas import (
    AnsibleAsset, RiskLevel, RiskFlagItem,
    ExecutionStatus, DuplicateCluster
)

class RiskScorer:
    @classmethod
    def evaluate_risks(
        cls,
        assets: List[AnsibleAsset],
        duplicate_clusters: List[DuplicateCluster]
    ) -> List[RiskFlagItem]:
        """
        Evaluate multi-factor risk scores and generate prioritized risk flags.
        Flag 'referenced by many projects but unmaintained recently' as high-risk assets.
        """
        risk_items: List[RiskFlagItem] = []

        # Map assets involved in duplicate clusters
        cluster_asset_ids = set()
        for c in duplicate_clusters:
            for v in c.variants:
                task_id = v.get("task_id", "")
                for a in assets:
                    if task_id.startswith(a.relative_path) or v.get("repo_name") == a.repo_name and a.name in v.get("task_name", ""):
                        cluster_asset_ids.add(a.id)

        for asset in assets:
            score = 0.0
            reasons: List[str] = []
            flags: List[str] = []
            primary_flag = "Low Risk Script"
            suggested_action = "No action needed."

            # 1. Blast Radius Risk Factor (0 - 40 points)
            br = asset.blast_radius_score
            if br >= 5:
                score += 40.0
                reasons.append(f"Massive Blast Radius: Referenced by {br} downstream playbooks/services.")
            elif br >= 3:
                score += 30.0
                reasons.append(f"High Blast Radius: Referenced by {br} downstream playbooks/services.")
            elif br >= 1:
                score += 15.0
                reasons.append(f"Moderate Blast Radius: Referenced by {br} dependent asset(s).")

            # 2. Staleness & Abandonment Factor (0 - 35 points)
            days_unmaintained = asset.git.days_since_last_commit
            if days_unmaintained >= 365:
                score += 35.0
                reasons.append(f"Severely unmaintained: Zero commits in {days_unmaintained} days (> 1 year).")
            elif days_unmaintained >= 180:
                score += 25.0
                reasons.append(f"Stale asset: Zero commits in {days_unmaintained} days (> 6 months).")
            elif days_unmaintained >= 90:
                score += 10.0
                reasons.append(f"Untouched for {days_unmaintained} days.")

            # SPECIFIC FLAG: "Referenced by many projects but unmaintained recently"
            if br >= 2 and days_unmaintained >= 180:
                flags.append("ZOMBIE_CORE_ASSET")
                primary_flag = "Zombie Core Asset (High Blast + Unmaintained)"
                suggested_action = (
                    f"Audit {asset.name} immediately. It anchors {br} downstream assets "
                    f"but hasn't been updated in {days_unmaintained} days. Assign an active owner and verify CI test coverage."
                )

            # 3. Execution Health Risk Factor (0 - 15 points)
            if asset.execution.last_status in [ExecutionStatus.FAILED, ExecutionStatus.UNREACHABLE]:
                score += 15.0
                reasons.append(f"Execution Failure: Last CI run status was '{asset.execution.last_status.value}'.")
                flags.append("EXECUTION_FAILURE")
                if primary_flag == "Low Risk Script":
                    primary_flag = "Recent Execution Failure in CI/CD"
                    suggested_action = "Inspect recent Ansible run logs; resolve failed task or host connectivity."
            elif asset.execution.last_status == ExecutionStatus.NEVER_RUN and br > 0:
                score += 10.0
                reasons.append("Referenced asset has no record of verified CI execution.")

            # 4. Duplicate Sprawl & Drift Factor (0 - 10 points)
            if asset.id in cluster_asset_ids:
                score += 10.0
                reasons.append("Identified as part of a divergent duplicate functionality cluster.")
                flags.append("DRIFTED_DUPLICATE")
                if primary_flag == "Low Risk Script":
                    primary_flag = "Fragmented / Duplicate Implementation"
                    suggested_action = "Consolidate into canonical shared role and parameterize variations."

            # 5. Volatility / Author Churn
            if asset.git.author_count >= 4 and asset.git.commits_last_90d >= 5:
                score += 10.0
                reasons.append(f"High Churn Volatility: Edited by {asset.git.author_count} different authors recently.")
                flags.append("HIGH_CHURN")

            # Final Risk Level Determination
            total_score = min(100.0, round(score, 1))
            asset.risk_score = total_score
            asset.risk_flags = flags

            if total_score >= 65:
                asset.risk_level = RiskLevel.CRITICAL
            elif total_score >= 45:
                asset.risk_level = RiskLevel.HIGH
            elif total_score >= 25:
                asset.risk_level = RiskLevel.MEDIUM
            else:
                asset.risk_level = RiskLevel.LOW

            if asset.risk_level in [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM]:
                risk_items.append(RiskFlagItem(
                    asset_id=asset.id,
                    asset_name=asset.name,
                    repo_name=asset.repo_name,
                    asset_type=asset.asset_type,
                    risk_level=asset.risk_level,
                    risk_score=total_score,
                    blast_radius=asset.blast_radius_score,
                    staleness_days=asset.git.days_since_last_commit,
                    authors_count=asset.git.author_count,
                    last_execution_status=asset.execution.last_status,
                    primary_risk_flag=primary_flag,
                    detailed_reasons=reasons,
                    suggested_action=suggested_action
                ))

        # Sort highest risk first
        risk_items.sort(key=lambda x: x.risk_score, reverse=True)
        return risk_items
