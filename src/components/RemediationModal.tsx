import React, { useState, useEffect } from 'react';
import type { CanonicalRemediation, DuplicateCluster } from '@/lib/types';
import { fetchRemediation } from '@/lib/api';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  X, Copy, Check, Download,
  Layers, Sparkles
} from 'lucide-react';

interface RemediationModalProps {
  cluster: DuplicateCluster | null;
  onClose: () => void;
}

export function RemediationModal({ cluster, onClose }: RemediationModalProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<CanonicalRemediation | null>(null);
  const [activeTab, setActiveTab] = useState<'tasks' | 'defaults' | 'patch' | 'notes'>('tasks');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!cluster) return;
    setLoading(true);
    fetchRemediation(cluster.cluster_id)
      .then(res => setData(res))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [cluster]);

  if (!cluster) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadPatch = () => {
    if (!data?.git_patch_diff) return;
    const blob = new Blob([data.git_patch_diff], { type: 'text/x-diff' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.suggested_role_name || 'consolidation'}.patch`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md font-sans">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                  Canonical Role Synthesizer & Patch Generator
                </h3>
                <Badge variant="outline" className="text-[10px]">
                  auto-remediation
                </Badge>
              </div>
              <p className="text-[11px] text-neutral-500">
                Consolidation target: <span className="text-neutral-700 dark:text-neutral-300">{cluster.functionality_name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="p-12 text-center text-neutral-500">
            <Sparkles className="w-6 h-6 mx-auto mb-2 animate-spin text-emerald-500" />
            <p className="text-xs">Synthesizing canonical Ansible role and computing parameter diffs...</p>
          </div>
        ) : !data ? (
          <div className="p-12 text-center text-neutral-500 text-xs">
            Failed to generate canonical role.
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Meta bar */}
            <div className="p-3 bg-neutral-50 dark:bg-neutral-950/80 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-neutral-500">Suggested Role:</span>
                <code className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-bold text-emerald-600 dark:text-emerald-400">
                  {data.suggested_role_name}
                </code>
                <span className="text-neutral-400">|</span>
                <span className="text-neutral-500">Impacted Repos:</span>
                <span className="text-neutral-800 dark:text-neutral-200 font-semibold">
                  {data.impacted_repos.length}
                </span>
              </div>

              {/* Sub-tabs */}
              <div className="flex items-center gap-1 bg-neutral-200/60 dark:bg-neutral-800/80 p-0.5 rounded text-xs">
                <button
                  onClick={() => setActiveTab('tasks')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    activeTab === 'tasks' ? 'bg-white dark:bg-neutral-900 shadow-xs font-semibold' : 'text-neutral-500'
                  }`}
                >
                  tasks/main.yml
                </button>
                <button
                  onClick={() => setActiveTab('defaults')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    activeTab === 'defaults' ? 'bg-white dark:bg-neutral-900 shadow-xs font-semibold' : 'text-neutral-500'
                  }`}
                >
                  defaults/main.yml
                </button>
                <button
                  onClick={() => setActiveTab('patch')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    activeTab === 'patch' ? 'bg-white dark:bg-neutral-900 shadow-xs font-semibold' : 'text-neutral-500'
                  }`}
                >
                  Unified Git Patch
                </button>
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    activeTab === 'notes' ? 'bg-white dark:bg-neutral-900 shadow-xs font-semibold' : 'text-neutral-500'
                  }`}
                >
                  Migration Notes
                </button>
              </div>
            </div>

            {/* Code / Text Panel */}
            <div className="flex-1 overflow-y-auto p-4 bg-neutral-950 text-neutral-200 text-xs font-mono relative">
              {activeTab === 'tasks' && (
                <div>
                  <div className="flex justify-between items-center mb-2 pb-2 border-b border-neutral-800 text-neutral-400">
                    <span>roles/{data.suggested_role_name}/tasks/main.yml</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white"
                      onClick={() => copyToClipboard(data.canonical_task_yaml, 'tasks')}
                    >
                      {copied === 'tasks' ? <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                      {copied === 'tasks' ? 'Copied' : 'Copy YAML'}
                    </Button>
                  </div>
                  <pre className="text-emerald-400/90 whitespace-pre leading-relaxed">{data.canonical_task_yaml}</pre>
                </div>
              )}

              {activeTab === 'defaults' && (
                <div>
                  <div className="flex justify-between items-center mb-2 pb-2 border-b border-neutral-800 text-neutral-400">
                    <span>roles/{data.suggested_role_name}/defaults/main.yml</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white"
                      onClick={() => copyToClipboard(data.defaults_yaml, 'defaults')}
                    >
                      {copied === 'defaults' ? <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                      {copied === 'defaults' ? 'Copied' : 'Copy YAML'}
                    </Button>
                  </div>
                  <pre className="text-amber-400/90 whitespace-pre leading-relaxed">{data.defaults_yaml}</pre>
                </div>
              )}

              {activeTab === 'patch' && (
                <div>
                  <div className="flex justify-between items-center mb-2 pb-2 border-b border-neutral-800 text-neutral-400">
                    <span>{data.suggested_role_name}.patch</span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white"
                        onClick={() => copyToClipboard(data.git_patch_diff, 'patch')}
                      >
                        {copied === 'patch' ? <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                        {copied === 'patch' ? 'Copied' : 'Copy Diff'}
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                        onClick={downloadPatch}
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Download .patch
                      </Button>
                    </div>
                  </div>
                  <pre className="text-blue-400/90 whitespace-pre leading-relaxed font-mono">{data.git_patch_diff}</pre>
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="space-y-3 p-2 text-neutral-300">
                  <h4 className="font-semibold text-sm text-neutral-100 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    Consolidation Strategy & Variable Overrides
                  </h4>
                  <ul className="list-disc pl-5 space-y-1.5 text-xs text-neutral-400">
                    {data.refactoring_notes.map((note, idx) => (
                      <li key={idx}>{note}</li>
                    ))}
                  </ul>

                  <div className="mt-4 p-3 rounded bg-neutral-900 border border-neutral-800">
                    <h5 className="font-semibold text-xs text-neutral-200 mb-1">How to apply this patch:</h5>
                    <code className="text-emerald-400 block bg-black/50 p-2 rounded text-[11px]">
                      git apply {data.suggested_role_name}.patch
                    </code>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex items-center justify-between text-xs">
          <span className="text-neutral-500 text-[11px]">
            Read-only synthesizer &bull; Does not mutate files on disk automatically.
          </span>
          <Button size="sm" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
