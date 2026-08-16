import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  AlertTriangle, ShieldCheck, Stethoscope, Building2, User, Heart,
  MapPin, Phone, Clock, Flame, ShieldAlert, Activity, CheckCircle2,
  XCircle, Navigation, ExternalLink, Zap, ArrowLeft
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export const QRPatientResultPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState(null); // null | 404 | 410 | 'NETWORK'
  const [errorMessage, setErrorMessage] = useState('');
  const [qrData, setQrData] = useState(null);

  const [actionNotice, setActionNotice] = useState(null);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyResult, setNotifyResult] = useState(null);

  useEffect(() => {
    fetchQRDetails();
  }, [token]);

  const fetchQRDetails = async () => {
    setLoading(true);
    setErrorStatus(null);
    setErrorMessage('');

    try {
      const res = await api.get(`/qr/${token}`);
      setQrData(res.data);
    } catch (err) {
      console.warn('QR Detail fetch notice:', err);
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 410) {
        setErrorStatus(410);
        setErrorMessage('This QR code is no longer active.');
      } else if (status === 404) {
        setErrorStatus(404);
        setErrorMessage(detail || 'Invalid ResQNet QR code.');
      } else {
        setErrorStatus('NETWORK');
        setErrorMessage(detail || 'Unable to retrieve emergency information. Please check your network connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBystanderRequestHelp = async () => {
    try {
      setActionNotice('Dispatching emergency SOS alert to hospital dispatch & family...');
      await api.post('/emergency/create', {
        trigger_source: 'Bystander QR Scan Alert',
        latitude: qrData?.active_emergency?.latitude || 37.7749,
        longitude: qrData?.active_emergency?.longitude || -122.4194,
        speed: 0.0,
        battery_level: 90,
        network_status: '5G'
      });
      setActionNotice('🚨 Emergency alert dispatched! Nearby responders and family contacts have been notified.');
      fetchQRDetails();
    } catch (err) {
      alert('Failed to dispatch emergency help notice.');
      setActionNotice(null);
    }
  };

  const handleBystanderNotifyFamily = async () => {
    setNotifyLoading(true);
    setNotifyResult(null);
    try {
      const res = await api.post('/qr/notify-family', { token });
      setNotifyResult(res.data);
    } catch (err) {
      console.error('Notify family error:', err);
      const detail = err.response?.data?.detail || err.response?.data?.message || 'Failed to connect to notification server.';
      setNotifyResult({
        success: false,
        status: 'FAILED',
        message: detail,
        results: []
      });
    } finally {
      setNotifyLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full border-4 border-cyan-500/30 border-t-cyan-500 animate-spin" />
        <p className="text-sm font-bold text-slate-300">Decrypting & Verifying ResQNet QR Token...</p>
      </div>
    );
  }

  if (errorStatus) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6 animate-fade-in">
        <div className="glass-panel p-8 rounded-3xl border-2 border-rose-500/50 bg-rose-950/40 space-y-4 shadow-2xl">
          <div className="mx-auto w-16 h-16 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/40 flex items-center justify-center">
            <XCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-white">QR Inspection Notice</h2>
          <p className="text-sm text-rose-200 font-semibold">{errorMessage}</p>

          {errorStatus === 410 && (
            <p className="text-xs text-slate-400">
              The patient has regenerated their QR code. This older physical QR card is revoked for security.
            </p>
          )}

          <div className="pt-4 flex justify-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Return Home
            </button>
            <button
              onClick={() => navigate('/qr-scanner')}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              Scan Another QR
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isDoctor = qrData.access_level === 'doctor';
  const isHospital = qrData.access_level === 'hospital';
  const isBystander = qrData.access_level === 'bystander';

  const activeEmergency = qrData.active_emergency;
  const hasActiveEmergency = qrData.has_active_emergency && activeEmergency;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* Top Navigation & Role Badge */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-800 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 text-xs font-extrabold rounded-full uppercase tracking-wider border ${
            isDoctor
              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
              : isHospital
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          }`}>
            ACCESS LEVEL: {qrData.access_level.toUpperCase()} SCANNER
          </span>
        </div>
      </div>

      {/* 🚨 PROMINENT ACTIVE EMERGENCY BANNER */}
      {hasActiveEmergency ? (
        <div className="glass-panel p-6 md:p-8 rounded-3xl border-2 border-rose-500 bg-rose-950/80 text-rose-100 space-y-6 shadow-2xl animate-pulse">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-rose-500/40 pb-4">
            <div className="space-y-1">
              <span className="px-3 py-1 rounded-full bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest inline-block">
                🚨 CRITICAL ACTIVE EMERGENCY
              </span>
              <h2 className="text-2xl md:text-4xl font-black text-white">
                Emergency ID #{activeEmergency.emergency_id}
              </h2>
              <p className="text-xs text-rose-200 font-mono">
                Trigger Source: <strong className="text-white uppercase">{activeEmergency.trigger_source}</strong> | Status: <strong className="text-amber-300">{activeEmergency.status}</strong>
              </p>
            </div>

            <div className="p-4 bg-slate-900/90 rounded-2xl border border-rose-400/50 text-center font-mono space-y-0.5">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block">Threat Confidence</span>
              <span className="text-3xl font-black text-white">{activeEmergency.confidence_score}%</span>
            </div>
          </div>

          {/* REAL SENSOR EVIDENCE MATRIX */}
          {activeEmergency.sensor_evidence && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-rose-200 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-cyan-400" /> Real Hardware Motion Evidence Matrix:
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className={`p-3 rounded-xl border ${activeEmergency.sensor_evidence.free_fall ? 'bg-rose-900/90 border-rose-400 text-white' : 'bg-slate-900/70 border-slate-800 text-slate-400'}`}>
                  <span className="block text-[10px]">Free Fall (&lt; 3.0 m/s²):</span>
                  <strong className={activeEmergency.sensor_evidence.free_fall ? 'text-amber-300' : 'text-slate-500'}>
                    {activeEmergency.sensor_evidence.free_fall ? 'DETECTED ✓' : 'NO'}
                  </strong>
                </div>

                <div className={`p-3 rounded-xl border ${activeEmergency.sensor_evidence.impact ? 'bg-rose-900/90 border-rose-400 text-white' : 'bg-slate-900/70 border-slate-800 text-slate-400'}`}>
                  <span className="block text-[10px]">High Impact (&gt; 24 m/s²):</span>
                  <strong className={activeEmergency.sensor_evidence.impact ? 'text-rose-300' : 'text-slate-500'}>
                    {activeEmergency.sensor_evidence.impact ? 'DETECTED ✓' : 'NO'}
                  </strong>
                </div>

                <div className={`p-3 rounded-xl border ${activeEmergency.sensor_evidence.stillness ? 'bg-rose-900/90 border-rose-400 text-white' : 'bg-slate-900/70 border-slate-800 text-slate-400'}`}>
                  <span className="block text-[10px]">Post-Impact Stillness:</span>
                  <strong className={activeEmergency.sensor_evidence.stillness ? 'text-emerald-300' : 'text-slate-500'}>
                    {activeEmergency.sensor_evidence.stillness ? 'DETECTED ✓' : 'NO'}
                  </strong>
                </div>

                <div className={`p-3 rounded-xl border ${activeEmergency.sensor_evidence.rotation ? 'bg-rose-900/90 border-rose-400 text-white' : 'bg-slate-900/70 border-slate-800 text-slate-400'}`}>
                  <span className="block text-[10px]">Orientation Change:</span>
                  <strong className={activeEmergency.sensor_evidence.rotation ? 'text-purple-300' : 'text-slate-500'}>
                    {activeEmergency.sensor_evidence.rotation ? 'DETECTED ✓' : 'NO'}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Location Callout */}
          {activeEmergency.location_url && (
            <div className="flex items-center justify-between flex-wrap gap-2 p-3.5 bg-slate-950/80 rounded-2xl border border-rose-500/40 text-xs font-mono">
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-400" />
                Live GPS Location: ({activeEmergency.latitude?.toFixed(4)}, {activeEmergency.longitude?.toFixed(4)})
              </span>
              <a
                href={activeEmergency.location_url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl flex items-center gap-1 cursor-pointer"
              >
                Open Google Maps <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <span className="flex items-center gap-2 font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Patient Status: SAFE (No Active Emergencies)
          </span>
          <span className="font-mono text-slate-400 text-[11px]">Verified Server Token</span>
        </div>
      )}

      {/* Action Notification Callout */}
      {actionNotice && (
        <div className="p-4 bg-emerald-950 border border-emerald-500/40 rounded-2xl text-emerald-200 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Real Emergency Notification Results Banner */}
      {notifyResult && (
        <div className={`p-4 rounded-2xl border text-xs font-medium space-y-3 shadow-xl transition-all ${
          notifyResult.status === 'SENT'
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100'
            : notifyResult.status === 'PARTIAL'
            ? 'bg-amber-950/90 border-amber-500/50 text-amber-100'
            : 'bg-rose-950/90 border-rose-500/50 text-rose-100'
        }`}>
          <div className="flex items-center justify-between font-extrabold text-sm border-b border-white/10 pb-2">
            <span className="flex items-center gap-2">
              {notifyResult.status === 'SENT' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {notifyResult.status === 'PARTIAL' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
              {notifyResult.status === 'FAILED' && <XCircle className="w-5 h-5 text-rose-400" />}
              {notifyResult.status === 'SENT'
                ? '✓ Notification Sent Successfully'
                : notifyResult.status === 'PARTIAL'
                ? '⚠️ Partial Notification Delivery'
                : '✕ Notification Failed'}
            </span>
            <button
              onClick={() => setNotifyResult(null)}
              className="text-slate-400 hover:text-white font-bold text-xs"
            >
              ✕
            </button>
          </div>

          <p className="leading-relaxed">{notifyResult.message}</p>

          {notifyResult.results && notifyResult.results.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/10 text-xs font-mono">
              <span className="text-[10px] text-slate-300 uppercase font-bold tracking-wider block">
                Detailed Emergency Contact Status:
              </span>
              <div className="space-y-1.5">
                {notifyResult.results.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-white/5 flex-wrap gap-2">
                    <div>
                      <span className="font-bold text-white">{c.contact_name}</span>
                      <span className="text-slate-400 text-[11px]"> ({c.relationship}) • </span>
                      <span className="text-cyan-300 font-bold">{c.phone}</span>
                    </div>

                    <span className={`font-bold px-2.5 py-0.5 rounded text-[11px] ${
                      c.status === 'SENT' || c.status === 'DELIVERED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {c.status === 'SENT' || c.status === 'DELIVERED'
                        ? `SENT ✓ (${c.message_id ? `ID: ${c.message_id.slice(0, 14)}` : 'OK'})`
                        : `FAILED ✕ (${c.error || 'Provider error'})`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* 5. BYSTANDER / PUBLIC SCANNER VIEW */}
      {/* ========================================== */}
      {isBystander && (
        <div className="glass-panel p-6 md:p-8 rounded-3xl border border-slate-800 space-y-6 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">Bystander Minimal View</span>
              <h2 className="text-xl md:text-2xl font-black text-white">Emergency Patient Profile</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Patient Name</span>
              <p className="text-lg font-black text-white">{qrData.patient_name}</p>
            </div>

            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Blood Group</span>
              <p className="text-lg font-black text-rose-400">{qrData.blood_group}</p>
            </div>

            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Critical Allergies</span>
              <p className="text-sm font-bold text-amber-300">{qrData.critical_allergies}</p>
            </div>

            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Critical Medical Conditions</span>
              <p className="text-sm font-bold text-cyan-300">{qrData.critical_medical_conditions}</p>
            </div>
          </div>

          {/* Bystander Emergency Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
            <button
              onClick={handleBystanderRequestHelp}
              className="py-4 px-5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-2xl text-xs md:text-sm border border-rose-400/50 shadow-xl shadow-rose-950/60 transition-all hover:scale-105 uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
            >
              <Flame className="w-5 h-5 text-rose-200 animate-pulse" />
              Request Emergency Help
            </button>

            <button
              onClick={handleBystanderNotifyFamily}
              disabled={notifyLoading}
              className="py-4 px-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-2xl text-xs md:text-sm border border-emerald-400/50 shadow-xl shadow-emerald-950/60 transition-all hover:scale-105 uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
            >
              {notifyLoading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Sending notification...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 text-emerald-200" />
                  Notify Family
                </>
              )}
            </button>
          </div>

          <p className="text-[10px] text-slate-500 italic text-center">
            🔒 Privacy Protocol: Personal address, phone numbers, and full medication logs are restricted to authorized Doctor & Hospital accounts.
          </p>
        </div>
      )}

      {/* ========================================== */}
      {/* 6. DOCTOR SCANNER VIEW */}
      {/* ========================================== */}
      {isDoctor && (
        <div className="glass-panel p-6 md:p-8 rounded-3xl border border-slate-800 space-y-6 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="p-3 bg-purple-500/20 text-purple-400 rounded-2xl border border-purple-500/30">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block">Doctor Verified Profile</span>
              <h2 className="text-xl md:text-2xl font-black text-white">{qrData.patient_name}</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Age & Blood Group</span>
              <p className="text-base font-black text-white">{qrData.age ? `${qrData.age} yrs` : 'N/A'} | <span className="text-rose-400">{qrData.blood_group}</span></p>
            </div>

            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Primary Physician</span>
              <p className="text-sm font-bold text-cyan-300">{qrData.primary_doctor?.name} ({qrData.primary_doctor?.phone})</p>
            </div>

            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Emergency Incident History</span>
              <p className="text-base font-black text-amber-300">{qrData.emergency_history_count} total records</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Known Allergies</span>
              <p className="text-xs font-bold text-amber-300 leading-relaxed">{qrData.allergies}</p>
            </div>

            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Diagnosed Conditions</span>
              <p className="text-xs font-bold text-cyan-300 leading-relaxed">{qrData.medical_conditions}</p>
            </div>

            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Current Medications</span>
              <p className="text-xs font-bold text-emerald-300 leading-relaxed">{qrData.current_medications}</p>
            </div>
          </div>

          {/* Emergency Contacts List */}
          {qrData.emergency_contacts && qrData.emergency_contacts.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Emergency Contact List:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {qrData.emergency_contacts.map((c, idx) => (
                  <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">{c.name} ({c.relationship})</p>
                      <p className="text-slate-400 text-[11px] font-mono">{c.phone}</p>
                    </div>
                    <a href={`tel:${c.phone}`} className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg border border-emerald-500/40">
                      <Phone className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* 7. HOSPITAL SCANNER VIEW */}
      {/* ========================================== */}
      {isHospital && (
        <div className="glass-panel p-6 md:p-8 rounded-3xl border border-slate-800 space-y-6 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-2xl border border-cyan-500/30">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest block">Hospital ER Triage Profile</span>
              <h2 className="text-xl md:text-2xl font-black text-white">{qrData.patient_name}</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Age / Blood Group</span>
              <p className="text-base font-black text-white">{qrData.age ? `${qrData.age} yrs` : 'N/A'} | <span className="text-rose-400">{qrData.blood_group}</span></p>
            </div>

            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Allergies & Alerts</span>
              <p className="text-xs font-bold text-amber-300 truncate">{qrData.allergies}</p>
            </div>

            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Current Medications</span>
              <p className="text-xs font-bold text-cyan-300 truncate">{qrData.current_medications}</p>
            </div>
          </div>

          {hasActiveEmergency && (
            <div className="p-4 bg-slate-950 rounded-2xl border border-cyan-500/30 space-y-2 text-xs">
              <h4 className="font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-cyan-400" /> ER Ambulance Allocation Status
              </h4>
              <p className="text-slate-300 font-mono">
                Ambulance Status: <strong className="text-emerald-400">{activeEmergency.ambulance_status}</strong>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
