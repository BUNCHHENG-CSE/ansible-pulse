import React, { useState, useEffect, useCallback } from 'react';
import type { QualityGateResult } from '../types';
import { evaluateQualityGate } from '../api';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  X, CheckCircle2, XCircle, Shield, Sliders,
  Terminal, Copy, Check, Sparkles, Activity,
  ShieldCheck, Layers, AlertTriangle, RotateCcw,
  Code2, ChevronDown, ChevronUp
} from 'lucide-react';

interface QualityGateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PolicyPreset = 'recommended' | 'relaxed' | 'strict' | 'custom';
type CiTab = 'github' | 'gitlab' | 'curl';

export function QualityGateModal({ isOpen, onClose }: QualityGateModalProps) {
  // Policy Thresholds
  const [minHealth, setMinHealth] = useState<number>(70);
  const [minSecurity, setMinSecurity] = useState<number>(70);
  const [failOnZombies, setFailOnZombies] = useState<boolean>(true);
  const [maxDuplicates, setMaxDuplicates] = useState<number>(5);
  const [maxCriticalRisks, setMaxCriticalRisks] = useState<number>(0);

  const [activePreset, setActivePreset] = useState<PolicyPreset>('recommended');
  const [activeCiTab, setActiveCiTab] = useState<CiTab>('github');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<QualityGateResult | null>(null);
  const [copiedCi, setCopiedCi] = useState<boolean>(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState<boolean>(false);

  const runEvaluation = useCallback(async () => {
    try {
      setLoading(true);
      const res = await evaluateQualityGate({
        min_health_score: minHealth,
        min_security_score: minSecurity,
        fail_on_zombies: failOnZombies,
        max_duplicate_clusters: maxDuplicates,
        max_critical_risks: maxCriticalRisks
      });
      setResult(res);
    } catch (err) {
      console.error('Failed to evaluate quality gate:', err);
    } finally {
      setLoading(false);
    }
  }, [minHealth, minSecurity, failOnZombies, maxDuplicates, maxCriticalRisks]);

  useEffect(() => {
    if (isOpen) {
      runEvaluation();
    }
  }, [isOpen, runEvaluation]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Preset handlers
  const applyPreset = (preset: PolicyPreset) => {
    setActivePreset(preset);
    if (preset === 'recommended') {
      setMinHealth(70);
      setMinSecurity(70);
      setMaxDuplicates(5);
      setFailOnZombies(true);
      setMaxCriticalRisks(0);
    } else if (preset === 'relaxed') {
      setMinHealth(50);
      setMinSecurity(60);
      setMaxDuplicates(10);
      setFailOnZombies(false);
      setMaxCriticalRisks(2);
    } else if (preset === 'strict') {
      setMinHealth(85);
      setMinSecurity(85);
      setMaxDuplicates(2);
      setFailOnZombies(true);
      setMaxCriticalRisks(0);
    }
  };

  const handleCustomChange = (setter: (val: any) => void, val: any) => {
    setter(val);
    setActivePreset('custom');
  };

  // CI Snippets Generator
  const getCiSnippet = (): string => {
    if (activeCiTab === 'github') {
      return `name: TCT AnsiblePulse Governance Gate
on: [pull_request, push]

jobs:
  iac-observability-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - name: Install Dependencies
        run: bun install
      - name: Evaluate Quality Gate
        run: |
          curl -s -f -X POST http://localhost:3000/api/gate/check \\
            -H "Content-Type: application/json" \\
            -d '{"min_health_score": ${minHealth}, "min_security_score": ${minSecurity}, "fail_on_zombies": ${failOnZombies}, "max_duplicate_clusters": ${maxDuplicates}, "max_critical_risks": ${maxCriticalRisks}}'`;
    }

    if (activeCiTab === 'gitlab') {
      return `stages:
  - governance

iac-quality-gate:
  stage: governance
  image: oven/bun:latest
  script:
    - bun install
    - |
      curl -s -f -X POST http://localhost:3000/api/gate/check \\
        -H "Content-Type: application/json" \\
        -d '{"min_health_score": ${minHealth}, "min_security_score": ${minSecurity}, "fail_on_zombies": ${failOnZombies}, "max_duplicate_clusters": ${maxDuplicates}, "max_critical_risks": ${maxCriticalRisks}}'
  only:
    - merge_requests
    - main`;
    }

    return `# Execute interactive Quality Gate validation via Terminal:
curl -s -f -X POST http://localhost:3000/api/gate/check \\
  -H "Content-Type: application/json" \\
  -d '{
    "min_health_score": ${minHealth},
    "min_security_score": ${minSecurity},
    "fail_on_zombies": ${failOnZombies},
    "max_duplicate_clusters": ${maxDuplicates},
    "max_critical_risks": ${maxCriticalRisks}
  }' | jq .`;
  };

  const copyCiSnippet = () => {
    navigator.clipboard.writeText(getCiSnippet());
    setCopiedCi(true);
    setTimeout(() => setCopiedCi(false), 2000);
  };

  const copyEndpoint = () => {
    navigator.clipboard.writeText('POST http://localhost:3000/api/gate/check');
    setCopiedEndpoint(true);
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

  // Helper for categorizing violations
  const getViolationBadge = (v: string) => {
    if (v.toLowerCase().includes('health')) return { label: 'HEALTH', variant: 'destructive' as const };
    if (v.toLowerCase().includes('zombie')) return { label: 'ZOMBIE CORE', variant: 'destructive' as const };
    if (v.toLowerCase().includes('critical risk')) return { label: 'RISK RADAR', variant: 'destructive' as const };
    if (v.toLowerCase().includes('duplicate')) return { label: 'DUPLICATION', variant: 'warning' as const };
    if (v.toLowerCase().includes('security')) return { label: 'SECURITY', variant: 'destructive' as const };
    return { label: 'POLICY', variant: 'outline' as const };
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/75 backdrop-blur-md font-mono animate-in fade-in duration-150"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Subtle top gradient accent */}
        <div className="h-1 w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-500" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-sm sm:text-base text-neutral-900 dark:text-neutral-100 tracking-tight">
                  CI/CD Quality Gate &amp; Drift Policy Simulator
                </h3>
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider text-purple-700 dark:text-purple-300 border-purple-500/30 bg-purple-500/5">
                  pipeline-governance
                </Badge>
                <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </div>
              </div>
              <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Simulate pull-request blocking rules before enforcing in GitHub Actions or GitLab CI.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {/* Policy Preset Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-lg bg-neutral-100/70 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800/80">
            <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
              <Sliders className="w-3.5 h-3.5 text-purple-500" />
              <span className="font-semibold text-[11px] uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                Policy Presets:
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset('recommended')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  activePreset === 'recommended'
                    ? 'bg-purple-600 text-white shadow-xs font-semibold'
                    : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                ⚡ Recommended CI
              </button>
              <button
                type="button"
                onClick={() => applyPreset('relaxed')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  activePreset === 'relaxed'
                    ? 'bg-purple-600 text-white shadow-xs font-semibold'
                    : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                🌿 Dev / Staging
              </button>
              <button
                type="button"
                onClick={() => applyPreset('strict')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  activePreset === 'strict'
                    ? 'bg-purple-600 text-white shadow-xs font-semibold'
                    : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                🛡️ Zero-Trust Prod
              </button>
              {activePreset === 'custom' && (
                <span className="px-2 py-0.5 rounded text-[10px] bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-700 font-mono">
                  Custom Mode
                </span>
              )}
            </div>
          </div>

          {/* Active Policy Thresholds Grid */}
          <div className="bg-neutral-50/70 dark:bg-neutral-950/70 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800/80">
              <div className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-neutral-500" />
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                  Active Policy Thresholds
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-neutral-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Live re-evaluated
                </span>
                <button
                  type="button"
                  onClick={() => applyPreset('recommended')}
                  className="text-[11px] text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Reset to recommended defaults"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Card 1: Min Fleet Health Score */}
              <div className="p-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800/80 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                      Min Fleet Health:
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100 font-mono">
                      {minHealth}
                    </span>
                    {result && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono border ${
                          result.health_score >= minHealth
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 font-bold'
                        }`}
                      >
                        {result.health_score >= minHealth
                          ? `Actual ${result.health_score} (PASS)`
                          : `Actual ${result.health_score} (FAIL)`}
                      </span>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min="30"
                  max="95"
                  value={minHealth}
                  onChange={e => handleCustomChange(setMinHealth, Number(e.target.value))}
                  className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-600 dark:accent-purple-400"
                />
                <div className="flex justify-between text-[10px] text-neutral-400">
                  <span>Relaxed (30)</span>
                  <span>Target Threshold</span>
                  <span>Strict (95)</span>
                </div>
              </div>

              {/* Card 2: Min Security Score */}
              <div className="p-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800/80 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                      Min Security Score:
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100 font-mono">
                      {minSecurity}
                    </span>
                    {result && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono border ${
                          result.security_score >= minSecurity
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 font-bold'
                        }`}
                      >
                        {result.security_score >= minSecurity
                          ? `Actual ${result.security_score} (PASS)`
                          : `Actual ${result.security_score} (FAIL)`}
                      </span>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min="30"
                  max="100"
                  value={minSecurity}
                  onChange={e => handleCustomChange(setMinSecurity, Number(e.target.value))}
                  className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-600 dark:accent-purple-400"
                />
                <div className="flex justify-between text-[10px] text-neutral-400">
                  <span>Permissive (30)</span>
                  <span>Target Threshold</span>
                  <span>Maximum (100)</span>
                </div>
              </div>

              {/* Card 3: Max Duplicate Clusters */}
              <div className="p-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800/80 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                      Max Duplicate Clusters:
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100 font-mono">
                      {maxDuplicates}
                    </span>
                    {result && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono border ${
                          result.duplicate_count <= maxDuplicates
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 font-bold'
                        }`}
                      >
                        {result.duplicate_count <= maxDuplicates
                          ? `Actual ${result.duplicate_count} (PASS)`
                          : `Actual ${result.duplicate_count} (FAIL)`}
                      </span>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={maxDuplicates}
                  onChange={e => handleCustomChange(setMaxDuplicates, Number(e.target.value))}
                  className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-600 dark:accent-purple-400"
                />
                <div className="flex justify-between text-[10px] text-neutral-400">
                  <span>Zero (0)</span>
                  <span>Allowed Ceiling</span>
                  <span>Permissive (15)</span>
                </div>
              </div>

              {/* Card 4: Zombie Core Assets Policy */}
              <div className="p-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800/80 flex flex-col justify-between">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                      Zombie Core Assets:
                    </span>
                  </div>
                  {result && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                      {result.zombie_count} Detected
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 mt-2.5">
                  <button
                    type="button"
                    onClick={() => handleCustomChange(setFailOnZombies, true)}
                    className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      failOnZombies
                        ? 'bg-red-500 text-white shadow-xs'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                    }`}
                  >
                    <Shield className="w-3 h-3" />
                    STRICT (Block)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCustomChange(setFailOnZombies, false)}
                    className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      !failOnZombies
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                    PERMISSIVE
                  </button>
                </div>
                <p className="text-[10px] text-neutral-400 mt-1.5">
                  {failOnZombies
                    ? 'Fails pipeline if unmaintained core assets with high blast radius are detected.'
                    : 'Permits pipeline execution with non-blocking warning telemetry.'}
                </p>
              </div>
            </div>

            {/* Advanced Policy Rules Toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 font-medium transition-colors cursor-pointer"
              >
                {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <span>Advanced Governance Rules (Critical Risk Ceiling)</span>
              </button>

              {showAdvanced && (
                <div className="mt-2.5 p-3 rounded-lg bg-neutral-100/50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                      Max Critical Risks Allowed:
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                        {maxCriticalRisks}
                      </span>
                      {result && (
                        <span className="text-[10px] text-neutral-500 font-mono">
                          (Fleet has {result.critical_risk_count} critical)
                        </span>
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    value={maxCriticalRisks}
                    onChange={e => handleCustomChange(setMaxCriticalRisks, Number(e.target.value))}
                    className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-600 dark:accent-purple-400"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-400">
                    <span>Zero Tolerance (0)</span>
                    <span>Tolerated Risks</span>
                    <span>Relaxed (5)</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Gate Verdict Banner */}
          {result && (
            <div
              className={`p-4 rounded-xl border transition-all ${
                result.passed
                  ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/30 text-emerald-950 dark:text-emerald-100 shadow-sm'
                  : 'bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent border-red-500/30 text-red-950 dark:text-red-100 shadow-sm'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                    result.passed
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30'
                  }`}
                >
                  {result.passed ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                </div>

                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm tracking-wide">
                        {result.passed ? 'QUALITY GATE PASSED' : 'QUALITY GATE FAILED'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                          result.passed
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/30'
                        }`}
                      >
                        {result.passed ? 'PR Status: Mergeable' : 'PR Status: Blocked'}
                      </span>
                    </div>
                    <Badge variant={result.passed ? 'secondary' : 'destructive'} className="text-[10px] font-mono">
                      exit code: {result.passed ? 0 : 1}
                    </Badge>
                  </div>

                  <p className="text-xs text-neutral-600 dark:text-neutral-300">
                    {result.passed
                      ? 'All infrastructure code governance checks passed successfully. Pull request is eligible for automated merge.'
                      : 'The pull request violates configured IaC quality rules and would be blocked in CI.'}
                  </p>

                  {/* Summary Metric Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded font-mono border ${
                        result.health_score >= minHealth
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                          : 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20'
                      }`}
                    >
                      Health: {result.health_score}/{minHealth}
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded font-mono border ${
                        result.security_score >= minSecurity
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                          : 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20'
                      }`}
                    >
                      Security: {result.security_score}/{minSecurity}
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded font-mono border ${
                        !failOnZombies || result.zombie_count === 0
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                          : 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20'
                      }`}
                    >
                      Zombies: {result.zombie_count} {failOnZombies ? '(Strict)' : '(Allowed)'}
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded font-mono border ${
                        result.duplicate_count <= maxDuplicates
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                          : 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20'
                      }`}
                    >
                      Duplicates: {result.duplicate_count}/{maxDuplicates}
                    </span>
                  </div>

                  {/* Violations List */}
                  {result.violations.length > 0 && (
                    <div className="pt-2 border-t border-red-500/20 mt-2 space-y-1.5">
                      <span className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Violations ({result.violations.length}):
                      </span>
                      <div className="space-y-1.5 mt-1.5">
                        {result.violations.map((v, i) => {
                          const badge = getViolationBadge(v);
                          return (
                            <div
                              key={i}
                              className="flex items-start gap-2 p-2 rounded-md bg-red-500/5 border border-red-500/15 text-neutral-800 dark:text-neutral-200"
                            >
                              <Badge variant={badge.variant} className="text-[9px] shrink-0 font-mono mt-0.5">
                                {badge.label}
                              </Badge>
                              <span className="text-[11px] leading-relaxed flex-1">{v}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {result.recommendations && result.recommendations.length > 0 && (
                    <div className="pt-2 border-t border-purple-500/20 mt-2 space-y-1.5">
                      <span className="font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Remediation Guidance:
                      </span>
                      <ul className="space-y-1 mt-1 text-[11px] text-neutral-600 dark:text-neutral-300">
                        {result.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-purple-500 shrink-0 mt-0.5">→</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CI/CD Integration Snippet & Multi-Provider Tabs */}
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5 text-neutral-500" />
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                  CI Pipeline Integration:
                </span>
                <div className="flex items-center gap-1 ml-2 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <button
                    type="button"
                    onClick={() => setActiveCiTab('github')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                      activeCiTab === 'github'
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                    }`}
                  >
                    GitHub Actions
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCiTab('gitlab')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                      activeCiTab === 'gitlab'
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                    }`}
                  >
                    GitLab CI
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCiTab('curl')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                      activeCiTab === 'curl'
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                    }`}
                  >
                    cURL / CLI
                  </button>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={copyCiSnippet}
              >
                {copiedCi ? <Check className="w-3 h-3 text-emerald-500 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                {copiedCi ? 'Copied to Clipboard' : 'Copy Step Code'}
              </Button>
            </div>

            {/* High-tech terminal viewer */}
            <div className="rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950 shadow-inner">
              <div className="flex items-center justify-between px-3.5 py-2 bg-neutral-900/90 border-b border-neutral-800 text-[11px] text-neutral-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                  <span className="ml-2 font-mono text-[10px] text-neutral-400">
                    {activeCiTab === 'github' && '.github/workflows/quality-gate.yml'}
                    {activeCiTab === 'gitlab' && '.gitlab-ci.yml'}
                    {activeCiTab === 'curl' && 'bash / terminal execution'}
                  </span>
                </div>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
                  {activeCiTab === 'curl' ? 'BASH' : 'YAML'}
                </span>
              </div>
              <pre className="p-3.5 text-neutral-200 text-[11px] overflow-x-auto font-mono leading-relaxed selection:bg-purple-900/50">
                {getCiSnippet()}
              </pre>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-neutral-500 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Policy API:</span>
            <button
              type="button"
              onClick={copyEndpoint}
              className="font-mono text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
              title="Copy endpoint"
            >
              <code>POST /api/gate/check</code>
              {copiedEndpoint ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={copyCiSnippet}
              className="text-[11px]"
            >
              <Code2 className="w-3.5 h-3.5 mr-1" />
              Copy Pipeline Step
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={onClose}
              className="text-[11px]"
            >
              Close
              <span className="ml-1.5 text-[9px] opacity-60 font-mono px-1 py-0.2 rounded bg-neutral-700 dark:bg-neutral-300 text-neutral-100 dark:text-neutral-900">
                ESC
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
