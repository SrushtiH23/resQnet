import React, { useEffect, useRef, useState } from 'react';
import { useAccelerometer } from '../hooks/useAccelerometer';
import { useGyroscope } from '../hooks/useGyroscope';
import api from '../services/api';
import { Smartphone, Radio, Zap, ShieldCheck, Activity, Compass } from 'lucide-react';

export const RealSmartphoneSensor = ({ userId = 1, onFallDetected }) => {
  const accel = useAccelerometer();
  const gyro = useGyroscope();
  const [streamActive, setStreamActive] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [lastStreamTime, setLastStreamTime] = useState(null);

  // Keep latest sensor values in refs for the 200ms interval timer
  const accelRef = useRef(accel);
  const gyroRef = useRef(gyro);

  useEffect(() => {
    accelRef.current = accel;
  }, [accel]);

  useEffect(() => {
    gyroRef.current = gyro;
  }, [gyro]);

  // 200ms Frame Streaming Loop to FastAPI
  useEffect(() => {
    let interval;
    if (streamActive) {
      interval = setInterval(async () => {
        const a = accelRef.current;
        const g = gyroRef.current;

        const frame = {
          ax: a.ax,
          ay: a.ay,
          az: a.az,
          gx: g.gx,
          gy: g.gy,
          gz: g.gz,
          alpha: g.alpha,
          beta: g.beta,
          gamma: g.gamma,
          timestamp: Date.now(),
        };

        try {
          const res = await api.post('/sensor/sliding-window-analyze', {
            frames: [frame],
            user_id: userId,
            latitude: 37.7749,
            longitude: -122.4194,
          });

          setFrameCount((prev) => prev + 1);
          setLastStreamTime(new Date().toLocaleTimeString());

          if (res.data.is_fall_detected && onFallDetected) {
            onFallDetected(res.data);
          }
        } catch (err) {
          console.warn('Sensor 200ms frame stream error:', err);
        }
      }, 200); // 200ms transmission interval (5Hz)
    }

    return () => clearInterval(interval);
  }, [streamActive, userId, onFallDetected]);

  const handleStartStream = async () => {
    if (!accel.permissionGranted) {
      await accel.requestPermission();
    }
    setStreamActive(true);
  };

  const handleStopStream = () => {
    setStreamActive(false);
  };

  return (
    <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6 shadow-2xl">
      {/* Header & Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 border ${
              streamActive
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              <Smartphone className="w-3.5 h-3.5" />
              {streamActive ? 'Real Hardware Sensors Streaming (200ms / 5Hz)' : 'Hardware Sensors Ready'}
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white">Smartphone Hardware Sensor Engine</h2>
          <p className="text-xs text-slate-400">
            Real DeviceMotionEvent & DeviceOrientationEvent live hardware stream to FastAPI
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!accel.permissionGranted && (
            <button
              onClick={() => accel.requestPermission()}
              className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-md"
            >
              Enable Motion Sensors
            </button>
          )}

          <button
            onClick={streamActive ? handleStopStream : handleStartStream}
            className={`px-5 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 border transition-all shadow-lg ${
              streamActive
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-rose-600/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-emerald-600/30'
            }`}
          >
            <Radio className="w-4 h-4" />
            {streamActive ? 'Stop 200ms Streaming' : 'Start 200ms Stream to FastAPI'}
          </button>
        </div>
      </div>

      {/* Live Value Display Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {/* Accelerometer Card */}
        <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-cyan-400 flex items-center gap-1.5">
              <Activity className="w-4 h-4" /> Accelerometer
            </span>
            <span className="font-mono text-white text-base font-black">{accel.total_accel} m/s²</span>
          </div>
          <div className="grid grid-cols-3 gap-1 font-mono text-slate-300 text-center pt-1">
            <div className="p-1.5 bg-slate-950 rounded-lg">X: {accel.ax}</div>
            <div className="p-1.5 bg-slate-950 rounded-lg">Y: {accel.ay}</div>
            <div className="p-1.5 bg-slate-950 rounded-lg">Z: {accel.az}</div>
          </div>
        </div>

        {/* Gyroscope Card */}
        <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-purple-400 flex items-center gap-1.5">
              <Zap className="w-4 h-4" /> Gyroscope Rotation
            </span>
            <span className="font-mono text-white text-base font-black">{gyro.total_gyro} °/s</span>
          </div>
          <div className="grid grid-cols-3 gap-1 font-mono text-slate-300 text-center pt-1">
            <div className="p-1.5 bg-slate-950 rounded-lg">gX: {gyro.gx}</div>
            <div className="p-1.5 bg-slate-950 rounded-lg">gY: {gyro.gy}</div>
            <div className="p-1.5 bg-slate-950 rounded-lg">gZ: {gyro.gz}</div>
          </div>
        </div>

        {/* Orientation Card */}
        <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
              <Compass className="w-4 h-4" /> Device Orientation
            </span>
            <span className="font-mono text-emerald-300 text-xs font-bold">Live Angles</span>
          </div>
          <div className="grid grid-cols-3 gap-1 font-mono text-slate-300 text-center pt-1">
            <div className="p-1.5 bg-slate-950 rounded-lg">α: {gyro.alpha}°</div>
            <div className="p-1.5 bg-slate-950 rounded-lg">β: {gyro.beta}°</div>
            <div className="p-1.5 bg-slate-950 rounded-lg">γ: {gyro.gamma}°</div>
          </div>
        </div>
      </div>

      {/* Stream Metrics Badge */}
      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          FastAPI Stream Status: <strong className="text-white font-mono">{streamActive ? 'Transmitting (200ms)' : 'Idle'}</strong>
        </span>
        <span className="font-mono text-[11px]">
          Frames Transmitted: <strong className="text-cyan-400">{frameCount}</strong> {lastStreamTime && `| Last: ${lastStreamTime}`}
        </span>
      </div>
    </div>
  );
};
