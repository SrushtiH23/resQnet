import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DashboardTriageChatbot } from '../components/DashboardTriageChatbot';
import { InteractiveLiveMap } from '../components/InteractiveLiveMap';
import { EmergencyEscalationCard } from '../components/EmergencyEscalationCard';
import {
  ShieldCheck, AlertTriangle, Radio, Navigation, Flame, CheckCircle,
  XCircle, Clock, ShieldAlert, Heart, Activity, MapPin, RefreshCw
} from 'lucide-react';

export const UserDashboard = () => {
  const { user } = useAuth();
  const [activeEmergency, setActiveEmergency] = useState(null);
  const [gpsData, setGpsData] = useState({
    latitude: null,
    longitude: null,
    accuracy: null,
    lastUpdated: null,
    available: false
  });

  // SOS Countdown Modal State
  const [showSosModal, setShowSosModal] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(5);
  const [sosTimerId, setSosTimerId] = useState(null);

  useEffect(() => {
    fetchActiveEmergency();
    const interval = setInterval(fetchActiveEmergency, 3000);
    return () => clearInterval(interval);
  }, []);

  // Real-Time Device Geolocation Tracking
  useEffect(() => {
    let watchId = null;
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newGps = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : 10,
            lastUpdated: new Date().toLocaleTimeString(),
            available: true
          };
          setGpsData(newGps);

          // If emergency is active, send updated coordinates to FastAPI backend
          if (activeEmergency?.id) {
            api.post('/emergency/location/update', {
              emergency_id: activeEmergency.id,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              timestamp: new Date().toISOString()
            }).catch((err) => console.warn('Failed to push location update:', err));
          }
        },
        (err) => {
          console.warn('Geolocation error:', err);
          setGpsData((prev) => ({ ...prev, available: false }));
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
      );
    }
    return () => {
      if (watchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [activeEmergency?.id]);

  // SOS Countdown Timer Effect
  useEffect(() => {
    let timer;
    if (showSosModal) {
      setSosCountdown(5);
      timer = setInterval(() => {
        setSosCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            executeRealSosTrigger();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      setSosTimerId(timer);
    } else if (sosTimerId) {
      clearInterval(sosTimerId);
    }
    return () => clearInterval(timer);
  }, [showSosModal]);

  const fetchActiveEmergency = async () => {
    try {
      const res = await api.get('/emergency/active');
      if (res.data && res.data.length > 0) {
        setActiveEmergency(res.data[0]);
      } else {
        setActiveEmergency(null);
      }
    } catch (err) {
      console.error('Error fetching active emergency:', err);
    }
  };

  const handleOpenSosModal = () => {
    setShowSosModal(true);
  };

  const handleCancelSos = () => {
    if (sosTimerId) clearInterval(sosTimerId);
    setShowSosModal(false);
  };

  const executeRealSosTrigger = async () => {
    if (sosTimerId) clearInterval(sosTimerId);
    setShowSosModal(false);

    try {
      const lat = gpsData.available ? gpsData.latitude : 0.0;
      const lon = gpsData.available ? gpsData.longitude : 0.0;

      const res = await api.post('/emergency/create', {
        trigger_source: 'MANUAL_SOS',
        latitude: lat,
        longitude: lon,
        speed: 0.0,
        battery_level: 92,
        network_status: '5G'
      });
      setActiveEmergency(res.data);
    } catch (err) {
      alert('Failed to trigger SOS emergency.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* 1. Welcome + Health Status Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`px-3.5 py-1 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 border ${
              activeEmergency
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${activeEmergency ? 'bg-rose-500 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
              {activeEmergency ? '🚨 EMERGENCY ACTIVE' : 'HEALTH STATUS: PROTECTED'}
            </span>
          </div>
          <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">
            Welcome, {user?.full_name?.split(' ')[0] || 'User'}
          </h1>
          <p className="text-sm font-medium text-slate-300 mt-1">
            ResQNet real-time emergency triage and response platform.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-4 py-2.5 rounded-2xl font-bold">
          <Navigation className="w-4 h-4 text-cyan-400" />
          {gpsData.available
            ? `GPS Active (${gpsData.latitude.toFixed(4)}, ${gpsData.longitude.toFixed(4)})`
            : 'LOCATION UNAVAILABLE'}
        </div>
      </div>

      {/* 2. DYNAMIC ACTIVE EMERGENCY PANEL (If Active Emergency Exists) */}
      {activeEmergency && (
        <div className="space-y-6 animate-fade-in">
          <div className="p-6 bg-rose-950/80 border-2 border-rose-500 rounded-3xl space-y-4 shadow-2xl shadow-rose-950/90">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-rose-800/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/40 animate-bounce">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                    🚨 EMERGENCY ACTIVE
                  </h2>
                  <p className="text-xs text-rose-200 font-medium">
                    Trigger Source: <span className="font-bold underline">{activeEmergency.trigger_source}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3.5 py-1.5 bg-rose-600 text-white font-mono text-xs font-extrabold rounded-xl uppercase tracking-wider">
                  Severity: {activeEmergency.confidence_score >= 80 ? 'CRITICAL' : 'HIGH'}
                </span>
                <span className="px-3.5 py-1.5 bg-slate-900 border border-rose-500/40 text-rose-300 font-mono text-xs font-bold rounded-xl">
                  Confidence: {activeEmergency.confidence_score}%
                </span>
              </div>
            </div>

            {/* Live Map Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-rose-200">
                <span className="font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-400" /> Live Location Tracking
                </span>
                {gpsData.available ? (
                  <span className="font-mono text-[11px] text-slate-300">
                    Lat: {gpsData.latitude.toFixed(4)}, Lon: {gpsData.longitude.toFixed(4)} | Accuracy: ±{gpsData.accuracy}m | Updated: {gpsData.lastUpdated}
                  </span>
                ) : (
                  <span className="font-bold text-amber-400">LOCATION UNAVAILABLE</span>
                )}
              </div>

              {gpsData.available ? (
                <InteractiveLiveMap
                  userLat={gpsData.latitude}
                  userLon={gpsData.longitude}
                  isEmergency={true}
                />
              ) : (
                <div className="p-8 bg-slate-900/90 rounded-2xl border border-slate-800 text-center space-y-2">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto animate-pulse" />
                  <p className="text-sm font-bold text-white">LOCATION UNAVAILABLE</p>
                  <p className="text-xs text-slate-400">Device GPS permissions disabled or signal unavailable.</p>
                </div>
              )}
            </div>

            {/* Notification Status & Escalation Card */}
            <EmergencyEscalationCard
              emergency={activeEmergency}
              onStatusChange={fetchActiveEmergency}
            />
          </div>
        </div>
      )}

      {/* 3. PROMINENT LARGE SOS BUTTON CENTERPIECE (ALWAYS DISPLAYED) */}
      <div className="glass-panel p-8 rounded-3xl border border-slate-800 text-center space-y-6 shadow-2xl relative overflow-hidden">
        <div className="space-y-1">
          <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider">
            Emergency SOS Assistance
          </h2>
          <p className="text-xs text-slate-400">
            Press the button below to instantly trigger emergency notifications and share your location.
          </p>
        </div>

        <div className="py-4 flex justify-center">
          <button
            onClick={handleOpenSosModal}
            className="w-44 h-44 md:w-56 md:h-56 rounded-full bg-gradient-to-tr from-rose-700 via-rose-600 to-red-500 text-white font-black text-4xl md:text-5xl tracking-widest shadow-2xl shadow-rose-600/60 border-4 border-rose-400/50 flex flex-col items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all duration-300 group cursor-pointer"
          >
            <Flame className="w-10 h-10 md:w-12 md:h-12 text-rose-200 animate-pulse group-hover:scale-110 transition-transform" />
            <span className="drop-shadow-lg">SOS</span>
            <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-rose-200 font-sans">
              Press for Emergency
            </span>
          </button>
        </div>

        <p className="text-xs text-slate-400 italic">
          Pressing SOS initiates immediate priority contact escalation & location tracking.
        </p>
      </div>

      {/* 4. EMERGENCY TRIAGE CHATBOT */}
      <DashboardTriageChatbot
        activeEmergency={activeEmergency}
        onRequestEmergency={handleOpenSosModal}
      />

      {/* SOS VERIFICATION & COUNTDOWN MODAL */}
      {showSosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-fade-in">
          <div className="glass-panel p-8 rounded-3xl max-w-md w-full border-2 border-rose-500 bg-rose-950/60 text-center space-y-6 shadow-2xl shadow-rose-950/90">
            <div className="mx-auto w-20 h-20 bg-rose-500/20 text-rose-400 rounded-3xl border border-rose-500/50 flex items-center justify-center animate-bounce">
              <ShieldAlert className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
                🚨 EMERGENCY ASSISTANCE
              </h3>
              <p className="text-xs text-rose-200 font-semibold leading-relaxed">
                You are about to notify your emergency contacts and share your current location. Are you sure you need emergency assistance?
              </p>
            </div>

            <div className="p-4 bg-slate-900/90 rounded-2xl border border-rose-500/40 space-y-1">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block">
                Auto-Confirmation Countdown
              </span>
              <span className="text-5xl font-black text-white font-mono">{sosCountdown}s</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleCancelSos}
                className="py-3.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs border border-slate-700 transition-all"
              >
                CANCEL
              </button>
              <button
                onClick={executeRealSosTrigger}
                className="py-3.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-2xl text-xs shadow-xl shadow-rose-600/40 transition-all hover:scale-105 uppercase tracking-wider"
              >
                CONFIRM SOS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

