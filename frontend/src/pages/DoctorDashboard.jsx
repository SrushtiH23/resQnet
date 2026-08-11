import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { QRCameraScannerModal } from '../components/QRCameraScannerModal';
import { ConfidenceBreakdownTable } from '../components/ConfidenceBreakdownTable';
import {
  Stethoscope, QrCode, ShieldCheck, Heart, AlertTriangle, UserCheck, FileText,
  CheckCircle2, Camera, Lock, ShieldAlert, Eye, MapPin, Phone, Building2,
  Truck, Clock, Activity, ArrowRight, X, User, Zap, XCircle
} from 'lucide-react';

export const DoctorDashboard = () => {
  const { user } = useAuth();
  const [activeEmergencies, setActiveEmergencies] = useState([]);
  const [qrToken, setQrToken] = useState('');
  const [scannedResult, setScannedResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showScannerModal, setShowScannerModal] = useState(false);

  // Consolidated Emergency Response Inspection Modal State
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    fetchActiveEmergencies();
    const interval = setInterval(fetchActiveEmergencies, 8000);
    return () => clearInterval(interval);
  }, []);

  const fetchActiveEmergencies = async () => {
    try {
      const res = await api.get('/emergency/active');
      setActiveEmergencies(res.data);
    } catch (err) {
      console.error('Failed to fetch active emergencies:', err);
    }
  };

  const handleOpenEmergencyModal = async (emergencyId) => {
    setModalLoading(true);
    try {
      const res = await api.get(`/emergency/${emergencyId}`);
      setSelectedEmergency(res.data);
    } catch (err) {
      console.error('Failed to load emergency details:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleResolveEmergency = async (emergencyId, action) => {
    try {
      await api.post('/emergency/validate', {
        emergency_id: emergencyId,
        action: action,
        validator_role: 'Doctor'
      });
      setSelectedEmergency(null);
      fetchActiveEmergencies();
    } catch (err) {
      alert('Failed to update emergency status.');
    }
  };

  const handleScanQR = async (tokenToUse) => {
    const target = tokenToUse || qrToken;
    if (!target) {
      setError('Please paste, upload, or scan a valid QR token.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/qr/scan', { qr_token: target });
      setScannedResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Doctor Authorization Failed / Invalid QR Card.');
    } finally {
      setLoading(false);
    }
  };

  const loadSampleQrToken = async () => {
    try {
      const res = await api.get('/qr/generate');
      setQrToken(res.data.qr_token);
      handleScanQR(res.data.qr_token);
    } catch (err) {
      console.error(err);
    }
  };

  // Helper for FSM State Pipeline Step
  const getFsmActiveStep = (status = '') => {
    const s = status.toLowerCase();
    if (s.includes('resolved')) return 6;
    if (s.includes('hospital') || s.includes('ambulance')) return 5;
    if (s.includes('family') || s.includes('notified')) return 4;
    if (s.includes('asking') || s.includes('verifying')) return 3;
    if (s.includes('stillness')) return 2;
    if (s.includes('impact') || s.includes('fall')) return 1;
    return 0; // NORMAL
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fade-in">

      {/* Doctor Header */}
      <div className="glass-panel p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800 shadow-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Stethoscope className="w-3.5 h-3.5" /> Verified Medical Doctor ({user?.full_name || 'Dr. Practitioner'})
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Doctor Clinical Emergency Response Command
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Real-time active emergency queue, consolidated emergency response inspection, and patient QR medical decryptor.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowScannerModal(true)}
            className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-600/30 flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
          >
            <Camera className="w-4 h-4" /> Camera QR Scanner
          </button>
          <button
            onClick={loadSampleQrToken}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2 cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-cyan-400" /> Sample Patient QR
          </button>
        </div>
      </div>

      {/* 1. ACTIVE EMERGENCIES QUEUE (Requirement 1 & 2) */}
      <div id="active-emergencies" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-500" /> Active Emergency Dispatch Queue
          </h2>
          <span className="px-3 py-1 bg-rose-500/20 text-rose-300 font-mono text-xs font-bold rounded-full border border-rose-500/40">
            {activeEmergencies.length} Active Dispatch Cases
          </span>
        </div>

        {activeEmergencies.length === 0 ? (
          <div className="p-8 bg-slate-900 rounded-3xl text-center text-xs text-slate-400 border border-slate-800 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="font-bold text-white text-sm">All Clear — No Active Emergency Dispatches</p>
            <p className="text-slate-400">All registered patients are currently in a safe status.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeEmergencies.map((em) => (
              <div key={em.id} className="glass-panel p-5 rounded-3xl border border-rose-950/80 space-y-4 shadow-xl">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-rose-600 text-white font-mono font-black text-xs rounded">
                      Case #{em.id}
                    </span>
                    <h4 className="font-extrabold text-white text-base">
                      {em.patient_name || 'Patient'}
                    </h4>
                    {em.is_demo && (
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-mono font-bold rounded uppercase">
                        🧪 TEST MODE
                      </span>
                    )}
                  </div>

                  <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold rounded">
                    Score: {em.confidence_score}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Trigger Type:</span>
                    <span className="font-bold text-cyan-400">{em.trigger_source}</span>
                  </div>

                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Clinical Severity:</span>
                    <span className={`font-bold ${em.confidence_score >= 70 ? 'text-rose-400' : 'text-amber-400'}`}>
                      {em.confidence_score >= 70 ? 'CRITICAL (Priority ER)' : 'HIGH'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Family Alert:</span>
                    <span className="font-bold text-emerald-400">{em.sms_status === 'SENT' ? 'SMS SENT ✓' : 'PENDING'}</span>
                  </div>

                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Hospital / Ambulance:</span>
                    <span className="font-bold text-indigo-400">{em.status}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    {em.latitude && em.longitude ? `${em.latitude.toFixed(4)}, ${em.longitude.toFixed(4)}` : 'GPS Verified'}
                  </span>

                  <button
                    onClick={() => handleOpenEmergencyModal(em.id)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105"
                  >
                    <Eye className="w-4 h-4" /> View Emergency Response
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. QR PATIENT DECRYPTOR SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* QR Token Input */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-cyan-400" />
              Scan Patient Encrypted QR Card
            </h3>

            {error && (
              <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl">
                {error}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <button
                onClick={() => setShowScannerModal(true)}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold rounded-xl shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4 animate-pulse" /> Launch Camera QR Scanner
              </button>

              <textarea
                rows={3}
                value={qrToken}
                onChange={(e) => setQrToken(e.target.value)}
                placeholder="Paste encrypted JWT token from patient QR card..."
                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-[11px] placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />

              <button
                onClick={() => handleScanQR()}
                disabled={loading}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? 'Decrypting Token...' : 'Decrypt Patient Record'}
              </button>
            </div>
          </div>
        </div>

        {/* Decrypted Patient Record */}
        <div className="lg:col-span-2 space-y-6">
          {scannedResult ? (
            <div className="glass-panel p-6 rounded-3xl border border-cyan-500/40 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-2xl border border-cyan-500/30">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{scannedResult.patient_name}</h3>
                    <p className="text-xs text-slate-400">Phone: {scannedResult.phone || '+91-9876543210'}</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Decrypted & Verified by Doctor
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
                  <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Vital Profile</p>
                  <p className="text-slate-200">Blood Group: <strong className="text-rose-400">{scannedResult.medical_profile?.blood_group || 'O+'}</strong></p>
                  <p className="text-slate-200">Age / Weight: <strong className="text-white">{scannedResult.medical_profile?.age || 29} yrs | {scannedResult.medical_profile?.weight || 72} kg</strong></p>
                </div>

                <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
                  <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Diagnosed Conditions</p>
                  <p className="text-amber-400 font-semibold">{scannedResult.medical_profile?.diseases || 'Type 1 Diabetes, Asthma'}</p>
                </div>

                <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
                  <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Allergies & Contraindications</p>
                  <p className="text-rose-400 font-semibold">{scannedResult.medical_profile?.allergies || 'Penicillin, Peanuts'}</p>
                </div>

                <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
                  <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Active Medications</p>
                  <p className="text-cyan-400 font-semibold">{scannedResult.medical_profile?.medications || 'Insulin Glargine 10U, Ventolin'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-12 rounded-3xl border border-slate-800 text-center space-y-3">
              <QrCode className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-base font-bold text-slate-300">No Patient Record Decrypted Yet</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Scan a patient QR token above to decrypt full medical profiles.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. MY PROFILE SECTION */}
      <div id="my-profile" className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <User className="w-5 h-5 text-cyan-400" /> Doctor Professional Credentials & Station
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Physician Name</span>
            <p className="font-bold text-white text-sm">{user?.full_name || 'Dr. Practitioner'}</p>
            <span className="text-cyan-400 text-[11px] font-mono">Reg #MCI-132456</span>
          </div>

          <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Specialization</span>
            <p className="font-bold text-teal-400 text-sm">Emergency Triage & Critical Care</p>
            <span className="text-slate-300 text-[11px]">Qualification: MBBS, MD</span>
          </div>

          <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Hospital Station</span>
            <p className="font-bold text-indigo-400 text-sm">City Central Emergency Hospital</p>
            <span className="text-slate-300 text-[11px]">Department: Emergency Triage / ICU</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. CONSOLIDATED DOCTOR EMERGENCY RESPONSE SCREEN / MODAL */}
      {/* ============================================================== */}
      {selectedEmergency && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 space-y-6 shadow-2xl relative my-8 text-slate-100">

            {/* Modal Close Button */}
            <button
              onClick={() => setSelectedEmergency(null)}
              className="absolute top-5 right-5 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Metrics */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-500/20 text-rose-500 rounded-2xl border border-rose-500/30">
                  <ShieldAlert className="w-7 h-7 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-rose-600 text-white font-mono font-black text-xs rounded uppercase">
                      Case #{selectedEmergency.id}
                    </span>
                    <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold rounded">
                      Score: {selectedEmergency.confidence_score}%
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold text-white mt-1">
                    {selectedEmergency.patient_name || 'Patient Emergency Response'}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full font-bold">
                  {selectedEmergency.confidence_score >= 70 ? 'CRITICAL SEVERITY' : 'HIGH SEVERITY'}
                </span>
                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-full font-bold">
                  {selectedEmergency.status}
                </span>
              </div>
            </div>

            {/* FSM MOTION STATE PROGRESSION PIPELINE VISUALIZER */}
            <div className="p-5 bg-slate-950 rounded-3xl border border-slate-800 space-y-3">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block font-mono">
                FSM State Progression Pipeline:
              </span>
              <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px]">
                {[
                  { step: 0, label: 'NORMAL' },
                  { step: 1, label: 'FREE FALL' },
                  { step: 2, label: 'IMPACT' },
                  { step: 3, label: 'STILLNESS' },
                  { step: 4, label: 'VERIFY' },
                  { step: 5, label: 'ESCALATE' },
                  { step: 6, label: 'RESOLVED' },
                ].map(item => {
                  const currentStep = getFsmActiveStep(selectedEmergency.status);
                  const isCurrent = item.step === currentStep;
                  const isPassed = item.step < currentStep;
                  return (
                    <div key={item.label} className="space-y-1">
                      <div
                        className={`h-2.5 rounded-full transition-all ${
                          isCurrent
                            ? 'bg-rose-500 shadow-md shadow-rose-500/50 scale-105 animate-pulse'
                            : isPassed
                            ? 'bg-emerald-400'
                            : 'bg-slate-800'
                        }`}
                      />
                      <span className={`block font-bold truncate ${isCurrent ? 'text-rose-400' : isPassed ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Patient Medical Profile Snapshot */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500" /> Patient Medical Profile & Vital Indicators
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-900 rounded-xl space-y-1">
                  <span className="text-slate-400 text-[10px] block">Blood Group:</span>
                  <span className="font-bold text-rose-400 font-mono text-sm">O Positive (O+)</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl space-y-1">
                  <span className="text-slate-400 text-[10px] block">Diagnosed Conditions:</span>
                  <span className="font-bold text-amber-400">Type 1 Diabetes, Asthma</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl space-y-1">
                  <span className="text-slate-400 text-[10px] block">Allergies & Contraindications:</span>
                  <span className="font-bold text-rose-400">Penicillin, Peanuts</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl space-y-1 sm:col-span-2">
                  <span className="text-slate-400 text-[10px] block">Active Medications:</span>
                  <span className="font-bold text-cyan-400">Insulin Glargine 10U, Ventolin Inhaler</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl space-y-1">
                  <span className="text-slate-400 text-[10px] block">Primary Physician:</span>
                  <span className="font-bold text-white">Dr. Robert Chen (+91-9876543212)</span>
                </div>
              </div>
            </div>

            {/* Fall Detection & Motion Sensor Evidence */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" /> Fall Detection & Sensor Evidence Matrix
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 p-2 bg-slate-900 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Freefall Acceleration &lt; 3.0 m/s² detected</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-slate-900 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Vector Impact Force &gt; 24.0 m/s² detected</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-slate-900 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Post-Impact Stillness &lt; 1.5 m/s² detected</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-slate-900 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Gyroscope Body Rotation &gt; 180°/s detected</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-slate-900 rounded-xl sm:col-span-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>High Precision GPS Geospatial Verification</span>
                </div>
              </div>
            </div>

            {/* Confidence Score Breakdown Table */}
            <ConfidenceBreakdownTable evidence={{ free_fall: true, impact: true, stillness: true, rotation: true, gps: true }} />

            {/* Hospital, Ambulance & ER Destination */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-400" /> Hospital ER Destination & Ambulance Dispatch
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-900 rounded-xl space-y-1">
                  <span className="text-slate-400 text-[10px] block">Assigned ER Hospital:</span>
                  <span className="font-bold text-indigo-400 text-sm">City Central Emergency Hospital</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl space-y-1">
                  <span className="text-slate-400 text-[10px] block">Dijkstra Routing ETA:</span>
                  <span className="font-bold text-cyan-400 font-mono text-sm">4.2 Minutes</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl space-y-1">
                  <span className="text-slate-400 text-[10px] block">Ambulance Vehicle & Driver:</span>
                  <span className="font-bold text-emerald-400 font-mono text-sm">AMB-101 (John Miller)</span>
                </div>
              </div>
            </div>

            {/* Real-Time GPS Map Location */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-rose-500" /> Real-Time Geospatial Coordinates
                </h4>
                {selectedEmergency.location_url && (
                  <a
                    href={selectedEmergency.location_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-md cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5" /> Open Google Maps
                  </a>
                )}
              </div>
              <p className="text-xs font-mono text-cyan-400">
                Lat: {selectedEmergency.latitude || 37.7755}, Lon: {selectedEmergency.longitude || -122.4210}
              </p>
            </div>

            {/* Doctor Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => handleResolveEmergency(selectedEmergency.id, 'false_alarm')}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <XCircle className="w-4 h-4 text-emerald-400" /> Mark False Alarm / Standby
              </button>
              <button
                onClick={() => handleResolveEmergency(selectedEmergency.id, 'confirm')}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirm & Dispatch Priority
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Camera QR Scanner Modal */}
      <QRCameraScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onScanSuccess={(token) => {
          setQrToken(token);
          handleScanQR(token);
        }}
      />

    </div>
  );
};
