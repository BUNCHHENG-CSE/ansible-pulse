import type {
  AnsibleAsset, AnsibleTask, SecurityFinding,
  SecurityComplianceSummary
} from '../types';

export class SecurityLinter {
  private static SECRET_KEY_PATTERNS = /(password|passwd|secret|token|api_key|apikey|auth_token|private_key|aws_secret|db_pass)/i;
  private static VAULT_OR_VAR_PATTERN = /^\{\{.*\}\}$|!vault/;
  private static SHELL_NATIVE_CANDIDATES: Record<string, string[]> = {
    apt: ['apt-get install', 'apt install'],
    yum: ['yum install', 'dnf install'],
    service: ['systemctl start', 'systemctl restart', 'service start', 'service restart'],
    git: ['git clone', 'git pull'],
    user: ['useradd', 'adduser'],
    file: ['mkdir ', 'chmod ', 'chown ', 'rm -rf ']
  };

  static auditAssets(assets: AnsibleAsset[]): SecurityComplianceSummary {
    const findings: SecurityFinding[] = [];
    const ruleBreakdown: Record<string, number> = {};

    for (const asset of assets) {
      for (const task of asset.tasks) {
        const taskFindings = this.auditTask(task, asset);
        for (const f of taskFindings) {
          findings.push(f);
          ruleBreakdown[f.rule_id] = (ruleBreakdown[f.rule_id] || 0) + 1;
        }
      }
    }

    const critCount = findings.filter(f => f.severity === 'critical').length;
    const highCount = findings.filter(f => f.severity === 'high').length;
    const medCount = findings.filter(f => f.severity === 'medium').length;
    const lowCount = findings.filter(f => f.severity === 'low').length;

    const penalty = (critCount * 15.0) + (highCount * 8.0) + (medCount * 3.0) + (lowCount * 1.0);
    const overallScore = Math.max(10.0, Math.round((100.0 - penalty) * 10) / 10);

    let grade = 'F';
    if (overallScore >= 90) grade = 'A';
    else if (overallScore >= 80) grade = 'B';
    else if (overallScore >= 70) grade = 'C';
    else if (overallScore >= 50) grade = 'D';

    return {
      overall_score: overallScore,
      grade,
      total_findings: findings.length,
      critical_count: critCount,
      high_count: highCount,
      medium_count: medCount,
      low_count: lowCount,
      rule_breakdown: ruleBreakdown,
      findings
    };
  }

