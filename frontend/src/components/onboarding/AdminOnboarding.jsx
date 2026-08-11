import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, LayoutDashboard, CheckCircle2 } from 'lucide-react';

export const AdminOnboarding = ({ user }) => {
  const navigate = useNavigate();

  const handleFinishOnboarding = () => {
    navigate('/admin-dashboard');
  };

  return (
    <div className="space-y-6 animate-fade-in text-center max-w-md mx-auto">
      <div className="mx-auto w-20 h-20 bg-purple-500/20 text-purple-400 rounded-3xl flex items-center justify-center border border-purple-500/40 animate-bounce">
        <LayoutDashboard className="w-10 h-10" />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-black text-white">Admin Account Activated</h2>
        <p className="text-xs text-slate-400">
          System Administrator access granted for ResQNet Platform Management.
        </p>
      </div>

      <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 text-left space-y-2 text-xs">
        <div className="flex justify-between py-1 border-b border-slate-800">
          <span className="text-slate-400">Admin Name:</span>
          <span className="font-bold text-white">{user?.full_name || 'System Admin'}</span>
        </div>
        <div className="flex justify-between py-1 border-b border-slate-800">
          <span className="text-slate-400">Role Privilege:</span>
          <span className="font-mono font-bold text-purple-400 uppercase">Administrator</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-slate-400">Status:</span>
          <span className="font-bold text-emerald-400">Active</span>
        </div>
      </div>

      <button
        onClick={handleFinishOnboarding}
        className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-base rounded-xl shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
      >
        <CheckCircle2 className="w-5 h-5" /> Open Admin Command Center
      </button>
    </div>
  );
};
