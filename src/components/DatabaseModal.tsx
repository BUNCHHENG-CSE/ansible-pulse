'use client';

import React, { useState, useEffect } from 'react';
import type { DbStatus, ScanHistoryItem } from '@/lib/types';
import { fetchDbStatus, fetchScanHistory } from '@/lib/api';
import {
  Database, Server, Activity, CheckCircle2, XCircle,
  RefreshCw, Terminal, Layers, TrendingUp, Clock, Copy,
  Check
} from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from './ui/table';

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DatabaseModal: React.FC<DatabaseModalProps> = ({
  isOpen,
  onClose
}) => {
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const loadDbInfo = async () => {
    setLoading(true);
    try {
      const [status, hist] = await Promise.all([
        fetchDbStatus(),
        fetchScanHistory(10)
      ]);
      setDbStatus(status);
      setHistory(hist.history || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDbInfo();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (cmd: string) => {
    navigator.clipboard?.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  const isPostgres = dbStatus?.dialect?.toLowerCase().includes('postgres') || dbStatus?.dialect?.toLowerCase().includes('neon');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md font-sans">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
              <span className="text-[10px] uppercase font-bold text-neutral-600 dark:text-neutral-400">
                Storage & Audit Engine
              </span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
              {dbStatus?.dialect || 'Database Engine Persistence'}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Dual-mode Prisma persistence: SQLite for zero-config local dev &amp; Neon Serverless PostgreSQL for production.
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

        {/* Live Status Card */}
        <div className="p-3.5 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-850">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${dbStatus?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span className="font-bold text-neutral-900 dark:text-neutral-100 text-xs">
                {dbStatus?.connected
                  ? `${dbStatus?.dialect || 'Database'} Online`
                  : 'Database Offline (In-Memory Fallback)'}
              </span>
              <Badge variant="outline" className="text-[9px] py-0 text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-800">
                {isPostgres ? 'Neon / Postgres' : 'SQLite (Local)'}
              </Badge>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={loadDbInfo}
              disabled={loading}
              className="h-6 text-[11px] text-neutral-600 dark:text-neutral-400"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <span className="text-neutral-500 dark:text-neutral-400 text-[10px] uppercase block">Latency</span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                {dbStatus?.latency_ms !== undefined ? `${dbStatus.latency_ms} ms` : '—'}
              </span>
            </div>

            <div className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <span className="text-neutral-500 dark:text-neutral-400 text-[10px] uppercase block">Pool / Mode</span>
              <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mt-0.5 block">
                {isPostgres ? `Pool: ${dbStatus?.pool?.size || 10}` : 'Embedded Single'}
              </span>
            </div>

            <div className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <span className="text-neutral-500 dark:text-neutral-400 text-[10px] uppercase block">Clients</span>
              <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mt-0.5 block">
                {dbStatus?.active_connections || 1}
              </span>
            </div>

            <div className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <span className="text-neutral-500 dark:text-neutral-400 text-[10px] uppercase block">Target</span>
              <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mt-0.5 block truncate" title={dbStatus?.version || 'Prisma Engine'}>
                {dbStatus?.version || (isPostgres ? 'PostgreSQL' : 'SQLite 3')}
              </span>
            </div>
          </div>
        </div>

        {/* Scan History Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-400">
            <span>Historical Scan Runs ({history.length})</span>
            <span className="text-[10px] text-neutral-500 font-normal">Audit trail</span>
          </div>

          <Card className="overflow-hidden border border-neutral-200 dark:border-neutral-800">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-neutral-600 dark:text-neutral-400">Timestamp</TableHead>
                  <TableHead className="text-neutral-600 dark:text-neutral-400">Health</TableHead>
                  <TableHead className="text-neutral-600 dark:text-neutral-400">Playbooks / Roles</TableHead>
                  <TableHead className="text-neutral-600 dark:text-neutral-400">Zombies</TableHead>
                  <TableHead className="text-neutral-600 dark:text-neutral-400">Clusters</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-neutral-600 dark:text-neutral-400 text-[10px]">
                      {h.created_at}
                    </TableCell>
                    <TableCell className="font-bold text-neutral-900 dark:text-neutral-200">
                      {h.health_score}/100
                    </TableCell>
                    <TableCell className="text-neutral-800 dark:text-neutral-300">
                      {h.total_playbooks} pb / {h.total_roles} roles
                    </TableCell>
                    <TableCell>
                      <Badge variant={h.zombie_core_assets > 0 ? 'destructive' : 'secondary'} className="text-[10px] py-0">
                        {h.zombie_core_assets}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-neutral-800 dark:text-neutral-300">
                      {h.duplicate_clusters}
                    </TableCell>
                  </TableRow>
                ))}

                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="p-6 text-center text-neutral-500 italic">
                      No previous scans recorded in database. Trigger re-scan to persist.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Database Quick Commands */}
        <div className="p-3 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-neutral-800 dark:text-neutral-300 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
              Database Management Commands
            </span>
            <span className="text-neutral-500 dark:text-neutral-400 text-[10px]">Click to copy</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
            <button
              onClick={() => handleCopy('bun run prisma:generate:sqlite')}
              className="bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 p-2 rounded border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 flex items-center justify-between text-left transition cursor-pointer text-neutral-800 dark:text-neutral-300"
            >
              <code>bun run prisma:generate:sqlite</code>
              <Copy className="w-3 h-3 text-neutral-500" />
            </button>
            <button
              onClick={() => handleCopy('bun run prisma:generate:neon')}
              className="bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 p-2 rounded border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 flex items-center justify-between text-left transition cursor-pointer text-neutral-800 dark:text-neutral-300"
            >
              <code>bun run prisma:generate:neon</code>
              <Copy className="w-3 h-3 text-neutral-500" />
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
};
