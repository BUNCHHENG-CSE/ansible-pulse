import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import type { AnsibleAsset, AnsibleTask, ScriptType } from '../types';

export const ANSIBLE_TASK_CONTROL_KEYS = new Set([
  'name', 'when', 'tags', 'notify', 'register', 'become', 'become_user',
  'become_method', 'ignore_errors', 'delegate_to', 'run_once', 'vars',
  'loop', 'with_items', 'with_dict', 'with_file', 'with_together', 'with_sequence',
  'loop_control', 'failed_when', 'changed_when', 'until', 'retries', 'delay',
  'check_mode', 'diff', 'environment', 'no_log', 'args', 'async', 'poll',
  'listen', 'block', 'rescue', 'always'
]);

export const MODULE_NORMALIZER: Record<string, string> = {
  'ansible.builtin.apt': 'apt',
  'ansible.builtin.yum': 'yum',
  'ansible.builtin.dnf': 'dnf',
  'ansible.builtin.package': 'package',
  'ansible.builtin.service': 'service',
  'ansible.builtin.systemd': 'systemd',
  'ansible.builtin.systemd_service': 'systemd',
  'ansible.builtin.template': 'template',
  'ansible.builtin.copy': 'copy',
  'ansible.builtin.file': 'file',
  'ansible.builtin.lineinfile': 'lineinfile',
  'ansible.builtin.blockinfile': 'blockinfile',
  'ansible.builtin.user': 'user',
  'ansible.builtin.group': 'group',
  'ansible.builtin.command': 'command',
  'ansible.builtin.shell': 'shell',
  'ansible.builtin.raw': 'raw',
  'ansible.builtin.git': 'git',
  'ansible.builtin.get_url': 'get_url',
  'ansible.builtin.uri': 'uri',
  'ansible.builtin.unarchive': 'unarchive',
  'ansible.builtin.cron': 'cron',
  'ansible.builtin.stat': 'stat',
  'ansible.builtin.debug': 'debug',
  'ansible.builtin.set_fact': 'set_fact',
  'ansible.builtin.fail': 'fail',
  'ansible.builtin.assert': 'assert',
  'ansible.builtin.include_tasks': 'include_tasks',
  'ansible.builtin.import_tasks': 'import_tasks',
  'ansible.builtin.include_role': 'include_role',
  'ansible.builtin.import_role': 'import_role',
  'ansible.builtin.import_playbook': 'import_playbook',
  'community.docker.docker_container': 'docker_container',
  'community.docker.docker_image': 'docker_image',
  'community.general.docker_container': 'docker_container',
};

