import fs from 'fs';
import path from 'path';
import type { ExecutionMetadata, ExecutionStatus } from '../types';

export class CILogParser {
  private logDirectory: string | null;
  public executionCache: Record<string, ExecutionMetadata> = {};

  constructor(logDirectory: string | null = null) {
    this.logDirectory = logDirectory;
  }

  loadExecutionHistory(logDir?: string | null): Record<string, ExecutionMetadata> {
    const targetDir = logDir || this.logDirectory;
    if (!targetDir || !fs.existsSync(targetDir)) {
      return {};
    }

    const records: Record<string, any[]> = {};

    const walkDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile()) {
          if (entry.name.endsWith('.json')) {
            this.parseJsonLog(fullPath, records);
          } else if (entry.name.endsWith('.log') || entry.name.endsWith('.txt')) {
            this.parseRawTextLog(fullPath, records);
          }
        }
      }
    };

    walkDir(targetDir);

    const results: Record<string, ExecutionMetadata> = {};
    for (const [scriptKey, runList] of Object.entries(records)) {
      results[scriptKey] = this.aggregateRuns(runList);
    }

    this.executionCache = results;
    return results;
  }

  private parseJsonLog(filePath: string, records: Record<string, any[]>): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const runs = Array.isArray(data) ? data : [data];

      for (const run of runs) {
        const script = run.playbook || run.target_script || run.role;
        if (!script) continue;
        const scriptNorm = String(script).replace(/\\/g, '/').toLowerCase();
        if (!records[scriptNorm]) records[scriptNorm] = [];
        records[scriptNorm].push(run);
      }
    } catch {
      // Ignore invalid JSON logs
    }
  }

  private parseRawTextLog(filePath: string, records: Record<string, any[]>): void {
    try {
      const text = fs.readFileSync(filePath, 'utf-8');
      const pbMatch = text.match(/PLAYBOOK:\s*([^\s]+)/);
      if (!pbMatch) return;

      const playbookName = pbMatch[1].replace(/\\/g, '/').toLowerCase();
      const recapMatch = text.match(/PLAY RECAP \*+\s*\n([^\n]+)/);

      let status: ExecutionStatus = 'success';
      if (recapMatch) {
        const recapLine = recapMatch[1];
        if (recapLine.includes('failed=') && !/failed=0(\s|$)/.test(recapLine)) {
          status = 'failed';
        } else if (recapLine.includes('unreachable=') && !/unreachable=0(\s|$)/.test(recapLine)) {
          status = 'unreachable';
        } else if (recapLine.includes('changed=') && !/changed=0(\s|$)/.test(recapLine)) {
          status = 'changed';
        }
      }

      const stats = fs.statSync(filePath);
      const dt = stats.mtime.toISOString();

      if (!records[playbookName]) records[playbookName] = [];
      records[playbookName].push({
        playbook: playbookName,
        timestamp: dt,
        status,
        environment: filePath.toLowerCase().includes('prod') ? 'production' : 'staging'
      });
    } catch {
      // Ignore read errors
    }
  }

  private aggregateRuns(runList: any[]): ExecutionMetadata {
    if (!runList || runList.length === 0) {
      return {
        last_run_timestamp: null,
        days_since_last_run: null,
        last_status: 'never_run',
        run_count_30d: 0,
        failure_rate_30d: 0.0,
        active_in_production: false,
        last_environment: null,
        recent_hosts_targeted: []
      };
    }

    const sortedRuns = [...runList].sort((a, b) => {
      const tA = a.timestamp || '';
      const tB = b.timestamp || '';
      return tB.localeCompare(tA);
    });

    const latest = sortedRuns[0];
    let daysSince: number | null = null;
    if (latest.timestamp) {
      const runDt = new Date(latest.timestamp).getTime();
      daysSince = Math.max(0, Math.floor((Date.now() - runDt) / (1000 * 60 * 60 * 24)));
    }

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const runs30d = sortedRuns.filter(r => r.timestamp && new Date(r.timestamp).getTime() >= thirtyDaysAgo);

    const failCount = runs30d.filter(r => r.status === 'failed' || r.status === 'unreachable').length;
    const failRate = runs30d.length > 0 ? Math.round((failCount / runs30d.length) * 100) / 100 : 0.0;

    const hasProd = runs30d.some(r => r.environment === 'production' && r.status !== 'failed');

    const hosts = Array.from(new Set(sortedRuns.slice(0, 5).flatMap(r => r.hosts_targeted || [])));

    return {
      last_run_timestamp: latest.timestamp || null,
      days_since_last_run: daysSince,
      last_status: (latest.status as ExecutionStatus) || 'success',
      run_count_30d: runs30d.length,
      failure_rate_30d: failRate,
      active_in_production: hasProd,
      last_environment: latest.environment || null,
      recent_hosts_targeted: hosts
    };
  }

  matchExecutionForAsset(relativePath: string, assetName: string): ExecutionMetadata {
    const relNorm = relativePath.replace(/\\/g, '/').toLowerCase();
    const nameNorm = assetName.toLowerCase();

    for (const [key, meta] of Object.entries(this.executionCache)) {
      if (key === relNorm || key.endsWith(relNorm) || relNorm.endsWith(key) || key.includes(nameNorm)) {
        return meta;
      }
    }

    return {
      last_run_timestamp: null,
      days_since_last_run: null,
      last_status: 'never_run',
      run_count_30d: 0,
      failure_rate_30d: 0.0,
      active_in_production: false,
      last_environment: null,
      recent_hosts_targeted: []
    };
  }
}
