import React from 'react';
import { RealTimeTelemetryGraph } from '../components/RealTimeTelemetryGraph';
import { Activity, LineChart } from 'lucide-react';

export const SensorAnalyticsPage = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex items-center justify-between flex-wrap gap-4">
        <div>
          <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 w-fit mb-1">
            <LineChart className="w-3.5 h-3.5" /> Real-Time Telemetry Waveforms
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Sensor Analytics Engine
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Continuous Acceleration (m/s²) vs Time waveform line chart analytics.
          </p>
        </div>
      </div>

      <RealTimeTelemetryGraph currentAccel={9.81} isMonitoring={true} />
    </div>
  );
};