export class AnsibleYamlParser {
  static loadYaml(filePath: string): any {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Parse with custom tags ignored like !vault
      return YAML.parse(content, {
        customTags: [
          { tag: '!vault', resolve: (str: any) => str },
          { tag: '!unsafe', resolve: (str: any) => str }
        ]
      } as any);
    } catch {
      return null;
    }
  }

  static extractModuleAndParams(taskDict: Record<string, any>): [string, Record<string, any>] {
    if ('action' in taskDict) {
      const actionVal = taskDict.action;
      if (typeof actionVal === 'object' && actionVal !== null) {
        const mod = Object.keys(actionVal)[0] || 'unknown';
        const params = actionVal[mod] || {};
        const normModule = MODULE_NORMALIZER[mod] || mod.split('.').pop() || mod;
        return [normModule, typeof params === 'object' ? params : { _raw: String(params) }];
      } else if (typeof actionVal === 'string') {
        const parts = actionVal.trim().split(/\s+/, 2);
        const mod = parts[0];
        const normModule = MODULE_NORMALIZER[mod] || mod.split('.').pop() || mod;
        return [normModule, { _raw: parts[1] || '' }];
      }
    }

    const candidateModules = Object.keys(taskDict).filter(k => !ANSIBLE_TASK_CONTROL_KEYS.has(k));
    if (candidateModules.length === 0) {
      return ['unknown', {}];
    }

    const moduleKey = candidateModules[0];
    const params = taskDict[moduleKey];
    const normModule = MODULE_NORMALIZER[moduleKey] || moduleKey.split('.').pop() || moduleKey;
    const finalParams = (typeof params === 'object' && params !== null) ? params : { _raw: params != null ? String(params) : '' };

    return [normModule, finalParams];
  }

  static computeTaskSignature(module: string, params: Record<string, any>, name: string): string {
    let target = '';
    for (const key of ['name', 'path', 'dest', 'src', 'repo', 'pkg', 'service']) {
      const val = params[key];
      if (val != null) {
        if (Array.isArray(val)) {
          target = [...val].sort().join(',');
        } else {
          target = String(val).trim();
        }
        break;
      }
    }

    if (!target && params._raw) {
      target = String(params._raw).trim();
    }

    const cleanedTarget = target.replace(/\{\{\s*([a-zA-Z0-9_\.\-]+)\s*\}\}/g, '__VAR__').toLowerCase();
    const cleanedName = name.replace(/\{\{\s*([a-zA-Z0-9_\.\-]+)\s*\}\}/g, '__VAR__').toLowerCase();

    return `${module}::${cleanedTarget || cleanedName}`;
  }

  static parseTaskEntry(taskDict: Record<string, any>, filePath: string, idx: number): AnsibleTask | null {
    if (typeof taskDict !== 'object' || taskDict === null) return null;

    const name = taskDict.name || `Unnamed task #${idx + 1}`;
    const [module, params] = this.extractModuleAndParams(taskDict);

    let notifyVal = taskDict.notify || [];
    if (typeof notifyVal === 'string') notifyVal = [notifyVal];
    else if (!Array.isArray(notifyVal)) notifyVal = [];

    let tagsVal = taskDict.tags || [];
    if (typeof tagsVal === 'string') tagsVal = [tagsVal];
    else if (!Array.isArray(tagsVal)) tagsVal = [];

    const signature = this.computeTaskSignature(module, params, name);
    const taskId = `${filePath}:${idx}:${module}`;

    return {
      id: taskId,
      name,
      module,
      parameters: params,
      file_path: filePath,
      line_number: idx + 1,
      when: taskDict.when ? String(taskDict.when) : null,
      tags: tagsVal,
      notify: notifyVal,
      normalized_signature: signature
    };
  }

  static parseFile(fullPath: string, repoRoot: string, repoName: string): AnsibleAsset | null {
    const relPath = path.relative(repoRoot, fullPath).replace(/\\/g, '/');
    const filename = path.basename(fullPath).toLowerCase();

    if (!filename.endsWith('.yml') && !filename.endsWith('.yaml')) return null;
    if (relPath.includes('/.') || relPath.includes('node_modules/') || relPath.includes('.git/')) return null;

    const doc = this.loadYaml(fullPath);
    if (doc === null || doc === undefined) return null;

    const normRel = '/' + relPath.replace(/^\//, '');
    let assetType: ScriptType = 'playbook';

    if (normRel.includes('/roles/')) {
      if (normRel.includes('/tasks/')) assetType = 'role';
      else if (normRel.includes('/handlers/')) assetType = 'handler_file';
      else if (normRel.includes('/vars/') || normRel.includes('/defaults/')) assetType = 'vars_file';
      else assetType = 'role';
    } else if (normRel.includes('/tasks/') || filename.includes('tasks.yml') || filename.endsWith('_tasks.yml')) {
      assetType = 'task_file';
    } else if (Array.isArray(doc) && doc.some(item => typeof item === 'object' && item !== null && ('hosts' in item || 'import_playbook' in item))) {
      assetType = 'playbook';
    }

    const tasks: AnsibleTask[] = [];
    const includedRoles: string[] = [];
    const includedTasks: string[] = [];
    const importedPlaybooks: string[] = [];
    let targetHosts: string | null = null;

    if (Array.isArray(doc)) {
      for (let i = 0; i < doc.length; i++) {
        const item = doc[i];
        if (typeof item !== 'object' || item === null) continue;

        if ('hosts' in item) {
          targetHosts = String(item.hosts);
        }
        if ('import_playbook' in item) {
          importedPlaybooks.push(String(item.import_playbook));
        }

        if ('roles' in item && Array.isArray(item.roles)) {
          for (const r of item.roles) {
            if (typeof r === 'string') includedRoles.push(r);
            else if (typeof r === 'object' && r !== null) {
              if (r.role) includedRoles.push(String(r.role));
              else if (r.name) includedRoles.push(String(r.name));
            }
          }
        }

        for (const section of ['tasks', 'pre_tasks', 'post_tasks', 'handlers']) {
          if (section in item && Array.isArray(item[section])) {
            for (let subIdx = 0; subIdx < item[section].length; subIdx++) {
              const t = item[section][subIdx];
              if (typeof t === 'object' && t !== null) {
                const taskObj = this.parseTaskEntry(t, relPath, tasks.length);
                if (taskObj) {
                  tasks.push(taskObj);
                  if (taskObj.module === 'include_role' || taskObj.module === 'import_role') {
                    const roleName = taskObj.parameters.name || taskObj.parameters._raw;
                    if (roleName) includedRoles.push(String(roleName));
                  } else if (taskObj.module === 'include_tasks' || taskObj.module === 'import_tasks') {
                    const fileName = taskObj.parameters.file || taskObj.parameters._raw;
                    if (fileName) includedTasks.push(String(fileName));
                  }
                }
              }
            }
          }
        }

        const keys = Object.keys(item);
        if (keys.some(k => k === 'name' || k === 'action' || Object.values(MODULE_NORMALIZER).includes(k))) {
          if (!('hosts' in item)) {
            const taskObj = this.parseTaskEntry(item, relPath, tasks.length);
            if (taskObj) {
              tasks.push(taskObj);
              if (taskObj.module === 'include_role' || taskObj.module === 'import_role') {
                const roleName = taskObj.parameters.name || taskObj.parameters._raw;
                if (roleName) includedRoles.push(String(roleName));
              } else if (taskObj.module === 'include_tasks' || taskObj.module === 'import_tasks') {
                const fileName = taskObj.parameters.file || taskObj.parameters._raw;
                if (fileName) includedTasks.push(String(fileName));
              }
            }
          }
        }
      }
    } else if (typeof doc === 'object' && doc !== null) {
      const taskObj = this.parseTaskEntry(doc, relPath, 0);
      if (taskObj) tasks.push(taskObj);
    }

    const assetId = `${repoName}::${relPath}`;
    let name = path.basename(fullPath);
    if (normRel.includes('/roles/')) {
      const parts = normRel.split('/');
      const roleIdx = parts.indexOf('roles');
      if (roleIdx !== -1 && roleIdx + 1 < parts.length) {
        name = `role:${parts[roleIdx + 1]}`;
      }
    }

    return {
      id: assetId,
      name,
      repo_name: repoName,
      relative_path: relPath,
      full_path: fullPath,
      asset_type: assetType,
      tasks_count: tasks.length,
      tasks,
      included_roles: Array.from(new Set(includedRoles)),
      included_tasks: Array.from(new Set(includedTasks)),
      imported_playbooks: Array.from(new Set(importedPlaybooks)),
      target_hosts: targetHosts,
      git: {
        last_commit_date: null,
        days_since_last_commit: 0,
        total_commits: 0,
        commits_last_90d: 0,
        authors: [],
        author_count: 0,
        churn_lines_added: 0,
        churn_lines_deleted: 0,
        staleness_score: 0
      },
      execution: {
        last_run_timestamp: null,
        days_since_last_run: null,
        last_status: 'never_run',
        run_count_30d: 0,
        failure_rate_30d: 0,
        active_in_production: false,
        last_environment: null,
        recent_hosts_targeted: []
      },
      blast_radius_score: 0,
      downstream_dependents: [],
      upstream_dependencies: [],
      risk_level: 'low',
      risk_score: 0,
      risk_flags: []
    };
  }
}
