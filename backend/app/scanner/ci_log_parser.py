import os
import json
import re
from datetime import datetime, timezone
from typing import Dict, List, Optional
from ..models.schemas import ExecutionMetadata, ExecutionStatus

class CILogParser:
    def __init__(self, log_directory: Optional[str] = None):
        self.log_directory = log_directory
        self.execution_cache: Dict[str, ExecutionMetadata] = {}

    def load_execution_history(self, log_dir: Optional[str] = None) -> Dict[str, ExecutionMetadata]:
        target_dir = log_dir or self.log_directory
        if not target_dir or not os.path.exists(target_dir):
            return {}

        records: Dict[str, List[Dict]] = {}

        # Look for .json logs or .log files
        for root, _, files in os.walk(target_dir):
            for file in files:
                full_path = os.path.join(root, file)
                if file.endswith(".json"):
                    self._parse_json_log(full_path, records)
                elif file.endswith(".log") or file.endswith(".txt"):
                    self._parse_raw_text_log(full_path, records)

        # Consolidate into ExecutionMetadata per script/role
        results: Dict[str, ExecutionMetadata] = {}
        for script_key, run_list in records.items():
            results[script_key] = self._aggregate_runs(run_list)

        self.execution_cache = results
        return results

    def _parse_json_log(self, filepath: str, records: Dict[str, List[Dict]]):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                
            runs = data if isinstance(data, list) else [data]
            for run in runs:
                script = run.get("playbook") or run.get("target_script") or run.get("role")
                if not script:
                    continue
                script_norm = script.replace("\\", "/").lower()
                if script_norm not in records:
                    records[script_norm] = []
                records[script_norm].append(run)
        except Exception:
            pass

    def _parse_raw_text_log(self, filepath: str, records: Dict[str, List[Dict]]):
        try:
            with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                text = f.read()

            # Detect PLAYBOOK: <name>
            pb_match = re.search(r'PLAYBOOK:\s*([^\s]+)', text)
            if not pb_match:
                return

            playbook_name = pb_match.group(1).replace("\\", "/").lower()
            
            # Detect PLAY RECAP: ok=X changed=Y unreachable=Z failed=W
            recap_match = re.search(r'PLAY RECAP \*+\s*\n([^\n]+)', text)
            status = ExecutionStatus.SUCCESS
            if recap_match:
                recap_line = recap_match.group(1)
                if "failed=" in recap_line and not re.search(r'failed=0(\s|$)', recap_line):
                    status = ExecutionStatus.FAILED
                elif "unreachable=" in recap_line and not re.search(r'unreachable=0(\s|$)', recap_line):
                    status = ExecutionStatus.UNREACHABLE
                elif "changed=" in recap_line and not re.search(r'changed=0(\s|$)', recap_line):
                    status = ExecutionStatus.CHANGED

            mtime = os.path.getmtime(filepath)
            dt = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()

            if playbook_name not in records:
                records[playbook_name] = []

            records[playbook_name].append({
                "playbook": playbook_name,
                "timestamp": dt,
                "status": status.value,
                "environment": "production" if "prod" in filepath.lower() else "staging"
            })
        except Exception:
            pass

    def _aggregate_runs(self, run_list: List[Dict]) -> ExecutionMetadata:
        if not run_list:
            return ExecutionMetadata()

        # Sort descending by timestamp
        sorted_runs = sorted(
            run_list,
            key=lambda x: x.get("timestamp", ""),
            reverse=True
        )
        latest = sorted_runs[0]
        ts_str = latest.get("timestamp")
        days_since = None
        if ts_str:
            try:
                dt = datetime.fromisoformat(ts_str)
                days_since = max(0, (datetime.now(timezone.utc) - dt).days)
            except Exception:
                pass

        total_runs = len(sorted_runs)
        failed_runs = sum(1 for r in sorted_runs if r.get("status") in ["failed", "unreachable"])
        failure_rate = round(failed_runs / total_runs, 2) if total_runs > 0 else 0.0

        status_str = latest.get("status", "never_run").lower()
        status_enum = ExecutionStatus.NEVER_RUN
        for s in ExecutionStatus:
            if s.value == status_str:
                status_enum = s
                break

        is_prod = any(r.get("environment") == "production" for r in sorted_runs)
        recent_env = latest.get("environment", "staging")

        return ExecutionMetadata(
            last_run_timestamp=ts_str,
            days_since_last_run=days_since,
            last_status=status_enum,
            run_count_30d=total_runs,
            failure_rate_30d=failure_rate,
            active_in_production=is_prod,
            last_environment=recent_env,
            recent_hosts_targeted=latest.get("hosts", ["default-host-pool"])
        )

    def match_execution_for_asset(self, asset_rel_path: str, asset_name: str) -> ExecutionMetadata:
        """Find matching execution stats for a given asset path or role name."""
        norm_path = asset_rel_path.replace("\\", "/").lower()
        norm_name = asset_name.lower()

        # Direct path match
        if norm_path in self.execution_cache:
            return self.execution_cache[norm_path]

        # Partial match
        for key, meta in self.execution_cache.items():
            if key.endswith(norm_path) or norm_path.endswith(key) or norm_name == key or f"role:{norm_name}" == key:
                return meta

        return ExecutionMetadata()
