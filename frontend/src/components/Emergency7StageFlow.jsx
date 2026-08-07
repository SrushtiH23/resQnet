import React from 'react';
import { Activity, ShieldCheck, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';

export const Emergency7StageFlow = ({ activeStage = 'STILLNESS' }) => {
  const stages = [
    { key: 'NORMAL', label: 'NORMAL', desc: '20Hz Telemetry' },
    { key: 'FREE_FALL', label: 'FREE FALL', desc: '< 3.0 m/s²' },
    { key: 'IMPACT', label: 'IMPACT', desc: '> 24.0 m/s²' },
    { key: 'STILLNESS', label: 'STILLNESS', desc: '< 1.5 m/s²' },
    { key: 'VERIFY', label: 'VERIFY', desc: '30s Checkout' },
    { key: 'ESCALATE', label: 'ESCALATE', desc: 'Family Queue' },
    { key: 'RESOLVED', label: 'RESOLVED', desc: 'Hospital ER' },
  ];

  const getStageIndex = (key) => stages.findIndex((s) => s.key === key);
  const activeIdx = getStageIndex(activeStage);

  return (
    <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4 shadow-2xl">
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            7-Stage Emergency Motion State Machine
          </h3>
          <p className="text-xs text-slate-400">Finite State Transition Pipeline</p>
        </div>
        <span className="px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-mono font-bold rounded-xl animate-pulse">
          Current State: {activeStage}
        </span>
      </div>

      {/* Pipeline Flow Stepper */}
      <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
        {stages.map((stg, idx) => {
          const isCurrent = idx === activeIdx;
          const isPassed = idx < activeIdx;

          return (
            <div
              key={stg.key}
              className={`p-3 rounded-2xl border text-center transition-all flex flex-col justify-between space-y-1 relative ${
                isCurrent
                  ? 'bg-rose-600/30 border-rose-500 shadow-lg shadow-rose-500/25 ring-2 ring-rose-500/40 scale-105 z-10'
                  : isPassed
                  ? 'bg-slate-900/90 border-slate-700 text-slate-300'
                  : 'bg-slate-950/60 border-slate-850 text-slate-500 opacity-60'
              }`}
            >
              <div className="flex justify-center mb-1">
                {isPassed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : isCurrent ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-slate-600" />
                )}
              </div>
              <p className={`text-[10px] font-extrabold tracking-wider ${isCurrent ? 'text-white' : 'text-slate-300'}`}>
                {stg.label}
              </p>
              <span className="text-[9px] text-slate-400 block font-mono">{stg.desc}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
