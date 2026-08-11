import React, { useState } from 'react';
import { Radio, Navigation, Play, Square, AlertTriangle } from 'lucide-react';
import { RealSmartphoneSensor } from './RealSmartphoneSensor';
import { useAccelerometer } from '../hooks/useAccelerometer';
import { useGyroscope } from '../hooks/useGyroscope';

export const LiveMonitoringScreen = ({ isMonitoring, onToggleMonitoring, gpsAvailable, confidenceScore, onFallDetected }) => {
  const accel = useAccelerometer();
  const gyro = useGyroscope();

  const sensorStatus = accel.sensorState;
  const isSensorActive = sensorStatus === 'ACTIVE';

  const displayAccelMag = accel.total_accel !== null ? accel.total_accel : '--';
  const displayGyroMag = gyro.total_gyro !== null ? gyro.total_gyro : '--';
  const displayConfidence = confidenceScore !== undefined && confidenceScore !== null ? `${confidenceScore}%` : '--';

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 border ${
                isSensorActive
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse'
                  : sensorStatus === 'WAITING_FOR_PERMISSION'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                <Radio className="w-3.5 h-3.5" />
                Sensor status: {sensorStatus.replace(/_/g, ' ')}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white">Live Monitoring Screen</h2>
            <p className="text-xs text-slate-400">Continuous hardware telemetry stream from device sensors</p>
          </div>

          <button
            onClick={onToggleMonitoring}
            className={`px-5 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 border transition-all shadow-lg cursor-pointer ${
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

        {/* Notice for Desktop/No-Sensor Devices */}
        {!isSensorActive && (
          <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-slate-300 text-xs flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 animate-pulse" />
            <div>
              <p className="font-bold text-white uppercase tracking-wide">Motion sensors unavailable on this device/browser.</p>
              <p className="text-slate-400 text-[11px] mt-0.5">
                Desktop computers without motion hardware display <strong className="text-amber-400">NOT AVAILABLE</strong> instead of fake sensor readings.
              </p>
            </div>
          </div>
        )}

        {/* 5 Prominent Display Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {/* Card 1: Acceleration */}
          <div className="glass-card p-4 rounded-2xl border border-slate-800 text-center space-y-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Acceleration</p>
            <p className="text-2xl md:text-3xl font-black text-cyan-400 font-mono">{displayAccelMag}</p>
            <span className="text-[10px] text-slate-500 block">m/s²</span>
          </div>

          {/* Card 2: Gyroscope */}
          <div className="glass-card p-4 rounded-2xl border border-slate-800 text-center space-y-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gyroscope</p>
            <p className="text-2xl md:text-3xl font-black text-purple-400 font-mono">{displayGyroMag}</p>
            <span className="text-[10px] text-slate-500 block">°/s</span>
          </div>

          {/* Card 3: GPS */}
          <div className="glass-card p-4 rounded-2xl border border-slate-800 text-center space-y-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">GPS</p>
            <p className="text-xl md:text-2xl font-black text-emerald-400 flex items-center justify-center gap-1 font-sans">
              <Navigation className="w-4 h-4" /> {gpsAvailable ? 'Available' : 'Searching'}
            </p>
            <span className="text-[10px] text-slate-500 block">Location Status</span>
          </div>

          {/* Card 4: Status */}
          <div className="glass-card p-4 rounded-2xl border border-slate-800 text-center space-y-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
            <p className={`text-sm md:text-base font-black ${isSensorActive ? 'text-emerald-400' : 'text-slate-400'}`}>
              {sensorStatus.replace(/_/g, ' ')}
            </p>
            <span className="text-[10px] text-slate-500 block">Hardware Engine</span>
          </div>

          {/* Card 5: Confidence */}
          <div className="glass-card p-4 rounded-2xl border border-slate-800 text-center space-y-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Confidence</p>
            <p className="text-2xl md:text-3xl font-black text-rose-400 font-mono">{displayConfidence}</p>
            <span className="text-[10px] text-slate-500 block">Evidence Index</span>
          </div>
        </div>

        {/* Dynamic Confidence Meter Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold text-slate-300">
            <span>Evidence-Based Dynamic Emergency Confidence:</span>
            <span className="text-rose-400 font-bold font-mono">{displayConfidence}</span>
          </div>
          <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div
              className="bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, typeof confidenceScore === 'number' ? confidenceScore : 0)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Real Smartphone Sensor Hooks Component */}
      <RealSmartphoneSensor onFallDetected={onFallDetected} />
    </div>
  );
};
