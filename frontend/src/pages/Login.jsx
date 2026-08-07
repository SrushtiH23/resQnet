import React, { useState } from 'react';
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from '../context/AuthContext';
import { Activity, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('user@resqnet.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      navigate(`/${data.role}-dashboard`);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((d) => d.msg || 'Invalid credentials').join(', '));
      } else if (typeof detail === 'object' && detail !== null) {
        setError(detail.msg || JSON.stringify(detail));
      } else {
        setError('Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (roleEmail) => {
    setEmail(roleEmail);
    setPassword('password123');
    try {
      const data = await login(roleEmail, 'password123');
      navigate(`/${data.role}-dashboard`);
    } catch (err) {
      setError('Demo login failed');
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 mb-2">
            <Activity className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Welcome Back</h2>
          <p className="text-sm text-slate-400">Sign in to access ResQNet Emergency Intelligence</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-2xl space-y-4 shadow-2xl">
          {error && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl font-medium">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                placeholder="user@resqnet.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold rounded-xl shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Demo Login Preset Buttons */}
        <div className="glass-card p-4 rounded-xl border border-slate-800 space-y-2">
          <p className="text-xs font-semibold text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> One-Click Role Demos (Preset Accounts):
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button onClick={() => handleQuickDemo('user@resqnet.com')} className="p-2 bg-slate-800/80 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-500/40 rounded-lg text-slate-200 text-left font-medium">
              🙋 Patient (User)
            </button>
            <button onClick={() => handleQuickDemo('family@resqnet.com')} className="p-2 bg-slate-800/80 hover:bg-amber-950/40 border border-slate-700 hover:border-amber-500/40 rounded-lg text-slate-200 text-left font-medium">
              👨‍👩‍👧 Family Contact
            </button>
            <button onClick={() => handleQuickDemo('doctor@resqnet.com')} className="p-2 bg-slate-800/80 hover:bg-cyan-950/40 border border-slate-700 hover:border-cyan-500/40 rounded-lg text-slate-200 text-left font-medium">
              👨‍⚕️ Doctor Role
            </button>
            <button onClick={() => handleQuickDemo('hospital@resqnet.com')} className="p-2 bg-slate-800/80 hover:bg-indigo-950/40 border border-slate-700 hover:border-indigo-500/40 rounded-lg text-slate-200 text-left font-medium">
              🏥 Hospital ER
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-rose-400 font-semibold hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
};
