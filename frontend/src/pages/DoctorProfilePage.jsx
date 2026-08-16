import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Stethoscope, User, ShieldCheck, Building2, FileText, CheckCircle2, Award, Mail, Phone } from 'lucide-react';

export const DoctorProfilePage = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800 shadow-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Stethoscope className="w-3.5 h-3.5" /> Official Medical Doctor Profile
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {user?.full_name || 'Dr. Practitioner'}
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Verified ResQNet emergency response physician profile and hospital credentials.
          </p>
        </div>

        <span className="px-3.5 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-full flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> ResQNet Authorized Practitioner
        </span>
      </div>

      {/* Main Profile Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Profile Card */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 text-center md:col-span-1">
          <div className="w-24 h-24 mx-auto rounded-full bg-cyan-500/10 border-2 border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-xl">
            <Stethoscope className="w-12 h-12" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-white">{user?.full_name || 'Dr. Practitioner'}</h3>
            <p className="text-xs text-cyan-400 font-mono font-bold mt-0.5">Registration #MCI-132456</p>
            <p className="text-xs text-slate-400 mt-1">Emergency Medicine & Triage Specialist</p>
          </div>

          <div className="pt-2 border-t border-slate-800 text-xs space-y-2 text-left">
            <div className="flex items-center gap-2 text-slate-300">
              <Mail className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span className="truncate">{user?.email || 'doctor@resqnet.com'}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Phone className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span>{user?.phone || '+91 98765 43210'}</span>
            </div>
          </div>
        </div>

        {/* Credentials & Station Details */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6 md:col-span-2">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-teal-400" />
            Medical Licensing & Hospital Station Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Medical Registration</span>
              <p className="font-bold text-white text-sm font-mono">MCI-132456 (Verified)</p>
              <span className="text-emerald-400 text-[11px]">Medical Council Authorized</span>
            </div>

            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Qualification</span>
              <p className="font-bold text-white text-sm">MBBS, MD (Emergency Medicine)</p>
              <span className="text-slate-400 text-[11px]">10+ Years ER Experience</span>
            </div>

            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Assigned Hospital</span>
              <p className="font-bold text-indigo-400 text-sm">City Central Emergency Hospital</p>
              <span className="text-slate-400 text-[11px]">Sector 4, Main Highway</span>
            </div>

            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Department</span>
              <p className="font-bold text-teal-400 text-sm">Emergency Triage & Trauma ICU</p>
              <span className="text-slate-400 text-[11px]">Shift: On-Call Command</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
