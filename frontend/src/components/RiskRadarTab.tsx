import React, { useState, useMemo } from 'react';
import type { RiskFlagItem, RiskLevel } from '../types';
import {
  ShieldAlert, AlertTriangle, TrendingDown, Clock, GitCommit,
  CheckCircle2, XCircle, Search, Filter, Play, ArrowRight,
  Zap, Users, Activity, Sparkles, Check, ChevronRight, Layers
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface RiskRadarTabProps {
  risks: RiskFlagItem[];
  onSimulateAsset: (assetId: string) => void;
}

export const RiskRadarTab: React.FC<RiskRadarTabProps> = ({
  risks,
  onSimulateAsset
}) => {
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [activeQuadrant, setActiveQuadrant] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Quadrant classification
  const isZombie = (r: RiskFlagItem) => r.primary_risk_flag.toLowerCase().includes('zombie') || (r.blast_radius >= 2 && r.staleness_days >= 180);
  const isFork = (r: RiskFlagItem) => r.primary_risk_flag.toLowerCase().includes('divergent') || r.primary_risk_flag.toLowerCase().includes('fork') || r.primary_risk_flag.toLowerCase().includes('duplicate');
  const isChurn = (r: RiskFlagItem) => r.authors_count >= 2 || r.last_execution_status === 'failed';

  const zombieCount = useMemo(() => risks.filter(isZombie).length, [risks]);
  const forkCount = useMemo(() => risks.filter(isFork).length, [risks]);
  const churnCount = useMemo(() => risks.filter(isChurn).length, [risks]);

  const filteredRisks = useMemo(() => {
    return risks.filter(r => {
      const matchesLevel = filterLevel === 'all' || r.risk_level === filterLevel;
      const matchesSearch = r.asset_name.toLowerCase().includes(search.toLowerCase()) ||
        r.repo_name.toLowerCase().includes(search.toLowerCase()) ||
        r.primary_risk_flag.toLowerCase().includes(search.toLowerCase());
      
      let matchesQuadrant = true;
      if (activeQuadrant === 'zombie') matchesQuadrant = isZombie(r);
      else if (activeQuadrant === 'fork') matchesQuadrant = isFork(r);
      else if (activeQuadrant === 'churn') matchesQuadrant = isChurn(r);

      return matchesLevel && matchesSearch && matchesQuadrant;
    });
  }, [risks, filterLevel, search, activeQuadrant]);

  return (
    <div className="space-y-4 font-mono">
      {/* 1. Header Filter Bar */}
      <Card className="p-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-900 dark:text-neutral-200 text-xs">High-Risk Asset Radar</span>
            <Badge variant="destructive" className="text-[10px]">
              {zombieCount} Zombie Core
            </Badge>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search risk flag or repo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-7 text-xs"
              />
            </div>

            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="h-7 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 text-xs rounded px-2 focus:outline-none focus:border-neutral-500 cursor-pointer shadow-xs"
            >
              <option value="all">All Risk Levels</option>
              <option value="critical">Critical Severity</option>
              <option value="high">High Severity</option>
              <option value="medium">Medium Severity</option>
            </select>
          </div>
        </div>
      </Card>

      {/* 2. Clickable Quadrant Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Quadrant 1 */}
        <div
          onClick={() => setActiveQuadrant(activeQuadrant === 'zombie' ? 'all' : 'zombie')}
          className={`p-3 rounded border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
            activeQuadrant === 'zombie'
              ? 'bg-neutral-100 border-red-500 ring-1 ring-red-500 dark:bg-neutral-900'
              : 'bg-white hover:bg-neutral-50 dark:bg-neutral-900/60 dark:hover:bg-neutral-850/80 border-neutral-200 dark:border-neutral-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Quadrant 1: Zombie Core
            </span>
            <Badge variant="destructive" className="text-[10px]">
              {zombieCount}
            </Badge>
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            High blast radius + abandoned (&gt;180 days). Critical anchor with zero recent git commits.
          </p>
        </div>

        {/* Quadrant 2 */}
        <div
          onClick={() => setActiveQuadrant(activeQuadrant === 'fork' ? 'all' : 'fork')}
          className={`p-3 rounded border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
            activeQuadrant === 'fork'
              ? 'bg-neutral-100 border-amber-500 ring-1 ring-amber-500 dark:bg-neutral-900'
              : 'bg-white hover:bg-neutral-50 dark:bg-neutral-900/60 dark:hover:bg-neutral-850/80 border-neutral-200 dark:border-neutral-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5" /> Quadrant 2: Drifted Forks
            </span>
            <Badge variant="warning" className="text-[10px]">
              {forkCount}
            </Badge>
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Near-duplicate scripts (&gt;75% similarity) with divergent parameters or flags across teams.
          </p>
        </div>

        {/* Quadrant 3 */}
        <div
          onClick={() => setActiveQuadrant(activeQuadrant === 'churn' ? 'all' : 'churn')}
          className={`p-3 rounded border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
            activeQuadrant === 'churn'
              ? 'bg-neutral-100 border-neutral-500 ring-1 ring-neutral-500 dark:bg-neutral-900'
              : 'bg-white hover:bg-neutral-50 dark:bg-neutral-900/60 dark:hover:bg-neutral-850/80 border-neutral-200 dark:border-neutral-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Quadrant 3: Hot Churn
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {churnCount}
            </Badge>
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Frequent modifications across &ge;2 authors with test or CI execution failures.
          </p>
        </div>
      </div>

      {/* 3. Detailed Risk Cards */}
      <div className="space-y-3">
        {filteredRisks.map((item) => (
          <Card key={item.asset_id} className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={item.risk_level === 'critical' ? 'destructive' : 'warning'}
                  className="text-[10px] font-bold uppercase"
                >
                  {item.risk_level} • Score {item.risk_score}
                </Badge>

                <span className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">{item.asset_name}</span>
                <Badge variant="outline" className="text-[10px] text-neutral-600 dark:text-neutral-400">
                  {item.repo_name}
                </Badge>
                <Badge variant="secondary" className="text-[10px] uppercase text-neutral-600 dark:text-neutral-400">
                  {item.asset_type}
                </Badge>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onSimulateAsset(item.asset_id)}
                className="h-7 text-[11px]"
              >
                <Zap className="w-3.5 h-3.5 text-neutral-500" />
                Simulate Blast Impact
              </Button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                <span className="text-[10px] uppercase text-neutral-500 block">Blast Radius</span>
                <span className="text-sm font-bold text-red-600 dark:text-red-400 mt-0.5 block">{item.blast_radius} Playbooks</span>
              </div>

              <div className="p-2.5 rounded bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                <span className="text-[10px] uppercase text-neutral-500 block">Dormancy</span>
                <span className={`text-sm font-bold mt-0.5 block ${item.staleness_days >= 180 ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-800 dark:text-neutral-200'}`}>
                  {item.staleness_days} days
                </span>
              </div>

              <div className="p-2.5 rounded bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                <span className="text-[10px] uppercase text-neutral-500 block">Authors</span>
                <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mt-0.5 block">{item.authors_count}</span>
              </div>

              <div className="p-2.5 rounded bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                <span className="text-[10px] uppercase text-neutral-500 block">Last CI Run</span>
                <span className="text-sm font-bold uppercase text-neutral-800 dark:text-neutral-200 mt-0.5 block">{item.last_execution_status}</span>
              </div>
            </div>

            {/* Evidence Checklist */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-neutral-600 dark:text-neutral-400 block">
                Evidence Signals:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {item.detailed_reasons.map((r, i) => (
                  <div key={i} className="p-2 rounded bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800/80 text-xs text-neutral-800 dark:text-neutral-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Suggested Remediation */}
            <div className="rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-950/80 p-2.5 text-xs flex items-start gap-2">
              <span className="font-semibold text-neutral-800 dark:text-neutral-300 shrink-0">Action:</span>
              <span className="text-neutral-600 dark:text-neutral-400">{item.suggested_action}</span>
            </div>
          </Card>
        ))}

        {filteredRisks.length === 0 && (
          <div className="p-12 text-center text-xs text-neutral-500 bg-white dark:bg-neutral-900/40 rounded border border-neutral-200 dark:border-neutral-800">
            No assets match the selected filter.
          </div>
        )}
      </div>
    </div>
  );
};
