'use client';

import React, { useState, useEffect } from 'react';
import {
  fetchSummary, fetchInventory, fetchDuplicates,
  fetchBlastRadiusGraph, fetchRisks, triggerScan,
  fetchDbStatus, fetchSecuritySummary
} from '@/lib/api';
import type {
  ObservabilitySummary, AnsibleAsset, DuplicateCluster,
  BlastRadiusGraph, RiskFlagItem, DbStatus, SecurityComplianceSummary
} from '@/lib/types';
import dynamic from 'next/dynamic';
import { OverviewTab } from './OverviewTab';

const TabFallback = () => (
  <div className="py-24 text-center space-y-3 font-mono">
    <div className="w-8 h-8 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex items-center justify-center mx-auto text-neutral-600 dark:text-neutral-300 animate-spin">
      <RefreshCw className="w-4 h-4" />
    </div>
    <p className="text-xs text-neutral-500 dark:text-neutral-400">Loading module chunk...</p>
  </div>
);

const DuplicateTab = dynamic(() => import('./DuplicateTab').then(m => m.DuplicateTab), {
  loading: TabFallback,
});
const BlastRadiusTab = dynamic(() => import('./BlastRadiusTab').then(m => m.BlastRadiusTab), {
  loading: TabFallback,
});
const RiskRadarTab = dynamic(() => import('./RiskRadarTab').then(m => m.RiskRadarTab), {
  loading: TabFallback,
});
const CatalogTab = dynamic(() => import('./CatalogTab').then(m => m.CatalogTab), {
  loading: TabFallback,
});
const SecurityTab = dynamic(() => import('./SecurityTab').then(m => m.SecurityTab), {
  loading: TabFallback,
});

const SimulatorModal = dynamic(() => import('./SimulatorModal').then(m => m.SimulatorModal));
const RoiCalculatorModal = dynamic(() => import('./RoiCalculatorModal').then(m => m.RoiCalculatorModal));
const DatabaseModal = dynamic(() => import('./DatabaseModal').then(m => m.DatabaseModal));
const ReportModal = dynamic(() => import('./ReportModal').then(m => m.ReportModal));
const QualityGateModal = dynamic(() => import('./QualityGateModal').then(m => m.QualityGateModal));

