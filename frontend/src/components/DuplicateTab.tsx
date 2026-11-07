import React, { useState, useMemo } from 'react';
import type { DuplicateCluster } from '../types';
import {
  Copy, GitBranch, CheckCircle, AlertTriangle, ArrowRight,
  Code2, Filter, Layers, Search, Sparkles, Check, ChevronDown,
  Info, ExternalLink, ShieldAlert, SplitSquareVertical, Eye
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from './ui/table';
import { RemediationModal } from './RemediationModal';

interface DuplicateTabProps {
  clusters: DuplicateCluster[];
  selectedCluster: DuplicateCluster | null;
  onSelectCluster: (cluster: DuplicateCluster | null) => void;
  onSimulateAsset: (assetId: string) => void;
}

export const DuplicateTab: React.FC<DuplicateTabProps> = ({
  clusters,
  selectedCluster,
  onSelectCluster,
  onSimulateAsset
}) => {
  const [search, setSearch] = useState('');
  const [filterModule, setFilterModule] = useState<string>('all');
  const [onlyDivergent, setOnlyDivergent] = useState<boolean>(true);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [remediationCluster, setRemediationCluster] = useState<DuplicateCluster | null>(null);

  // Available modules for filter dropdown
  const availableModules = useMemo(() => {
    const mods = new Set<string>();
    clusters.forEach(c => {
      if (c.primary_module) mods.add(c.primary_module);
    });
    return Array.from(mods).sort();
  }, [clusters]);

  // Filter clusters
  const filtered = clusters.filter(c => {
    const matchesSearch = c.functionality_name.toLowerCase().includes(search.toLowerCase()) ||
      c.divergence_summary.toLowerCase().includes(search.toLowerCase()) ||
      c.variants.some(v => v.repo_name.toLowerCase().includes(search.toLowerCase()) || v.task_name.toLowerCase().includes(search.toLowerCase()));
    const matchesModule = filterModule === 'all' || c.primary_module === filterModule;
    return matchesSearch && matchesModule;
  });

  const activeCluster = selectedCluster || (filtered.length > 0 ? filtered[0] : null);

  // Collect all parameter keys across variants of active cluster
  const { allParamKeys, divergentKeySet } = useMemo(() => {
    if (!activeCluster) return { allParamKeys: [], divergentKeySet: new Set<string>() };
    const keys = new Set<string>();
    const divergent = new Set<string>();

    activeCluster.variants.forEach(v => {
      Object.keys(v.parameters || {}).forEach(k => {
        if (k !== '_raw') keys.add(k);
      });
      if (v.parameters?._raw) keys.add('_raw');
    });

    const keyList = Array.from(keys).sort();

    // Determine which are divergent
    keyList.forEach(key => {
      const vals = activeCluster.variants.map(v => {
        if (key === '_raw') return v.parameters?._raw;
        return v.parameters?.[key];
      });
      const distinct = new Set(vals.map(val => JSON.stringify(val)));
      if (distinct.size > 1) {
        divergent.add(key);
      }
    });

    return { allParamKeys: keyList, divergentKeySet: divergent };
  }, [activeCluster]);

  const displayedParamKeys = useMemo(() => {
    if (!onlyDivergent) return allParamKeys;
    return allParamKeys.filter(k => divergentKeySet.has(k));
  }, [allParamKeys, divergentKeySet, onlyDivergent]);

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedPath(text);
    setTimeout(() => setCopiedPath(null), 2500);
  };

  return (
    <div className="space-y-4 font-mono">
      {/* 1. Top Filter & Action Bar */}
      <Card className="p-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-900 dark:text-neutral-200 text-xs">Duplicate Clusters</span>
            <Badge variant="outline" className="text-[10px] text-neutral-600 dark:text-neutral-400">
              {clusters.length} functional groups
            </Badge>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search cluster, task, repo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-7 text-xs"
              />
            </div>

            <select
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              className="h-7 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 text-xs rounded px-2 focus:outline-none focus:border-neutral-500 cursor-pointer shadow-xs"
            >
              <option value="all">All Modules ({clusters.length})</option>
              {availableModules.map(mod => (
                <option key={mod} value={mod}>{mod}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* 2. Main Two-Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Pane: Cluster List */}
        <div className="lg:col-span-4 space-y-2">
          <div className="text-[11px] uppercase font-bold text-neutral-500 dark:text-neutral-400 px-1 flex items-center justify-between">
            <span>Clusters ({filtered.length})</span>
            <span className="text-neutral-400 dark:text-neutral-500 font-normal">Select to inspect</span>
          </div>

          <div className="space-y-2 max-h-[750px] overflow-y-auto pr-1">
            {filtered.map((cluster) => {
              const isSelected = activeCluster?.cluster_id === cluster.cluster_id;
              const matchPct = Math.round(cluster.similarity_score * 100);

              return (
                <div
                  key={cluster.cluster_id}
                  onClick={() => onSelectCluster(cluster)}
                  className={`p-3 rounded border transition-all cursor-pointer flex flex-col gap-2 ${
                    isSelected
                      ? 'bg-neutral-100 border-neutral-400 dark:bg-neutral-900 dark:border-neutral-400 text-neutral-900 dark:text-neutral-100 shadow-xs'
                      : 'bg-white hover:bg-neutral-50 dark:bg-neutral-900/60 dark:hover:bg-neutral-850/80 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate">
                      <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                        {cluster.functionality_name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[10px] py-0 px-1 text-neutral-600 dark:text-neutral-400">
                          {cluster.primary_module}
                        </Badge>
                        <span className="text-[10px] text-neutral-500">
                          {cluster.variants.length} copies
                        </span>
                      </div>
                    </div>

                    <Badge
                      variant={matchPct >= 90 ? 'default' : 'secondary'}
                      className="text-[10px] font-bold"
                    >
                      {matchPct}%
                    </Badge>
                  </div>

                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2">
                    {cluster.divergence_summary}
                  </p>

                  <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-400 dark:text-neutral-500">
                    <span className="truncate max-w-[180px]">
                      {cluster.variants.map(v => v.repo_name).join(', ')}
                    </span>
                    <span className="text-neutral-800 dark:text-neutral-300 font-semibold flex items-center gap-1">
                      Inspect <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="p-8 text-center text-xs text-neutral-500 bg-white dark:bg-neutral-900/40 rounded border border-neutral-200 dark:border-neutral-800">
                No clusters match filter criteria.
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Deep Comparison Matrix */}
        <div className="lg:col-span-8">
          {activeCluster ? (
            <Card className="space-y-4 p-4">
              {/* Cluster Title Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{activeCluster.functionality_name}</h3>
                    <Badge variant="outline" className="text-[10px] text-neutral-600 dark:text-neutral-400">
                      module: {activeCluster.primary_module}
                    </Badge>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{activeCluster.divergence_summary}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[11px] font-bold">
                    {Math.round(activeCluster.similarity_score * 100)}% Structural Match
                  </Badge>
                  <Badge variant={divergentKeySet.size > 0 ? 'warning' : 'outline'} className="text-[11px] font-bold">
                    {divergentKeySet.size} Divergent
                  </Badge>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-mono flex items-center gap-1.5 shadow-xs"
                    onClick={() => setRemediationCluster(activeCluster)}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Consolidate Role
                  </Button>
                </div>
              </div>

              {/* Canonical Standard Banner */}
              {activeCluster.canonical_recommendation && (
                <div className="rounded border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/20 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-emerald-800 dark:text-emerald-300">Recommended Canonical Target</span>
                        <Badge variant="success" className="text-[9px] py-0 px-1">
                          Standard
                        </Badge>
                      </div>
                      <p className="font-mono text-neutral-800 dark:text-neutral-200 mt-0.5 break-all">
                        {activeCluster.canonical_recommendation}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(activeCluster.canonical_recommendation!)}
                    className="shrink-0 h-7 text-[11px] border-emerald-300 text-emerald-800 dark:border-emerald-800/80 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/50"
                  >
                    {copiedPath === activeCluster.canonical_recommendation ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy Target
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Variant Implementation Summary Cards */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Implementations ({activeCluster.variants.length})
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOnlyDivergent(!onlyDivergent)}
                    className="h-6 text-[10px] px-2 text-neutral-700 dark:text-neutral-300"
                  >
                    <Filter className="w-3 h-3" />
                    {onlyDivergent ? 'Showing Divergent Only' : 'Showing All'}
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  {activeCluster.variants.map((v, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/80 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-neutral-900 dark:text-neutral-200">{v.repo_name}</span>
                        <Badge variant="outline" className="text-[9px] py-0 px-1 text-neutral-600 dark:text-neutral-400">
                          {v.module}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-neutral-700 dark:text-neutral-300 truncate" title={v.task_name}>
                        {v.task_name}
                      </div>
                      <div className="text-[10px] text-neutral-500 truncate" title={v.file_path}>
                        {v.file_path}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Parameter Matrix Table - Light & Dark Optimized */}
                <Card className="overflow-hidden border border-neutral-200 dark:border-neutral-800">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-44 text-neutral-600 dark:text-neutral-400 text-xs">Parameter</TableHead>
                        {activeCluster.variants.map((v, i) => (
                          <TableHead key={i} className="text-neutral-800 dark:text-neutral-300 text-xs">
                            {v.repo_name}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedParamKeys.map((paramKey) => {
                        const isDivergent = divergentKeySet.has(paramKey);

                        return (
                          <TableRow
                            key={paramKey}
                            className={isDivergent ? 'bg-amber-50/60 hover:bg-amber-100/60 dark:bg-amber-950/15 dark:hover:bg-amber-950/25' : ''}
                          >
                            <TableCell className="font-semibold text-neutral-800 dark:text-neutral-300">
                              <div className="flex items-center justify-between gap-1">
                                <span className={isDivergent ? 'text-amber-800 dark:text-amber-300' : 'text-neutral-600 dark:text-neutral-400'}>
                                  {paramKey}
                                </span>
                                {isDivergent ? (
                                  <Badge variant="warning" className="text-[9px] py-0 px-1">
                                    Divergent
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[9px] py-0 px-1 text-neutral-500">
                                    Match
                                  </Badge>
                                )}
                              </div>
                            </TableCell>

                            {activeCluster.variants.map((v, i) => {
                              const val = paramKey === '_raw' ? v.parameters?._raw : v.parameters?.[paramKey];
                              const isMissing = val === undefined || val === null;

                              return (
                                <TableCell key={i} className="text-neutral-900 dark:text-neutral-200 align-top">
                                  {isMissing ? (
                                    <span className="text-neutral-400 dark:text-neutral-600 italic text-[10px]">
                                      (not set)
                                    </span>
                                  ) : typeof val === 'object' ? (
                                    <pre className="p-1.5 rounded bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-[10px] text-neutral-800 dark:text-neutral-300 overflow-x-auto max-w-[240px]">
                                      {JSON.stringify(val, null, 1)}
                                    </pre>
                                  ) : (
                                    <span className={isDivergent ? 'text-amber-900 dark:text-amber-200 font-semibold' : 'text-neutral-800 dark:text-neutral-300'}>
                                      {String(val)}
                                    </span>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}

                      {displayedParamKeys.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={activeCluster.variants.length + 1} className="p-6 text-center text-neutral-500 italic">
                            All parameters match identically across versions.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </div>

              {/* Risk Assessment Box */}
              <div className="rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60 p-3 flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-300">Governance Drift Risk Assessment</span>
                  <p className="text-neutral-600 dark:text-neutral-400 mt-0.5 leading-relaxed">
                    {activeCluster.risk_assessment}
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <div className="p-16 text-center text-xs text-neutral-500 bg-white dark:bg-neutral-900/40 rounded border border-neutral-200 dark:border-neutral-800">
              Select any duplicate cluster to compare parameter divergence.
            </div>
          )}
        </div>
      </div>

      {/* Canonical Role Synthesizer & Patch Modal */}
      {remediationCluster && (
        <RemediationModal
          cluster={remediationCluster}
          onClose={() => setRemediationCluster(null)}
        />
      )}
    </div>
  );
};
