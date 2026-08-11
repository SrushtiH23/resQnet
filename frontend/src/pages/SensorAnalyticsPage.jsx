import React from 'react';
import { RealTimeTelemetryGraph } from '../components/RealTimeTelemetryGraph';
import { useAccelerometer } from '../hooks/useAccelerometer';
import { LineChart, Smartphone } from 'lucide-react';

export const SensorAnalyticsPage = () => {
  const accel = useAccelerometer();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 w-fit">
              <LineChart className="w-3.5 h-3.5" /> Real-Time Telemetry Waveforms
            </span>
            <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 border ${
              accel.sensorState === 'ACTIVE'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              <Smartphone className="w-3.5 h-3.5" />
              Sensor status: {accel.sensorState.replace(/_/g, ' ')}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Sensor Analytics Engine
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Continuous Acceleration (m/s²) vs Time waveform line chart analytics from real hardware sensors.
          </p>
        </div>
      </div>

      <RealTimeTelemetryGraph currentAccel={accel.total_accel} isMonitoring={accel.sensorState === 'ACTIVE'} />
    </div>
  );
};
