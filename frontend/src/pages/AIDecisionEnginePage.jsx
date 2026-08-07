import React from 'react';
import { ConfidenceBreakdownTable } from '../components/ConfidenceBreakdownTable';
import { Award, Zap } from 'lucide-react';

export const AIDecisionEnginePage = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex items-center justify-between flex-wrap gap-4">
        <div>
          <span className="px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 w-fit mb-1">
            <Zap className="w-3.5 h-3.5" /> Multi-Factor Scoring Engine
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            AI Decision Engine
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Itemized emergency confidence score matrix (Free Fall: 25 + Impact: 25 + Stillness: 20 + Gyro: 15 + GPS: 10 = 95%).
          </p>
        </div>
      </div>

      <ConfidenceBreakdownTable score={95} />
    </div>
  );
};
