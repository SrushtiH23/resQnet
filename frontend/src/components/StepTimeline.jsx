import React from 'react';
import { Clock, Radio, AlertTriangle, ShieldCheck, PhoneCall, Building2 } from 'lucide-react';

export const StepTimeline = () => {
  const events = [
    { time: '6:20 PM', stage: 'Monitoring', desc: '20Hz sensor background telemetry stream active', icon: <Radio className="w-4 h-4 text-emerald-400" />, badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
    { time: '6:21 PM', stage: 'Fall Detected', desc: 'Freefall (0.4g) & Vector Impact Force (26.2g) recorded', icon: <AlertTriangle className="w-4 h-4 text-amber-400" />, badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
    { time: '6:22 PM', stage: 'Verification', desc: '30-second checkout prompt displayed on device', icon: <ShieldCheck className="w-4 h-4 text-orange-400" />, badgeColor: 'bg-orange-500/20 text-orange-400 border-orange-500/40' },
    { time: '6:23 PM', stage: 'Family Escalation', desc: 'Sequential family emergency contacts notified via SMS', icon: <PhoneCall className="w-4 h-4 text-rose-400" />, badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40' },
    { time: '6:24 PM', stage: 'Hospital Dispatched', desc: 'Dijkstra routing assigned SF General ER & Priority Ambulance', icon: <Building2 className="w-4 h-4 text-cyan-400" />, badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' },
  ];

  return (
    <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4 shadow-2xl">
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Emergency Incident Step Timeline
          </h3>
          <p className="text-xs text-slate-400">Sequential Timestamp Log (6:20 PM – 6:24 PM)</p>
        </div>
        <span className="px-3 py-1 bg-slate-900 text-slate-300 border border-slate-800 text-xs font-mono font-bold rounded-xl">
          Duration: 4 Mins
        </span>
      </div>

      {/* Vertical Stepper Timeline */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
        {events.map((evt, idx) => (
          <div key={idx} className="relative flex items-start justify-between flex-wrap gap-2 group">
            {/* Timeline Node Icon */}
            <div className="absolute -left-6 p-1.5 rounded-full bg-slate-900 border border-slate-700 shadow-md">
              {evt.icon}
            </div>

            <div className="space-y-0.5 max-w-md">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-cyan-400">{evt.time}</span>
                <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md border ${evt.badgeColor}`}>
                  {evt.stage}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">{evt.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