import {
  Layers, Copy, ShieldAlert, GitFork, Terminal,
  RefreshCw, DollarSign, Activity, Sparkles, Database,
  Sun, Moon, ShieldCheck, FileText, Shield, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { TabsList, TabsTrigger } from './ui/tabs';

export function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'duplicates' | 'blast_radius' | 'risks' | 'security' | 'catalog'>('overview');
  
  // Theme state: dark or light
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Data states
  const [summary, setSummary] = useState<ObservabilitySummary | null>(null);
  const [assets, setAssets] = useState<AnsibleAsset[]>([]);
  const [clusters, setClusters] = useState<DuplicateCluster[]>([]);
  const [graph, setGraph] = useState<BlastRadiusGraph | null>(null);
  const [risks, setRisks] = useState<RiskFlagItem[]>([]);
  const [security, setSecurity] = useState<SecurityComplianceSummary | null>(null);
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  
  // Interaction states
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [selectedCluster, setSelectedCluster] = useState<DuplicateCluster | null>(null);
  const [simulatingAssetId, setSimulatingAssetId] = useState<string | null>(null);
  const [isRoiOpen, setIsRoiOpen] = useState<boolean>(false);
  const [isDbOpen, setIsDbOpen] = useState<boolean>(false);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [isGateOpen, setIsGateOpen] = useState<boolean>(false);
  const [isToolsOpen, setIsToolsOpen] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toolsMenuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
        setIsToolsOpen(false);
      }
    }
    if (isToolsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isToolsOpen]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sumData, assetData, clusterData, graphData, riskData, secData, dbData] = await Promise.all([
        fetchSummary(),
        fetchInventory(),
        fetchDuplicates(),
        fetchBlastRadiusGraph(),
        fetchRisks(),
        fetchSecuritySummary().catch(() => null),
        fetchDbStatus().catch(() => null)
      ]);
      setSummary(sumData);
      setAssets(assetData);
      setClusters(clusterData);
      setGraph(graphData);
      setRisks(riskData);
      if (secData) setSecurity(secData);
      if (dbData) setDbStatus(dbData);
    } catch (err) {
      console.error('Failed to load observability data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRescan = async () => {
    try {
      setScanning(true);
      await triggerScan(true);
      await loadData();
      setToastMsg('Scan complete. Repositories re-indexed.');
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleSelectClusterFromAnywhere = (cluster: DuplicateCluster) => {
    setSelectedCluster(cluster);
    setActiveTab('duplicates');
  };

  return (
    <div className="min-h-screen bg-neutral-50/70 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans text-xs transition-colors duration-200">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 px-3.5 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs font-sans rounded-xl shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="border-b border-neutral-200/90 dark:border-neutral-800/80 bg-white/95 dark:bg-neutral-950/95 sticky top-0 z-40 backdrop-blur-md transition-colors w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          {/* Logo & Brand + Navigation Tabs Group */}
          <div className="flex items-center gap-4 sm:gap-6 min-w-0 flex-1">
            <div
              onClick={() => setActiveTab('overview')}
              className="flex items-center gap-2.5 cursor-pointer group select-none shrink-0"
            >
              <div className="h-7 w-7 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 flex items-center justify-center shadow-xs group-hover:scale-105 transition-all">
                <Terminal className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-neutral-900 dark:text-neutral-100 text-sm whitespace-nowrap">TCT AnsiblePulse</span>
                <span className="hidden sm:inline-flex text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                  read-only-iac
                </span>
              </div>
            </div>

            <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-800 hidden md:block shrink-0" />

            {/* Navigation Tabs - Full width, continuous, fluid */}
            <div className="min-w-0 overflow-x-auto scrollbar-none py-1">
              <TabsList className="bg-neutral-100/90 dark:bg-neutral-900/90 border border-neutral-200/90 dark:border-neutral-800/90 p-0.5 rounded-lg shadow-xs">
                <TabsTrigger
                  active={activeTab === 'overview'}
                  onClick={() => setActiveTab('overview')}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Overview</span>
                </TabsTrigger>

                <TabsTrigger
                  active={activeTab === 'duplicates'}
                  onClick={() => setActiveTab('duplicates')}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Duplicates</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                    {clusters.length}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  active={activeTab === 'blast_radius'}
                  onClick={() => setActiveTab('blast_radius')}
                >
                  <GitFork className="w-3.5 h-3.5" />
                  <span>Blast DAG</span>
                </TabsTrigger>

                <TabsTrigger
                  active={activeTab === 'risks'}
                  onClick={() => setActiveTab('risks')}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                  <span>Risk Radar</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/60">
                    {risks.length}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  active={activeTab === 'security'}
                  onClick={() => setActiveTab('security')}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  <span>Security</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">
                    {security?.grade || 'A'}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  active={activeTab === 'catalog'}
                  onClick={() => setActiveTab('catalog')}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Catalog</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                    {assets.length}
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Action Controls & Utilities */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Database Engine Status Chip */}
            <button
              onClick={() => setIsDbOpen(true)}
              className="h-8 px-2.5 rounded-lg border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer font-mono text-[11px]"
              title={dbStatus?.connected ? `${dbStatus.dialect || 'Database'} connected (${Math.round(dbStatus.latency_ms || 3)}ms) — click to inspect` : 'Click to inspect database'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${dbStatus?.connected ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-amber-500'}`} />
              <span className="hidden sm:inline">
                {dbStatus?.connected
                  ? `${dbStatus.dialect?.includes('Neon') ? 'Neon' : (dbStatus.dialect?.includes('Postgres') ? 'PG' : 'SQLite')} ${Math.round(dbStatus.latency_ms || 3)}ms`
                  : 'In-Memory'}
              </span>
            </button>

            {/* Tools & Governance Dropdown Menu */}
            <div className="relative" ref={toolsMenuRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsToolsOpen(!isToolsOpen)}
                className={cn(
                  "h-8 px-2.5 text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5",
                  isToolsOpen && "bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white"
                )}
                title="Executive Governance & Simulation Tools"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span className="hidden md:inline font-medium">Tools</span>
                <ChevronDown className={cn("w-3 h-3 text-neutral-400 transition-transform duration-150", isToolsOpen && "rotate-180")} />
              </Button>

              {/* Floating Dropdown Panel */}
              {isToolsOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 font-sans">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 border-b border-neutral-100 dark:border-neutral-800/80 mb-1">
                    Governance & Diagnostics
                  </div>

                  {/* CI Gate */}
                  <button
                    onClick={() => { setIsGateOpen(true); setIsToolsOpen(false); }}
                    className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-neutral-100/80 dark:hover:bg-neutral-800 text-left transition-colors cursor-pointer group"
                  >
                    <div className="p-1.5 rounded-md bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/60 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
                      <Shield className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-purple-600 dark:group-hover:text-purple-400">CI/CD Quality Gate</span>
                        <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">AST</span>
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">Simulate PR gate pass/fail policies</p>
                    </div>
                  </button>

                  {/* Audit Report */}
                  <button
                    onClick={() => { setIsReportOpen(true); setIsToolsOpen(false); }}
                    className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-neutral-100/80 dark:hover:bg-neutral-800 text-left transition-colors cursor-pointer group"
                  >
                    <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">Executive Audit Report</span>
                        <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">MD/HTML</span>
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">Export executive governance summary</p>
                    </div>
                  </button>

                  {/* ROI Calculator */}
                  <button
                    onClick={() => { setIsRoiOpen(true); setIsToolsOpen(false); }}
                    className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-neutral-100/80 dark:hover:bg-neutral-800 text-left transition-colors cursor-pointer group"
                  >
                    <div className="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                      <DollarSign className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">ROI Calculator</span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">$99/mo</span>
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">Calculate script drift & outage savings</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Rescan Fleet Button */}
            <Button
              variant="default"
              size="sm"
              disabled={scanning}
              onClick={handleRescan}
              className="h-8 px-3 rounded-lg text-xs font-semibold shadow-xs bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", scanning && "animate-spin")} />
              <span>{scanning ? 'Scanning...' : 'Re-scan'}</span>
            </Button>

            {/* Dark/Light Mode Toggle Button */}
            <button
              onClick={toggleTheme}
              className="h-8 w-8 rounded-lg border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-center transition-colors shadow-xs cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle color theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-neutral-600" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-5">
        {loading ? (
          <div className="py-24 text-center space-y-3 font-mono">
            <div className="w-8 h-8 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex items-center justify-center mx-auto text-neutral-600 dark:text-neutral-300 animate-spin">
              <RefreshCw className="w-4 h-4" />
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Loading IaC observability AST metadata...</p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                summary={summary}
                risks={risks}
                clusters={clusters}
                onNavigateTab={(tab) => setActiveTab(tab as any)}
                onSelectCluster={handleSelectClusterFromAnywhere}
                onSimulateAsset={(aid) => setSimulatingAssetId(aid)}
              />
            )}

            {activeTab === 'duplicates' && (
              <DuplicateTab
                clusters={clusters}
                selectedCluster={selectedCluster}
                onSelectCluster={setSelectedCluster}
                onSimulateAsset={(aid) => setSimulatingAssetId(aid)}
              />
            )}

            {activeTab === 'blast_radius' && (
              <BlastRadiusTab
                graph={graph}
                onSimulateAsset={(aid) => setSimulatingAssetId(aid)}
              />
            )}

            {activeTab === 'risks' && (
              <RiskRadarTab
                risks={risks}
                onSimulateAsset={(aid) => setSimulatingAssetId(aid)}
              />
            )}

            {activeTab === 'security' && (
              <SecurityTab
                security={security}
                onSelectAsset={(aid) => setSimulatingAssetId(aid)}
              />
            )}

            {activeTab === 'catalog' && (
              <CatalogTab
                assets={assets}
                onSimulateAsset={(aid) => setSimulatingAssetId(aid)}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200/80 dark:border-neutral-900 bg-white/60 dark:bg-neutral-950/60 py-3.5 text-xs text-neutral-500 font-sans transition-colors w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-neutral-800 dark:text-neutral-300 font-semibold">TCT AnsiblePulse</span>
            <span className="text-neutral-300 dark:text-neutral-700">•</span>
            <span>Read-Only IaC Observability</span>
          </div>
          <div className="flex items-center gap-3 text-neutral-500 dark:text-neutral-400 font-mono text-[11px]">
            <span>AST Static Analysis</span>
            <span className="text-neutral-300 dark:text-neutral-700">•</span>
            <span>{dbStatus?.dialect || 'Prisma Engine'}</span>
            <span className="text-neutral-300 dark:text-neutral-700">•</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">$99/mo per team</span>
          </div>
        </div>
      </footer>

      {/* Lazy-loaded Modals */}
      {Boolean(simulatingAssetId) && (
        <SimulatorModal
          assetId={simulatingAssetId}
          onClose={() => setSimulatingAssetId(null)}
        />
      )}

      {isRoiOpen && (
        <RoiCalculatorModal
          isOpen={isRoiOpen}
          onClose={() => setIsRoiOpen(false)}
        />
      )}

      {isDbOpen && (
        <DatabaseModal
          isOpen={isDbOpen}
          onClose={() => setIsDbOpen(false)}
        />
      )}

      {isReportOpen && (
        <ReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
        />
      )}

      {isGateOpen && (
        <QualityGateModal
          isOpen={isGateOpen}
          onClose={() => setIsGateOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
