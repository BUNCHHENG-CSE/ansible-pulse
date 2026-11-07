'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { fetchExecutiveReport } from '@/lib/api';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  X, Copy, Check, Download, Printer,
  FileText, Sparkles, Code2, Globe, FileDown
} from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReportModal({ isOpen, onClose }: ReportModalProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [reportMarkdown, setReportMarkdown] = useState<string>('');
  const [reportHtml, setReportHtml] = useState<string>('');
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');
  const [copied, setCopied] = useState<boolean>(false);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const [md, html] = await Promise.all([
        fetchExecutiveReport('markdown'),
        fetchExecutiveReport('html')
      ]);
      setReportMarkdown(md);
      setReportHtml(html);
    } catch (err) {
      console.error('Failed to load executive report:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadReports();
    }
  }, [isOpen, loadReports]);

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

  const copyMarkdown = () => {
    navigator.clipboard.writeText(reportMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (format: 'md' | 'html') => {
    const content = format === 'md' ? reportMarkdown : reportHtml;
    const type = format === 'md' ? 'text/markdown' : 'text/html';
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tct-ansiblepulse-executive-audit.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printHtml = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(reportHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/75 backdrop-blur-md font-mono animate-in fade-in duration-150"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-5xl xl:max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Subtle top gradient accent */}
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" />

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-sm sm:text-base text-neutral-900 dark:text-neutral-100 tracking-tight">
                  Executive Governance &amp; Audit Report
                </h3>
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider text-blue-700 dark:text-blue-300 border-blue-500/30 bg-blue-500/5">
                  management-brief
                </Badge>
                <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Audit Ready
                </div>
              </div>
              <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Complete longitudinal analysis, Zombie Core flags, and strategic remediation roadmap.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="px-4 py-2.5 bg-neutral-100/70 dark:bg-neutral-950/70 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-1 bg-white dark:bg-neutral-900 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'preview'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Formatted View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('raw')}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'raw'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Raw Markdown
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={copyMarkdown}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copied ? 'Copied' : 'Copy MD'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => downloadFile('md')}
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Download .md
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => downloadFile('html')}
            >
              <Globe className="w-3.5 h-3.5 mr-1" />
              Download .html
            </Button>
            <Button
              size="sm"
              className="h-7 text-[11px] bg-blue-600 hover:bg-blue-500 text-white shadow-xs font-semibold"
              onClick={printHtml}
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              Print / Save PDF
            </Button>
          </div>
        </div>

        {/* Report Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-neutral-100/50 dark:bg-neutral-950/50 flex flex-col min-h-0">
          {loading ? (
            <div className="p-16 text-center text-neutral-500 flex flex-col items-center justify-center m-auto">
              <Sparkles className="w-8 h-8 mb-3 animate-spin text-blue-500" />
              <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                Compiling executive scorecards and risk registries...
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                Aggregating multi-repo AST AST models, blast radius indices, and security findings.
              </p>
            </div>
          ) : viewMode === 'raw' ? (
            <div className="rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950 shadow-inner flex flex-col flex-1">
              <div className="flex items-center justify-between px-3.5 py-2 bg-neutral-900/90 border-b border-neutral-800 text-[11px] text-neutral-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                  <span className="ml-2 font-mono text-[10px] text-neutral-400">
                    tct-ansiblepulse-audit.md
                  </span>
                </div>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
                  MARKDOWN SOURCE
                </span>
              </div>
              <pre className="p-4 text-neutral-200 text-xs overflow-auto font-mono leading-relaxed whitespace-pre-wrap flex-1 selection:bg-blue-900/50">
                {reportMarkdown}
              </pre>
            </div>
          ) : (
            <div className="flex-1 w-full rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-[#090d16] shadow-sm flex flex-col min-h-[580px]">
              <iframe
                title="Executive Report Preview"
                srcDoc={reportHtml}
                className="w-full flex-1 border-none bg-[#090d16]"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-neutral-500 text-[11px] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Generated by TCT AnsiblePulse Read-Only Static Engine.
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadFile('md')}
              className="text-[11px]"
            >
              <FileDown className="w-3.5 h-3.5 mr-1" />
              Download Report
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
