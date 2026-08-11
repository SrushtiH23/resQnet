import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ShieldAlert, CheckCircle2, ArrowRight, Bell, Heart, User } from 'lucide-react';
import { IndianPhoneInput, validateIndianPhone } from '../IndianPhoneInput';

export const FamilyOnboarding = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [family, setFamily] = useState({
    contact_name: user?.full_name || '',
    phone: user?.phone || '',
    relationship_type: 'Mother',
    email: user?.email || '',
    notification_preference: 'SMS + Priority Voice Call'
  });

  const handleFinishOnboarding = async (e) => {
    e.preventDefault();
    if (family.phone && !validateIndianPhone(family.phone)) {
      setError('Enter a valid 10-digit Indian mobile contact number.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      await api.put('/family/profile', {
        contact_name: family.contact_name,
        phone: family.phone,
        relationship_type: family.relationship_type,
        email: family.email,
        notification_preference: family.notification_preference
      });
      navigate('/family-dashboard');
    } catch (err) {
      console.warn('Family profile setup notice:', err);
      navigate('/family-dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-1">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-white">Family Contact Onboarding</h2>
        <p className="text-xs text-slate-400">Emergency Notification & Relationship Setup</p>
      </div>

      {error && (
        <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl font-medium flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-300 font-bold ml-2">✕</button>
        </div>
      )}

      <form onSubmit={handleFinishOnboarding} className="glass-panel p-6 rounded-3xl space-y-4 shadow-2xl border border-slate-800">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Heart className="w-5 h-5 text-amber-400" /> Step 2: Emergency Contact Profile
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Your Full Name</label>
            <input
              type="text"
              required
              value={family.contact_name}
              onChange={e => setFamily({ ...family, contact_name: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              placeholder="Sarah Mercer"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Relationship to Patient</label>
            <select
              value={family.relationship_type}
              onChange={e => setFamily({ ...family, relationship_type: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 capitalize"
            >
              {['Mother', 'Father', 'Spouse', 'Child', 'Sibling', 'Friend', 'Relative'].map(rel => (
                <option key={rel} value={rel}>{rel}</option>
              ))}
            </select>
          </div>

          <IndianPhoneInput
            label="Mobile Phone Number"
            required
            value={family.phone}
            onChange={val => setFamily({ ...family, phone: val })}
          />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Emergency Alert Preference</label>
            <select
              value={family.notification_preference}
              onChange={e => setFamily({ ...family, notification_preference: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
            >
              <option value="SMS + Priority Voice Call">SMS + Priority Voice Call</option>
              <option value="SMS Only">SMS Only</option>
              <option value="Voice Call Only">Voice Call Only</option>
              <option value="Push Notifications">Push Notifications</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black text-base rounded-xl shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <CheckCircle2 className="w-5 h-5" />
          {loading ? 'Completing Setup...' : 'Complete Family Setup & Open Dashboard'}
        </button>
      </form>
    </div>
  );
};
