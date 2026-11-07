import React, { useState } from 'react';
import type { SecurityComplianceSummary, SecurityFinding } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  ShieldAlert, ShieldCheck, AlertTriangle, Info,
  Lock, Key, FileText, CheckCircle2, Filter
} from 'lucide-react';

interface SecurityTabProps {
  security: SecurityComplianceSummary | null;
  onSelectAsset?: (assetId: string) => void;
}

export function SecurityTab({ security }: SecurityTabProps) {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  if (!security) {
    return (
      <div className="p-8 text-center text-neutral-500 font-mono">
        <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-40 animate-pulse" />
        <p>Loading security audit telemetry...</p>
      </div>
    );
  }

  const findings = security.findings || [];
  const filtered = findings.filter(f => {
    if (selectedSeverity !== 'all' && f.severity !== selectedSeverity) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.rule_id.toLowerCase().includes(q) ||
        f.repo_name.toLowerCase().includes(q) ||
        f.file_path.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const gradeColor =
    security.grade === 'A'
      ? 'text-emerald-500 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
      : security.grade === 'B'
      ? 'text-blue-500 dark:text-blue-400 border-blue-500/40 bg-blue-500/10'
      : security.grade === 'C'
      ? 'text-amber-500 dark:text-amber-400 border-amber-500/40 bg-amber-500/10'
      : 'text-red-500 dark:text-red-400 border-red-500/40 bg-red-500/10';

  return (
    <div className="space-y-6">
      {/* Top Banner & Scorecards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Overall Grade Card */}
        <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center justify-between">
              <span>Compliance Grade</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-lg border-2 flex items-center justify-center font-bold text-2xl ${gradeColor}`}>
              {security.grade}
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100">
                {security.overall_score}<span className="text-xs text-neutral-500">/100</span>
              </div>
              <p className="text-[11px] text-neutral-500">CIS & Best-Practice AST Score</p>
            </div>
          </CardContent>
        </Card>

        {/* Critical & High Violations */}
        <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center justify-between">
              <span>High Severity Risks</span>
              <ShieldAlert className="w-4 h-4 text-red-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-red-600 dark:text-red-400">
              {security.critical_count + security.high_count}
            </div>
            <p className="text-[11px] text-neutral-500">
              {security.critical_count} Critical, {security.high_count} High issues
            </p>
          </CardContent>
        </Card>

        {/* Medium & Low Findings */}
        <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center justify-between">
              <span>Anti-Patterns</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {security.medium_count + security.low_count}
            </div>
            <p className="text-[11px] text-neutral-500">
              {security.medium_count} Medium, {security.low_count} Low findings
            </p>
          </CardContent>
        </Card>

        {/* Total Scanned Rules */}
        <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center justify-between">
              <span>Rule Policies</span>
              <Lock className="w-4 h-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
              {Object.keys(security.rule_breakdown || {}).length || 6}
            </div>
            <p className="text-[11px] text-neutral-500">Active static security checks</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          <span className="text-[11px] text-neutral-500 uppercase font-semibold flex items-center gap-1">
            <Filter className="w-3 h-3" /> Severity:
          </span>
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map(sev => (
            <button
              key={sev}
              onClick={() => setSelectedSeverity(sev)}
              className={`px-2.5 py-1 rounded text-xs capitalize transition-colors font-mono ${
                selectedSeverity === sev
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              {sev}
              {sev === 'all'
                ? ` (${findings.length})`
                : sev === 'critical'
                ? ` (${security.critical_count})`
                : sev === 'high'
                ? ` (${security.high_count})`
                : sev === 'medium'
                ? ` (${security.medium_count})`
                : ` (${security.low_count})`}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search rules, repos, tasks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:w-64 px-3 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs text-neutral-900 dark:text-neutral-100 font-mono placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
        />
      </div>

      {/* Findings List */}
      {filtered.length === 0 ? (
        <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-center py-12">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            No Security Violations Detected
          </h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1">
            All evaluated tasks adhere to safe credential handling, restrictive file modes, and idempotent execution guidelines.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(f => {
            const sevBadgeClass =
              f.severity === 'critical'
                ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                : f.severity === 'high'
                ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30'
                : f.severity === 'medium'
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';

            return (
              <Card
                key={f.id}
                className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
              >
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${sevBadgeClass}`}>
                        {f.severity}
                      </span>
                      <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">
                        {f.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                        {f.rule_id}
                      </span>
                      <span>&bull;</span>
                      <span>{f.repo_name}</span>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-600 dark:text-neutral-300">
                    {f.description}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono bg-neutral-50 dark:bg-neutral-950/70 p-2.5 rounded border border-neutral-200/60 dark:border-neutral-800">
                    <div>
                      <span className="text-neutral-500">Location: </span>
                      <span className="text-neutral-800 dark:text-neutral-200">
                        {f.file_path}:{f.line_number}
                      </span>
                      {f.task_name && (
                        <div className="truncate mt-0.5">
                          <span className="text-neutral-500">Task: </span>
                          <span className="text-neutral-700 dark:text-neutral-300">{f.task_name}</span>
                        </div>
                      )}
                    </div>

                    {f.offending_snippet && (
                      <div className="truncate">
                        <span className="text-neutral-500">Offender: </span>
                        <code className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-1 py-0.5 rounded">
                          {f.offending_snippet}
                        </code>
                      </div>
                    )}
                  </div>

                  <div className="flex items-start gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded border border-emerald-200 dark:border-emerald-900/40">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span><strong>Remediation:</strong> {f.remediation_advice}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
