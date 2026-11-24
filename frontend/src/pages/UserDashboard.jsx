import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DashboardTriageChatbot } from '../components/DashboardTriageChatbot';
import { SimpleEmergencyStatusCard } from '../components/SimpleEmergencyStatusCard';
import { RealSmartphoneSensor } from '../components/RealSmartphoneSensor';
import { InteractiveLiveMap } from '../components/InteractiveLiveMap';
import { NearbyHospitalNavigationModal } from '../components/NearbyHospitalNavigationModal';
import {
  Navigation, Flame, ShieldAlert, MapPin, RefreshCw, CheckCircle2, AlertTriangle, MessageSquare, X
} from 'lucide-react';

export const UserDashboard = () => {
  const { user, role } = useAuth();
  const isUser = role === 'user' || user?.role?.toLowerCase() === 'user';
  const [activeEmergency, setActiveEmergency] = useState(null);
  const [nearbyHospitals, setNearbyHospitals] = useState([]);
  const [locationStatus, setLocationStatus] = useState('PROMPT'); // PROMPT | GRANTED | DENIED | UNAVAILABLE
  const [gpsData, setGpsData] = useState({
    latitude: null,
    longitude: null,
    accuracy: null,
    lastUpdated: null,
    available: false
  });

  // Floating Clinical Triage Assistant Chatbot State (USER Role Only)
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  // SOS Modal & Trigger State
  const [showSosModal, setShowSosModal] = useState(false);
  const [sendingSos, setSendingSos] = useState(false);

  // Automatic Nearby Hospital Direction Popup State
  const [showHospitalNavModal, setShowHospitalNavModal] = useState(false);
  const [hospitalNavEmergency, setHospitalNavEmergency] = useState(null);
  const handledEmergencyIdRef = useRef(null);

  useEffect(() => {
    fetchActiveEmergency();
    const interval = setInterval(fetchActiveEmergency, 3000);
    return () => clearInterval(interval);
  }, []);

  // Fetch all real discovered Bengaluru hospitals from database; sort by distance when coordinates are updated
  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const params = (gpsData.available && gpsData.latitude !== null && gpsData.longitude !== null)
          ? { lat: gpsData.latitude, lon: gpsData.longitude }
          : {};
        const res = await api.get('/hospitals/discovered', { params });
        if (res.data) setNearbyHospitals(res.data);
      } catch (err) {
        console.warn('Failed to fetch discovered hospitals for dashboard map:', err);
      }
    };
    fetchHospitals();
  }, [gpsData.latitude, gpsData.longitude, gpsData.available]);

  // Request Device Location Permission & Current Position
  const requestUserLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationStatus('UNAVAILABLE');
      setGpsData((prev) => ({ ...prev, available: false }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newGps = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : 10,
          lastUpdated: new Date().toLocaleTimeString(),
          available: true
        };
        setGpsData(newGps);
        setLocationStatus('GRANTED');
      },
      (err) => {
        console.warn('Geolocation position request error:', err);
        if (err.code === 1) { // PERMISSION_DENIED
          setLocationStatus('DENIED');
        } else {
          setLocationStatus('UNAVAILABLE');
        }
        setGpsData((prev) => ({ ...prev, available: false }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    requestUserLocation();
  }, [requestUserLocation]);

  // Real-Time Device Geolocation Tracking (watchPosition)
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
          setLocationStatus('GRANTED');

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
          console.warn('Geolocation watch error:', err);
          if (err.code === 1) {
            setLocationStatus('DENIED');
          }
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      );
    }
    return () => {
      if (watchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [activeEmergency?.id]);

  const fetchActiveEmergency = useCallback(async () => {
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
  }, []);

  const triggerHospitalNavigationFlow = useCallback(async (emergencyData) => {
    if (!emergencyData || !emergencyData.id) return;

    let current = emergencyData;
    // Verify TextBee SMS status using existing emergency status API if still pending
    if (current.sms_status === 'PENDING') {
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        try {
          const check = await api.get(`/emergency/${current.id}`);
          if (check.data) {
            current = check.data;
            if (current.sms_status !== 'PENDING') break;
          }
        } catch (e) {
          break;
        }
      }
    }

    setActiveEmergency(current);
    setHospitalNavEmergency(current);

    // Automatically open hospital navigation popup (prevent duplicate popups for same emergency)
    if (handledEmergencyIdRef.current !== current.id) {
      handledEmergencyIdRef.current = current.id;
      setShowHospitalNavModal(true);
    }
  }, []);

  const handleFallEmergencyConfirmed = useCallback((fallEmergency) => {
    if (fallEmergency && fallEmergency.id) {
      triggerHospitalNavigationFlow(fallEmergency);
    } else {
      fetchActiveEmergency();
    }
  }, [triggerHospitalNavigationFlow, fetchActiveEmergency]);

  const handleOpenSosModal = () => {
    setShowSosModal(true);
  };

  const handleCancelSos = () => {
    setShowSosModal(false);
  };

  const executeRealSosTrigger = async () => {
    setSendingSos(true);
    let lat = gpsData.available ? gpsData.latitude : null;
    let lon = gpsData.available ? gpsData.longitude : null;

    // Attempt browser Geolocation API fresh capture first
    if ('geolocation' in navigator && (lat === null || lon === null)) {
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
        latitude: lat !== null ? lat : 0.0,
        longitude: lon !== null ? lon : 0.0,
        speed: 0.0,
        battery_level: 92,
        network_status: '5G'
      });
      setShowSosModal(false);
      await triggerHospitalNavigationFlow(res.data);
    } catch (err) {
      alert('Failed to trigger SOS emergency alert.');
    } finally {
      setSendingSos(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fade-in relative pb-24 sm:pb-8">
      {/* 1. Welcome + Health Status Header */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950/80 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-3.5 py-1 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 border shadow-sm ${
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

        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-4 py-2.5 rounded-2xl font-bold shadow-sm relative z-10">
          <Navigation className="w-4 h-4 text-cyan-400 animate-pulse" />
          {gpsData.available && gpsData.latitude !== null
            ? `GPS Active (${gpsData.latitude.toFixed(4)}, ${gpsData.longitude.toFixed(4)})`
            : locationStatus === 'DENIED'
            ? 'LOCATION PERMISSION REQUIRED'
            : 'LOCATION UNAVAILABLE'}
        </div>
      </div>

      {/* 2. DYNAMIC ACTIVE EMERGENCY STATUS CARD (When active emergency exists) */}
      {activeEmergency && (
        <SimpleEmergencyStatusCard
          emergency={activeEmergency}
          onStatusChange={fetchActiveEmergency}
          gpsData={gpsData}
          onOpenHospitalNav={() => {
            setHospitalNavEmergency(activeEmergency);
            setShowHospitalNavModal(true);
          }}
        />
      )}

      {/* 3. PROMINENT SOS BUTTON CENTERPIECE */}
      <div className="glass-panel p-8 sm:p-10 rounded-3xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 via-slate-900/50 to-slate-950/90 text-center space-y-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1.5 relative z-10">
          <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider">
            Emergency SOS Assistance
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Press the button below to send an emergency alert and share your location.
          </p>
        </div>

        <div className="py-4 flex justify-center relative z-10">
          <div className="relative group">
            <div className="absolute -inset-4 bg-gradient-to-r from-rose-600 to-red-600 rounded-full blur-xl opacity-30 group-hover:opacity-60 transition duration-500 animate-pulse" />
            <button
              onClick={handleOpenSosModal}
              className="relative w-44 h-44 md:w-56 md:h-56 rounded-full bg-gradient-to-tr from-rose-700 via-rose-600 to-red-500 text-white font-black text-4xl md:text-5xl tracking-widest shadow-2xl shadow-rose-600/60 border-4 border-rose-400/50 flex flex-col items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
            >
              <Flame className="w-10 h-10 md:w-12 md:h-12 text-rose-200 animate-pulse group-hover:scale-110 transition-transform" />
              <span className="drop-shadow-lg">SOS</span>
              <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-rose-200 font-sans">
                Press for Emergency
              </span>
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 italic relative z-10">
          Pressing SOS opens an alert confirmation dialog before sending notifications.
        </p>
      </div>

      {/* 4. CURRENT LOCATION & LIVE MAP SECTION */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 border ${
                locationStatus === 'GRANTED' || gpsData.available
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : locationStatus === 'DENIED'
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}>
                <MapPin className="w-3.5 h-3.5 animate-pulse" />
                {locationStatus === 'GRANTED' || gpsData.available
                  ? 'Location detected'
                  : locationStatus === 'DENIED'
                  ? 'Location access required'
                  : 'Location unavailable'}
              </span>
            </div>
            <h3 className="text-xl font-black text-white tracking-tight">CURRENT LOCATION</h3>
          </div>

          <div className="flex items-center gap-3">
            {gpsData.available && gpsData.latitude !== null ? (
              <div className="text-right font-mono text-xs">
                <p className="text-slate-200 font-bold">
                  Latitude: {gpsData.latitude.toFixed(4)} | Longitude: {gpsData.longitude.toFixed(4)}
                </p>
                <p className="text-[10px] text-slate-400">Last updated: {gpsData.lastUpdated || 'Just now'}</p>
              </div>
            ) : (
              <button
                onClick={requestUserLocation}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
              >
                <Navigation className="w-4 h-4" /> Enable Location
              </button>
            )}
          </div>
        </div>

        {/* Leaflet Live Map or Permission Denied Message */}
        {locationStatus === 'DENIED' && !gpsData.available ? (
          <div className="p-8 bg-slate-900/90 rounded-2xl border border-rose-500/40 text-center space-y-3">
            <MapPin className="w-10 h-10 text-rose-400 mx-auto animate-bounce" />
            <p className="text-sm font-bold text-white">
              Location permission is required to display your current location.
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Please allow location permissions in your mobile browser or click below to enable GPS location tracking.
            </p>
            <button
              onClick={requestUserLocation}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-rose-600/30"
            >
              <Navigation className="w-4 h-4" /> Enable Location
            </button>
          </div>
        ) : gpsData.available && gpsData.latitude !== null ? (
          <div className="space-y-4">
            <InteractiveLiveMap
              userLat={gpsData.latitude}
              userLon={gpsData.longitude}
              isEmergency={Boolean(activeEmergency)}
              hospitalLat={activeEmergency?.assigned_hospital?.latitude}
              hospitalLon={activeEmergency?.assigned_hospital?.longitude}
              hospitalName={activeEmergency?.assigned_hospital?.name}
              hospitalsList={nearbyHospitals}
              showHeader={false}
              height="h-80"
            />

            <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono">
              <div>
                <span className="text-slate-400">Current Latitude: </span>
                <strong className="text-cyan-400">{gpsData.latitude.toFixed(6)}</strong>
              </div>
              <div>
                <span className="text-slate-400">Current Longitude: </span>
                <strong className="text-cyan-400">{gpsData.longitude.toFixed(6)}</strong>
              </div>
              <div>
                <span className="text-slate-400">Last updated: </span>
                <strong className="text-emerald-400">{gpsData.lastUpdated || 'Just now'}</strong>
              </div>
            </div>

            {/* NEAREST HOSPITALS LIST (Sorted by Distance) */}
            {nearbyHospitals.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Nearest Hospitals (Sorted by Distance)
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">Real Google Places Registry</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {nearbyHospitals.slice(0, 3).map((h, idx) => (
                    <div key={h.id || idx} className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2 hover:border-slate-700 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-slate-400">#{idx + 1}</span>
                        <span className={`px-2 py-0.5 font-extrabold text-[9px] rounded uppercase ${
                          h.is_registered_resqnet && h.verification_status === 'VERIFIED'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}>
                          {h.is_registered_resqnet && h.verification_status === 'VERIFIED' ? 'ResQNet Verified' : 'Google Discovered'}
                        </span>
                      </div>

                      <div>
                        <h5 className="font-bold text-slate-100 text-sm leading-snug truncate" title={h.name}>{h.name}</h5>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{h.address}</p>
                      </div>

                      <div className="pt-1 flex items-center justify-between text-xs font-mono border-t border-slate-800/80">
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase">Distance</span>
                          <strong className="text-cyan-400 font-bold">{h.distance_km} km</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase">Est. ETA</span>
                          <strong className="text-emerald-400 font-bold">~{h.eta_minutes} mins</strong>
                        </div>
                        <a
                          href={h.maps_url || `https://www.google.com/maps/dir/?api=1&destination=${h.latitude},${h.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-[10px] font-bold rounded-lg transition-colors border border-slate-700 flex items-center gap-1"
                        >
                          Directions
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 bg-slate-900/90 rounded-2xl border border-slate-800 text-center space-y-3">
            <Navigation className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-300">Requesting real-time device GPS coordinates...</p>
            <button
              onClick={requestUserLocation}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Enable Location
            </button>
          </div>
        )}
      </div>

      {/* 5. REAL SMARTPHONE HARDWARE SENSOR & FALL DETECTION ENGINE */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Hardware Telemetry & Fall Detection
            </span>
          </div>
          <span className="text-[11px] text-cyan-400 font-mono font-medium">5Hz Sliding-Window Analysis</span>
        </div>
        <RealSmartphoneSensor
          onFallDetected={handleFallEmergencyConfirmed}
          userLat={gpsData.latitude}
          userLon={gpsData.longitude}
          showNativeBanner={false}
        />
      </div>

      {/* AUTOMATIC NEARBY HOSPITAL DIRECTION POPUP */}
      <NearbyHospitalNavigationModal
        isOpen={showHospitalNavModal}
        onClose={() => setShowHospitalNavModal(false)}
        emergency={hospitalNavEmergency || activeEmergency}
        userGps={gpsData}
        locationStatus={locationStatus}
      />

      {/* 6. FLOATING CLINICAL TRIAGE ASSISTANT CHATBOT (USER ROLE ONLY) */}
      {isUser && (
        <>
          {/* Floating Chat Panel */}
          <div
            style={{ display: isChatbotOpen ? 'block' : 'none' }}
            className="fixed bottom-24 right-4 sm:right-6 z-50 w-[96vw] sm:w-[480px] md:w-[520px] max-w-[96vw] max-h-[82vh] rounded-3xl border border-cyan-500/40 bg-slate-950/95 shadow-2xl shadow-cyan-950/60 backdrop-blur-2xl animate-fade-in overflow-hidden flex flex-col"
            role="dialog"
            aria-label="ResQNet Clinical Triage Assistant"
          >
            {/* Window Header with Minimize/Close Button */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/50 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center shadow-sm">
                  <MessageSquare className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white tracking-wide">ResQNet Assistant</span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Live Triage
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">Clinical Triage & Symptom Assessment</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsChatbotOpen(false)}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
                title="Minimize Assistant"
                aria-label="Minimize Assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Window Content: Reusing Existing DashboardTriageChatbot */}
            <div className="overflow-y-auto max-h-[calc(82vh-4rem)] p-3 sm:p-4 scrollbar-thin scrollbar-thumb-slate-800">
              <DashboardTriageChatbot
                activeEmergency={activeEmergency}
                onRequestEmergency={() => {
                  setIsChatbotOpen(false);
                  handleOpenSosModal();
                }}
              />
            </div>
          </div>

          {/* Floating Chatbot Launcher Button */}
          <button
            type="button"
            onClick={() => setIsChatbotOpen((prev) => !prev)}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-cyan-600 via-teal-600 to-indigo-600 hover:from-cyan-500 hover:via-teal-500 hover:to-indigo-500 text-white font-bold text-xs shadow-2xl shadow-cyan-500/40 hover:shadow-cyan-500/60 hover:scale-105 active:scale-95 transition-all duration-300 border border-white/20 backdrop-blur-md group cursor-pointer"
            title="ResQNet Assistant"
            aria-label="ResQNet Assistant"
          >
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-12 transition-transform shadow-inner">
              {isChatbotOpen ? (
                <X className="w-3.5 h-3.5 text-white" />
              ) : (
                <MessageSquare className="w-3.5 h-3.5 text-cyan-200 fill-cyan-200" />
              )}
            </div>
            <span className="hidden sm:inline font-bold tracking-wide text-white drop-shadow">
              {isChatbotOpen ? 'Close Assistant' : 'ResQNet Assistant'}
            </span>
            {!isChatbotOpen && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
              </span>
            )}
          </button>
        </>
      )}

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
                className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs border border-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeRealSosTrigger}
                disabled={sendingSos}
                className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {sendingSos ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    <Flame className="w-4 h-4 fill-white" /> Confirm SOS
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
