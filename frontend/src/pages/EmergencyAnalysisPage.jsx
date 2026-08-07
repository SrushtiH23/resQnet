import React from 'react';
import { Emergency7StageFlow } from '../components/Emergency7StageFlow';
import { Cpu, Activity } from 'lucide-react';

export const EmergencyAnalysisPage = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex items-center justify-between flex-wrap gap-4">
        <div>
          <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 w-fit mb-1">
            <Cpu className="w-3.5 h-3.5" /> Finite State Machine Analysis
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Emergency Motion Analysis
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            7-Stage motion transition pipeline (NORMAL → FREE FALL → IMPACT → STILLNESS → VERIFY → ESCALATE → RESOLVED).
          </p>
        </div>
      </div>

      <Emergency7StageFlow activeStage="STILLNESS" />
    </div>
  );
};
