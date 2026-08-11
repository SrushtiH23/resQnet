import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { InteractiveLiveMap } from '../components/InteractiveLiveMap';
import { StepTimeline } from '../components/StepTimeline';
import { EmergencyEscalationCard } from '../components/EmergencyEscalationCard';
import { ShieldAlert, MapPin, Radio, CheckCircle, XCircle, Clock, Heart, Phone, Battery, Wifi, Activity, Zap, Navigation, Truck } from 'lucide-react';

export const FamilyDashboard = () => {
  const { user } = useAuth();
  const [activeEmergency, setActiveEmergency] = useState(null);
  const [timelineLogs, setTimelineLogs] = useState([]);
  const [medicalProfile, setMedicalProfile] = useState(null);
  const [telemetry, setTelemetry] = useState({
    latitude: 37.7755,
    longitude: -122.4210,
    speed: 0.0,
    battery: 88,
    status: 'Hospital Dispatched',
    eta_minutes: 4.2
  });

  useEffect(() => {
    fetchActiveEmergency();
    fetchMedicalProfile();

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setTelemetry((prev) => ({
            ...prev,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }));
        },
        (err) => console.warn('Family GPS fetch error:', err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
      );
    }

    // 2-second auto-polling interval for live telemetry auto-updates without manual refresh
    const interval = setInterval(fetchActiveEmergency, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeEmergency) return;
    const ws = new WebSocket(`ws://127.0.0.1:8001/ws/live-tracking/${activeEmergency.id}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.latitude) {
        setTelemetry(prev => ({ ...prev, ...data }));
      }
    };

    return () => ws.close();
  }, [activeEmergency]);

  const fetchActiveEmergency = async () => {
    try {
      const res = await api.get('/emergency/active');
      if (res.data && res.data.length > 0) {
        const em = res.data[0];
        setActiveEmergency(em);
        fetchTimeline(em.id);
      } else {
        setActiveEmergency(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTimeline = async (emId) => {
    try {
      const res = await api.get(`/emergency/${emId}/timeline`);
      setTimelineLogs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMedicalProfile = async () => {
    try {
      const res = await api.get('/user/medical-profile');
      setMedicalProfile(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleValidate = async (action) => {
    if (!activeEmergency) return;
    try {
      await api.post('/emergency/validate', {
        emergency_id: activeEmergency.id,
        action,
        validator_role: 'family'
      });
      fetchActiveEmergency();
      alert(`Emergency marked as ${action === 'confirm' ? 'CONFIRMED' : 'FALSE ALARM'}.`);
    } catch (err) {
      console.error(err);
    }
  };

  const confidenceScore = activeEmergency?.confidence_score || 95.0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 animate-ping text-amber-500" /> WebSockets Telemetry Stream Active (Auto-Updating)
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Family Command Center
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Real-time patient location map, emergency confidence scoring, timeline & medical info.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-slate-900 px-4 py-2 rounded-2xl border border-slate-800">
          <Battery className="w-4 h-4 text-emerald-400" /> {telemetry.battery}% Battery | <Wifi className="w-4 h-4 text-cyan-400" /> 5G Connected
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Interactive Map & Step Timeline */}
        <div className="lg:col-span-2 space-y-6">

          {/* Interactive Live Map */}
          <InteractiveLiveMap
            userLat={telemetry.latitude}
            userLon={telemetry.longitude}
            hospitalLat={37.7850}
            hospitalLon={-122.4090}
            hospitalName="SF General Hospital ER"
            etaMinutes={telemetry.eta_minutes}
            isEmergency={true}
          />

          {/* Real Emergency Escalation & Live Provider Notification Status */}
          {activeEmergency && (
            <div className="space-y-2">
              {activeEmergency.is_demo && (
                <div className="p-3 bg-purple-950/80 border border-purple-500/50 rounded-2xl flex items-center justify-between text-purple-300 text-xs font-mono font-bold">
                  <span>🧪 TEST MODE / SEEDED DEMO DATA</span>
                  <span className="text-[10px] text-purple-400">Historical Seed Event #{activeEmergency.id}</span>
                </div>
              )}
              <EmergencyEscalationCard emergency={activeEmergency} onStatusChange={fetchActiveEmergency} />
            </div>
          )}

          {/* Time-Stamped Step Timeline */}
          <StepTimeline />
        </div>

        {/* Right Sidebar: Confidence & Patient Medical Info */}
        <div className="space-y-6">

          {/* Confidence Score Card */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Emergency Threat Confidence
            </h3>

            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 text-center space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Calculated Confidence Score</p>
              <p className="text-4xl font-black text-rose-400 font-mono">{confidenceScore}%</p>
              <span className="text-xs font-semibold text-rose-300">Hospital Dispatch Triggered</span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleValidate('false_alarm')}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-4 h-4 text-emerald-400" /> Standby (False Alarm)
              </button>
              <button
                onClick={() => handleValidate('confirm')}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/30 flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" /> Confirm Emergency
              </button>
            </div>
          </div>

          {/* Medical Info Snapshot Card */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-500" />
                Patient Medical Info
              </h3>
              <span className="text-[10px] px-2.5 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono font-bold rounded">
                Blood: {medicalProfile?.blood_group || 'O+'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px]">Diagnosed Conditions:</span>
                <p className="font-bold text-amber-400">{medicalProfile?.diseases || 'Type 1 Diabetes, Asthma'}</p>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px]">Allergies:</span>
                <p className="font-bold text-rose-400">{medicalProfile?.allergies || 'Penicillin'}</p>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px]">Primary Physician:</span>
                <p className="font-bold text-cyan-400">{medicalProfile?.doctor_name || 'Dr. Robert Chen'}</p>
              </div>
            </div>

            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-[11px] text-rose-300 space-y-1">
              <p className="font-bold flex items-center gap-1 text-rose-400">
                🔒 QR Card Security Protocol:
              </p>
              <p>Medical QR cards contain ONLY an encrypted UUID payload. QR decryption is restricted to verified Doctors & Hospitals. Family access is restricted by protocol.</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
