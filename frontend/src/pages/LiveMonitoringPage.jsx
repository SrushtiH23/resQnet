import React from 'react';
import { RealSmartphoneSensor } from '../components/RealSmartphoneSensor';
import { Smartphone, Radio, Activity } from 'lucide-react';

export const LiveMonitoringPage = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex items-center justify-between flex-wrap gap-4">
        <div>
          <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 w-fit mb-1">
            <Radio className="w-3.5 h-3.5 animate-pulse" /> 200ms Fast Telemetry Stream
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Live Hardware Monitoring
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Raw smartphone DeviceMotionEvent & DeviceOrientationEvent hardware sensor values.
          </p>
        </div>
      </div>

      <RealSmartphoneSensor />
    </div>
  );
};
