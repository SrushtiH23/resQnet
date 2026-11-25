import React, { useEffect, useRef, useState } from 'react';
import { useAccelerometer } from '../hooks/useAccelerometer';
import { useGyroscope } from '../hooks/useGyroscope';
import api from '../services/api';
import { EmergencyScreenModal } from './EmergencyScreenModal';
import {
  Smartphone, Radio, Zap, ShieldCheck, Activity, Compass,
  AlertTriangle, CheckCircle2, ShieldAlert, Bug, ChevronDown, ChevronUp
} from 'lucide-react';

export const RealSmartphoneSensor = ({ userId = 1, onFallDetected, userLat = null, userLon = null, showNativeBanner = true }) => {
  const accel = useAccelerometer();
  const gyro = useGyroscope();

  const [streamActive, setStreamActive] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [lastStreamTime, setLastStreamTime] = useState(null);
  const [streamStatus, setStreamStatus] = useState('IDLE'); // IDLE | CONNECTED | DISCONNECTED
  const [streamError, setStreamError] = useState(null);

  const [lastAnalysis, setLastAnalysis] = useState(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticHistory, setDiagnosticHistory] = useState([]);

  // In-Browser Emergency Modal State (For Active Web Session)
  const [showFallModal, setShowFallModal] = useState(false);
  const activeFallLockRef = useRef(false);
  const hasDispatchedEmergencyRef = useRef(false);

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

  const executeEmergencyDispatch = async (fallData) => {
    setShowFallModal(false);

    if (hasDispatchedEmergencyRef.current) {
      console.log('[SENSOR DISPATCH LOCK] Emergency alert already dispatched for this fall event. Skipping duplicate POST.');
      return;
    }
    hasDispatchedEmergencyRef.current = true;

    let lat = (userLat !== null && !isNaN(userLat)) ? userLat : 0.0;
    let lon = (userLon !== null && !isNaN(userLon)) ? userLon : 0.0;

    if ('geolocation' in navigator && (lat === 0.0 || lon === 0.0)) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
        });
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      } catch (err) {
        console.warn('Geolocation capture for fall dispatch notice:', err);
      }
    }

    // Dispatch single emergency alert on confirmed fall and notify dashboard
    try {
      const res = await api.post('/emergency/create', {
        user_id: userId,
        trigger_source: 'Fall Detection',
        latitude: lat,
        longitude: lon,
        speed: 0.0,
        battery_level: 95,
        network_status: '5G'
      });
      if (onFallDetectedRef.current) {
        onFallDetectedRef.current(res.data);
      }
    } catch (err) {
      console.warn('Fall detection emergency trigger notice:', err);
      if (onFallDetectedRef.current) {
        onFallDetectedRef.current(fallData || lastAnalysis);
      }
    }
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

        // Retrieve buffered high-frequency samples accumulated during the 200ms interval
        const bufferedAccel = a.getAndClearBuffer ? a.getAndClearBuffer() : [];
        const bufferedGyro = g.getAndClearBuffer ? g.getAndClearBuffer() : [];

        // Synchronize frames by timestamp
        let framesToSend = [];

        if (bufferedAccel.length > 0) {
          framesToSend = bufferedAccel.map((accelSample) => {
            // Find closest gyro sample in time within 100ms
            let closestGyro = null;
            let minDt = Infinity;
            if (bufferedGyro.length > 0) {
              for (const gs of bufferedGyro) {
                const dt = Math.abs(gs.timestamp - accelSample.timestamp);
                if (dt < minDt && dt <= 100) {
                  minDt = dt;
                  closestGyro = gs;
                }
              }
            }

            const hasG = g.hasEmittedGyro;
            const gx = closestGyro ? closestGyro.gx : (hasG && g.gx !== null ? g.gx : null);
            const gy = closestGyro ? closestGyro.gy : (hasG && g.gy !== null ? g.gy : null);
            const gz = closestGyro ? closestGyro.gz : (hasG && g.gz !== null ? g.gz : null);

            return {
              ax: accelSample.ax,
              ay: accelSample.ay,
              az: accelSample.az,
              gx: gx,
              gy: gy,
              gz: gz,
              alpha: g.hasEmittedOrientation ? g.alpha : null,
              beta: g.hasEmittedOrientation ? g.beta : null,
              gamma: g.hasEmittedOrientation ? g.gamma : null,
              timestamp: accelSample.timestamp,
              gyro_available: hasG,
              orientation_available: g.hasEmittedOrientation,
            };
          });
        } else {
          const hasG = g.hasEmittedGyro;
          framesToSend = [{
            ax: a.ax !== null ? a.ax : 0.0,
            ay: a.ay !== null ? a.ay : 9.81,
            az: a.az !== null ? a.az : 0.0,
            gx: hasG && g.gx !== null ? g.gx : null,
            gy: hasG && g.gy !== null ? g.gy : null,
            gz: hasG && g.gz !== null ? g.gz : null,
            alpha: g.hasEmittedOrientation ? g.alpha : null,
            beta: g.hasEmittedOrientation ? g.beta : null,
            gamma: g.hasEmittedOrientation ? g.gamma : null,
            timestamp: Date.now(),
            gyro_available: hasG,
            orientation_available: g.hasEmittedOrientation,
          }];
        }

        try {
          const res = await api.post('/sensor/sliding-window-analyze', {
            frames: framesToSend,
            user_id: userId,
            latitude: userLat !== null ? userLat : 0.0,
            longitude: userLon !== null ? userLon : 0.0,
          });

          setFrameCount((prev) => prev + framesToSend.length);
          const timeStr = new Date().toLocaleTimeString();
          setLastStreamTime(timeStr);
          setStreamStatus('CONNECTED');
          setStreamError(null);

          if (res.data) {
            setLastAnalysis(res.data);
            if (res.data.diagnostics) {
              setDiagnosticHistory((prev) => [
                { time: timeStr, stage: res.data.detected_stage, ...res.data.diagnostics },
                ...prev.slice(0, 19),
              ]);
            }
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
    if (!accel.permissionGranted || !gyro.permissionGranted) {
      if (accel.requestPermission) await accel.requestPermission();
      if (gyro.requestPermission) await gyro.requestPermission();
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
    <div className="space-y-6">
      {/* NATIVE ANDROID FOREGROUND SERVICE MONITORING STATUS BANNER */}
      {showNativeBanner && (
        <div className="glass-panel p-5 rounded-3xl border border-cyan-500/30 bg-cyan-950/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-2xl border border-cyan-500/40 mt-0.5">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-cyan-300 tracking-wider">Android Native OS Architecture</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  24/7 OS Foreground Service Enabled
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Native Android <code className="text-cyan-300 font-mono">FallDetectionService</code> monitors hardware sensors 24/7 when browser tab is closed, minimized to Android Home Screen, inside WhatsApp/Chrome, or when screen is locked.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MAIN SENSOR ENGINE VIEW */}
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
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                showDiagnostics
                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
              title="Toggle Diagnostic Telemetry Inspector"
            >
              <Bug className="w-3.5 h-3.5" />
              <span>Diagnostics</span>
              {showDiagnostics ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {(!accel.permissionGranted || !gyro.permissionGranted) && (accel.isSupported || gyro.isSupported) && (
              <button
                onClick={async () => {
                  if (accel.requestPermission) await accel.requestPermission();
                  if (gyro.requestPermission) await gyro.requestPermission();
                }}
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
                {gyro.hasEmittedGyro && gyro.total_gyro !== null ? `${gyro.total_gyro} °/s` : (gyro.sensorState === 'NOT_AVAILABLE' ? 'Unavailable' : '--')}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 font-mono text-slate-300 text-center pt-1">
              <div className="p-1.5 bg-slate-950 rounded-lg">gX: {gyro.hasEmittedGyro && gyro.gx !== null ? gyro.gx : '--'}</div>
              <div className="p-1.5 bg-slate-950 rounded-lg">gY: {gyro.hasEmittedGyro && gyro.gy !== null ? gyro.gy : '--'}</div>
              <div className="p-1.5 bg-slate-950 rounded-lg">gZ: {gyro.hasEmittedGyro && gyro.gz !== null ? gyro.gz : '--'}</div>
            </div>
          </div>

          {/* Orientation Card */}
          <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <Compass className="w-4 h-4" /> Device Orientation
              </span>
              <span className="font-mono text-emerald-300 text-xs font-bold">
                {gyro.hasEmittedOrientation ? 'Live Angles' : (gyro.sensorState === 'NOT_AVAILABLE' ? 'Unavailable' : '--')}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 font-mono text-slate-300 text-center pt-1">
              <div className="p-1.5 bg-slate-950 rounded-lg">α: {gyro.hasEmittedOrientation && gyro.alpha !== null ? `${gyro.alpha}°` : '--'}</div>
              <div className="p-1.5 bg-slate-950 rounded-lg">β: {gyro.hasEmittedOrientation && gyro.beta !== null ? `${gyro.beta}°` : '--'}</div>
              <div className="p-1.5 bg-slate-950 rounded-lg">γ: {gyro.hasEmittedOrientation && gyro.gamma !== null ? `${gyro.gamma}°` : '--'}</div>
            </div>
          </div>
        </div>

        {/* DIAGNOSTIC MODE INSPECTOR PANEL */}
        {showDiagnostics && (
          <div className="p-4 bg-slate-950 rounded-2xl border border-cyan-500/30 space-y-3 font-mono text-xs animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-cyan-400 font-bold flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Bug className="w-3.5 h-3.5" /> Fall Kinematic Diagnostic Telemetry
              </span>
              <span className="text-slate-400 text-[10px]">
                Sampling Interval: <strong className="text-cyan-300">{lastAnalysis?.diagnostics?.sampling_interval_ms || 20} ms</strong> (~50Hz)
              </span>
            </div>

            {lastAnalysis?.diagnostics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Min Accel (Descent)</span>
                  <span className="text-white font-bold">{lastAnalysis.diagnostics.min_accel ?? '--'} m/s²</span>
                </div>
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Max Accel (Impact)</span>
                  <span className="text-white font-bold">{lastAnalysis.diagnostics.max_accel ?? '--'} m/s²</span>
                </div>
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Max Gyro (Rotation)</span>
                  <span className="text-white font-bold">{lastAnalysis.diagnostics.max_gyro ?? '--'} °/s</span>
                </div>
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Tail Variance (Stillness)</span>
                  <span className="text-white font-bold">{lastAnalysis.diagnostics.accel_variance ?? '--'} m/s²</span>
                </div>
              </div>
            )}

            {lastAnalysis?.diagnostics?.transition_reason && (
              <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800 text-[11px] text-slate-300">
                <span className="text-cyan-400 font-bold">State Transition Reason: </span>
                {lastAnalysis.diagnostics.transition_reason}
              </div>
            )}

            {lastAnalysis?.diagnostics?.rejection_reason && (
              <div className="p-2.5 bg-rose-950/40 rounded-lg border border-rose-500/30 text-[11px] text-rose-300">
                <span className="text-rose-400 font-bold">Fall Rejection Cause: </span>
                {lastAnalysis.diagnostics.rejection_reason}
              </div>
            )}

            {diagnosticHistory.length > 0 && (
              <div className="space-y-1 pt-1">
                <span className="text-slate-400 text-[10px] block uppercase font-bold">Recent Telemetry Event Log (Last {diagnosticHistory.length})</span>
                <div className="max-h-28 overflow-y-auto space-y-1 text-[10px] text-slate-400 pr-1">
                  {diagnosticHistory.map((item, i) => (
                    <div key={i} className="p-1.5 bg-slate-900/60 rounded border border-slate-800/80 flex items-center justify-between">
                      <span className="text-cyan-400">[{item.time}]</span>
                      <span className="text-slate-300">{item.stage}</span>
                      <span>MaxA: {item.max_accel || '--'}</span>
                      <span>Var: {item.accel_variance || '--'}</span>
                      <span className={item.rejection_reason ? 'text-amber-400' : 'text-emerald-400'}>
                        {item.rejection_reason ? `REJECT: ${item.rejection_reason}` : 'PASS'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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

      {/* WEB DASHBOARD IN-SESSION FALL VERIFICATION MODAL (When active in web browser) */}
      <EmergencyScreenModal
        isOpen={showFallModal}
        initialCountdown={10}
        confidenceScore={lastAnalysis?.confidence_score || lastAnalysis?.confidence || 95}
        stageLabel={lastAnalysis?.detected_stage || 'Stage 5: User Confirmation'}
        onCancel={handleUserSaysOkay}
        onConfirm={() => executeEmergencyDispatch(lastAnalysis)}
      />
    </div>
  );
};
