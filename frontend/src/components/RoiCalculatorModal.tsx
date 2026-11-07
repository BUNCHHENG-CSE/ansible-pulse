import React, { useState } from 'react';
import { DollarSign, TrendingUp, Users, AlertCircle, ShieldCheck, Check, Sparkles, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface RoiCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoiCalculatorModal: React.FC<RoiCalculatorModalProps> = ({
  isOpen,
  onClose
}) => {
  const [teamSize, setTeamSize] = useState(8);
  const [hoursPerMonthPerEngineer, setHoursPerMonth] = useState(6);
  const [hourlyRate, setHourlyRate] = useState(85);
  const [outagesPerYear, setOutagesPerYear] = useState(1);
  const [costPerOutage, setCostPerOutage] = useState(25000);
  const [tier, setTier] = useState<'standard' | 'enterprise'>('standard');

  if (!isOpen) return null;

  const monthlySubscription = tier === 'standard' ? 99 : 249;
  const annualSubscription = monthlySubscription * 12;

  // Manual governance waste per year: teamSize * hoursPerMonth * hourlyRate * 12
  const annualGovernanceCost = teamSize * hoursPerMonthPerEngineer * hourlyRate * 12;
  const annualOutageCost = outagesPerYear * costPerOutage;
  const totalAnnualCostWithoutTool = annualGovernanceCost + annualOutageCost;

  // Assuming tool saves 70% of governance time and prevents version confusion outages
  const annualSavings = Math.round(annualGovernanceCost * 0.7 + annualOutageCost * 0.85);
  const netRoi = Math.round(((annualSavings - annualSubscription) / annualSubscription) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/85 backdrop-blur-sm font-mono">
      <Card className="max-w-xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700">
        <div className="flex items-start justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                Business Case Calculator
              </span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">Script Governance ROI</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Anchored to preventing outages caused by divergent versions & manual cleanup.
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

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-neutral-50 dark:bg-neutral-950 p-3 rounded border border-neutral-200 dark:border-neutral-800 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-neutral-700 dark:text-neutral-300 font-semibold">Team Size</span>
              <span className="font-bold text-neutral-900 dark:text-neutral-100">{teamSize} engineers</span>
            </div>
            <input
              type="range"
              min="3"
              max="40"
              value={teamSize}
              onChange={(e) => setTeamSize(Number(e.target.value))}
              className="w-full accent-neutral-700 dark:accent-neutral-300 cursor-pointer"
            />
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">5–25 person infrastructure team</span>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-950 p-3 rounded border border-neutral-200 dark:border-neutral-800 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-neutral-700 dark:text-neutral-300 font-semibold">Hours wasted/mo</span>
              <span className="font-bold text-neutral-900 dark:text-neutral-100">{hoursPerMonthPerEngineer} hrs/eng</span>
            </div>
            <input
              type="range"
              min="2"
              max="20"
              value={hoursPerMonthPerEngineer}
              onChange={(e) => setHoursPerMonth(Number(e.target.value))}
              className="w-full accent-neutral-700 dark:accent-neutral-300 cursor-pointer"
            />
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">Debugging parameter drift & copies</span>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-950 p-3 rounded border border-neutral-200 dark:border-neutral-800 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-neutral-700 dark:text-neutral-300 font-semibold">Cost of 1 Outage</span>
              <span className="font-bold text-red-600 dark:text-red-400">${costPerOutage.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="5000"
              max="100000"
              step="5000"
              value={costPerOutage}
              onChange={(e) => setCostPerOutage(Number(e.target.value))}
              className="w-full accent-neutral-700 dark:accent-neutral-300 cursor-pointer"
            />
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">Industry avg: $25k–$50k / event</span>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-950 p-3 rounded border border-neutral-200 dark:border-neutral-800 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-neutral-700 dark:text-neutral-300 font-semibold">Subscription</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">${monthlySubscription}/mo</span>
            </div>
            <div className="flex gap-1.5 pt-0.5">
              <Button
                variant={tier === 'standard' ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setTier('standard')}
                className="flex-1 h-7 text-[10px]"
              >
                Standard ($99)
              </Button>
              <Button
                variant={tier === 'enterprise' ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setTier('enterprise')}
                className="flex-1 h-7 text-[10px]"
              >
                Enterprise ($249)
              </Button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="p-3.5 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850">
              <span className="text-[10px] uppercase text-neutral-500 dark:text-neutral-400 block">Unmanaged Waste</span>
              <div className="text-base font-bold text-neutral-900 dark:text-neutral-200 mt-0.5">
                ${totalAnnualCostWithoutTool.toLocaleString()} <span className="text-[10px] text-neutral-500">/yr</span>
              </div>
            </div>

            <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
              <span className="text-[10px] uppercase text-emerald-700 dark:text-emerald-400 block font-semibold">Net Savings</span>
              <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                ${annualSavings.toLocaleString()} <span className="text-[10px] text-emerald-600 dark:text-emerald-400/80">/yr</span>
              </div>
            </div>

            <div className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850">
              <span className="text-[10px] uppercase text-neutral-600 dark:text-neutral-400 block font-semibold">Calculated ROI</span>
              <div className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
                {netRoi.toLocaleString()}%
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
            <span className="font-semibold text-neutral-800 dark:text-neutral-300">Validation Statement:</span>
            <p className="mt-0.5 italic text-neutral-500 dark:text-neutral-400">
              "When did running the wrong version of a playbook last cause an outage or staging drift? TCT AnsiblePulse automates blast radius visibility for less than one engineering team lunch."
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Calculator
          </Button>
        </div>
      </Card>
    </div>
  );
};
