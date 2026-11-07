import React, { useState, useEffect } from 'react';
import {
  fetchSummary, fetchInventory, fetchDuplicates,
  fetchBlastRadiusGraph, fetchRisks, triggerScan
} from './api';
import type {
  ObservabilitySummary, AnsibleAsset, DuplicateCluster,
  BlastRadiusGraph, RiskFlagItem
} from './types';
import { OverviewTab } from './components/OverviewTab';
import { DuplicateTab } from './components/DuplicateTab';
import { BlastRadiusTab } from './components/BlastRadiusTab';
import { RiskRadarTab } from './components/RiskRadarTab';
import { CatalogTab } from './components/CatalogTab';
import { SecurityTab } from './components/SecurityTab';
import { SimulatorModal } from './components/SimulatorModal';
import { RoiCalculatorModal } from './components/RoiCalculatorModal';
import { DatabaseModal } from './components/DatabaseModal';
import { ReportModal } from './components/ReportModal';
import { QualityGateModal } from './components/QualityGateModal';
import type { DbStatus, SecurityComplianceSummary } from './types';
import { fetchDbStatus, fetchSecuritySummary } from './api';

import {
  Layers, Copy, ShieldAlert, GitFork, Terminal,
  RefreshCw, DollarSign, Activity, Sparkles, Database,
  Sun, Moon, ShieldCheck, FileText, Shield
} from 'lucide-react';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { TabsList, TabsTrigger } from './components/ui/tabs';

export function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'duplicates' | 'blast_radius' | 'risks' | 'security' | 'catalog'>('overview');
  
  // Theme state: dark or light
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

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
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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
    <div className="min-h-screen bg-neutral-100/60 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-mono text-xs transition-colors duration-200">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 px-3.5 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs font-mono rounded shadow-xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-950/90 sticky top-0 z-40 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              onClick={() => setActiveTab('overview')}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <div className="h-6 w-6 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-neutral-800 dark:text-neutral-200 group-hover:border-neutral-400 dark:group-hover:border-neutral-500 transition-colors">
                <Terminal className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">TCT AnsiblePulse</span>
            </div>

            <Badge variant="outline" className="hidden sm:inline-flex text-[10px] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800">
              read-only-iac
            </Badge>
          </div>

          {/* Navigation Tabs - Mira High-Density Segmented List */}
          <div className="flex-1 max-w-2xl overflow-x-auto scrollbar-none">
            <TabsList>
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
                <span className="ml-1 text-[10px] font-bold px-1 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300">
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
                <span className="ml-1 text-[10px] font-bold px-1 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60">
                  {risks.length}
                </span>
              </TabsTrigger>

              <TabsTrigger
                active={activeTab === 'security'}
                onClick={() => setActiveTab('security')}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>Security</span>
                <span className="ml-1 text-[10px] font-bold px-1.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                  {security?.grade || 'A'}
                </span>
              </TabsTrigger>

              <TabsTrigger
                active={activeTab === 'catalog'}
                onClick={() => setActiveTab('catalog')}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Catalog</span>
                <span className="ml-1 text-[10px] font-bold px-1 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                  {assets.length}
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Action Controls & Theme Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Dark/Light Mode Toggle Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className="text-neutral-700 dark:text-neutral-300"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden md:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-neutral-600" />
                  <span className="hidden md:inline">Dark</span>
                </>
              )}
            </Button>

            {/* Database Engine Status Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDbOpen(true)}
              className="text-neutral-700 dark:text-neutral-300"
              title={dbStatus?.connected ? `PostgreSQL 16 (${dbStatus.latency_ms}ms)` : 'Click to inspect database'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${dbStatus?.connected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              <span className="hidden md:inline">
                {dbStatus?.connected ? `PG ${Math.round(dbStatus.latency_ms || 10)}ms` : 'In-Memory'}
              </span>
            </Button>

            {/* CI/CD Quality Gate Simulator */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsGateOpen(true)}
              className="hidden lg:inline-flex text-neutral-700 dark:text-neutral-300"
              title="Simulate CI/CD Quality Gate policies"
            >
              <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>CI Gate</span>
            </Button>

            {/* Executive Audit Report Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReportOpen(true)}
              className="hidden sm:inline-flex text-neutral-700 dark:text-neutral-300"
              title="Export executive governance audit report"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Audit Report</span>
            </Button>

            {/* Pricing / ROI Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRoiOpen(true)}
              className="hidden sm:inline-flex text-neutral-700 dark:text-neutral-300"
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>ROI ($99/mo)</span>
            </Button>

            {/* Rescan Fleet Button */}
            <Button
              variant="default"
              size="sm"
              disabled={scanning}
              onClick={handleRescan}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
              <span>{scanning ? 'Scanning...' : 'Re-scan'}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-5 w-full">
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
      <footer className="border-t border-neutral-200 dark:border-neutral-900 bg-white dark:bg-neutral-950 py-3 text-xs text-neutral-500 font-mono transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-neutral-700 dark:text-neutral-400 font-semibold">TCT AnsiblePulse</span>
            <span>•</span>
            <span>Read-Only IaC Observability</span>
          </div>
          <div className="flex items-center gap-3 text-neutral-500 dark:text-neutral-400">
            <span>AST Static Analysis</span>
            <span>•</span>
            <span>PostgreSQL 16 WSL Docker</span>
            <span>•</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">$99/mo per team</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <SimulatorModal
        assetId={simulatingAssetId}
        onClose={() => setSimulatingAssetId(null)}
      />

      <RoiCalculatorModal
        isOpen={isRoiOpen}
        onClose={() => setIsRoiOpen(false)}
      />

      <DatabaseModal
        isOpen={isDbOpen}
        onClose={() => setIsDbOpen(false)}
      />

      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
      />

      <QualityGateModal
        isOpen={isGateOpen}
        onClose={() => setIsGateOpen(false)}
      />
    </div>
  );
}

export default App;
