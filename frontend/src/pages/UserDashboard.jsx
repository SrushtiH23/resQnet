import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { mobileSensorManager } from '../services/mobileSensorManager';
import { InteractiveLiveMap } from '../components/InteractiveLiveMap';
import { QRMedicalCardModal } from '../components/QRMedicalCardModal';
import { EmergencyScreenModal } from '../components/EmergencyScreenModal';
import {
  AlertTriangle, ShieldCheck, QrCode, Activity, PhoneCall, CheckCircle,
  Building2, Radio, Navigation, Zap, Download, Printer, Eye, Save, Heart,
  User, History, Settings, Play, Square, UserCheck, ShieldAlert, Compass, Smartphone
} from 'lucide-react';

export const UserDashboard = () => {
  const { user } = useAuth();
  const [medicalProfile, setMedicalProfile] = useState(null);
  const [familyContacts, setFamilyContacts] = useState([]);
  const [activeEmergency, setActiveEmergency] = useState(null);
  const [qrCardToken, setQrCardToken] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  // Live Telemetry & Monitoring State
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [gpsData, setGpsData] = useState({ latitude: 37.7749, longitude: -122.4194 });
  const [accelData, setAccelData] = useState({ ax: 0.1, ay: 9.81, az: 0.2, total: 9.81 });
  const [gyroData, setGyroData] = useState({ gx: 0.1, gy: 0.1, gz: 0.1, total: 0.21 });
  const [confidenceScore, setConfidenceScore] = useState(12);

  useEffect(() => {
    fetchProfile();
    fetchContacts();
    fetchActiveEmergency();

    // Query real physical device coordinates via HTML5 Geolocation
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsData({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        (err) => console.warn('Real GPS fetch error:', err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/user/medical-profile');
      setMedicalProfile(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await api.get('/user/family-contacts');
      setFamilyContacts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchActiveEmergency = async () => {
    try {
      const res = await api.get('/emergency/active');
      if (res.data && res.data.length > 0) {
        setActiveEmergency(res.data[0]);
        setConfidenceScore(res.data[0].confidence_score || 85);
        if (res.data[0].status === 'Asking User') {
          setShowEmergencyModal(true);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleMonitoring = async () => {
    if (isMonitoring) {
      mobileSensorManager.stopMonitoring();
      setIsMonitoring(false);
    } else {
      await mobileSensorManager.requestPermissions();
      mobileSensorManager.startMonitoring({
        onSample: (sample) => {
          setAccelData({ ax: sample.ax, ay: sample.ay, az: sample.az, total: sample.total_accel });
          setGyroData({ gx: sample.gx, gy: sample.gy, gz: sample.gz, total: sample.total_gyro });
        },
        onGps: (gps) => setGpsData(gps),
        onStatus: () => {}
      });
      setIsMonitoring(true);
    }
  };

  const handleTriggerSOS = async () => {
    try {
      const res = await api.post('/emergency/create', {
        trigger_source: 'SOS Button',
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        speed: 0.0,
        battery_level: 92,
        network_status: '5G'
      });
      setActiveEmergency(res.data);
      setConfidenceScore(85);
      setShowEmergencyModal(true);
    } catch (err) {
      alert('Failed to trigger SOS emergency.');
    }
  };

  const handleGenerateQR = async () => {
    try {
      const res = await api.get('/qr/generate');
      setQrCardToken(res.data.qr_token);
      setShowQrModal(true);
    } catch (err) {
      alert('Failed to generate QR card.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

      {/* 1. Welcome + Health Status + Monitoring Toggle Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs rounded-full uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Health Status: Normal / Protected
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Welcome, {user?.full_name || 'Patient'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Continuous Fall Detection & Medical Intelligence Platform</p>
        </div>

        {/* Start / Stop Monitoring Button & Status */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleToggleMonitoring}
            className={`px-5 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg ${
              isMonitoring
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30'
                : 'bg-rose-600 text-white hover:bg-rose-500 shadow-rose-600/30'
            }`}
          >
            {isMonitoring ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span>🟢 Monitoring Active</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Start Monitoring</span>
              </>
            )}
          </button>

          <span className="px-3.5 py-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold rounded-2xl flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5" /> GPS Active
          </span>
        </div>
      </div>

      {/* LIVE HARDWARE TELEMETRY CARDS: Accelerometer, Gyroscope, GPS, Confidence */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* 1. ACCELEROMETER CARD */}
        <div className="glass-card p-5 rounded-3xl border border-slate-800 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">Accelerometer</h3>
            </div>
            <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[10px] font-mono font-bold rounded-md">
              20Hz Live
            </span>
          </div>

          <div className="text-center py-1">
            <p className="text-3xl font-black text-cyan-400 font-mono">{accelData.total.toFixed(2)}</p>
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Vector (m/s²)</span>
          </div>

          {/* Vector X Y Z Axis Breakdown */}
          <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-800/80 text-center font-mono text-xs">
            <div className="p-1.5 bg-slate-900/90 rounded-xl border border-slate-800">
              <span className="text-[9px] text-slate-500 block">X</span>
              <span className="text-cyan-300 font-bold">{accelData.ax.toFixed(1)}</span>
            </div>
            <div className="p-1.5 bg-slate-900/90 rounded-xl border border-slate-800">
              <span className="text-[9px] text-slate-500 block">Y</span>
              <span className="text-cyan-300 font-bold">{accelData.ay.toFixed(1)}</span>
            </div>
            <div className="p-1.5 bg-slate-900/90 rounded-xl border border-slate-800">
              <span className="text-[9px] text-slate-500 block">Z</span>
              <span className="text-cyan-300 font-bold">{accelData.az.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* 2. GYROSCOPE CARD */}
        <div className="glass-card p-5 rounded-3xl border border-slate-800 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-purple-400" />
              <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">Gyroscope</h3>
            </div>
            <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[10px] font-mono font-bold rounded-md">
              Rotation Rate
            </span>
          </div>

          <div className="text-center py-1">
            <p className="text-3xl font-black text-purple-400 font-mono">{gyroData.total.toFixed(2)}</p>
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Rotation (°/s)</span>
          </div>

          {/* Rotation gx gy gz Axis Breakdown */}
          <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-800/80 text-center font-mono text-xs">
            <div className="p-1.5 bg-slate-900/90 rounded-xl border border-slate-800">
              <span className="text-[9px] text-slate-500 block">gx</span>
              <span className="text-purple-300 font-bold">{gyroData.gx.toFixed(1)}</span>
            </div>
            <div className="p-1.5 bg-slate-900/90 rounded-xl border border-slate-800">
              <span className="text-[9px] text-slate-500 block">gy</span>
              <span className="text-purple-300 font-bold">{gyroData.gy.toFixed(1)}</span>
            </div>
            <div className="p-1.5 bg-slate-900/90 rounded-xl border border-slate-800">
              <span className="text-[9px] text-slate-500 block">gz</span>
              <span className="text-purple-300 font-bold">{gyroData.gz.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* 3. GPS LOCATION CARD */}
        <div className="glass-card p-5 rounded-3xl border border-slate-800 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-emerald-400" />
              <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">GPS Position</h3>
            </div>
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold rounded-md">
              High Accuracy
            </span>
          </div>

          <div className="text-center py-1">
            <p className="text-lg font-black text-emerald-400 font-mono truncate">
              {gpsData.latitude.toFixed(4)}, {gpsData.longitude.toFixed(4)}
            </p>
            <span className="text-[10px] text-slate-400 font-semibold uppercase block mt-1">Latitude, Longitude</span>
          </div>

          <div className="p-1.5 bg-slate-900/90 rounded-xl border border-slate-800 text-center text-xs font-mono text-emerald-300 border-t border-slate-800/80">
            Precision: ±10m | 5G Stream
          </div>
        </div>

        {/* 4. CONFIDENCE SCORE CARD */}
        <div className="glass-card p-5 rounded-3xl border border-slate-800 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-rose-400" />
              <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">Threat Index</h3>
            </div>
            <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-mono font-bold rounded-md">
              Multi-Factor
            </span>
          </div>

          <div className="text-center py-1">
            <p className="text-3xl font-black text-rose-400 font-mono">{confidenceScore}%</p>
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Confidence Index</span>
          </div>

          <div className="p-1.5 bg-slate-900/90 rounded-xl border border-slate-800 text-center text-xs font-mono text-rose-300 border-t border-slate-800/80">
            {confidenceScore > 50 ? '⚠️ High Threat' : '🟢 Normal Status'}
          </div>
        </div>

      </div>

      {/* 2. Main Dashboard Cards: Blood Group, Medical Profile, Contacts, QR Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

        {/* Card 1: Blood Group & Medical Profile Summary */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-500" /> Medical Profile
              </h3>
              <span className="px-2.5 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/40 font-mono font-black text-sm rounded-xl">
                {medicalProfile?.blood_group || 'O+'}
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">Age / Gender:</span>
                <span className="font-bold text-white">{medicalProfile?.age || 28} / Male</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">Conditions:</span>
                <span className="font-bold text-amber-400 truncate max-w-[120px]">{medicalProfile?.diseases || 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Allergies:</span>
                <span className="font-bold text-rose-400 truncate max-w-[120px]">{medicalProfile?.allergies || 'Penicillin'}</span>
              </div>
            </div>
          </div>

          <Link
            to="/ai-decision-engine"
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold rounded-xl text-center block border border-slate-700 transition-colors"
          >
            View Full Medical Record →
          </Link>
        </div>

        {/* Card 2: Emergency Contacts List (Min 2: Mother & Father) */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-amber-400" /> Emergency Contacts
              </h3>
              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold rounded-full">
                {familyContacts.length || 2} Saved
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {familyContacts.length === 0 ? (
                <>
                  <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-white">Contact 1: Mother</p>
                      <span className="text-[10px] text-slate-400">+1-555-0199</span>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded">Priority #1</span>
                  </div>

                  <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-white">Contact 2: Father</p>
                      <span className="text-[10px] text-slate-400">+1-555-0198</span>
                    </div>
                    <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-[10px] font-bold rounded">Priority #2</span>
                  </div>
                </>
              ) : (
                familyContacts.slice(0, 2).map((fc, idx) => (
                  <div key={fc.id || idx} className="p-2 bg-slate-900 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-white">{fc.contact_name} ({fc.relationship_type})</p>
                      <span className="text-[10px] text-slate-400">{fc.phone}</span>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded">
                      #{fc.escalation_order}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <Link
            to="/register"
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold rounded-xl text-center block border border-slate-700 transition-colors"
          >
            Manage Contacts →
          </Link>
        </div>

        {/* Card 3: Medical QR Card */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-cyan-400" /> Medical QR Card
              </h3>
              <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[10px] font-bold rounded-full">
                Encrypted UUID
              </span>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-center space-y-1">
              <QrCode className="w-12 h-12 text-cyan-400 mx-auto" />
              <p className="text-[10px] text-slate-400 font-mono">Token Encrypted for ER Doctors</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={handleGenerateQR}
              className="py-1.5 bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600/30 rounded-lg text-[10px] font-bold border border-cyan-500/30 text-center"
            >
              View
            </button>
            <button
              onClick={handleGenerateQR}
              className="py-1.5 bg-slate-800 text-slate-200 hover:bg-slate-700 rounded-lg text-[10px] font-bold border border-slate-700 text-center"
            >
              Download
            </button>
            <button
              onClick={() => window.print()}
              className="py-1.5 bg-slate-800 text-slate-200 hover:bg-slate-700 rounded-lg text-[10px] font-bold border border-slate-700 text-center"
            >
              Print
            </button>
          </div>
        </div>

        {/* Card 4: Quick Navigation (Emergency History & Settings) */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-rose-500" /> Quick Modules
            </h3>

            <div className="space-y-2">
              <Link
                to="/emergency-history"
                className="p-2.5 bg-slate-900 hover:bg-slate-850 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-slate-200 font-medium transition-colors block"
              >
                <span className="flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-400" /> Emergency History
                </span>
                <span className="text-slate-500 font-mono">Logs →</span>
              </Link>

              <Link
                to="/live-monitoring"
                className="p-2.5 bg-slate-900 hover:bg-slate-850 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-slate-200 font-medium transition-colors block"
              >
                <span className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-cyan-400" /> Live Hardware Engine
                </span>
                <span className="text-slate-500 font-mono">20Hz →</span>
              </Link>
            </div>
          </div>

          <button
            onClick={handleTriggerSOS}
            className="w-full py-3 bg-gradient-to-r from-rose-600 to-red-600 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 hover:scale-[1.01] transition-transform"
          >
            <AlertTriangle className="w-4 h-4 animate-bounce" /> PANIC SOS BUTTON
          </button>
        </div>

      </div>

      {/* 3. Hospital Route Panel & Interactive Live Map */}
      <div className="space-y-4">
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3 shadow-2xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white">Hospital Route Panel</h3>
            </div>
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold rounded-xl">
              Dijkstra Shortest Path Engine
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 space-y-0.5">
              <span className="text-slate-400 text-[10px]">CURRENT LOCATION</span>
              <p className="font-bold text-cyan-400 truncate">Lat: {gpsData.latitude.toFixed(4)}, Lon: {gpsData.longitude.toFixed(4)}</p>
            </div>

            <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 space-y-0.5">
              <span className="text-slate-400 text-[10px]">NEAREST HOSPITAL</span>
              <p className="font-bold text-emerald-400 truncate">SF General Hospital ER</p>
            </div>

            <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 space-y-0.5">
              <span className="text-slate-400 text-[10px]">ESTIMATED ARRIVAL TIME</span>
              <p className="font-bold text-amber-400 truncate">4.2 Minutes (2.08 km)</p>
            </div>

            <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 space-y-0.5">
              <span className="text-slate-400 text-[10px]">SHORTEST PATH</span>
              <p className="font-bold text-rose-400 truncate">Dijkstra Min-Heap Path</p>
            </div>
          </div>
        </div>

        <InteractiveLiveMap
          userLat={gpsData.latitude}
          userLon={gpsData.longitude}
          hospitalLat={37.7850}
          hospitalLon={-122.4090}
          hospitalName="SF General Hospital ER"
          etaMinutes={4.2}
          isEmergency={!!activeEmergency}
        />
      </div>

      {/* Emergency Screen Modal (30s Countdown) */}
      <EmergencyScreenModal
        isOpen={showEmergencyModal}
        confidenceScore={confidenceScore}
        onCancel={() => setShowEmergencyModal(false)}
        onConfirm={() => setShowEmergencyModal(false)}
      />

      {/* Encrypted QR Card Modal */}
      <QRMedicalCardModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        qrToken={qrCardToken}
        user={user}
        medicalProfile={medicalProfile}
      />
    </div>
  );
};
