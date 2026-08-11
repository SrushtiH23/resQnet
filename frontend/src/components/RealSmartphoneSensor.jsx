import React, { useEffect, useRef, useState } from 'react';
import { useAccelerometer } from '../hooks/useAccelerometer';
import { useGyroscope } from '../hooks/useGyroscope';
import api from '../services/api';
import { Smartphone, Radio, Zap, ShieldCheck, Activity, Compass, AlertTriangle } from 'lucide-react';

export const RealSmartphoneSensor = ({ userId = 1, onFallDetected }) => {
  const accel = useAccelerometer();
  const gyro = useGyroscope();

  const [streamActive, setStreamActive] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [lastStreamTime, setLastStreamTime] = useState(null);
  const [streamStatus, setStreamStatus] = useState('IDLE'); // IDLE | CONNECTED | DISCONNECTED
  const [streamError, setStreamError] = useState(null);

  const [lastAnalysis, setLastAnalysis] = useState(null);

  // 5-Second Verification Modal State
  const [showFallModal, setShowFallModal] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const countdownTimerRef = useRef(null);
  const activeFallLockRef = useRef(false);
  const hasDispatchedEmergencyRef = useRef(false);

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
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    setShowFallModal(false);

    if (hasDispatchedEmergencyRef.current) {
      console.log('[SENSOR DISPATCH LOCK] Emergency alert already dispatched for this fall event. Skipping duplicate POST.');
      return;
    }
    hasDispatchedEmergencyRef.current = true;

    if (onFallDetected) {
      onFallDetected(fallData || lastAnalysis);
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
    setShowFallModal(true);
    setCountdown(5);

    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    let timer = 5;
    countdownTimerRef.current = setInterval(() => {
      timer -= 1;
      setCountdown(timer);
      if (timer <= 0) {
        clearInterval(countdownTimerRef.current);
        executeEmergencyDispatch(fallData);
      }
    }, 1000);
  };

  const handleUserSaysOkay = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    setShowFallModal(false);
    setTimeout(() => {
      activeFallLockRef.current = false;
    }, 15000);
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
  }, [streamActive, userId, onFallDetected]);

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

  return (
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

      {/* 5-SECOND FALL VERIFICATION MODAL POPUP */}
      {showFallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-fade-in">
          <div className="glass-panel p-8 rounded-3xl max-w-lg w-full border-2 border-rose-500 bg-rose-950/90 text-center space-y-6 shadow-2xl shadow-rose-950/90">
            {/* Animated Red Ring & Large Countdown Digit */}
            <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-rose-500/40 animate-ping" />
              <div className="w-24 h-24 rounded-full bg-rose-600/30 border-4 border-rose-500 flex items-center justify-center text-white font-black text-4xl font-mono shadow-inner">
                {countdown}s
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center justify-center gap-2">
                🚨 FALL DETECTED!
              </h3>
              <p className="text-sm font-bold text-rose-200 uppercase tracking-wider">
                Are you okay?
              </p>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                An emergency alert and SMS will automatically be sent to your emergency contacts in <strong className="text-rose-400 font-mono text-sm">{countdown} seconds</strong> unless you respond.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <button
                onClick={handleUserSaysOkay}
                className="py-4 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-2xl text-xs md:text-sm border border-emerald-400/50 shadow-xl shadow-emerald-950/60 transition-all hover:scale-105 uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-5 h-5 text-emerald-200" />
                I'M OKAY (CANCEL ALERT)
              </button>

              <button
                onClick={() => executeEmergencyDispatch(lastAnalysis)}
                className="py-4 px-5 bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 text-white font-black rounded-2xl text-xs md:text-sm border border-rose-400/50 shadow-xl shadow-rose-950/60 transition-all hover:scale-105 uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-5 h-5 text-rose-200" />
                NEED HELP NOW (SEND SOS)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
