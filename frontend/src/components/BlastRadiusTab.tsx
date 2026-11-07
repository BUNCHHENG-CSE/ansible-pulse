import React, { useState, useMemo } from 'react';
import type { BlastRadiusGraph, BlastRadiusNode } from '../types';
import {
  GitFork, ShieldAlert, AlertTriangle, Layers, Info,
  CheckCircle2, XCircle, Search, ArrowRight, Play,
  Zap, GitBranch, Share2, Compass, Eye, Filter, ArrowDown
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface BlastRadiusTabProps {
  graph: BlastRadiusGraph | null;
  onSimulateAsset: (assetId: string) => void;
}

export const BlastRadiusTab: React.FC<BlastRadiusTabProps> = ({
  graph,
  onSimulateAsset
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'dag' | 'matrix'>('dag');

  const nodes = useMemo(() => graph?.nodes || [], [graph]);
  const edges = useMemo(() => graph?.edges || [], [graph]);

  // Set default selection to highest blast radius node
  React.useEffect(() => {
    if (!selectedNodeId && nodes.length > 0) {
      const topNode = [...nodes].sort((a, b) => b.blast_radius - a.blast_radius)[0];
      if (topNode) setSelectedNodeId(topNode.id);
    }
  }, [nodes, selectedNodeId]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  // Downstream dependents for selected node
  const highlightedNodeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const highlighted = new Set<string>([selectedNodeId]);
    
    const queue = [selectedNodeId];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      edges.forEach(e => {
        if (e.target === curr && !highlighted.has(e.source)) {
          highlighted.add(e.source);
          queue.push(e.source);
        }
      });
    }
    return highlighted;
  }, [selectedNodeId, edges]);

  // Filtered nodes
  const filteredNodes = nodes.filter(n => {
    const matchesSearch = n.label.toLowerCase().includes(search.toLowerCase()) || n.repo.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || n.type === filterType;
    return matchesSearch && matchesType;
  });

  // Layered categorization for DAG
  const layers = useMemo(() => {
    const coreRoles = nodes.filter(n => n.type === 'role');
    const taskFiles = nodes.filter(n => n.type === 'task_file');
    const playbooks = nodes.filter(n => n.type === 'playbook');
    return { coreRoles, taskFiles, playbooks };
  }, [nodes]);

  return (
    <div className="space-y-4 font-mono">
      {/* 1. Header & Controls */}
      <Card className="p-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-900 dark:text-neutral-200 text-xs">Dependency Blast Radius</span>
            <Badge variant="outline" className="text-[10px] text-neutral-600 dark:text-neutral-400">
              {nodes.length} nodes • {edges.length} links
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* View Mode Toggle */}
            <div className="flex rounded bg-neutral-100 dark:bg-neutral-950 p-0.5 border border-neutral-300 dark:border-neutral-800">
              <Button
                variant={viewMode === 'dag' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('dag')}
                className="h-6 text-[10px] px-2"
              >
                Topology
              </Button>
              <Button
                variant={viewMode === 'matrix' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('matrix')}
                className="h-6 text-[10px] px-2"
              >
                Grid
              </Button>
            </div>

            <div className="relative flex-1 sm:w-44">
              <Search className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Filter nodes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-7 text-xs"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-7 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 text-xs rounded px-2 focus:outline-none focus:border-neutral-500 cursor-pointer shadow-xs"
            >
              <option value="all">All Types</option>
              <option value="role">Roles Only</option>
              <option value="playbook">Playbooks Only</option>
              <option value="task_file">Task Files Only</option>
            </select>
          </div>
        </div>
      </Card>

      {/* 2. Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Main DAG Canvas */}
        <Card className="lg:col-span-8 p-4 flex flex-col justify-between min-h-[580px]">
          <div>
            {/* Topology Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400">
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">Interactive DAG Layout</span>
              <div className="flex flex-wrap items-center gap-2.5 text-[11px]">
                <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60 py-0">
                  Role
                </Badge>
                <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800/60 py-0">
                  Task File
                </Badge>
                <Badge variant="outline" className="text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800/60 py-0">
                  Playbook
                </Badge>
                <Badge variant="destructive" className="py-0">
                  Blast Path
                </Badge>
              </div>
            </div>

            {/* View Mode 1: 3-Tier Layered DAG */}
            {viewMode === 'dag' ? (
              <div className="mt-5 space-y-6">
                {/* Tier 1: Shared Core Roles */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Tier 1: Core Foundation Roles ({layers.coreRoles.length})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {layers.coreRoles.map(node => {
                      const isSelected = selectedNodeId === node.id;
                      const isDownstream = highlightedNodeIds.has(node.id) && !isSelected;

                      return (
                        <div
                          key={node.id}
                          onClick={() => setSelectedNodeId(node.id)}
                          className={`p-2.5 rounded border transition-all cursor-pointer relative ${
                            isSelected
                              ? 'bg-neutral-100 border-neutral-900 ring-1 ring-neutral-900 dark:bg-neutral-900 dark:border-neutral-300 dark:ring-neutral-300 shadow-sm'
                              : isDownstream
                              ? 'bg-red-50/80 border-red-300 dark:bg-red-950/30 dark:border-red-800/80'
                              : 'bg-white border-neutral-200 hover:border-neutral-300 dark:bg-neutral-950 dark:border-neutral-800 dark:hover:border-neutral-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className="text-[9px] text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-900 py-0 px-1">
                              ROLE
                            </Badge>
                            <Badge variant={node.blast_radius >= 3 ? 'destructive' : 'secondary'} className="text-[9px] py-0 px-1">
                              Blast: {node.blast_radius}
                            </Badge>
                          </div>

                          <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate" title={node.label}>
                            {node.label}
                          </div>
                          <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                            {node.repo}
                          </div>

                          <div className="mt-2 pt-1.5 border-t border-neutral-150 dark:border-neutral-850 flex items-center justify-between text-[10px]">
                            <span className={node.staleness_days >= 180 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-neutral-500'}>
                              {node.staleness_days}d ago
                            </span>
                            <span className="uppercase text-emerald-700 dark:text-emerald-400 font-semibold text-[9px]">
                              {node.last_status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Connecting Separator */}
                <div className="flex items-center justify-center -my-2">
                  <span className="text-[10px] text-neutral-500 px-2 py-0.5 rounded bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-center gap-1 shadow-xs">
                    <ArrowDown className="w-3 h-3 text-neutral-400" />
                    <span>Included & Called By</span>
                  </span>
                </div>

                {/* Tier 2: Downstream Playbooks */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      Tier 2: Production Execution Playbooks ({layers.playbooks.length})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {layers.playbooks.map(node => {
                      const isSelected = selectedNodeId === node.id;
                      const isDownstream = highlightedNodeIds.has(node.id) && !isSelected;

                      return (
                        <div
                          key={node.id}
                          onClick={() => setSelectedNodeId(node.id)}
                          className={`p-2.5 rounded border transition-all cursor-pointer relative ${
                            isSelected
                              ? 'bg-neutral-100 border-neutral-900 ring-1 ring-neutral-900 dark:bg-neutral-900 dark:border-neutral-300 dark:ring-neutral-300 shadow-sm'
                              : isDownstream
                              ? 'bg-red-50/80 border-red-300 dark:bg-red-950/25 dark:border-red-800/80 shadow-xs'
                              : 'bg-white border-neutral-200 hover:border-neutral-300 dark:bg-neutral-950 dark:border-neutral-800 dark:hover:border-neutral-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className="text-[9px] text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-900 py-0 px-1">
                              PLAYBOOK
                            </Badge>
                            {isDownstream && (
                              <Badge variant="destructive" className="text-[9px] py-0 px-1">
                                In Blast Path
                              </Badge>
                            )}
                          </div>

                          <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate" title={node.label}>
                            {node.label}
                          </div>
                          <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                            {node.repo}
                          </div>

                          <div className="mt-2 pt-1.5 border-t border-neutral-150 dark:border-neutral-850 flex items-center justify-between text-[10px] text-neutral-500">
                            <span>{node.staleness_days}d ago</span>
                            <span className="uppercase text-neutral-700 dark:text-neutral-300 font-semibold text-[9px]">
                              {node.last_status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* View Mode 2: Matrix Grid */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 mt-4">
                {filteredNodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  const isDownstream = highlightedNodeIds.has(node.id) && !isSelected;

                  return (
                    <div
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`p-2.5 rounded border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-neutral-100 border-neutral-900 ring-1 ring-neutral-900 dark:bg-neutral-900 dark:border-neutral-300 dark:ring-neutral-300'
                          : isDownstream
                          ? 'bg-red-50/80 border-red-300 dark:bg-red-950/25 dark:border-red-800/80'
                          : 'bg-white border-neutral-200 hover:border-neutral-300 dark:bg-neutral-950 dark:border-neutral-800 dark:hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-[9px] py-0 px-1 text-neutral-600 dark:text-neutral-400">
                          {node.type}
                        </Badge>
                        <Badge variant="secondary" className="text-[9px] py-0 px-1 font-bold">
                          Blast: {node.blast_radius}
                        </Badge>
                      </div>

                      <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                        {node.label}
                      </div>
                      <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                        {node.repo}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500 flex items-center justify-between">
            <span>Select any node to propagate blast calculation</span>
            <span className="text-neutral-700 dark:text-neutral-300">
              {highlightedNodeIds.size - 1} dependent targets in path
            </span>
          </div>
        </Card>

        {/* Right Inspector Drawer */}
        <div className="lg:col-span-4">
          {selectedNode ? (
            <Card className="p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400">Asset Inspector</span>
                  <Badge
                    variant={selectedNode.risk_level === 'critical' ? 'destructive' : 'warning'}
                    className="text-[10px]"
                  >
                    {selectedNode.risk_level} Risk
                  </Badge>
                </div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mt-1 break-all">{selectedNode.label}</h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">{selectedNode.repo}</p>
              </div>

              {/* Blast Radius Stat Card */}
              <div className="p-3 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase text-neutral-500 dark:text-neutral-400">Blast Radius Score</span>
                  <span className="text-2xl font-black text-red-600 dark:text-red-400">{selectedNode.blast_radius}</span>
                </div>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed border-t border-neutral-200 dark:border-neutral-850 pt-2">
                  {selectedNode.blast_radius >= 3 ? (
                    <strong className="text-red-700 dark:text-red-300">
                      Core Anchor: Modifying this script propagates to {selectedNode.blast_radius} downstream playbooks across teams.
                    </strong>
                  ) : (
                    <span>Localized script with minimal cross-project propagation risk.</span>
                  )}
                </p>
              </div>

              {/* Metadata */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-neutral-200 dark:border-neutral-800">
                  <span className="text-neutral-500 dark:text-neutral-400">Git Dormancy:</span>
                  <span className={`font-semibold ${selectedNode.staleness_days >= 180 ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-800 dark:text-neutral-200'}`}>
                    {selectedNode.staleness_days} days
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-neutral-200 dark:border-neutral-800">
                  <span className="text-neutral-500 dark:text-neutral-400">CI Execution:</span>
                  <span className="uppercase font-semibold text-neutral-800 dark:text-neutral-200">
                    {selectedNode.last_status}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-neutral-200 dark:border-neutral-800">
                  <span className="text-neutral-500 dark:text-neutral-400">Architecture Type:</span>
                  <span className="uppercase text-neutral-700 dark:text-neutral-300 font-semibold">{selectedNode.type}</span>
                </div>
              </div>

              {/* Direct & Transitive Callers */}
              <div>
                <div className="flex items-center justify-between mb-1.5 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  <span>Downstream Callers</span>
                  <span>{highlightedNodeIds.size - 1}</span>
                </div>

                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {Array.from(highlightedNodeIds).filter(id => id !== selectedNode.id).map(id => {
                    const callerNode = nodes.find(n => n.id === id);
                    if (!callerNode) return null;
                    return (
                      <div
                        key={id}
                        className="p-2 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-xs flex items-center justify-between gap-2"
                      >
                        <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">{callerNode.label}</span>
                        <Badge variant="outline" className="text-[9px] py-0 text-neutral-600 dark:text-neutral-400 shrink-0">
                          {callerNode.repo}
                        </Badge>
                      </div>
                    );
                  })}
                  {highlightedNodeIds.size <= 1 && (
                    <div className="text-xs text-neutral-500 italic p-3 bg-neutral-50 dark:bg-neutral-950 rounded border border-neutral-200 dark:border-neutral-800 text-center">
                      No downstream dependents detected.
                    </div>
                  )}
                </div>
              </div>

              <Button
                variant="default"
                size="sm"
                onClick={() => onSimulateAsset(selectedNode.id)}
                className="w-full"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Simulate Full Blast Impact
              </Button>
            </Card>
          ) : (
            <div className="p-12 text-center text-xs text-neutral-500 bg-white dark:bg-neutral-900/40 rounded border border-neutral-200 dark:border-neutral-800">
              Select any node in the topology to inspect.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
