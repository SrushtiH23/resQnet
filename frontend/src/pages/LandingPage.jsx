import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShieldAlert, Activity, Cpu, QrCode, Stethoscope, Building2, PhoneCall,
  ArrowRight, ShieldCheck, Zap, Radio, Lock, Heart, CheckCircle2, Flame
} from 'lucide-react';

export const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="space-y-16 py-8 px-4 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-950 p-8 md:p-14 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3.5 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-extrabold rounded-full uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 animate-pulse" /> 4-Layer Architecture Architecture
            </span>
            <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono rounded-full">
              20Hz Hardware Telemetry
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">
            ResQNet <br />
            <span className="bg-gradient-to-r from-rose-500 via-amber-400 to-cyan-400 bg-clip-text text-transparent">
              Protecting Lives Through Intelligent Emergency Detection
            </span>
          </h1>

          <p className="text-sm md:text-base text-slate-300 font-normal leading-relaxed max-w-2xl">
            A next-generation emergency intelligence platform powered by 6-stage motion fall detection,
            multi-factor confidence scoring, Dijkstra graph routing, and privacy-preserving QR medical cards.
          </p>

          {/* Core Navigation CTAs */}
          <div className="flex items-center gap-3 pt-4 flex-wrap">
            <button
              onClick={() => navigate(user ? '/user-dashboard' : '/login')}
              className="px-6 py-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-extrabold rounded-2xl text-sm shadow-xl shadow-rose-600/30 flex items-center gap-2 transition-all hover:scale-105"
            >
              <Radio className="w-5 h-5 animate-pulse text-rose-200" />
              Start Monitoring
            </button>

            <button
              onClick={() => navigate(user ? '/user-dashboard' : '/login')}
              className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-sm border border-slate-700 flex items-center gap-2 transition-all hover:scale-105"
            >
              <Heart className="w-5 h-5 text-rose-400" />
              Medical Profile
            </button>

            <button
              onClick={() => navigate('/user-dashboard')}
              className="px-6 py-4 bg-slate-900 hover:bg-slate-800 text-cyan-300 font-bold rounded-2xl text-sm border border-cyan-500/30 flex items-center gap-2 transition-all hover:scale-105"
            >
              <Activity className="w-5 h-5 text-cyan-400" />
              Live Emergency Dashboard
            </button>

            <button
              onClick={() => navigate('/doctor-dashboard')}
              className="px-6 py-4 bg-slate-900 hover:bg-slate-800 text-emerald-300 font-bold rounded-2xl text-sm border border-emerald-500/30 flex items-center gap-2 transition-all hover:scale-105"
            >
              <Stethoscope className="w-5 h-5 text-emerald-400" />
              Doctor Portal
            </button>
          </div>
        </div>
      </div>

      {/* Platform Architecture & Key Features */}
      <div className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">Platform Core Capabilities</h2>
          <p className="text-xs md:text-sm text-slate-400">
            Engineered with high-frequency sensor telemetry, mathematical algorithms, and strict privacy controls.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-3 hover:border-rose-500/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-white">6-Stage Fall Engine</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sequential motion pipeline: Free Fall $\to$ Impact Force $\to$ Gyro Rotation $\to$ Stillness $\to$ Movement Recovery.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-3 hover:border-amber-500/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-white">Multi-Factor Confidence</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Calculates dynamic 0-100% emergency confidence matrix combining hardware sensors, bystander verification, and AI triage.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-3 hover:border-cyan-500/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-white">Encrypted QR Cards</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Privacy-preserving QR token cards with instant PNG download, print format, and doctor camera scanning.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
