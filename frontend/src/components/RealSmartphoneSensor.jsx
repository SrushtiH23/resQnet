import React, { useEffect, useRef, useState } from 'react';
import { useAccelerometer } from '../hooks/useAccelerometer';
import { useGyroscope } from '../hooks/useGyroscope';
import api from '../services/api';
import { EmergencyScreenModal } from './EmergencyScreenModal';
import {
  Smartphone, Radio, Zap, ShieldCheck, Activity, Compass,
  AlertTriangle, Lock, Unlock, Home, Flame, Clock, Wifi, Battery
} from 'lucide-react';

export const RealSmartphoneSensor = ({ userId = 1, onFallDetected }) => {
  const accel = useAccelerometer();
  const gyro = useGyroscope();

  const [streamActive, setStreamActive] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [lastStreamTime, setLastStreamTime] = useState(null);
  const [streamStatus, setStreamStatus] = useState('IDLE'); // IDLE | CONNECTED | DISCONNECTED
  const [streamError, setStreamError] = useState(null);

  const [lastAnalysis, setLastAnalysis] = useState(null);

  // Screen View Mode State: 'HOME' | 'LOCK'
  const [screenMode, setScreenMode] = useState('HOME');

  // Full-Screen Fall Verification Modal State
  const [showFallModal, setShowFallModal] = useState(false);
  const activeFallLockRef = useRef(false);
  const hasDispatchedEmergencyRef = useRef(false);

  // Live Lock Screen Clock
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const onFallDetectedRef = useRef(onFallDetected);
  useEffect(() => {
    onFallDetectedRef.current = onFallDetected;
  }, [onFallDetected]);

  // Refs for 200ms streaming loop
  const accelRef = useRef(accel);
  const gyroRef = useRef(gyro);

  useEffect(() => {
    accelRef.current = accel;
  }, [accel]);

  useEffect(() => {
    gyroRef.current = gyro;
  }, [gyro]);

  const executeEmergencyDispatch = (fallData) => {
    setShowFallModal(false);

    if (hasDispatchedEmergencyRef.current) {
      console.log('[SENSOR DISPATCH LOCK] Emergency alert already dispatched for this fall event. Skipping duplicate POST.');
      return;
    }
    hasDispatchedEmergencyRef.current = true;

    if (onFallDetectedRef.current) {
      onFallDetectedRef.current(fallData || lastAnalysis);
    }

    // Dispatch single emergency alert on confirmed fall
    api.post('/emergency/create', {
      trigger_source: 'Fall Detection',
      latitude: 37.7749,
      longitude: -122.4194,
      speed: 0.0,
      battery_level: 95,
      network_status: '5G'
    }).catch((err) => console.warn('Fall detection emergency trigger notice:', err));
  };

  const triggerFallVerificationModal = (fallData) => {
    hasDispatchedEmergencyRef.current = false;
    if (fallData) {
      setLastAnalysis(fallData);
    }
    setShowFallModal(true);
  };

  const handleUserSaysOkay = () => {
    setShowFallModal(false);
    setTimeout(() => {
      activeFallLockRef.current = false;
      hasDispatchedEmergencyRef.current = false;
    }, 10000);
  };

  // Manual Test Trigger for Fall Detection
  const handleSimulateFallEvent = () => {
    const mockFallData = {
      is_fall_detected: true,
      status_label: 'FALL CONFIRMED',
      confidence_score: 96,
      detected_stage: 'Stage 5: Stillness & Impact Verified',
      free_fall: true,
      impact: true,
      rotation: true,
      stillness: true,
      explanation: 'High-G impact force followed by prolonged body immobility detected.'
    };
    activeFallLockRef.current = true;
    triggerFallVerificationModal(mockFallData);
  };

  // Auto-start streaming as soon as hardware motion sensors emit active telemetry
  useEffect(() => {
    if ((accel.sensorState === 'ACTIVE' || accel.hasEmittedData) && !streamActive) {
      setStreamActive(true);
    }
  }, [accel.sensorState, accel.hasEmittedData, streamActive]);

  // 200ms Frame Streaming Loop to FastAPI
  useEffect(() => {
    let interval;
    if (streamActive) {
      interval = setInterval(async () => {
        const a = accelRef.current;
        const g = gyroRef.current;

        // Verify that real hardware sensor data has actually been received
        if (!a.hasEmittedData) {
          setStreamStatus('DISCONNECTED');
          setStreamError('Motion sensors unavailable on this device/browser.');
          return;
        }

        // Retrieve all high-frequency frames accumulated during the 200ms interval
        const bufferedSamples = a.getAndClearBuffer ? a.getAndClearBuffer() : [];

        const framesToSend = bufferedSamples.length > 0
          ? bufferedSamples.map((s) => ({
              ax: s.ax, ay: s.ay, az: s.az,
              gx: g.gx !== null ? g.gx : 0.0,
              gy: g.gy !== null ? g.gy : 0.0,
              gz: g.gz !== null ? g.gz : 0.0,
              timestamp: s.timestamp,
            }))
          : [{
              ax: a.ax !== null ? a.ax : 0.0,
              ay: a.ay !== null ? a.ay : 0.0,
              az: a.az !== null ? a.az : 0.0,
              gx: g.gx !== null ? g.gx : 0.0,
              gy: g.gy !== null ? g.gy : 0.0,
              gz: g.gz !== null ? g.gz : 0.0,
              timestamp: Date.now(),
            }];

        try {
          const res = await api.post('/sensor/sliding-window-analyze', {
            frames: framesToSend,
            user_id: userId,
            latitude: 37.7749,
            longitude: -122.4194,
          });

          setFrameCount((prev) => prev + framesToSend.length);
          setLastStreamTime(new Date().toLocaleTimeString());
          setStreamStatus('CONNECTED');
          setStreamError(null);
          if (res.data) {
            setLastAnalysis(res.data);
          }

          if (res.data?.is_fall_detected && !activeFallLockRef.current) {
            activeFallLockRef.current = true;
            triggerFallVerificationModal(res.data);
          }
        } catch (err) {
          console.warn('Sensor 200ms frame stream error:', err);
          setStreamStatus('DISCONNECTED');
          setStreamError('FastAPI stream error or connection timeout.');
        }
      }, 200); // 200ms transmission interval (5Hz)
    } else {
      setStreamStatus('IDLE');
    }

    return () => clearInterval(interval);
  }, [streamActive, userId]);

  const handleStartStream = async () => {
    setStreamError(null);
    if (!accel.permissionGranted) {
      const granted = await accel.requestPermission();
      if (!granted) {
        setStreamError('Motion sensor permission required.');
        return;
      }
    }

    if (!accel.hasEmittedData) {
      setStreamError('Motion sensors unavailable on this device/browser.');
    }
    setStreamActive(true);
  };

  const handleStopStream = () => {
    setStreamActive(false);
    setStreamStatus('IDLE');
  };

  const formattedClock = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDate = currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* SCREEN MODE SWITCHER HEADER & TEST TRIGGER BUTTON */}
      <div className="glass-panel p-4 md:p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
            <button
              onClick={() => setScreenMode('HOME')}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                screenMode === 'HOME'
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Home className="w-4 h-4" /> HOME SCREEN
            </button>
            <button
              onClick={() => setScreenMode('LOCK')}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                screenMode === 'LOCK'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Lock className="w-4 h-4" /> LOCK SCREEN
            </button>
          </div>

          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline-block">
            Current View: <strong className="text-white uppercase">{screenMode} SCREEN</strong>
          </span>
        </div>

        {/* Prominent Fall Simulation Trigger */}
        <button
          onClick={handleSimulateFallEvent}
          className="w-full md:w-auto px-5 py-3 bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-xs rounded-2xl border border-rose-400/50 shadow-xl shadow-rose-950/80 transition-all hover:scale-105 active:scale-95 uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
        >
          <AlertTriangle className="w-4 h-4 text-amber-200 animate-pulse" />
          <span>SIMULATE FALL EVENT (TRIGGER POPUP)</span>
        </button>
      </div>

      {/* SIMULATED LOCK SCREEN VIEW */}
      {screenMode === 'LOCK' && (
        <div className="glass-panel p-8 md:p-12 rounded-3xl border-2 border-purple-500/40 bg-gradient-to-b from-slate-950 via-purple-950/40 to-slate-950 relative overflow-hidden shadow-2xl text-center space-y-8 animate-fade-in">
          {/* Top Status Bar */}
          <div className="flex items-center justify-between text-xs text-purple-200 font-mono border-b border-purple-500/20 pb-4">
            <span className="flex items-center gap-1.5 font-bold">
              <Lock className="w-3.5 h-3.5 text-purple-400" /> RESQNET SECURE LOCKSCREEN
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><Wifi className="w-3.5 h-3.5" /> 5G</span>
              <span className="flex items-center gap-1"><Battery className="w-3.5 h-3.5" /> 98%</span>
            </div>
          </div>

          {/* Clock Display */}
          <div className="space-y-2 py-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold uppercase tracking-widest animate-pulse">
              <Activity className="w-3.5 h-3.5 text-purple-400" /> FALL DETECTION SENSORS ACTIVE
            </div>

            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight font-mono drop-shadow-xl pt-2">
              {formattedClock}
            </h1>
            <p className="text-sm md:text-base font-bold text-slate-300 tracking-wide uppercase">
              {formattedDate}
            </p>
          </div>

          {/* Lock Screen Notification Box */}
          <div className="max-w-md mx-auto p-4 bg-slate-900/90 border border-purple-500/30 rounded-2xl text-left space-y-2 shadow-lg backdrop-blur-md">
            <div className="flex items-center justify-between text-xs font-bold text-purple-300">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> ResQNet Safety Sentinel
              </span>
              <span className="text-[10px] text-slate-400 font-mono">NOW</span>
            </div>
            <p className="text-xs text-slate-200 font-medium">
              Background accelerometer & gyro fall state machine actively monitoring device motion.
            </p>
          </div>

          {/* Instructions Callout */}
          <div className="p-4 bg-purple-950/60 border border-purple-500/30 rounded-2xl max-w-md mx-auto text-xs text-purple-200 font-medium space-y-2">
            <p>
              💡 <strong>Lock Screen Fall Detection Test:</strong> When a fall is detected, the full-screen <strong>"ARE YOU OKAY?"</strong> emergency popup will instantly override and cover this lock screen.
            </p>
            <button
              onClick={handleSimulateFallEvent}
              className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-md transition-all uppercase tracking-wider cursor-pointer"
            >
              Test Lock Screen Fall Alert
            </button>
          </div>

          {/* Unlock Action Button */}
          <div className="pt-4">
            <button
              onClick={() => setScreenMode('HOME')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs rounded-2xl border border-slate-700 transition-all cursor-pointer"
            >
              <Unlock className="w-4 h-4 text-cyan-400" /> Tap to Unlock & Switch to Home Screen
            </button>
          </div>
        </div>
      )}

      {/* HOME SCREEN MAIN SENSOR ENGINE VIEW */}
      {screenMode === 'HOME' && (
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6 shadow-2xl">
          {/* Header & Controls */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-3.5 py-1 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 border ${
                  accel.sensorState === 'ACTIVE'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse'
                    : accel.sensorState === 'WAITING_FOR_PERMISSION'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}>
                  <Smartphone className="w-3.5 h-3.5" />
                  SENSOR STATUS: {accel.sensorState.replace(/_/g, ' ')}
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white">Smartphone Hardware Sensor Engine</h2>
              <p className="text-xs text-slate-400">
                Real DeviceMotionEvent & DeviceOrientationEvent live hardware stream to FastAPI
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!accel.permissionGranted && accel.isSupported && (
                <button
                  onClick={() => accel.requestPermission()}
                  className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Request Permission
                </button>
              )}

              <button
                onClick={streamActive ? handleStopStream : handleStartStream}
                className={`px-5 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 border transition-all shadow-lg cursor-pointer ${
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

          {/* Stream Notice / Error Display */}
          {streamError && (
            <div className="p-3.5 bg-amber-950/80 border border-amber-500/50 rounded-2xl flex items-center gap-2.5 text-amber-300 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
              <span>{streamError}</span>
            </div>
          )}

          {/* Fall Detection Live Status Display */}
          {lastAnalysis && (
            <div className={`p-4 rounded-2xl border flex items-center justify-between flex-wrap gap-3 transition-all ${
              lastAnalysis.status_label === 'FALL CONFIRMED' || lastAnalysis.is_fall_detected
                ? 'bg-rose-950/90 border-rose-500/80 text-rose-200 animate-pulse shadow-lg shadow-rose-900/40'
                : lastAnalysis.status_label === 'POSSIBLE FALL'
                ? 'bg-amber-950/90 border-amber-500/80 text-amber-200'
                : 'bg-slate-900/90 border-slate-800 text-slate-300'
            }`}>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                  <span>FALL ALGORITHM STATUS:</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-black font-mono ${
                    lastAnalysis.status_label === 'FALL CONFIRMED' || lastAnalysis.is_fall_detected
                      ? 'bg-rose-500 text-white'
                      : lastAnalysis.status_label === 'POSSIBLE FALL'
                      ? 'bg-amber-500 text-black'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  }`}>
                    {lastAnalysis.status_label || (lastAnalysis.is_fall_detected ? 'FALL CONFIRMED' : 'NORMAL')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  {lastAnalysis.detected_stage} {lastAnalysis.explanation && `| ${lastAnalysis.explanation}`}
                </p>
              </div>
              <div className="text-[11px] font-mono flex items-center gap-3">
                <span>FreeFall: <strong className={lastAnalysis.free_fall ? 'text-amber-400' : 'text-slate-500'}>{lastAnalysis.free_fall ? 'YES' : 'NO'}</strong></span>
                <span>Impact: <strong className={lastAnalysis.impact ? 'text-rose-400' : 'text-slate-500'}>{lastAnalysis.impact ? 'YES' : 'NO'}</strong></span>
                <span>Rotation: <strong className={lastAnalysis.rotation ? 'text-purple-400' : 'text-slate-500'}>{lastAnalysis.rotation ? 'YES' : 'NO'}</strong></span>
                <span>Stillness: <strong className={lastAnalysis.stillness ? 'text-emerald-400' : 'text-slate-500'}>{lastAnalysis.stillness ? 'YES' : 'NO'}</strong></span>
              </div>
            </div>
          )}

          {/* Live Value Display Gauges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Accelerometer Card */}
            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                  <Activity className="w-4 h-4" /> Accelerometer
                </span>
                <span className="font-mono text-white text-base font-black">
                  {accel.total_accel !== null ? `${accel.total_accel} m/s²` : '--'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 font-mono text-slate-300 text-center pt-1">
                <div className="p-1.5 bg-slate-950 rounded-lg">X: {accel.ax !== null ? accel.ax : '--'}</div>
                <div className="p-1.5 bg-slate-950 rounded-lg">Y: {accel.ay !== null ? accel.ay : '--'}</div>
                <div className="p-1.5 bg-slate-950 rounded-lg">Z: {accel.az !== null ? accel.az : '--'}</div>
              </div>
            </div>

            {/* Gyroscope Card */}
            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-400 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" /> Gyroscope Rotation
                </span>
                <span className="font-mono text-white text-base font-black">
                  {gyro.total_gyro !== null ? `${gyro.total_gyro} °/s` : '--'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 font-mono text-slate-300 text-center pt-1">
                <div className="p-1.5 bg-slate-950 rounded-lg">gX: {gyro.gx !== null ? gyro.gx : '--'}</div>
                <div className="p-1.5 bg-slate-950 rounded-lg">gY: {gyro.gy !== null ? gyro.gy : '--'}</div>
                <div className="p-1.5 bg-slate-950 rounded-lg">gZ: {gyro.gz !== null ? gyro.gz : '--'}</div>
              </div>
            </div>

            {/* Orientation Card */}
            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <Compass className="w-4 h-4" /> Device Orientation
                </span>
                <span className="font-mono text-emerald-300 text-xs font-bold">
                  {gyro.sensorState === 'ACTIVE' ? 'Live Angles' : '--'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 font-mono text-slate-300 text-center pt-1">
                <div className="p-1.5 bg-slate-950 rounded-lg">α: {gyro.alpha !== null ? `${gyro.alpha}°` : '--'}</div>
                <div className="p-1.5 bg-slate-950 rounded-lg">β: {gyro.beta !== null ? `${gyro.beta}°` : '--'}</div>
                <div className="p-1.5 bg-slate-950 rounded-lg">γ: {gyro.gamma !== null ? `${gyro.gamma}°` : '--'}</div>
              </div>
            </div>
          </div>

          {/* Stream Metrics Badge */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              FastAPI Stream Status:{' '}
              <strong className={`font-mono ${
                streamStatus === 'CONNECTED' ? 'text-emerald-400 font-extrabold' : streamStatus === 'DISCONNECTED' ? 'text-rose-400 font-extrabold' : 'text-slate-400'
              }`}>
                {streamStatus}
              </strong>
            </span>
            <span className="font-mono text-[11px]">
              Frames Transmitted: <strong className="text-cyan-400">{frameCount}</strong> {lastStreamTime && `| Last: ${lastStreamTime}`}
            </span>
          </div>
        </div>
      )}

      {/* FULL-SCREEN FALL VERIFICATION OVERLAY (COVERING HOME SCREEN & LOCK SCREEN) */}
      <EmergencyScreenModal
        isOpen={showFallModal}
        initialCountdown={5}
        confidenceScore={lastAnalysis?.confidence_score || lastAnalysis?.confidence || 95}
        stageLabel={lastAnalysis?.detected_stage || 'Stage 5: Stillness & Freefall Verified'}
        onCancel={handleUserSaysOkay}
        onConfirm={() => executeEmergencyDispatch(lastAnalysis)}
      />
    </div>
  );
};
