import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle, Flame, Activity, XCircle } from 'lucide-react';

export const EmergencyScreenModal = ({ isOpen, confidenceScore = 84, onCancel, onConfirm }) => {
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    let timer;
    if (isOpen) {
      setCountdown(30);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            onConfirm(); // Auto escalate when timer hits 0
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-fade-in">
      <div className="glass-panel p-8 rounded-3xl max-w-lg w-full border-2 border-rose-500 bg-rose-950/50 space-y-6 shadow-2xl shadow-rose-950/80 text-center relative">
        {/* Pulsing Alert Icon Header */}
        <div className="mx-auto w-20 h-20 bg-rose-500/20 text-rose-400 rounded-3xl border border-rose-500/50 flex items-center justify-center animate-bounce shadow-xl shadow-rose-600/30">
          <AlertTriangle className="w-10 h-10" />
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-black text-rose-200 tracking-tight flex items-center justify-center gap-2">
            ⚠ Possible Fall Detected
          </h2>
          <p className="text-xs md:text-sm text-rose-300 font-semibold tracking-wider uppercase animate-pulse">
            Checking patient responsiveness & movement...
          </p>
        </div>

        {/* Confidence & Countdown Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-slate-900/90 rounded-2xl border border-rose-500/40 text-center space-y-1">
            <p className="text-[11px] font-bold text-rose-400 uppercase tracking-widest">Confidence</p>
            <p className="text-3xl font-black text-white font-mono">{confidenceScore}%</p>
            <span className="text-[10px] text-slate-400 block">High Threat Index</span>
          </div>

          <div className="p-4 bg-slate-900/90 rounded-2xl border border-rose-500/40 text-center space-y-1">
            <p className="text-[11px] font-bold text-rose-400 uppercase tracking-widest">Auto Escalation</p>
            <p className="text-3xl font-black text-white font-mono">{countdown}s</p>
            <span className="text-[10px] text-slate-400 block">Countdown</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <button
            onClick={onCancel}
            className="py-4 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-2xl text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all hover:scale-105"
          >
            <CheckCircle className="w-5 h-5" /> I'm Fine (Cancel)
          </button>
          <button
            onClick={onConfirm}
            className="py-4 px-5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-2xl text-sm shadow-xl shadow-rose-600/40 flex items-center justify-center gap-2 transition-all hover:scale-105"
          >
            <Flame className="w-5 h-5 animate-pulse" /> Need Help
          </button>
        </div>

        <p className="text-[10px] text-rose-300/80 italic">
          If no response is received in {countdown} seconds, emergency contact contacts & hospital dispatch will be notified automatically.
        </p>
      </div>
    </div>
  );
};
