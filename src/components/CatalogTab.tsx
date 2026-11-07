import React, { useState, useMemo } from 'react';
import type { AnsibleAsset } from '@/lib/types';
import {
  Search,
  LayoutGrid, Table as TableIcon, ChevronRight
} from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from './ui/table';

interface CatalogTabProps {
  assets: AnsibleAsset[];
  onSimulateAsset: (assetId: string) => void;
}

export const CatalogTab: React.FC<CatalogTabProps> = ({
  assets,
  onSimulateAsset
}) => {
  const [search, setSearch] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedAsset, setSelectedAsset] = useState<AnsibleAsset | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const repos = useMemo(() => Array.from(new Set(assets.map(a => a.repo_name))).sort(), [assets]);

  const filtered = useMemo(() => {
    return assets.filter(a => {
      const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.relative_path.toLowerCase().includes(search.toLowerCase()) ||
        a.repo_name.toLowerCase().includes(search.toLowerCase());
      const matchesRepo = selectedRepo === 'all' || a.repo_name === selectedRepo;
      const matchesType = selectedType === 'all' || a.asset_type === selectedType;
      return matchesSearch && matchesRepo && matchesType;
    });
  }, [assets, search, selectedRepo, selectedType]);

  return (
    <div className="space-y-4 font-sans">
      {/* 1. Filter & View Switcher Bar */}
      <Card className="p-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-900 dark:text-neutral-200 text-xs">Script Catalog</span>
            <Badge variant="outline" className="text-[10px] text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-800">
              {assets.length} assets
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* View Mode Toggle */}
            <div className="flex rounded bg-neutral-100 dark:bg-neutral-950 p-0.5 border border-neutral-200 dark:border-neutral-800">
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="h-6 text-[10px] px-2"
                title="Table View"
              >
                <TableIcon className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('cards')}
                className="h-6 text-[10px] px-2"
                title="Card Grid"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search scripts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-7 text-xs"
              />
            </div>

            <select
              value={selectedRepo}
              onChange={(e) => setSelectedRepo(e.target.value)}
              className="h-7 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 text-xs rounded px-2 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 cursor-pointer"
            >
              <option value="all">All Repositories ({repos.length})</option>
              {repos.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="h-7 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 text-xs rounded px-2 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="playbook">Playbooks</option>
              <option value="role">Roles</option>
              <option value="task_file">Task Files</option>
            </select>
          </div>
        </div>
      </Card>

      {/* 2. Content Display (Table or Cards) */}
      {viewMode === 'table' ? (
        <Card className="overflow-hidden border border-neutral-200 dark:border-neutral-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-neutral-600 dark:text-neutral-400">Asset / Script</TableHead>
                <TableHead className="text-neutral-600 dark:text-neutral-400">Repo</TableHead>
                <TableHead className="text-neutral-600 dark:text-neutral-400">Type</TableHead>
                <TableHead className="text-neutral-600 dark:text-neutral-400">Tasks</TableHead>
                <TableHead className="text-neutral-600 dark:text-neutral-400">CI Status</TableHead>
                <TableHead className="text-neutral-600 dark:text-neutral-400">Dormancy</TableHead>
                <TableHead className="text-neutral-600 dark:text-neutral-400">Blast</TableHead>
                <TableHead className="text-neutral-600 dark:text-neutral-400">Risk</TableHead>
                <TableHead className="text-neutral-600 dark:text-neutral-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((asset) => (
                <TableRow
                  key={asset.id}
                  onClick={() => setSelectedAsset(asset)}
                  className="cursor-pointer"
                >
                  <TableCell>
                    <div className="font-semibold text-neutral-900 dark:text-neutral-200">{asset.name}</div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate max-w-[220px]" title={asset.relative_path}>
                      {asset.relative_path}
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" className="text-[10px] text-neutral-700 dark:text-neutral-400 border-neutral-300 dark:border-neutral-800 py-0">
                      {asset.repo_name}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <span className="uppercase text-[10px] text-neutral-600 dark:text-neutral-400 font-semibold">
                      {asset.asset_type}
                    </span>
                  </TableCell>

                  <TableCell className="text-neutral-800 dark:text-neutral-300 font-mono">
                    {asset.tasks_count}
                  </TableCell>

                  <TableCell>
                    <span className={`uppercase text-[10px] font-semibold ${
                      asset.execution.last_status === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
                      asset.execution.last_status === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                    }`}>
                      {asset.execution.last_status}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className={asset.git.days_since_last_commit >= 180 ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-neutral-600 dark:text-neutral-400'}>
                      {asset.git.days_since_last_commit}d
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className={asset.blast_radius_score >= 3 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-neutral-800 dark:text-neutral-300'}>
                      {asset.blast_radius_score}
                    </span>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant={asset.risk_level === 'critical' ? 'destructive' : asset.risk_level === 'high' ? 'warning' : 'outline'}
                      className="text-[10px] uppercase py-0"
                    >
                      {asset.risk_level}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSimulateAsset(asset.id);
                      }}
                      className="h-6 text-[10px] px-2 text-neutral-700 dark:text-neutral-300"
                    >
                      Simulate →
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        /* Card Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {filtered.map((asset) => (
            <Card
              key={asset.id}
              onClick={() => setSelectedAsset(asset)}
              className="p-3 cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-700 transition flex flex-col justify-between gap-2.5"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Badge variant="outline" className="text-[9px] uppercase py-0 text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-800">
                    {asset.asset_type}
                  </Badge>

                  <Badge
                    variant={asset.risk_level === 'critical' ? 'destructive' : asset.risk_level === 'high' ? 'warning' : 'secondary'}
                    className="text-[9px] uppercase py-0"
                  >
                    {asset.risk_level}
                  </Badge>
                </div>

                <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate" title={asset.name}>
                  {asset.name}
                </div>
                <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                  {asset.repo_name} • {asset.relative_path}
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-850 flex items-center justify-between text-[10px] text-neutral-600 dark:text-neutral-400">
                <span>{asset.tasks_count} tasks</span>
                <span className={asset.blast_radius_score >= 3 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-neutral-600 dark:text-neutral-400'}>
                  Blast: {asset.blast_radius_score}
                </span>
                <span className="text-neutral-700 dark:text-neutral-300 font-semibold flex items-center gap-1">
                  Inspect <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 3. Asset Detail Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/85 backdrop-blur-sm">
          <Card className="max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-4 shadow-2xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700">
            <div className="flex items-start justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-800">
                    {selectedAsset.asset_type}
                  </Badge>
                  <span className="text-xs text-neutral-600 dark:text-neutral-400">{selectedAsset.repo_name}</span>
                </div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-1">{selectedAsset.name}</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{selectedAsset.relative_path}</p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAsset(null)}
                className="h-7 w-7 p-0 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              >
                ✕
              </Button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-neutral-50 dark:bg-neutral-950 p-2.5 rounded border border-neutral-200 dark:border-neutral-800">
                <span className="text-neutral-500 dark:text-neutral-400 text-[10px] uppercase block">Blast Radius</span>
                <span className="text-lg font-bold text-red-600 dark:text-red-400 mt-0.5 block">{selectedAsset.blast_radius_score}</span>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-950 p-2.5 rounded border border-neutral-200 dark:border-neutral-800">
                <span className="text-neutral-500 dark:text-neutral-400 text-[10px] uppercase block">Dormancy</span>
                <span className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5 block">{selectedAsset.git.days_since_last_commit}d</span>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-950 p-2.5 rounded border border-neutral-200 dark:border-neutral-800">
                <span className="text-neutral-500 dark:text-neutral-400 text-[10px] uppercase block">Authors</span>
                <span className="text-lg font-bold text-neutral-900 dark:text-neutral-200 mt-0.5 block">{selectedAsset.git.author_count}</span>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-950 p-2.5 rounded border border-neutral-200 dark:border-neutral-800">
                <span className="text-neutral-500 dark:text-neutral-400 text-[10px] uppercase block">CI Status</span>
                <span className="text-lg font-bold uppercase text-emerald-600 dark:text-emerald-400 mt-0.5 block">{selectedAsset.execution.last_status}</span>
              </div>
            </div>

            {/* Structured Tasks */}
            <div>
              <div className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-400 mb-2">
                Parsed Tasks ({selectedAsset.tasks.length})
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {selectedAsset.tasks.map((task, idx) => (
                  <div key={idx} className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded p-2.5 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-200">{task.name}</span>
                      <Badge variant="secondary" className="text-[10px] py-0 px-1 text-neutral-700 dark:text-neutral-300">
                        {task.module}
                      </Badge>
                    </div>
                    {task.parameters && Object.keys(task.parameters).length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1.5 pt-1.5 border-t border-neutral-200 dark:border-neutral-850 text-[10px]">
                        {Object.entries(task.parameters).map(([k, v]) => (
                          <div key={k} className="p-1 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 truncate">
                            <span className="text-neutral-500 dark:text-neutral-400">{k}: </span>
                            <span className="text-neutral-800 dark:text-neutral-300">
                              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  const aid = selectedAsset.id;
                  setSelectedAsset(null);
                  onSimulateAsset(aid);
                }}
              >
                Simulate Blast Radius
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
