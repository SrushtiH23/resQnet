import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Stethoscope, Building2, ShieldCheck, ArrowRight, Award, CheckCircle2, MapPin, Clock } from 'lucide-react';

export const DoctorOnboarding = ({ user }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [profile, setProfile] = useState({
    registration_number: '',
    specialization: 'Emergency Triage & Trauma',
    qualification: 'MBBS, MD',
    experience_years: '8',
    hospital_name: 'Metro City Trauma Center',
    department: 'Emergency & Critical Care',
    city: 'Mumbai',
    address: '100 Hospital Way, Sector 4',
    working_hours: '24/7 ER Duty'
  });

  const handleStep2Submit = (e) => {
    e.preventDefault();
    if (!profile.registration_number.trim()) {
      setError('Medical Registration Number is required.');
      return;
    }
    setError('');
    setStep(3);
  };

  const handleFinishOnboarding = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.put('/doctor/profile', {
        registration_number: profile.registration_number,
        specialization: profile.specialization,
        qualification: profile.qualification,
        experience_years: parseInt(profile.experience_years) || 5,
        hospital_name: profile.hospital_name,
        department: profile.department,
        city: profile.city,
        address: profile.address,
        working_hours: profile.working_hours
      });
      navigate('/doctor-dashboard');
    } catch (err) {
      console.warn('Doctor profile setup notice:', err);
      // Fallback navigate to doctor dashboard
      navigate('/doctor-dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stepper Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-1">
          <Stethoscope className="w-8 h-8" />
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-white">Doctor Professional Setup</h2>
        <p className="text-xs text-slate-400">Step {step} of 4 — Verified Physician Onboarding</p>

        <div className="grid grid-cols-4 gap-2 pt-2 max-w-md mx-auto">
          {[
            { id: 1, label: 'Account' },
            { id: 2, label: 'Credentials' },
            { id: 3, label: 'Organization' },
            { id: 4, label: 'Verification' },
          ].map(st => (
            <div key={st.id} className="space-y-1">
              <div
                className={`h-2 rounded-full transition-all ${
                  st.id === step
                    ? 'bg-cyan-500 shadow-md shadow-cyan-500/40 scale-105'
                    : st.id < step
                    ? 'bg-emerald-400'
                    : 'bg-slate-800'
                }`}
              />
              <span className={`text-[10px] font-bold block truncate ${st.id === step ? 'text-white' : 'text-slate-500'}`}>
                {st.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl font-medium flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-300 font-bold ml-2">✕</button>
        </div>
      )}

      {/* STEP 2 – PROFESSIONAL CREDENTIALS */}
      {step === 2 && (
        <form onSubmit={handleStep2Submit} className="glass-panel p-6 rounded-3xl space-y-4 shadow-2xl border border-slate-800">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-cyan-400" /> Step 2: Professional Medical Credentials
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Medical Registration Number</label>
              <input
                type="text"
                required
                value={profile.registration_number}
                onChange={e => setProfile({ ...profile, registration_number: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                placeholder="MCI-994821 or State License"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Specialization</label>
              <input
                type="text"
                required
                value={profile.specialization}
                onChange={e => setProfile({ ...profile, specialization: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                placeholder="Emergency Medicine, Cardiology"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Qualification</label>
              <input
                type="text"
                required
                value={profile.qualification}
                onChange={e => setProfile({ ...profile, qualification: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                placeholder="MBBS, MD, MS"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Years of Experience</label>
              <input
                type="number"
                required
                value={profile.experience_years}
                onChange={e => setProfile({ ...profile, experience_years: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                placeholder="8"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            Continue to Organization Setup <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* STEP 3 – HOSPITAL / CLINIC DETAILS */}
      {step === 3 && (
        <form onSubmit={() => setStep(4)} className="glass-panel p-6 rounded-3xl space-y-4 shadow-2xl border border-slate-800">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cyan-400" /> Step 3: Hospital & Department Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Hospital / Clinic Name</label>
              <input
                type="text"
                required
                value={profile.hospital_name}
                onChange={e => setProfile({ ...profile, hospital_name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                placeholder="City General Emergency Hospital"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Department</label>
              <input
                type="text"
                required
                value={profile.department}
                onChange={e => setProfile({ ...profile, department: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                placeholder="Emergency Triage / ICU"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">City</label>
              <input
                type="text"
                required
                value={profile.city}
                onChange={e => setProfile({ ...profile, city: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                placeholder="Mumbai"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Working Hours / Shift</label>
              <input
                type="text"
                value={profile.working_hours}
                onChange={e => setProfile({ ...profile, working_hours: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                placeholder="24/7 ER Duty or Mon-Fri 08:00 - 20:00"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Professional Address</label>
            <input
              type="text"
              required
              value={profile.address}
              onChange={e => setProfile({ ...profile, address: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
              placeholder="100 Hospital Way, Sector 4"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="py-3.5 px-5 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs"
            >
              Back
            </button>
            <button
              type="submit"
              className="flex-1 py-3.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              Continue to Verification <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* STEP 4 – VERIFICATION SUMMARY */}
      {step === 4 && (
        <form onSubmit={handleFinishOnboarding} className="glass-panel p-6 rounded-3xl space-y-6 shadow-2xl border border-slate-800 text-center">
          <div className="mx-auto w-16 h-16 bg-cyan-500/20 text-cyan-400 rounded-2xl flex items-center justify-center border border-cyan-500/40">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-xl font-extrabold text-white">Step 4: Verify Doctor Profile</h3>
            <p className="text-xs text-slate-400 mt-1">
              Confirm your professional details to access the ResQNet Clinical Decision Portal.
            </p>
          </div>

          <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 text-left space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Doctor Name:</span>
              <span className="font-bold text-white">{user?.full_name || 'Dr. Practitioner'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Reg Number:</span>
              <span className="font-mono font-bold text-cyan-400">{profile.registration_number}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Specialization:</span>
              <span className="font-bold text-white">{profile.specialization} ({profile.qualification})</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Hospital:</span>
              <span className="font-bold text-white">{profile.hospital_name}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Location:</span>
              <span className="font-bold text-slate-300">{profile.city}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-base rounded-xl shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
            {loading ? 'Completing Setup...' : 'Complete Doctor Setup & Open Dashboard'}
          </button>
        </form>
      )}
    </div>
  );
};
