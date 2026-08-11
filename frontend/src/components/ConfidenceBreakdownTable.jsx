import React from 'react';
import { ShieldCheck, Activity, Zap, Compass, Navigation, Award, CheckCircle2, XCircle } from 'lucide-react';

export const ConfidenceBreakdownTable = ({ evidence = {} }) => {
  const {
    free_fall = false,
    impact = false,
    stillness = false,
    rotation = false,
    gps = false
  } = evidence;

  const items = [
    { factor: 'Free Fall', weight: 25, active: Boolean(free_fall), icon: <Activity className="w-4 h-4 text-cyan-400" />, desc: 'Freefall acceleration < 3.0 m/s² detected' },
    { factor: 'Impact', weight: 25, active: Boolean(impact), icon: <Zap className="w-4 h-4 text-rose-400" />, desc: 'Vector impact force > 24.0 m/s² detected' },
    { factor: 'Stillness', weight: 20, active: Boolean(stillness), icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />, desc: 'Post-impact lack of motion < 1.5 m/s²' },
    { factor: 'Gyroscope', weight: 15, active: Boolean(rotation), icon: <Compass className="w-4 h-4 text-purple-400" />, desc: 'Rapid body rotation > 180°/s' },
    { factor: 'GPS', weight: 10, active: Boolean(gps), icon: <Navigation className="w-4 h-4 text-amber-400" />, desc: 'High precision geospatial location verified' },
  ];

  const totalScore = items.reduce((acc, item) => acc + (item.active ? item.weight : 0), 0);

  return (
    <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4 shadow-2xl">
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-rose-500" />
            Itemized Emergency Confidence Score Breakdown
          </h3>
          <p className="text-xs text-slate-400">Multi-factor Evidence Matrix Calculation</p>
        </div>

        <div className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-2xl text-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Evidence Score</span>
          <span className={`text-2xl font-black font-mono ${totalScore > 50 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {totalScore}%
          </span>
        </div>
      </div>

      {/* Itemized Evidence Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              <th className="py-2.5 px-3">Evidence Factor</th>
              <th className="py-2.5 px-3">Detected Status</th>
              <th className="py-2.5 px-3">Condition Criteria</th>
              <th className="py-2.5 px-3 text-right">Points Added</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-900/50 transition-colors">
                <td className="py-2.5 px-3 text-slate-200 flex items-center gap-2 font-bold">
                  {item.icon}
                  {item.factor}
                </td>
                <td className="py-2.5 px-3">
                  {item.active ? (
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-bold inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> YES
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg text-[10px] font-bold inline-flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-slate-500" /> NO
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-slate-400 text-[11px]">{item.desc}</td>
                <td className="py-2.5 px-3 text-right font-mono font-bold">
                  {item.active ? (
                    <span className="text-emerald-400">+{item.weight}%</span>
                  ) : (
                    <span className="text-slate-500">+0%</span>
                  )}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-900/90 font-extrabold text-slate-100">
              <td className="py-3 px-3 uppercase tracking-wider" colSpan={3}>Total Emergency Threat Index</td>
              <td className="py-3 px-3 text-right font-mono text-base text-rose-400">{totalScore}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