  private static auditTask(task: AnsibleTask, asset: AnsibleAsset): SecurityFinding[] {
    const results: SecurityFinding[] = [];
    const mod = (task.module || '').toLowerCase();
    const params = task.parameters || {};

    // Rule 1: SEC001 - Plaintext Secrets
    for (const [key, val] of Object.entries(params)) {
      if ((typeof val === 'string' || typeof val === 'number') && this.SECRET_KEY_PATTERNS.test(key)) {
        const valStr = String(val).trim();
        if (
          !this.VAULT_OR_VAR_PATTERN.test(valStr) &&
          valStr.length > 0 &&
          !['yes', 'no', 'true', 'false', 'present', 'absent'].includes(valStr.toLowerCase())
        ) {
          results.push({
            id: Math.random().toString(36).substring(2, 10),
            rule_id: 'SEC001_PLAINTEXT_SECRET',
            severity: 'critical',
            title: 'Plaintext Hardcoded Secret in Parameters',
            description: `Task '${task.name}' hardcodes sensitive key '${key}' with unencrypted literal value.`,
            asset_id: asset.id,
            repo_name: asset.repo_name,
            file_path: asset.relative_path,
            line_number: task.line_number,
            task_name: task.name,
            module: task.module,
            offending_snippet: `${key}: ${valStr.substring(0, 3)}*** (redacted)`,
            remediation_advice: 'Encrypt this value using Ansible Vault (`ansible-vault encrypt_string`) or reference an external secret store.'
          });
        }
      }
    }

    // Rule 2: SEC002 - Insecure World-Writable File Modes
    const modeVal = String(params.mode || '').trim().replace(/['"]/g, '');
    if (['0777', '777', '0666', '666', 'a+rwx'].includes(modeVal)) {
      results.push({
        id: Math.random().toString(36).substring(2, 10),
        rule_id: 'SEC002_INSECURE_PERMS',
        severity: 'high',
        title: 'Excessively Permissive File Mode (World-Writable)',
        description: `Task '${task.name}' grants world-writable permissions (\`mode: ${modeVal}\`).`,
        asset_id: asset.id,
        repo_name: asset.repo_name,
        file_path: asset.relative_path,
        line_number: task.line_number,
        task_name: task.name,
        module: task.module,
        offending_snippet: `mode: '${modeVal}'`,
        remediation_advice: 'Restrict permissions to least privilege (e.g. `mode: \'0644\'` for config files, `mode: \'0755\'` for executables).'
      });
    }

    // Rule 3: SEC003 - Insecure Downloads & Pipe to Shell
    if (['get_url', 'uri'].includes(mod)) {
      if (!('checksum' in params) && !('validate_certs' in params)) {
        results.push({
          id: Math.random().toString(36).substring(2, 10),
          rule_id: 'SEC003_INSECURE_DOWNLOAD',
          severity: 'high',
          title: 'Remote Download Without Cryptographic Checksum',
          description: `Task '${task.name}' downloads remote assets without verifying SHA256 integrity.`,
          asset_id: asset.id,
          repo_name: asset.repo_name,
          file_path: asset.relative_path,
          line_number: task.line_number,
          task_name: task.name,
          module: task.module,
          offending_snippet: `url: ${params.url || 'unknown'}`,
          remediation_advice: 'Always supply the `checksum: \'sha256:<hash>\'` parameter to prevent supply-chain tampering.'
        });
      }
    }

    if (['shell', 'command'].includes(mod)) {
      const rawCmd = String(params._raw || params._raw_params || params.cmd || Object.values(params).join(' '));
      if (rawCmd.includes('curl ') && (rawCmd.includes('| sh') || rawCmd.includes('| bash'))) {
        results.push({
          id: Math.random().toString(36).substring(2, 10),
          rule_id: 'SEC003_PIPE_TO_SHELL',
          severity: 'critical',
          title: 'Insecure Pipe Remote Web Content Directly to Shell',
          description: `Task '${task.name}' pipes unauthenticated remote curl/wget directly to bash/sh.`,
          asset_id: asset.id,
          repo_name: asset.repo_name,
          file_path: asset.relative_path,
          line_number: task.line_number,
          task_name: task.name,
          module: task.module,
          offending_snippet: rawCmd.substring(0, 80),
          remediation_advice: 'Download files to temporary location with verification before execution or use dedicated package management.'
        });
      }

      // Rule 4: SEC004 - Non-idempotent raw command where native module exists
      for (const [candidateMod, patterns] of Object.entries(this.SHELL_NATIVE_CANDIDATES)) {
        if (patterns.some(p => rawCmd.includes(p))) {
          results.push({
            id: Math.random().toString(36).substring(2, 10),
            rule_id: 'SEC004_NON_IDEMPOTENT_COMMAND',
            severity: 'medium',
            title: `Non-Idempotent Shell Command Used Instead of '${candidateMod}' Module`,
            description: `Task '${task.name}' invokes raw command '${rawCmd.substring(0, 40)}...' instead of the idempotent native Ansible module '${candidateMod}'.`,
            asset_id: asset.id,
            repo_name: asset.repo_name,
            file_path: asset.relative_path,
            line_number: task.line_number,
            task_name: task.name,
            module: task.module,
            offending_snippet: rawCmd.substring(0, 60),
            remediation_advice: `Replace \`${mod}\` with Ansible's native \`${candidateMod}\` module to guarantee idempotency and error handling.`
          });
          break;
        }
      }
    }

    // Rule 5: SEC005 - Deprecated Include Syntax
    if (mod === 'include') {
      results.push({
        id: Math.random().toString(36).substring(2, 10),
        rule_id: 'SEC005_DEPRECATED_SYNTAX',
        severity: 'low',
        title: "Deprecated 'include' Directive",
        description: `Task '${task.name}' uses legacy bare \`include\` which is deprecated in modern Ansible versions.`,
        asset_id: asset.id,
        repo_name: asset.repo_name,
        file_path: asset.relative_path,
        line_number: task.line_number,
        task_name: task.name,
        module: task.module,
        offending_snippet: 'include: ...',
        remediation_advice: 'Migrate to `ansible.builtin.include_tasks` or `ansible.builtin.import_tasks`.'
      });
    }

    return results;
  }
}
