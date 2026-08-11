import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Building2, ShieldCheck, ArrowRight, CheckCircle2, Bed, Truck, Phone } from 'lucide-react';
import { IndianPhoneInput, validateIndianPhone } from '../IndianPhoneInput';

export const HospitalOnboarding = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [hospital, setHospital] = useState({
    hospital_name: user?.full_name || 'City Central Emergency Hospital',
    registration_number: 'HOSP-2026-991',
    phone: user?.phone || '',
    email: user?.email || '',
    address: '100 Hospital Way, Sector 4',
    city: 'Mumbai',
    emergency_dept_available: true,
    ambulance_available: true,
    departments: 'Trauma, Cardiology, ICU, Neurology',
    bed_capacity: '14'
  });

  const handleFinishOnboarding = async (e) => {
    e.preventDefault();
    if (hospital.phone && !validateIndianPhone(hospital.phone)) {
      setError('Enter a valid 10-digit Indian mobile contact number.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      await api.put('/hospital/profile', {
        hospital_name: hospital.hospital_name,
        registration_number: hospital.registration_number,
        phone: hospital.phone,
        email: hospital.email,
        address: hospital.address,
        city: hospital.city,
        emergency_dept_available: hospital.emergency_dept_available,
        ambulance_available: hospital.ambulance_available,
        departments: hospital.departments,
        bed_capacity: parseInt(hospital.bed_capacity) || 10
      });
      navigate('/hospital-dashboard');
    } catch (err) {
      console.warn('Hospital profile setup notice:', err);
      navigate('/hospital-dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-1">
          <Building2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-white">Hospital ER Onboarding</h2>
        <p className="text-xs text-slate-400">Emergency Department & Facility Capacity Setup</p>
      </div>

      {error && (
        <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl font-medium flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-300 font-bold ml-2">✕</button>
        </div>
      )}

      <form onSubmit={handleFinishOnboarding} className="glass-panel p-6 rounded-3xl space-y-4 shadow-2xl border border-slate-800">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-400" /> Step 2: Emergency Department Profile
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Hospital / Facility Name</label>
            <input
              type="text"
              required
              value={hospital.hospital_name}
              onChange={e => setHospital({ ...hospital, hospital_name: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              placeholder="City Central Emergency Hospital"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Hospital License / Reg Number</label>
            <input
              type="text"
              required
              value={hospital.registration_number}
              onChange={e => setHospital({ ...hospital, registration_number: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
              placeholder="HOSP-2026-991"
            />
          </div>

          <IndianPhoneInput
            label="ER Emergency Phone"
            required
            value={hospital.phone}
            onChange={val => setHospital({ ...hospital, phone: val })}
          />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Available ER Beds Capacity</label>
            <input
              type="number"
              required
              value={hospital.bed_capacity}
              onChange={e => setHospital({ ...hospital, bed_capacity: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 font-mono font-bold"
              placeholder="14"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">City</label>
            <input
              type="text"
              required
              value={hospital.city}
              onChange={e => setHospital({ ...hospital, city: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              placeholder="Mumbai"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Emergency Departments</label>
            <input
              type="text"
              required
              value={hospital.departments}
              onChange={e => setHospital({ ...hospital, departments: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              placeholder="Trauma, Cardiology, ICU, Neurology"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-300">Full Address</label>
          <input
            type="text"
            required
            value={hospital.address}
            onChange={e => setHospital({ ...hospital, address: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            placeholder="100 Hospital Way, Sector 4"
          />
        </div>

        {/* Toggles for ER & Ambulance */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <label className="flex items-center gap-3 p-3.5 bg-slate-900 rounded-2xl border border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={hospital.emergency_dept_available}
              onChange={e => setHospital({ ...hospital, emergency_dept_available: e.target.checked })}
              className="w-4 h-4 accent-indigo-500 rounded"
            />
            <div>
              <span className="text-xs font-bold text-white block">24/7 ER Available</span>
              <span className="text-[10px] text-slate-400">Accepting incoming priority dispatch</span>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3.5 bg-slate-900 rounded-2xl border border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={hospital.ambulance_available}
              onChange={e => setHospital({ ...hospital, ambulance_available: e.target.checked })}
              className="w-4 h-4 accent-indigo-500 rounded"
            />
            <div>
              <span className="text-xs font-bold text-white block">Ambulance Dispatch</span>
              <span className="text-[10px] text-slate-400">Dijkstra priority allocation</span>
            </div>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-base rounded-xl shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <CheckCircle2 className="w-5 h-5" />
          {loading ? 'Completing Setup...' : 'Complete Hospital Setup & Open Dashboard'}
        </button>
      </form>
    </div>
  );
};
