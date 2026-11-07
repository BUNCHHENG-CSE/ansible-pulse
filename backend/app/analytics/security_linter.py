import re
import uuid
from typing import List, Dict, Any, Tuple
from ..models.schemas import (
    AnsibleAsset, AnsibleTask, SecurityFinding,
    SecuritySeverity, SecurityComplianceSummary
)

class SecurityLinter:
    """
    Static AST Security & Compliance Linter for Ansible & IaC configurations.
    Scans modules, tasks, and parameters for security anti-patterns, plain-text
    credentials, dangerous permissions, and non-idempotent scripts.
    """

    SECRET_KEY_PATTERNS = re.compile(
        r"(password|passwd|secret|token|api_key|apikey|auth_token|private_key|aws_secret|db_pass)",
        re.IGNORECASE
    )
    VAULT_OR_VAR_PATTERN = re.compile(r"^\{\{.*\}\}$|!vault")
    SHELL_NATIVE_CANDIDATES = {
        "apt": ["apt-get install", "apt install"],
        "yum": ["yum install", "dnf install"],
        "service": ["systemctl start", "systemctl restart", "service start", "service restart"],
        "git": ["git clone", "git pull"],
        "user": ["useradd", "adduser"],
        "file": ["mkdir ", "chmod ", "chown ", "rm -rf "]
    }

    @classmethod
    def audit_assets(cls, assets: List[AnsibleAsset]) -> SecurityComplianceSummary:
        findings: List[SecurityFinding] = []
        rule_breakdown: Dict[str, int] = {}

        for asset in assets:
            for task in asset.tasks:
                task_findings = cls._audit_task(task, asset)
                for f in task_findings:
                    findings.append(f)
                    rule_breakdown[f.rule_id] = rule_breakdown.get(f.rule_id, 0) + 1

        crit_count = sum(1 for f in findings if f.severity == SecuritySeverity.CRITICAL)
        high_count = sum(1 for f in findings if f.severity == SecuritySeverity.HIGH)
        med_count = sum(1 for f in findings if f.severity == SecuritySeverity.MEDIUM)
        low_count = sum(1 for f in findings if f.severity == SecuritySeverity.LOW)

        # Calculate compliance score (100 base, deductions for findings)
        penalty = (crit_count * 15.0) + (high_count * 8.0) + (med_count * 3.0) + (low_count * 1.0)
        overall_score = max(10.0, round(100.0 - penalty, 1))

        if overall_score >= 90:
            grade = "A"
        elif overall_score >= 80:
            grade = "B"
        elif overall_score >= 70:
            grade = "C"
        elif overall_score >= 50:
            grade = "D"
        else:
            grade = "F"

        return SecurityComplianceSummary(
            overall_score=overall_score,
            grade=grade,
            total_findings=len(findings),
            critical_count=crit_count,
            high_count=high_count,
            medium_count=med_count,
            low_count=low_count,
            rule_breakdown=rule_breakdown,
            findings=findings
        )

    @classmethod
    def _audit_task(cls, task: AnsibleTask, asset: AnsibleAsset) -> List[SecurityFinding]:
        results: List[SecurityFinding] = []
        mod = (task.module or "").lower()
        params = task.parameters or {}

        # Rule 1: SEC001 - Plaintext Secrets in Parameters
        for key, val in params.items():
            if isinstance(val, (str, int)) and cls.SECRET_KEY_PATTERNS.search(str(key)):
                val_str = str(val).strip()
                # Check if it's NOT parameterized (i.e. literal secret)
                if not cls.VAULT_OR_VAR_PATTERN.search(val_str) and len(val_str) > 0 and val_str.lower() not in ["yes", "no", "true", "false", "present", "absent"]:
                    results.append(SecurityFinding(
                        id=str(uuid.uuid4())[:8],
                        rule_id="SEC001_PLAINTEXT_SECRET",
                        severity=SecuritySeverity.CRITICAL,
                        title="Plaintext Hardcoded Secret in Parameters",
                        description=f"Task '{task.name}' hardcodes sensitive key '{key}' with unencrypted literal value.",
                        asset_id=asset.id,
                        repo_name=asset.repo_name,
                        file_path=asset.relative_path,
                        line_number=task.line_number,
                        task_name=task.name,
                        module=task.module,
                        offending_snippet=f"{key}: {val_str[:3]}*** (redacted)",
                        remediation_advice=f"Encrypt this value using Ansible Vault (`ansible-vault encrypt_string`) or reference an external secret store."
                    ))

        # Rule 2: SEC002 - Insecure World-Writable File Modes
        mode_val = str(params.get("mode", "")).strip().replace("'", "").replace('"', '')
        if mode_val in ["0777", "777", "0666", "666", "a+rwx"]:
            results.append(SecurityFinding(
                id=str(uuid.uuid4())[:8],
                rule_id="SEC002_INSECURE_PERMS",
                severity=SecuritySeverity.HIGH,
                title="Excessively Permissive File Mode (World-Writable)",
                description=f"Task '{task.name}' grants world-writable permissions (`mode: {mode_val}`).",
                asset_id=asset.id,
                repo_name=asset.repo_name,
                file_path=asset.relative_path,
                line_number=task.line_number,
                task_name=task.name,
                module=task.module,
                offending_snippet=f"mode: '{mode_val}'",
                remediation_advice="Restrict permissions to least privilege (e.g. `mode: '0644'` for config files, `mode: '0755'` for executables)."
            ))

        # Rule 3: SEC003 - Insecure Downloads & Pipe to Shell
        if mod in ["get_url", "uri"]:
            if "checksum" not in params and "validate_certs" not in params:
                results.append(SecurityFinding(
                    id=str(uuid.uuid4())[:8],
                    rule_id="SEC003_INSECURE_DOWNLOAD",
                    severity=SecuritySeverity.HIGH,
                    title="Remote Download Without Cryptographic Checksum",
                    description=f"Task '{task.name}' downloads remote assets without verifying SHA256 integrity.",
                    asset_id=asset.id,
                    repo_name=asset.repo_name,
                    file_path=asset.relative_path,
                    line_number=task.line_number,
                    task_name=task.name,
                    module=task.module,
                    offending_snippet=f"url: {params.get('url', 'unknown')}",
                    remediation_advice="Always supply the `checksum: 'sha256:<hash>'` parameter to prevent supply-chain tampering."
                ))

        if mod in ["shell", "command"]:
            raw_cmd = str(params.get("_raw", "")) or str(params.get("_raw_params", "")) or str(params.get("cmd", "")) or " ".join(str(v) for v in params.values())
            if "curl " in raw_cmd and ("| sh" in raw_cmd or "| bash" in raw_cmd):
                results.append(SecurityFinding(
                    id=str(uuid.uuid4())[:8],
                    rule_id="SEC003_PIPE_TO_SHELL",
                    severity=SecuritySeverity.CRITICAL,
                    title="Insecure Pipe Remote Web Content Directly to Shell",
                    description=f"Task '{task.name}' pipes unauthenticated remote curl/wget directly to bash/sh.",
                    asset_id=asset.id,
                    repo_name=asset.repo_name,
                    file_path=asset.relative_path,
                    line_number=task.line_number,
                    task_name=task.name,
                    module=task.module,
                    offending_snippet=raw_cmd[:80],
                    remediation_advice="Download files to temporary location with verification before execution or use dedicated package management."
                ))

            # Rule 4: SEC004 - Non-idempotent raw command where native module exists
            for candidate_mod, patterns in cls.SHELL_NATIVE_CANDIDATES.items():
                if any(p in raw_cmd for p in patterns):
                    results.append(SecurityFinding(
                        id=str(uuid.uuid4())[:8],
                        rule_id="SEC004_NON_IDEMPOTENT_COMMAND",
                        severity=SecuritySeverity.MEDIUM,
                        title=f"Non-Idempotent Shell Command Used Instead of '{candidate_mod}' Module",
                        description=f"Task '{task.name}' invokes raw command '{raw_cmd[:40]}...' instead of the idempotent native Ansible module '{candidate_mod}'.",
                        asset_id=asset.id,
                        repo_name=asset.repo_name,
                        file_path=asset.relative_path,
                        line_number=task.line_number,
                        task_name=task.name,
                        module=task.module,
                        offending_snippet=raw_cmd[:60],
                        remediation_advice=f"Replace `{mod}` with Ansible's native `{candidate_mod}` module to guarantee idempotency and error handling."
                    ))
                    break

        # Rule 5: SEC005 - Deprecated Include Syntax
        if mod == "include":
            results.append(SecurityFinding(
                id=str(uuid.uuid4())[:8],
                rule_id="SEC005_DEPRECATED_SYNTAX",
                severity=SecuritySeverity.LOW,
                title="Deprecated 'include' Directive",
                description=f"Task '{task.name}' uses legacy bare `include` which is deprecated in modern Ansible versions.",
                asset_id=asset.id,
                repo_name=asset.repo_name,
                file_path=asset.relative_path,
                line_number=task.line_number,
                task_name=task.name,
                module=task.module,
                offending_snippet="include: ...",
                remediation_advice="Migrate to `ansible.builtin.include_tasks` or `ansible.builtin.import_tasks`."
            ))

        return results
