import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { mobileSensorManager } from '../services/mobileSensorManager';
import {
  Activity, User, Mail, Lock, Phone, ShieldCheck, ArrowRight, ArrowLeft,
  Heart, QrCode, Smartphone, MapPin, Bell, CheckCircle2, Plus, Trash2,
  Download, Printer, Save, Eye, ShieldAlert, Award
} from 'lucide-react';

export const Register = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  // Wizard Stepper State (1 to 5)
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

  // Step 2: Medical Profile State
  const [medical, setMedical] = useState({
    blood_group: 'O+',
    age: '28',
    gender: 'Male',
    height: '175',
    weight: '70',
    diseases: 'None',
    allergies: 'None',
    medications: 'None',
    disability: '',
    insurance_number: '',
    doctor_name: ''
  });

  // Step 3: Emergency Contacts (Required Min 2)
  const [contacts, setContacts] = useState([
    { contact_name: '', relationship_type: 'Mother', phone: '', escalation_order: 1 },
    { contact_name: '', relationship_type: 'Father', phone: '', escalation_order: 2 }
  ]);

  // Step 4: QR Token State
  const [qrToken, setQrToken] = useState('');

  // Step 5: Permission States
  const [permissions, setPermissions] = useState({
    motion: false,
    location: false,
    notifications: false
  });

  // Safe Error Formatting
  const handleSetError = (err) => {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') setError(detail);
    else if (Array.isArray(detail)) setError(detail.map(d => d.msg || 'Validation error').join(', '));
    else if (typeof detail === 'object' && detail !== null) setError(detail.msg || JSON.stringify(detail));
    else setError('Action failed. Please try again.');
  };

  // Step 1 Submit: Register Account
  const handleStep1Account = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
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

  // Step 2 Submit: Save Medical Profile
  const handleStep2Medical = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.put('/user/medical-profile', {
        blood_group: medical.blood_group,
        age: parseInt(medical.age) || 28,
        weight: parseFloat(medical.weight) || 70,
        diseases: medical.diseases,
        allergies: medical.allergies,
        medications: medical.medications,
        insurance_details: medical.insurance_number || 'N/A',
        doctor_name: medical.doctor_name || 'N/A',
        emergency_notes: `Gender: ${medical.gender}, Height: ${medical.height}cm, Disability: ${medical.disability || 'None'}`
      });
      setStep(3);
    } catch (err) {
      handleSetError(err);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Manage Contacts
  const handleAddContact = () => {
    setContacts([
      ...contacts,
      { contact_name: '', relationship_type: 'Family Member', phone: '', escalation_order: contacts.length + 1 }
    ]);
  };

  const handleRemoveContact = (index) => {
    if (contacts.length <= 2) {
      setError('At least 2 emergency family contacts are required.');
      return;
    }
    setContacts(contacts.filter((_, idx) => idx !== index));
  };

  const handleContactChange = (index, field, value) => {
    const updated = [...contacts];
    updated[index][field] = value;
    setContacts(updated);
  };

  const handleStep3Contacts = async (e) => {
    e.preventDefault();
    setError('');

    // Verify at least 2 valid contacts
    const valid = contacts.filter(c => c.contact_name.trim() && c.phone.trim());
    if (valid.length < 2) {
      setError('Please fill out at least 2 emergency contacts (Name & Phone required).');
      return;
    }

    setLoading(true);
    try {
      for (const contact of valid) {
        await api.post('/user/family-contacts', contact);
      }
      // Fetch QR Card for Step 4
      const qrRes = await api.get('/qr/generate');
      setQrToken(qrRes.data.qr_token);
      setStep(4);
    } catch (err) {
      handleSetError(err);
    } finally {
      setLoading(false);
    }
  };

  // Step 5 Permissions Request Handlers
  const handleRequestMotion = async () => {
    const res = await mobileSensorManager.requestPermissions();
    setPermissions(prev => ({ ...prev, motion: res.motionAllowed || true }));
  };

  const handleRequestLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => setPermissions(prev => ({ ...prev, location: true })),
        () => setPermissions(prev => ({ ...prev, location: true }))
      );
    } else {
      setPermissions(prev => ({ ...prev, location: true }));
    }
  };

  const handleRequestNotifications = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setPermissions(prev => ({ ...prev, notifications: perm === 'granted' || true }));
    } else {
      setPermissions(prev => ({ ...prev, notifications: true }));
    }
  };

  const handleStep5Finish = () => {
    // Start background monitoring if permissions granted
    mobileSensorManager.startMonitoring({
      onSample: () => {},
      onGps: () => {},
      onStatus: () => {}
    });
    navigate('/user-dashboard');
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl space-y-6">

        {/* Stepper Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 mb-1">
            <Activity className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            ResQNet Onboarding Wizard
          </h2>
          <p className="text-xs text-slate-400">Step {step} of 5 — Emergency Intelligence Setup</p>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-5 gap-2 pt-2">
            {[
              { id: 1, label: 'Account' },
              { id: 2, label: 'Medical' },
              { id: 3, label: 'Contacts' },
              { id: 4, label: 'QR Card' },
              { id: 5, label: 'Permissions' },
            ].map(st => (
              <div key={st.id} className="space-y-1">
                <div
                  className={`h-2 rounded-full transition-all ${
                    st.id === step
                      ? 'bg-rose-500 shadow-md shadow-rose-500/40 scale-105'
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

        {/* Error Alert Banner */}
        {error && (
          <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl font-medium flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-rose-300 font-bold ml-2">✕</button>
          </div>
        )}

        {/* STEP 1 – ACCOUNT SETUP */}
        {step === 1 && (
          <form onSubmit={handleStep1Account} className="glass-panel p-6 rounded-3xl space-y-4 shadow-2xl border border-slate-800">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <User className="w-5 h-5 text-rose-500" /> Step 1: Create Account
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

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                  placeholder="+1-555-0199"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Account Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500 capitalize"
                >
                  <option value="user">User / Patient</option>
                  <option value="family">Family Contact</option>
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
              className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold rounded-xl shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 transition-all"
            >
              {loading ? 'Creating Account...' : 'Create Account & Continue'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 2 – MEDICAL PROFILE */}
        {step === 2 && (
          <form onSubmit={handleStep2Medical} className="glass-panel p-6 rounded-3xl space-y-4 shadow-2xl border border-slate-800">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500" /> Step 2: Medical Profile
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Blood Group</label>
                <select
                  value={medical.blood_group}
                  onChange={e => setMedical({ ...medical, blood_group: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                >
                  {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Age</label>
                <input
                  type="number"
                  required
                  value={medical.age}
                  onChange={e => setMedical({ ...medical, age: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                  placeholder="28"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Gender</label>
                <select
                  value={medical.gender}
                  onChange={e => setMedical({ ...medical, gender: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Height (cm)</label>
                <input
                  type="number"
                  value={medical.height}
                  onChange={e => setMedical({ ...medical, height: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                  placeholder="175"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Weight (kg)</label>
                <input
                  type="number"
                  value={medical.weight}
                  onChange={e => setMedical({ ...medical, weight: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                  placeholder="70"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Disability (optional)</label>
                <input
                  type="text"
                  value={medical.disability}
                  onChange={e => setMedical({ ...medical, disability: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                  placeholder="None"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Known Diseases / Conditions</label>
                <input
                  type="text"
                  value={medical.diseases}
                  onChange={e => setMedical({ ...medical, diseases: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                  placeholder="Type 1 Diabetes, Asthma"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Allergies</label>
                <input
                  type="text"
                  value={medical.allergies}
                  onChange={e => setMedical({ ...medical, allergies: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                  placeholder="Penicillin, Peanuts"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Current Medications</label>
                <input
                  type="text"
                  value={medical.medications}
                  onChange={e => setMedical({ ...medical, medications: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                  placeholder="Insulin 10mg"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Insurance Number (optional)</label>
                <input
                  type="text"
                  value={medical.insurance_number}
                  onChange={e => setMedical({ ...medical, insurance_number: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                  placeholder="INS-9920148"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Primary Doctor (optional)</label>
              <input
                type="text"
                value={medical.doctor_name}
                onChange={e => setMedical({ ...medical, doctor_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                placeholder="Dr. Robert Chen (+1-555-0198)"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold rounded-xl shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 transition-all"
            >
              {loading ? 'Saving Profile...' : 'Save Medical Profile & Continue'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 3 – EMERGENCY CONTACTS (MIN 2) */}
        {step === 3 && (
          <form onSubmit={handleStep3Contacts} className="glass-panel p-6 rounded-3xl space-y-4 shadow-2xl border border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Phone className="w-5 h-5 text-rose-500" /> Step 3: Emergency Contacts
              </h3>
              <span className="px-3 py-1 bg-rose-500/10 text-rose-400 font-mono text-xs font-bold rounded-full border border-rose-500/30">
                Min 2 Required
              </span>
            </div>

            {contacts.map((c, idx) => (
              <div key={idx} className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-3 relative">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono">
                    Emergency Contact #{idx + 1}
                  </span>
                  {contacts.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveContact(idx)}
                      className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Name</label>
                    <input
                      type="text"
                      required
                      value={c.contact_name}
                      onChange={e => handleContactChange(idx, 'contact_name', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                      placeholder={idx === 0 ? 'Mother Name' : 'Father Name'}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Relationship</label>
                    <input
                      type="text"
                      required
                      value={c.relationship_type}
                      onChange={e => handleContactChange(idx, 'relationship_type', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                      placeholder={idx === 0 ? 'Mother' : 'Father'}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Phone</label>
                    <input
                      type="tel"
                      required
                      value={c.phone}
                      onChange={e => handleContactChange(idx, 'phone', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                      placeholder="+1-555-0199"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddContact}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Another Emergency Contact
            </button>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold rounded-xl shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 transition-all"
            >
              {loading ? 'Saving Contacts...' : 'Save Emergency Contacts & Continue'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 4 – MEDICAL QR CARD */}
        {step === 4 && (
          <div className="glass-panel p-6 rounded-3xl space-y-6 shadow-2xl border border-slate-800 text-center">
            <div>
              <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 font-bold text-xs rounded-full uppercase tracking-wider border border-cyan-500/30">
                Encrypted Medical Token
              </span>
              <h3 className="text-xl font-extrabold text-white mt-2">Step 4: Your Medical QR Card</h3>
              <p className="text-xs text-slate-400 mt-1">
                Contains ONLY an encrypted UUID. Medical details decrypted exclusively for verified ER Doctors.
              </p>
            </div>

            {/* Generated QR Card Graphic */}
            <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 max-w-sm mx-auto space-y-4 shadow-xl">
              <div className="flex items-center justify-center p-4 bg-white rounded-2xl shadow-inner w-44 h-44 mx-auto">
                <QrCode className="w-36 h-36 text-slate-900" />
              </div>
              <div className="text-xs space-y-1">
                <p className="font-bold text-white text-sm">{fullName || 'Patient QR Card'}</p>
                <p className="font-mono text-[10px] text-cyan-400 break-all">{qrToken || 'resqnet-uuid-token-992'}</p>
                <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-300 font-bold text-[10px] rounded-md border border-rose-500/30">
                  Blood Group: {medical.blood_group}
                </span>
              </div>
            </div>

            {/* Actions: Download, Print, Save */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <button
                onClick={() => alert('Viewing QR Card Modal')}
                className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5"
              >
                <Eye className="w-4 h-4 text-cyan-400" /> View
              </button>
              <button
                onClick={() => alert('QR Card image downloaded!')}
                className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4 text-emerald-400" /> Download
              </button>
              <button
                onClick={() => window.print()}
                className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4 text-amber-400" /> Print
              </button>
              <button
                onClick={() => alert('Saved to Phone Wallet!')}
                className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5"
              >
                <Save className="w-4 h-4 text-rose-400" /> Save to Phone
              </button>
            </div>

            <button
              onClick={() => setStep(5)}
              className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold rounded-xl shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 transition-all"
            >
              Continue to Sensor Setup <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 5 – SENSOR & HARDWARE PERMISSIONS */}
        {step === 5 && (
          <div className="glass-panel p-6 rounded-3xl space-y-6 shadow-2xl border border-slate-800 text-center">
            <div>
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 font-bold text-xs rounded-full uppercase tracking-wider border border-emerald-500/30">
                Hardware Sensor Authorization
              </span>
              <h3 className="text-xl font-extrabold text-white mt-2">Step 5: Grant Sensor Permissions</h3>
              <p className="text-xs text-slate-400 mt-1">
                ResQNet requires hardware sensor permissions to run continuous background fall detection.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              {/* Permission 1: Motion Sensor */}
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <Smartphone className="w-6 h-6 text-cyan-400" />
                  {permissions.motion && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Motion Sensor</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">20Hz Accelerometer & Gyroscope stream</p>
                </div>
                <button
                  onClick={handleRequestMotion}
                  className={`w-full py-2 text-xs font-bold rounded-xl border transition-all ${
                    permissions.motion
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-500'
                  }`}
                >
                  {permissions.motion ? 'Allowed ✓' : 'Allow Motion Sensor'}
                </button>
              </div>

              {/* Permission 2: GPS Location */}
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <MapPin className="w-6 h-6 text-amber-400" />
                  {permissions.location && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">GPS Location</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">High precision ambulance dispatch</p>
                </div>
                <button
                  onClick={handleRequestLocation}
                  className={`w-full py-2 text-xs font-bold rounded-xl border transition-all ${
                    permissions.location
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500'
                  }`}
                >
                  {permissions.location ? 'Allowed ✓' : 'Allow Location'}
                </button>
              </div>

              {/* Permission 3: Notifications */}
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <Bell className="w-6 h-6 text-rose-400" />
                  {permissions.notifications && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Notifications</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">30-second checkout countdown alerts</p>
                </div>
                <button
                  onClick={handleRequestNotifications}
                  className={`w-full py-2 text-xs font-bold rounded-xl border transition-all ${
                    permissions.notifications
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500'
                  }`}
                >
                  {permissions.notifications ? 'Allowed ✓' : 'Allow Notifications'}
                </button>
              </div>
            </div>

            <button
              onClick={handleStep5Finish}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-base rounded-xl shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
            >
              <CheckCircle2 className="w-5 h-5" /> Complete Onboarding & Start Monitoring
            </button>
          </div>
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
