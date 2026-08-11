import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, LayoutDashboard, KeyRound } from 'lucide-react';

export const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { user, role, login } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user && role === 'admin') {
      navigate('/admin-dashboard', { replace: true });
    }
  }, [user, role, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(email, password);
      if (data.role !== 'admin') {
        setError('Unauthorized account. Only verified system administrators can log in here.');
        return;
      }
      navigate('/admin-dashboard');
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') setError(detail);
      else setError('Invalid administrator credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3.5 rounded-3xl bg-purple-500/10 border border-purple-500/30 text-purple-400 mb-1 shadow-lg shadow-purple-500/10">
            <LayoutDashboard className="w-8 h-8" />
          </div>
          <span className="px-3 py-1 bg-purple-500/20 text-purple-300 font-mono text-[10px] font-extrabold rounded-full uppercase tracking-widest border border-purple-500/40 block w-fit mx-auto">
            Restricted Access Protocol
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">System Admin Login</h2>
          <p className="text-xs text-slate-400">ResQNet Intelligence Command & Administrative Portal</p>
        </div>

        {/* Login Form Card */}
        <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-3xl space-y-4 shadow-2xl border border-purple-900/40">
          {error && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl font-medium">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Administrator Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-purple-400 absolute left-3 top-3.5" />
              <input
                type="email"
                required
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-900/90 border border-purple-800/40 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                placeholder="Enter administrator email"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Administrator Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-purple-400 absolute left-3 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-900/90 border border-purple-800/40 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
            {loading ? 'Authenticating Admin Credentials...' : 'Authenticate & Enter Command Center'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400">
          Not an administrator?{' '}
          <Link to="/login" className="text-rose-400 font-semibold hover:underline">
            Return to User Login
          </Link>
        </p>

      </div>
    </div>
  );
};
