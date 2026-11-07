'use client';

import React, { useState, useEffect } from 'react';
import type { ImpactSimulation } from '@/lib/types';
import { simulateImpact } from '@/lib/api';
import {
  ShieldAlert, AlertTriangle, Layers, Server, CheckCircle2,
  XCircle, ArrowRight, Play, ExternalLink, Zap, Compass,
  FolderGit2, Activity
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface SimulatorModalProps {
  assetId: string | null;
  onClose: () => void;
}

export const SimulatorModal: React.FC<SimulatorModalProps> = ({
  assetId,
  onClose
}) => {
  const [simulation, setSimulation] = useState<ImpactSimulation | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (assetId) {
      setLoading(true);
      simulateImpact(assetId)
        .then(setSimulation)
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [assetId]);

  if (!assetId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md font-sans">
      <Card className="max-w-xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
              <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400">
                Blast Radius Impact Simulator
              </span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-1 break-all">
              {simulation?.target_asset.name || assetId.split('::').pop()}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Source Repo: {simulation?.target_asset.repo || assetId.split('::')[0]}
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 p-0 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            ✕
          </Button>
        </div>

        {loading ? (
          <div className="py-12 text-center space-y-2">
            <div className="w-7 h-7 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-950 flex items-center justify-center mx-auto text-neutral-600 dark:text-neutral-400 animate-spin">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">Tracing dependency DAG propagation...</p>
          </div>
        ) : simulation ? (
          <div className="space-y-4">
            {/* Severity Card */}
            <div className={`p-3.5 rounded border flex items-center justify-between ${
              simulation.impact_severity === 'CRITICAL' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-300' :
              simulation.impact_severity === 'HIGH' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/80 text-amber-700 dark:text-amber-300' :
              'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-300'
            }`}>
              <div>
                <span className="text-[10px] uppercase font-bold block">Impact Rating</span>
                <div className="text-xl font-black mt-0.5">{simulation.impact_severity} IMPACT</div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase block text-neutral-500 dark:text-neutral-400">Downstream Dependents</span>
                <div className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100 mt-0.5">
                  {simulation.target_asset.blast_radius_score} Playbooks
                </div>
              </div>
            </div>

            {/* Propagation Chain */}
            <div className="p-3 rounded bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-1.5 text-xs">
              <span className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 block">Propagation Path:</span>
              <div className="flex flex-wrap items-center gap-1.5 font-mono">
                <Badge variant="outline" className="text-neutral-800 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700">
                  {simulation.target_asset.name}
                </Badge>
                <span className="text-neutral-400 dark:text-neutral-600">──►</span>
                <Badge variant="destructive">
                  {simulation.target_asset.blast_radius_score} Playbooks
                </Badge>
                <span className="text-neutral-400 dark:text-neutral-600">──►</span>
                <Badge variant="warning">
                  {simulation.affected_repo_count} Repositories
                </Badge>
              </div>
            </div>

            {/* Affected Repos & Environments */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-neutral-50 dark:bg-neutral-950 p-3 rounded border border-neutral-200 dark:border-neutral-800 space-y-1.5">
                <span className="text-neutral-500 dark:text-neutral-400 font-bold uppercase text-[10px] block">
                  Affected Repos ({simulation.affected_repo_count})
                </span>
                <div className="flex flex-wrap gap-1">
                  {simulation.affected_repos.map(r => (
                    <Badge key={r} variant="outline" className="text-[10px] text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700">
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="bg-neutral-50 dark:bg-neutral-950 p-3 rounded border border-neutral-200 dark:border-neutral-800 space-y-1.5">
                <span className="text-neutral-500 dark:text-neutral-400 font-bold uppercase text-[10px] block">
                  Environments At Risk
                </span>
                <div className="flex flex-wrap gap-1">
                  {simulation.affected_environments.map(e => (
                    <Badge
                      key={e}
                      variant={e === 'production' ? 'destructive' : 'secondary'}
                      className="text-[10px] uppercase font-bold"
                    >
                      {e}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Dependent Playbooks */}
            <div>
              <div className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-400 mb-1.5">
                Dependent Playbooks ({simulation.indirect_dependents.length + simulation.direct_dependents.length})
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {[...simulation.direct_dependents, ...simulation.indirect_dependents].map((dep, idx) => (
                  <div key={idx} className="p-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded text-xs flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-neutral-900 dark:text-neutral-200">{dep.name}</span>
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">{dep.id}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800">
                      {dep.repo}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Advisory */}
            <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded p-3 text-xs space-y-1">
              <span className="font-semibold text-neutral-800 dark:text-neutral-300 block text-[11px]">
                Pre-Change Risk Advisory:
              </span>
              <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {simulation.recommendation}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Inspector
          </Button>
        </div>
      </Card>
    </div>
  );
};
