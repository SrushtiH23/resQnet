import React from 'react';
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from '../context/AuthContext';
import {
  Activity, ShieldAlert, UserCheck, Stethoscope, Building2, LayoutDashboard, LogOut, Radio,
  Smartphone, LineChart, Cpu, Zap, History, Layout
} from 'lucide-react';

export const Navbar = () => {
  const { user, logout, switchRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleRoleChange = async (role) => {
    await switchRole(role);
    navigate(`/${role}-dashboard`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleIcons = {
    user: <UserCheck className="w-4 h-4 text-emerald-400" />,
    family: <ShieldAlert className="w-4 h-4 text-amber-400" />,
    doctor: <Stethoscope className="w-4 h-4 text-cyan-400" />,
    hospital: <Building2 className="w-4 h-4 text-indigo-400" />,
    admin: <LayoutDashboard className="w-4 h-4 text-rose-400" />
  };

  const navPages = [
    { label: 'Dashboard', path: '/user-dashboard', icon: <Layout className="w-3.5 h-3.5" /> },
    { label: 'Live Monitoring', path: '/live-monitoring', icon: <Smartphone className="w-3.5 h-3.5" /> },
    { label: 'Sensor Analytics', path: '/sensor-analytics', icon: <LineChart className="w-3.5 h-3.5" /> },
    { label: 'Emergency Analysis', path: '/emergency-analysis', icon: <Cpu className="w-3.5 h-3.5" /> },
    { label: 'AI Decision Engine', path: '/ai-decision-engine', icon: <Zap className="w-3.5 h-3.5" /> },
    { label: 'Emergency History', path: '/emergency-history', icon: <History className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800 px-4 py-3 shadow-xl space-y-2">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/20 group-hover:scale-105 transition-transform">
              <Activity className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
                ResQ<span className="text-rose-500">Net</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30 uppercase tracking-widest">
                  Intelligence
                </span>
              </span>
              <p className="text-[11px] text-slate-400 font-medium">Multi-Stage Emergency Platform</p>
            </div>
          </Link>
        </div>

        {/* Role Switcher Pills */}
        {user && (
          <div className="flex items-center gap-1 p-1 bg-slate-900/80 rounded-xl border border-slate-800 text-xs">
            <span className="px-2 py-1 text-slate-400 font-medium hidden sm:inline flex items-center gap-1">
              <Radio className="w-3.5 h-3.5 text-rose-500 animate-ping" /> Role View:
            </span>
            {['user', 'family', 'doctor', 'hospital', 'admin'].map((r) => {
              const active = user.role === r || location.pathname.includes(r);
              return (
                <button
                  key={r}
                  onClick={() => handleRoleChange(r)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg capitalize font-medium transition-all ${active
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                >
                  {roleIcons[r]}
                  <span className="hidden sm:inline">{r}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* User Info & Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-slate-200">{user.full_name}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">{user.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/20"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <Link
                to="/login"
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors border border-slate-700"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-lg shadow-rose-600/20 transition-all"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Sub-Navigation Page Bar for Technical Modules */}
      {user && (
        <div className="max-w-7xl mx-auto pt-2 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs scrollbar-none">
          {navPages.map((page) => {
            const isActive = location.pathname === page.path;
            return (
              <Link
                key={page.path}
                to={page.path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {page.icon}
                {page.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
};
