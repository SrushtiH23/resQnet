import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { IndianPhoneInput, validateIndianPhone } from '../components/IndianPhoneInput';
import { PatientOnboarding } from '../components/onboarding/PatientOnboarding';
import { DoctorOnboarding } from '../components/onboarding/DoctorOnboarding';
import { HospitalOnboarding } from '../components/onboarding/HospitalOnboarding';
import { FamilyOnboarding } from '../components/onboarding/FamilyOnboarding';
import { AdminOnboarding } from '../components/onboarding/AdminOnboarding';
import { Activity, User, Mail, Lock, Phone, ArrowRight } from 'lucide-react';

export const Register = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Account State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('user');

  // Safe Error Formatting
  const handleSetError = (err) => {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') setError(detail);
    else if (Array.isArray(detail)) setError(detail.map(d => d.msg || 'Validation error').join(', '));
    else if (typeof detail === 'object' && detail !== null) setError(detail.msg || JSON.stringify(detail));
    else setError('Action failed. Please try again.');
  };

  // Step 1 Submit: Register Account & Log In
  const handleStep1Account = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!validateIndianPhone(phone)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        full_name: fullName,
        email,
        password,
        phone,
        role
      });
      await login(email, password);
      setStep(2);
    } catch (err) {
      handleSetError(err);
    } finally {
      setLoading(false);
    }
  };

  // Determine active role from current user session or selected form role
  const activeRole = user?.role || role;

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl space-y-6">

        {/* Header Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 mb-1">
            <Activity className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            ResQNet Onboarding Wizard
          </h2>
          <p className="text-xs text-slate-400">
            {step === 1 ? 'Step 1 of 5 — Account Credentials Setup' : `Role Setup: ${activeRole.toUpperCase()}`}
          </p>
        </div>

        {/* Error Alert Banner */}
        {error && (
          <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl font-medium flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-rose-300 font-bold ml-2">✕</button>
          </div>
        )}

        {/* STEP 1 – ACCOUNT CREATION (Shared for all roles) */}
        {step === 1 && (
          <form onSubmit={handleStep1Account} className="glass-panel p-6 rounded-3xl space-y-4 shadow-2xl border border-slate-800">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <User className="w-5 h-5 text-rose-500" /> Step 1: Create Account & Select Role
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                  placeholder="Jane Doe"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                  placeholder="jane@example.com"
                />
              </div>

              <IndianPhoneInput
                label="Mobile Phone Number"
                required
                value={phone}
                onChange={setPhone}
              />

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Account Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500 capitalize"
                >
                  <option value="user">User / Patient</option>
                  <option value="doctor">Medical Doctor</option>
                  <option value="hospital">Hospital ER Admin</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold rounded-xl shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {loading ? 'Creating Account...' : 'Create Account & Continue Onboarding'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 2 ONWARDS – ROLE-SPECIFIC ONBOARDING */}
        {step > 1 && (
          <>
            {activeRole === 'doctor' ? (
              <DoctorOnboarding user={user} />
            ) : activeRole === 'hospital' ? (
              <HospitalOnboarding user={user} />
            ) : activeRole === 'family' ? (
              <FamilyOnboarding user={user} />
            ) : activeRole === 'admin' ? (
              <AdminOnboarding user={user} />
            ) : (
              <PatientOnboarding user={user} />
            )}
          </>
        )}

        <p className="text-center text-xs text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="text-rose-400 font-semibold hover:underline">
            Sign in
          </Link>
        </p>

      </div>
    </div>
  );
};
