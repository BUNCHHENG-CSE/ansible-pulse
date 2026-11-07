import React from 'react';
import type {
  ObservabilitySummary, RiskFlagItem, DuplicateCluster
} from '../types';
import {
  ShieldAlert, Copy, GitFork, AlertTriangle, CheckCircle2,
  TrendingDown, Layers, Terminal, Sparkles, ArrowRight,
  Zap, Clock, ShieldCheck, Activity, ChevronRight, FileCode2,
  Server, Cpu
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface OverviewTabProps {
  summary: ObservabilitySummary | null;
  risks: RiskFlagItem[];
  clusters: DuplicateCluster[];
  onNavigateTab: (tab: string) => void;
  onSelectCluster: (cluster: DuplicateCluster) => void;
  onSimulateAsset: (assetId: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  summary,
  risks,
  clusters,
  onNavigateTab,
  onSelectCluster,
  onSimulateAsset
}) => {
  if (!summary) {
    return (
      <div className="py-20 text-center space-y-3 font-mono">
        <div className="w-8 h-8 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 flex items-center justify-center mx-auto animate-spin">
          <Activity className="w-4 h-4" />
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Loading IaC observability metrics...</p>
      </div>
    );
  }

  // Health score calculation
  const score = summary.overall_health_score;
  const healthBadge = score >= 80 ? 'success' : score >= 60 ? 'warning' : 'destructive';
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="space-y-4 font-mono">
      {/* 1. Critical Governance Alert Flash Banner - Light & Dark Optimized */}
      <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/80 dark:bg-red-950/20 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded border border-red-200 dark:border-red-800/80 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4 animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs">CRITICAL GOVERNANCE ALERT</span>
              <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                action-required
              </Badge>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="destructive" className="font-normal text-xs">
                {summary.zombie_core_assets_count} Zombie Core Asset (420+ days dormant)
              </Badge>
              <Badge variant="warning" className="font-normal text-xs">
                Anchors {risks[0]?.blast_radius || 4} Downstream Production Playbooks
              </Badge>
              <Badge variant="outline" className="font-normal text-xs text-neutral-700 dark:text-neutral-300">
                {summary.duplicate_clusters_count} Functional Groups Diverged
              </Badge>
            </div>
          </div>
        </div>

        <Button
          variant="destructive"
          size="sm"
          onClick={() => onNavigateTab('risks')}
          className="shrink-0"
        >
          Review High-Risk Assets <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* 2. KPI Cards Grid - Light & Dark Optimized */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Health Score */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="p-3.5 pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Fleet Health Score
              </CardDescription>
              <Badge variant={healthBadge} className="text-[10px] py-0 px-1.5">
                AST
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="flex items-center justify-between my-1">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-neutral-900 dark:text-neutral-100">{score}</span>
                  <span className="text-xs text-neutral-500">/100</span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {score < 70 ? 'Degraded by Drift' : 'Good Governance'}
                </p>
              </div>

              {/* Radial Score Gauge */}
              <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                  <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    className="stroke-neutral-200 dark:stroke-neutral-800"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    stroke={score < 70 ? '#f43f5e' : '#10b981'}
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <Activity className="w-4 h-4 absolute text-neutral-500 dark:text-neutral-400" />
              </div>
            </div>
            <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-500">
              <span>Drift Penalties:</span>
              <span className="text-red-600 dark:text-red-400 font-semibold">-46 pts deducted</span>
            </div>
          </CardContent>
        </Card>

        {/* Zombie Core Assets */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="p-3.5 pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Zombie Core Assets
              </CardDescription>
              <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                Dormant
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="my-1">
              <div className="text-3xl font-black text-red-600 dark:text-red-400 tracking-tight">
                {summary.zombie_core_assets_count}
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                High blast radius + abandoned (&gt;180d)
              </p>
            </div>
            <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-500">
              <span>Primary Anchor:</span>
              <span className="text-neutral-800 dark:text-neutral-200 font-semibold truncate">common_base</span>
            </div>
          </CardContent>
        </Card>

        {/* Duplicate Clusters */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="p-3.5 pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Duplicate Clusters
              </CardDescription>
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                AST AST
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="my-1">
              <div className="text-3xl font-black text-neutral-900 dark:text-neutral-100 tracking-tight">
                {summary.duplicate_clusters_count}
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                {summary.duplicate_tasks_count} duplicated task pairs
              </p>
            </div>
            <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-500">
              <span>Average Similarity:</span>
              <span className="text-neutral-800 dark:text-neutral-200 font-semibold">87% Match</span>
            </div>
          </CardContent>
        </Card>

        {/* Discovered Fleet Assets */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="p-3.5 pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Fleet Asset Catalog
              </CardDescription>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-neutral-600 dark:text-neutral-400">
                {summary.total_repos_scanned} Repos
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="my-1">
              <div className="text-3xl font-black text-neutral-900 dark:text-neutral-100 tracking-tight">
                {summary.total_playbooks + summary.total_roles}
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                {summary.total_playbooks} pb, {summary.total_roles} roles ({summary.total_tasks} tasks)
              </p>
            </div>
            <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-500">
              <span>Analysis Mode:</span>
              <span className="text-neutral-700 dark:text-neutral-300 font-semibold">AST Static + Git</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Left Column: Top High-Risk Governance Flags */}
        <Card>
          <CardHeader className="p-3.5 border-b border-neutral-200 dark:border-neutral-800 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500 dark:text-red-400" />
              <CardTitle className="text-xs uppercase font-bold text-neutral-800 dark:text-neutral-200">
                Prioritized High-Risk Flags
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateTab('risks')}
              className="text-[11px] h-6 px-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              View all ({risks.length}) →
            </Button>
          </CardHeader>
          <CardContent className="p-3.5 space-y-2.5">
            {risks.slice(0, 3).map((item) => (
              <div
                key={item.asset_id}
                className="p-3 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60 hover:border-neutral-300 dark:hover:border-neutral-700 transition flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-200">{item.asset_name}</span>
                      <Badge variant="outline" className="text-[10px] text-neutral-600 dark:text-neutral-400 py-0 px-1.5">
                        {item.repo_name}
                      </Badge>
                    </div>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">{item.primary_risk_flag}</p>
                  </div>

                  <Badge
                    variant={item.risk_level === 'critical' ? 'destructive' : 'warning'}
                    className="text-[10px] uppercase font-bold"
                  >
                    {item.risk_level}
                  </Badge>
                </div>

                <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                  <div className="flex items-center gap-3">
                    <span>Blast: <strong className="text-neutral-800 dark:text-neutral-200">{item.blast_radius}</strong> playbooks</span>
                    <span>•</span>
                    <span>Dormancy: <strong className="text-amber-600 dark:text-amber-400">{item.staleness_days}d</strong></span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSimulateAsset(item.asset_id)}
                    className="h-6 px-2 text-[10px]"
                  >
                    Simulate →
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Right Column: Duplicate Functionality Spotlights */}
        <Card>
          <CardHeader className="p-3.5 border-b border-neutral-200 dark:border-neutral-800 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Copy className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
              <CardTitle className="text-xs uppercase font-bold text-neutral-800 dark:text-neutral-200">
                Duplicate Functionality Clusters
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateTab('duplicates')}
              className="text-[11px] h-6 px-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              Explore Map ({clusters.length}) →
            </Button>
          </CardHeader>
          <CardContent className="p-3.5 space-y-2.5">
            {clusters.slice(0, 3).map((cluster) => (
              <div
                key={cluster.cluster_id}
                onClick={() => onSelectCluster(cluster)}
                className="p-3 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60 hover:border-neutral-300 dark:hover:border-neutral-700 transition cursor-pointer flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-200">{cluster.functionality_name}</span>
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5 text-neutral-600 dark:text-neutral-400">
                        {cluster.primary_module}
                      </Badge>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-1">{cluster.divergence_summary}</p>
                  </div>

                  <Badge variant="outline" className="text-[10px] text-neutral-700 dark:text-neutral-300 font-bold">
                    {Math.round(cluster.similarity_score * 100)}% Match
                  </Badge>
                </div>

                <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                  <span>{cluster.variants.length} divergent scripts across repos</span>
                  <span className="text-neutral-800 dark:text-neutral-300 hover:underline flex items-center gap-1 font-semibold">
                    Diffs <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 4. Architectural Summary Footer Strip */}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40 p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-600 dark:text-neutral-400">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-neutral-500" />
          <span>TCT AnsiblePulse Static AST Observability • Zero agent or runner modifications required</span>
        </div>
        <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-500 font-mono text-[11px]">
          <span>Targeting Platform Teams (5+ engineers)</span>
          <span>•</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">$99–$249/mo</span>
        </div>
      </div>
    </div>
  );
};
