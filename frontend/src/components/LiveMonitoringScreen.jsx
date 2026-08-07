import React, { useState, useEffect } from 'react';
import { Activity, Radio, Navigation, Zap, ShieldCheck, Play, Square } from 'lucide-react';
import { RealSmartphoneSensor } from './RealSmartphoneSensor';

export const LiveMonitoringScreen = ({ isMonitoring, onToggleMonitoring, accelValue, gyroValue, gpsAvailable, confidenceScore, onFallDetected }) => {
  const [liveAccel, setLiveAccel] = useState(accelValue || 9.81);
  const [liveGyro, setLiveGyro] = useState(gyroValue || 0.21);
  const [liveConfidence, setLiveConfidence] = useState(confidenceScore || 12);

  useEffect(() => {
    let interval;
    if (isMonitoring && accelValue === undefined) {
      interval = setInterval(() => {
        const accelNoise = (Math.random() * 0.08 - 0.04);
        const gyroNoise = (Math.random() * 0.04 - 0.02);
        setLiveAccel(+(9.81 + accelNoise).toFixed(2));
        setLiveGyro(+(Math.max(0, 0.21 + gyroNoise)).toFixed(2));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isMonitoring, accelValue]);

  useEffect(() => {
    if (accelValue !== undefined) setLiveAccel(+accelValue.toFixed(2));
    if (gyroValue !== undefined) setLiveGyro(+gyroValue.toFixed(2));
    if (confidenceScore !== undefined) setLiveConfidence(confidenceScore);
  }, [accelValue, gyroValue, confidenceScore]);

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 border ${
                isMonitoring
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                <Radio className="w-3.5 h-3.5" />
                {isMonitoring ? 'Status: Monitoring (20Hz Active)' : 'Status: Standby'}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white">Live Monitoring Screen</h2>
            <p className="text-xs text-slate-400">Continuous hardware telemetry stream updating every second</p>
          </div>

          <button
            onClick={onToggleMonitoring}
            className={`px-5 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 border transition-all shadow-lg ${
              isMonitoring
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-rose-600/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-emerald-600/30'
            }`}
          >
            {isMonitoring ? (
              <>
                <Square className="w-4 h-4" /> Stop Monitoring
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Start Monitoring
              </>
            )}
          </button>
        </div>

        {/* 5 Prominent Display Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {/* Card 1: Acceleration */}
          <div className="glass-card p-4 rounded-2xl border border-slate-800 text-center space-y-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Acceleration</p>
            <p className="text-2xl md:text-3xl font-black text-cyan-400 font-mono">{liveAccel}</p>
            <span className="text-[10px] text-slate-500 block">m/s²</span>
          </div>

          {/* Card 2: Gyroscope */}
          <div className="glass-card p-4 rounded-2xl border border-slate-800 text-center space-y-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gyroscope</p>
            <p className="text-2xl md:text-3xl font-black text-purple-400 font-mono">{liveGyro}</p>
            <span className="text-[10px] text-slate-500 block">°/s</span>
          </div>

          {/* Card 3: GPS */}
          <div className="glass-card p-4 rounded-2xl border border-slate-800 text-center space-y-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">GPS</p>
            <p className="text-xl md:text-2xl font-black text-emerald-400 flex items-center justify-center gap-1 font-sans">
              <Navigation className="w-4 h-4" /> {gpsAvailable ? 'Available' : 'Searching'}
            </p>
            <span className="text-[10px] text-slate-500 block">High Precision</span>
          </div>

          {/* Card 4: Status */}
          <div className="glass-card p-4 rounded-2xl border border-slate-800 text-center space-y-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
            <p className={`text-lg md:text-xl font-black ${isMonitoring ? 'text-emerald-400' : 'text-slate-400'}`}>
              {isMonitoring ? 'Monitoring' : 'Standby'}
            </p>
            <span className="text-[10px] text-slate-500 block">Shield Active</span>
          </div>

          {/* Card 5: Confidence */}
          <div className="glass-card p-4 rounded-2xl border border-slate-800 text-center space-y-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Confidence</p>
            <p className="text-2xl md:text-3xl font-black text-rose-400 font-mono">{liveConfidence}%</p>
            <span className="text-[10px] text-slate-500 block">Score Index</span>
          </div>
        </div>

        {/* Dynamic Confidence Meter Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold text-slate-300">
            <span>Live Dynamic Emergency Confidence:</span>
            <span className="text-rose-400 font-bold font-mono">{liveConfidence}%</span>
          </div>
          <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div
              className="bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, liveConfidence)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Real Smartphone Sensor Hooks Component */}
      <RealSmartphoneSensor onFallDetected={onFallDetected} />
    </div>
  );
};
