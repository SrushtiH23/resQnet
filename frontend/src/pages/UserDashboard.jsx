import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DashboardTriageChatbot } from '../components/DashboardTriageChatbot';
import { SimpleEmergencyStatusCard } from '../components/SimpleEmergencyStatusCard';
import { RealSmartphoneSensor } from '../components/RealSmartphoneSensor';
import {
  Navigation, Flame, ShieldAlert, MapPin
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

  // SOS Modal & Trigger State
  const [showSosModal, setShowSosModal] = useState(false);
  const [sendingSos, setSendingSos] = useState(false);

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
    setShowSosModal(false);
  };

  const executeRealSosTrigger = async () => {
    setSendingSos(true);
    let lat = gpsData.available ? gpsData.latitude : 0.0;
    let lon = gpsData.available ? gpsData.longitude : 0.0;

    // Attempt browser Geolocation API first
    if ('geolocation' in navigator) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          });
        });
        lat = position.coords.latitude;
        lon = position.coords.longitude;
      } catch (geoErr) {
        console.warn('Geolocation capture before SOS dispatch notice:', geoErr);
      }
    }

    try {
      const res = await api.post('/emergency/create', {
        trigger_source: 'MANUAL_SOS',
        latitude: lat,
        longitude: lon,
        speed: 0.0,
        battery_level: 92,
        network_status: '5G'
      });
      setActiveEmergency(res.data);
      setShowSosModal(false);
    } catch (err) {
      alert('Failed to trigger SOS emergency alert.');
    } finally {
      setSendingSos(false);
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

      {/* 2. DYNAMIC ACTIVE EMERGENCY STATUS CARD (When active emergency exists) */}
      {activeEmergency && (
        <SimpleEmergencyStatusCard
          emergency={activeEmergency}
          onStatusChange={fetchActiveEmergency}
          gpsData={gpsData}
        />
      )}

      {/* 3. PROMINENT SOS BUTTON CENTERPIECE */}
      <div className="glass-panel p-8 rounded-3xl border border-slate-800 text-center space-y-6 shadow-2xl relative overflow-hidden">
        <div className="space-y-1">
          <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider">
            Emergency SOS Assistance
          </h2>
          <p className="text-xs text-slate-400">
            Press the button below to send an emergency alert and share your location.
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
          Pressing SOS opens an alert confirmation dialog before sending notifications.
        </p>
      </div>

      {/* 4. REAL SMARTPHONE HARDWARE SENSOR & FALL DETECTION ENGINE */}
      <RealSmartphoneSensor onFallDetected={fetchActiveEmergency} />

      {/* 5. EMERGENCY TRIAGE CHATBOT */}
      <DashboardTriageChatbot
        activeEmergency={activeEmergency}
        onRequestEmergency={handleOpenSosModal}
      />

      {/* STEP 1 — SOS CONFIRMATION MODAL */}
      {showSosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-fade-in">
          <div className="glass-panel p-8 rounded-3xl max-w-md w-full border-2 border-rose-500 bg-rose-950/80 text-center space-y-6 shadow-2xl shadow-rose-950/90">
            <div className="mx-auto w-20 h-20 bg-rose-500/20 text-rose-400 rounded-3xl border border-rose-500/50 flex items-center justify-center animate-bounce">
              <ShieldAlert className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
                🚨 EMERGENCY SOS
              </h3>
              <p className="text-sm font-bold text-white leading-relaxed">
                Are you sure you want to send an emergency alert?
              </p>
            </div>

            <div className="p-4 bg-slate-900/90 rounded-2xl border border-rose-500/30 text-left space-y-2 text-xs">
              <span className="font-extrabold text-slate-300 uppercase tracking-wider block">
                Your emergency contacts will receive:
              </span>
              <ul className="space-y-1.5 text-slate-300 font-medium">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Emergency alert
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Your current location
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Your medical emergency information
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Time of emergency
                </li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleCancelSos}
                disabled={sendingSos}
                className="py-3.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs border border-slate-700 transition-all cursor-pointer"
              >
                CANCEL
              </button>
              <button
                onClick={executeRealSosTrigger}
                disabled={sendingSos}
                className="py-3.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-2xl text-xs shadow-xl shadow-rose-600/40 transition-all hover:scale-105 uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
              >
                {sendingSos ? 'SENDING...' : 'YES, SEND SOS'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
