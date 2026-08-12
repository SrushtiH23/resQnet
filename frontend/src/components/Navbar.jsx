import React from 'react';
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from '../context/AuthContext';
import {
  Activity, LogOut, Smartphone, LineChart, Cpu, Zap, History, Layout,
  Heart, PhoneCall, QrCode, ShieldAlert, Stethoscope, Building2, LayoutDashboard, Users, User
} from 'lucide-react';

export const Navbar = () => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (role === 'admin') {
    return null;
  }

  const roleDashboardPath = role ? `/${role}-dashboard` : '/login';

  const getNavPages = () => {
    if (!role) return [];

    switch (role) {
      case 'user':
        return [
          { label: 'Dashboard', path: '/user-dashboard', icon: <Layout className="w-3.5 h-3.5" /> },
          { label: 'QR Scanner', path: '/qr-scanner', icon: <QrCode className="w-3.5 h-3.5" /> },
          { label: 'Live Monitoring', path: '/live-monitoring', icon: <Smartphone className="w-3.5 h-3.5" /> },
          { label: 'Sensor Analytics', path: '/sensor-analytics', icon: <LineChart className="w-3.5 h-3.5" /> },
          { label: 'Emergency Analysis', path: '/emergency-analysis', icon: <Cpu className="w-3.5 h-3.5" /> },
          { label: 'AI Decision Engine', path: '/ai-decision-engine', icon: <Zap className="w-3.5 h-3.5" /> },
          { label: 'Emergency History', path: '/emergency-history', icon: <History className="w-3.5 h-3.5" /> },
          { label: 'Medical Profile', path: '/medical-profile', icon: <Heart className="w-3.5 h-3.5" /> },
        ];
      case 'doctor':
        return [
          { label: 'Doctor Dashboard', path: '/doctor-dashboard', icon: <Stethoscope className="w-3.5 h-3.5" /> },
          { label: 'QR Scanner', path: '/qr-scanner', icon: <QrCode className="w-3.5 h-3.5" /> },
          { label: 'Active Emergencies', path: '/active-emergencies', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
          { label: 'Emergency History', path: '/emergency-history', icon: <History className="w-3.5 h-3.5" /> },
          { label: 'My Profile', path: '/doctor-profile', icon: <User className="w-3.5 h-3.5" /> },
        ];
      case 'hospital':
        return [
          { label: 'Hospital ER Dashboard', path: '/hospital-dashboard', icon: <Building2 className="w-3.5 h-3.5" /> },
          { label: 'QR Scanner', path: '/qr-scanner', icon: <QrCode className="w-3.5 h-3.5" /> },
          { label: 'Live Monitoring', path: '/live-monitoring', icon: <Smartphone className="w-3.5 h-3.5" /> },
          { label: 'Emergency Analysis', path: '/emergency-analysis', icon: <Cpu className="w-3.5 h-3.5" /> },
          { label: 'Emergency History', path: '/emergency-history', icon: <History className="w-3.5 h-3.5" /> },
        ];
      case 'admin':
        return [
          { label: 'Admin Console', path: '/admin-dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
          { label: 'Active Emergencies', path: '/admin-dashboard#active-emergencies', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
          { label: 'Users', path: '/admin-dashboard#users', icon: <Users className="w-3.5 h-3.5" /> },
          { label: 'Doctors', path: '/admin-dashboard#doctors', icon: <Stethoscope className="w-3.5 h-3.5" /> },
          { label: 'Hospitals', path: '/admin-dashboard#hospitals', icon: <Building2 className="w-3.5 h-3.5" /> },
          { label: 'Emergency History', path: '/emergency-history', icon: <History className="w-3.5 h-3.5" /> },
          { label: 'Audit Logs', path: '/admin-dashboard#audit-logs', icon: <Activity className="w-3.5 h-3.5" /> },
        ];
      default:
        return [];
    }
  };

  const navPages = getNavPages();

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800 px-4 py-3 shadow-xl space-y-2">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link to={user ? roleDashboardPath : "/"} className="flex items-center gap-2 group">
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/20 cursor-pointer"
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
              <Link
                to="/admin-login"
                className="px-3.5 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-bold border border-purple-500/40 transition-all"
              >
                Admin Login
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Sub-Navigation Page Bar for Technical Modules & Role Features */}
      {user && navPages.length > 0 && (
        <div className="max-w-7xl mx-auto pt-2 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs scrollbar-none">
          {navPages.map((page) => {
            const isActive = location.pathname === page.path || (page.path.includes('#') && location.pathname + location.hash === page.path);
            return (
              <Link
                key={page.label}
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

