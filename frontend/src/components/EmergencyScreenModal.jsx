import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, ShieldCheck, Flame, Bell } from 'lucide-react';

export const EmergencyScreenModal = ({
  isOpen,
  initialCountdown = 5,
  confidenceScore = 95,
  stageLabel = 'Stage 5: Stillness Verified',
  onCancel,
  onConfirm
}) => {
  const [countdown, setCountdown] = useState(initialCountdown);
  const audioCtxRef = useRef(null);
  const intervalRef = useRef(null);

  // Play alarm sound using Web Audio API
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3); // Ramp down
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.warn('Audio alert playback notice:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCountdown(initialCountdown);
      playBeep();

      intervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          playBeep();
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            onConfirm(); // Auto dispatch emergency alert when timer hits 0
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try {
          audioCtxRef.current.close();
          audioCtxRef.current = null;
        } catch (e) {}
      }
    };
  }, [isOpen, initialCountdown]);

  if (!isOpen) return null;

  const progressPercent = ((initialCountdown - countdown) / initialCountdown) * 100;
  const strokeDashoffset = 283 - (283 * progressPercent) / 100;

  return (
    <div className="fixed inset-0 z-[9999] w-screen h-screen min-h-screen bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center animate-fade-in select-none overflow-y-auto">
      {/* Ambient Pulsing Background Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <div className="w-[600px] h-[600px] bg-rose-600/25 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute w-[400px] h-[400px] bg-red-700/30 rounded-full blur-[90px] animate-ping" />
      </div>

      <div className="relative max-w-2xl w-full space-y-8 z-10 my-auto">
        {/* Top Emergency Status Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 font-extrabold text-xs uppercase tracking-widest animate-pulse shadow-lg shadow-rose-950">
            <Bell className="w-4 h-4 text-rose-400 animate-bounce" />
            CRITICAL EMERGENCY OVERRIDE
          </div>

          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight drop-shadow-2xl">
            🚨 FALL DETECTED!
          </h1>
          
          <h2 className="text-2xl md:text-4xl font-extrabold text-rose-200 uppercase tracking-wide">
            ARE YOU OKAY?
          </h2>
          
          <p className="text-xs md:text-sm text-slate-300 max-w-md mx-auto font-medium">
            ResQNet AI multi-stage motion sensors detected a high-impact fall pattern.
          </p>
        </div>

        {/* Central 5-Second Countdown Ring Circle */}
        <div className="relative mx-auto w-40 h-40 md:w-48 md:h-48 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background Ring */}
            <circle
              cx="50"
              cy="50"
              r="45"
              className="stroke-rose-950/80 fill-none"
              strokeWidth="8"
            />
            {/* Progress Ring */}
            <circle
              cx="50"
              cy="50"
              r="45"
              className="stroke-rose-500 fill-none transition-all duration-1000 ease-linear"
              strokeWidth="8"
              strokeDasharray="283"
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>

          {/* Large Digit in Center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-5xl md:text-6xl font-black text-white font-mono tracking-tighter drop-shadow-xl animate-pulse">
              {countdown}
            </span>
            <span className="text-[10px] md:text-xs font-black uppercase text-rose-300 tracking-widest mt-0.5">
              SECONDS
            </span>
          </div>
        </div>

        {/* Evidence & Confidence Metrics */}
        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto text-xs">
          <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-rose-500/40 backdrop-blur-md shadow-xl text-center space-y-1">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block">AI Threat Confidence</span>
            <span className="text-2xl font-black text-white font-mono">{confidenceScore}%</span>
          </div>

          <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-rose-500/40 backdrop-blur-md shadow-xl text-center space-y-1">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block">Motion Pipeline</span>
            <span className="text-xs font-extrabold text-cyan-300 truncate block font-mono">{stageLabel}</span>
          </div>
        </div>

        {/* Warning Callout Box */}
        <p className="text-xs text-rose-200/90 max-w-md mx-auto bg-rose-950/70 border border-rose-500/40 p-3 rounded-xl shadow-inner font-medium">
          An emergency SOS alert and location coordinates will automatically be dispatched to your emergency contacts in <strong className="text-white font-mono text-sm underline">{countdown} seconds</strong> unless you tap below.
        </p>

        {/* Action Buttons: Green (I'M OKAY) & Red (NEED HELP NOW) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto pt-2">
          <button
            onClick={onCancel}
            className="py-5 px-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black rounded-3xl text-sm md:text-base border-2 border-emerald-300/50 shadow-2xl shadow-emerald-950/80 transition-all hover:scale-105 active:scale-95 uppercase tracking-wider cursor-pointer flex items-center justify-center gap-3"
          >
            <ShieldCheck className="w-6 h-6 text-emerald-200 flex-shrink-0" />
            <span>I'M OKAY<br/><span className="text-[10px] font-bold tracking-normal opacity-90">(CANCEL ALERT)</span></span>
          </button>

          <button
            onClick={onConfirm}
            className="py-5 px-6 bg-gradient-to-r from-rose-700 via-red-600 to-rose-600 hover:from-rose-600 hover:to-red-500 text-white font-black rounded-3xl text-sm md:text-base border-2 border-rose-300/50 shadow-2xl shadow-rose-950/80 transition-all hover:scale-105 active:scale-95 uppercase tracking-wider cursor-pointer flex items-center justify-center gap-3"
          >
            <Flame className="w-6 h-6 text-rose-200 animate-pulse flex-shrink-0" />
            <span>NEED HELP NOW<br/><span className="text-[10px] font-bold tracking-normal opacity-90">(DISPATCH SOS)</span></span>
          </button>
        </div>
      </div>
    </div>
  );
};
