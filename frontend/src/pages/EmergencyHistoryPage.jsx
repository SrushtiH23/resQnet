import React from 'react';
import { StepTimeline } from '../components/StepTimeline';
import { Clock, History } from 'lucide-react';

export const EmergencyHistoryPage = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex items-center justify-between flex-wrap gap-4">
        <div>
          <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 w-fit mb-1">
            <History className="w-3.5 h-3.5" /> Sequential Timestamp Logs
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Emergency Incident History
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Step timeline of incident occurrences (6:20 PM Monitoring → 6:24 PM Hospital Dispatched).
          </p>
        </div>
      </div>

      <StepTimeline />
    </div>
  );
};
