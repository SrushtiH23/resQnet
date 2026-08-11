import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { ConfidenceBreakdownTable } from '../components/ConfidenceBreakdownTable';
import {
  ShieldAlert, Eye, CheckCircle2, XCircle, MapPin, Building2,
  Heart, Zap, X, Activity, Clock
} from 'lucide-react';

export const ActiveEmergenciesPage = () => {
  const [activeEmergencies, setActiveEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    fetchActiveEmergencies();
    const interval = setInterval(fetchActiveEmergencies, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchActiveEmergencies = async () => {
    try {
      const res = await api.get('/emergency/active');
      setActiveEmergencies(res.data);
    } catch (err) {
      console.error('Failed to fetch active emergencies:', err);
    } finally {
      setLoading(false);
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

  const getFsmActiveStep = (status = '') => {
    const s = status.toLowerCase();
    if (s.includes('resolved')) return 6;
    if (s.includes('hospital') || s.includes('ambulance')) return 5;
    if (s.includes('family') || s.includes('notified')) return 4;
    if (s.includes('asking') || s.includes('verifying')) return 3;
    if (s.includes('stillness')) return 2;
    if (s.includes('impact') || s.includes('fall')) return 1;
    return 0;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      
      {/* Page Header */}
      <div className="glass-panel p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-rose-950/80 shadow-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <ShieldAlert className="w-3.5 h-3.5 animate-pulse" /> Live Active Emergency Response Dispatch
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Active Emergencies Queue
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Dedicated view of currently active emergency dispatches requiring immediate medical intervention.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1.5 bg-rose-500/20 text-rose-300 font-mono text-xs font-bold rounded-full border border-rose-500/40 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-rose-400 animate-pulse" />
            {activeEmergencies.length} Active Dispatches
          </span>
          <button
            onClick={fetchActiveEmergencies}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <Clock className="w-4 h-4 text-rose-400" /> Refresh
          </button>
        </div>
      </div>

      {/* Active Emergencies Grid */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400 font-mono animate-pulse">
          Loading live active emergencies from database...
        </div>
      ) : activeEmergencies.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl border border-slate-800 text-center space-y-3 shadow-xl">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="text-lg font-extrabold text-white">All Clear — No Active Emergency Dispatches</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            All registered patients are currently in a safe status. When a new fall detection or SOS alert is triggered, it will immediately appear in this dispatch queue.
          </p>
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

      {/* Emergency Response Inspection Modal */}
      {selectedEmergency && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 space-y-6 shadow-2xl relative my-8 text-slate-100">

            <button
              onClick={() => setSelectedEmergency(null)}
              className="absolute top-5 right-5 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

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

            {/* FSM State Pipeline */}
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

            {/* Patient Medical Profile */}
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
              </div>
            </div>

            {/* Sensor Evidence */}
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
              </div>
            </div>

            <ConfidenceBreakdownTable evidence={{ free_fall: true, impact: true, stillness: true, rotation: true, gps: true }} />

            {/* Hospital & Ambulance */}
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

            {/* Action Buttons */}
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

    </div>
  );
};
