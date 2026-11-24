import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import type { GitMetadata } from '../types';

export class GitMiner {
  static getGitMetadata(filePath: string, repoRoot: string): GitMetadata {
    const gitDir = path.join(repoRoot, '.git');
    if (!fs.existsSync(repoRoot) || !fs.existsSync(gitDir)) {
      return this.fallbackFsMetadata(filePath);
    }

    try {
      const relPath = path.relative(repoRoot, filePath);

      // Single git invocation: one line per commit, newest first ("<ISO date>|<author>")
      const res = spawnSync(
        'git',
        ['-C', repoRoot, 'log', '--format=%aI|%an', '--', relPath],
        { encoding: 'utf-8', timeout: 5000 }
      );

      let lastCommitDateStr: string | null = null;
      let daysSinceLastCommit = 0;
      let authors: string[] = [];
      let totalCommits = 0;
      let commitsLast90d = 0;

      if (res.status === 0 && res.stdout && res.stdout.trim()) {
        const DAY_MS = 1000 * 60 * 60 * 24;
        const nowTime = Date.now();
        const cutoff90d = nowTime - 90 * DAY_MS;
        const authorSet = new Set<string>();
        const lines = res.stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

        for (const line of lines) {
          const sep = line.indexOf('|');
          const dateStr = sep >= 0 ? line.slice(0, sep) : line;
          const author = sep >= 0 ? line.slice(sep + 1).trim() : '';
          if (author) authorSet.add(author);
          const t = new Date(dateStr).getTime();
          if (!Number.isNaN(t) && t >= cutoff90d) commitsLast90d++;
        }

        totalCommits = lines.length;
        authors = Array.from(authorSet);
        lastCommitDateStr = lines[0].split('|')[0];
        const commitTime = new Date(lastCommitDateStr).getTime();
        daysSinceLastCommit = Number.isNaN(commitTime)
          ? 0
          : Math.max(0, Math.floor((nowTime - commitTime) / DAY_MS));
      }

      // 4. Compute staleness score (0.0 to 1.0)
      let stalenessScore = 0.0;
      if (daysSinceLastCommit <= 14) {
        stalenessScore = 0.0;
      } else if (daysSinceLastCommit >= 180) {
        stalenessScore = 1.0;
      } else {
        stalenessScore = Math.round((daysSinceLastCommit / 180.0) * 100) / 100;
      }

      return {
        last_commit_date: lastCommitDateStr,
        days_since_last_commit: daysSinceLastCommit,
        total_commits: totalCommits,
        commits_last_90d: commitsLast90d,
        authors,
        author_count: authors.length,
        churn_lines_added: 0,
        churn_lines_deleted: 0,
        staleness_score: stalenessScore
      };
    } catch {
      return this.fallbackFsMetadata(filePath);
    }
  }

  static fallbackFsMetadata(filePath: string): GitMetadata {
    if (!fs.existsSync(filePath)) {
      return {
        last_commit_date: null,
        days_since_last_commit: 0,
        total_commits: 0,
        commits_last_90d: 0,
        authors: [],
        author_count: 0,
        churn_lines_added: 0,
        churn_lines_deleted: 0,
        staleness_score: 0
      };
    }

    try {
      const stats = fs.statSync(filePath);
      const mtime = stats.mtime;
      const days = Math.max(0, Math.floor((Date.now() - mtime.getTime()) / (1000 * 60 * 60 * 24)));
      const staleness = days > 14 ? Math.min(1.0, Math.round((days / 180.0) * 100) / 100) : 0.0;

      return {
        last_commit_date: mtime.toISOString(),
        days_since_last_commit: days,
        total_commits: 1,
        commits_last_90d: days <= 90 ? 1 : 0,
        authors: ['Local File Author'],
        author_count: 1,
        churn_lines_added: 0,
        churn_lines_deleted: 0,
        staleness_score: staleness
      };
    } catch {
      return {
        last_commit_date: null,
        days_since_last_commit: 0,
        total_commits: 0,
        commits_last_90d: 0,
        authors: [],
        author_count: 0,
        churn_lines_added: 0,
        churn_lines_deleted: 0,
        staleness_score: 0
      };
    }
  }
}
