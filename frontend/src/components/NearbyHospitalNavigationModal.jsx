import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Navigation, MapPin, Building2, Phone, Star, ExternalLink,
  CheckCircle2, AlertTriangle, XCircle, RefreshCw, X, ShieldAlert,
  Flame, Clock, ChevronDown, ChevronUp, ArrowRight
} from 'lucide-react';
import api from '../services/api';

export const NearbyHospitalNavigationModal = ({
  isOpen,
  onClose,
  emergency,
  userGps,
  locationStatus
}) => {
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [showOtherHospitals, setShowOtherHospitals] = useState(false);

  const lastLoadedEmergencyIdRef = useRef(null);
  const isFetchingRef = useRef(false);

  // Fallback Bengaluru center coordinates if GPS unavailable
  const fallbackLat = 12.9716;
  const fallbackLon = 77.5946;

  // Determine effective coordinates: prefer user GPS, then emergency coords, then fallback
  const effectiveLat = (userGps?.available && userGps?.latitude !== null && !isNaN(userGps.latitude) && userGps.latitude !== 0)
    ? userGps.latitude
    : (emergency?.latitude !== null && !isNaN(emergency?.latitude) && emergency?.latitude !== 0)
    ? emergency.latitude
    : fallbackLat;

  const effectiveLon = (userGps?.available && userGps?.longitude !== null && !isNaN(userGps.longitude) && userGps.longitude !== 0)
    ? userGps.longitude
    : (emergency?.longitude !== null && !isNaN(emergency?.longitude) && emergency?.longitude !== 0)
    ? emergency.longitude
    : fallbackLon;

  const hasRealGps = userGps?.available && userGps?.latitude !== null && userGps.latitude !== 0;

  // Stable hospital fetch: fetches once per emergency/open event, NOT on every GPS coordinate jitter
  const fetchNearby = useCallback(async (forcedLat, forcedLon) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoadingHospitals(true);
    setFetchError(null);
    try {
      const latToUse = forcedLat !== undefined ? forcedLat : effectiveLat;
      const lonToUse = forcedLon !== undefined ? forcedLon : effectiveLon;
      const res = await api.get('/hospitals/nearby', {
        params: {
          lat: latToUse,
          lon: lonToUse
        }
      });
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setHospitals(res.data);
        // Preserve user's existing hospital selection if still present in results
        setSelectedHospital((prev) => {
          if (prev && res.data.some(h => h.id === prev.id)) {
            return prev;
          }
          return res.data[0];
        });
      } else {
        setHospitals([]);
      }
      lastLoadedEmergencyIdRef.current = emergency?.id || 'active';
    } catch (err) {
      console.warn('Failed to fetch nearby hospitals:', err);
      setFetchError('Unable to load nearby hospitals. Please check your network connection.');
    } finally {
      setLoadingHospitals(false);
      isFetchingRef.current = false;
    }
  }, [effectiveLat, effectiveLon, emergency?.id]);

  // Fetch nearby hospitals ONCE when modal is opened or emergency ID changes
  // Crucial: effectiveLat and effectiveLon are intentionally excluded to prevent periodic reloading from GPS watchPosition jitter
  useEffect(() => {
    if (!isOpen) return;

    const currentEmergencyId = emergency?.id || 'active';
    if (lastLoadedEmergencyIdRef.current !== currentEmergencyId || hospitals.length === 0) {
      fetchNearby();
    }
  }, [isOpen, emergency?.id, fetchNearby, hospitals.length]);

  if (!isOpen) return null;

  // SMS Status evaluation matching backend statuses
  const smsStatus = emergency?.sms_status;
  const isSmsDelivered = smsStatus === 'DELIVERED';
  const isSmsSent = smsStatus === 'SENT' || smsStatus === 'DELIVERED' || smsStatus === 'ACKNOWLEDGED';
  const isSmsNotConfigured = smsStatus === 'PROVIDER_NOT_CONFIGURED';
  const isSmsNoContacts = smsStatus === 'NO_CONTACTS';
  const isSmsFailed = smsStatus === 'FAILED' || (!isSmsSent && !isSmsNotConfigured && !isSmsNoContacts && emergency?.sms_error);
  const isSmsPending = smsStatus === 'PENDING' || (!isSmsSent && !isSmsFailed && !isSmsNotConfigured && !isSmsNoContacts && !emergency?.sms_error);

  // Handle Google Maps Directions click
  const handleGetDirections = (hospitalToNavigate) => {
    const target = hospitalToNavigate || selectedHospital;
    if (!target) return;

    const destLat = target.latitude;
    const destLon = target.longitude;

    let mapsUrl = '';
    if (hasRealGps) {
      mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${effectiveLat},${effectiveLon}&destination=${destLat},${destLon}&travelmode=driving`;
    } else {
      // If GPS origin is not available, let Google Maps prompt for device origin
      mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLon}&travelmode=driving`;
    }

    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-fade-in select-none overflow-y-auto">
      <div className="glass-panel p-6 md:p-8 rounded-3xl max-w-2xl w-full border-2 border-cyan-500/50 bg-slate-900/95 text-slate-100 space-y-6 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                EMERGENCY HOSPITAL NAVIGATION
              </span>
              {emergency?.id && (
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  #{emergency.id}
                </span>
              )}
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
              Emergency Directions & Nearest Hospitals
            </h2>
            <p className="text-xs text-slate-400">
              Immediate medical navigation assistance based on your real-time location.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close navigation popup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. EMERGENCY CONFIRMED STATUS BANNER */}
        <div className="p-4 bg-rose-950/70 border border-rose-500/50 rounded-2xl flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/40">
              <Flame className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-white text-sm block">
                🚨 Emergency Confirmed: Patient Alert Active
              </span>
              <span className="text-rose-200 text-[11px] font-mono">
                Source: <strong className="text-white">{emergency?.trigger_source || 'Emergency SOS'}</strong> • Threat Confidence: <strong className="text-white">{emergency?.confidence_score ? Math.round(emergency.confidence_score) : 95}%</strong>
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-rose-500 text-white font-mono font-black text-[10px] rounded-lg uppercase tracking-wider">
            {emergency?.status || 'Confirmed'}
          </span>
        </div>

        {/* 2. SMS NOTIFICATION STATUS BANNER */}
        <div className={`p-4 rounded-2xl border text-xs space-y-1 transition-all ${
          isSmsSent
            ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-100'
            : isSmsNoContacts
            ? 'bg-amber-950/80 border-amber-500/50 text-amber-100'
            : isSmsNotConfigured
            ? 'bg-amber-950/80 border-amber-500/50 text-amber-100'
            : isSmsFailed
            ? 'bg-rose-950/80 border-rose-500/50 text-rose-100'
            : 'bg-cyan-950/80 border-cyan-500/50 text-cyan-100'
        }`}>
          <div className="flex items-center justify-between font-extrabold text-sm">
            <span className="flex items-center gap-2">
              {isSmsSent && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {isSmsNoContacts && <AlertTriangle className="w-4 h-4 text-amber-400" />}
              {isSmsNotConfigured && <AlertTriangle className="w-4 h-4 text-amber-400" />}
              {isSmsFailed && <XCircle className="w-4 h-4 text-rose-400" />}
              {isSmsPending && <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />}

              {isSmsDelivered
                ? '✓ Emergency SMS Delivered via TextBee'
                : isSmsSent
                ? '✓ Emergency SMS Sent via TextBee'
                : isSmsNoContacts
                ? '⚠️ No Emergency Contacts Configured'
                : isSmsNotConfigured
                ? '⚠️ SMS Provider Not Configured'
                : isSmsFailed
                ? '⚠️ Emergency SMS Delivery Notice'
                : '⏳ Verifying Emergency SMS Dispatch...'}
            </span>

            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-black/40">
              Provider: {emergency?.sms_provider || 'TextBee'}
            </span>
          </div>

          <p className="text-[11px] leading-relaxed opacity-90">
            {isSmsDelivered
              ? 'Your registered emergency contacts have received your live coordinates and medical profile.'
              : isSmsSent
              ? 'Emergency SMS was accepted by TextBee and dispatched to carrier queue for delivery.'
              : isSmsNoContacts
              ? 'No emergency contacts found in medical profile. Please add contacts in your profile. Hospital navigation remains fully functional.'
              : isSmsNotConfigured
              ? 'SMS gateway credentials are not configured in backend/.env. Hospital navigation remains fully functional.'
              : isSmsFailed
              ? (emergency?.sms_error || 'SMS notification could not be delivered to contacts. Hospital navigation remains active.')
              : 'Verifying notification dispatch with TextBee gateway...'}
          </p>
        </div>

        {/* GPS Location Callout */}
        <div className="flex items-center justify-between p-3 bg-slate-950/70 rounded-2xl border border-slate-800 text-[11px] font-mono text-slate-300 flex-wrap gap-2">
          <span className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            {hasRealGps ? (
              <span>Your Current GPS: <strong className="text-cyan-300">({effectiveLat.toFixed(4)}, {effectiveLon.toFixed(4)})</strong></span>
            ) : locationStatus === 'DENIED' ? (
              <span className="text-amber-300">GPS Permission Denied • Showing Bengaluru Hospitals</span>
            ) : (
              <span className="text-slate-400">Default Coordinates Active • ({effectiveLat.toFixed(4)}, {effectiveLon.toFixed(4)})</span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">
              {hospitals.length} facilities discovered
            </span>
            <button
              type="button"
              onClick={() => fetchNearby(effectiveLat, effectiveLon)}
              disabled={loadingHospitals}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 transition-colors cursor-pointer"
              title="Refresh nearby hospitals"
            >
              <RefreshCw className={`w-3 h-3 ${loadingHospitals ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 3. PRIMARY SELECTED HOSPITAL CARD */}
        {loadingHospitals ? (
          <div className="p-8 bg-slate-950/80 rounded-3xl border border-slate-800 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-300">
              Calculating nearest hospital routes via Dijkstra & Haversine...
            </p>
          </div>
        ) : fetchError ? (
          <div className="p-6 bg-rose-950/40 border border-rose-500/40 rounded-3xl text-center space-y-2">
            <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto" />
            <p className="text-xs font-bold text-rose-200">{fetchError}</p>
          </div>
        ) : selectedHospital ? (
          <div className="p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-3xl border-2 border-cyan-500/60 shadow-xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 inline-flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-cyan-400" />
                  {selectedHospital.id === hospitals[0]?.id ? 'NEAREST EMERGENCY FACILITY' : 'SELECTED DESTINATION'}
                </span>
                <h3 className="text-lg md:text-xl font-black text-white leading-tight">
                  {selectedHospital.name}
                </h3>
                <p className="text-xs text-slate-300 flex items-start gap-1.5 pt-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>{selectedHospital.address}</span>
                </p>
              </div>

              {selectedHospital.rating && (
                <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 text-center font-mono flex-shrink-0">
                  <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400" /> {selectedHospital.rating}
                  </span>
                </div>
              )}
            </div>

            {/* Metrics: Distance, ETA, Phone */}
            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 text-center space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Distance</span>
                <strong className="text-cyan-400 font-bold text-sm">
                  {selectedHospital.distance_km !== null ? `${selectedHospital.distance_km} km` : '--'}
                </strong>
              </div>

              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 text-center space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Est. Driving ETA</span>
                <strong className="text-emerald-400 font-bold text-sm">
                  {selectedHospital.eta_minutes !== null ? `~${selectedHospital.eta_minutes} mins` : '--'}
                </strong>
              </div>

              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 text-center space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Facility Type</span>
                <strong className="text-slate-200 font-semibold text-[11px] truncate block" title={selectedHospital.place_type}>
                  {selectedHospital.place_type || 'Hospital'}
                </strong>
              </div>
            </div>

            {selectedHospital.phone && (
              <div className="flex items-center justify-between p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400 font-mono flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-cyan-400" /> Phone: {selectedHospital.phone}
                </span>
                <a
                  href={`tel:${selectedHospital.phone}`}
                  className="px-2.5 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-[11px] font-bold"
                >
                  Call Hospital
                </a>
              </div>
            )}

            {/* PROMINENT GET DIRECTIONS BUTTON */}
            <button
              onClick={() => handleGetDirections(selectedHospital)}
              className="w-full py-4 px-6 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black text-sm md:text-base rounded-2xl shadow-xl shadow-cyan-600/30 flex items-center justify-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer uppercase tracking-wider border border-cyan-400/40"
            >
              <Navigation className="w-5 h-5 animate-pulse" />
              <span>Get Directions on Google Maps</span>
              <ExternalLink className="w-4 h-4 ml-1 opacity-80" />
            </button>
          </div>
        ) : null}

        {/* 4. OPTION TO VIEW & SELECT OTHER NEARBY HOSPITALS */}
        {hospitals.length > 1 && (
          <div className="space-y-3">
            <button
              onClick={() => setShowOtherHospitals(!showOtherHospitals)}
              className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-800/80 rounded-xl border border-slate-800 text-xs font-bold text-slate-300 flex items-center justify-between transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-cyan-400" />
                {showOtherHospitals ? 'Hide Other Nearby Hospitals' : `View ${hospitals.length - 1} Other Nearby Hospitals`}
              </span>
              {showOtherHospitals ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showOtherHospitals && (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {hospitals.map((h, idx) => {
                  const isCurrent = selectedHospital?.id === h.id;
                  return (
                    <div
                      key={h.id || idx}
                      onClick={() => setSelectedHospital(h)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-cyan-950/70 border-cyan-500 text-white shadow-md'
                          : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-slate-400">#{idx + 1}</span>
                          <h4 className="font-bold text-xs truncate text-white">{h.name}</h4>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{h.address}</p>
                      </div>

                      <div className="flex items-center gap-3 font-mono text-xs flex-shrink-0">
                        <div className="text-right">
                          <strong className="text-cyan-400 block text-xs">{h.distance_km} km</strong>
                          <span className="text-[10px] text-emerald-400">~{h.eta_minutes} min</span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedHospital(h);
                            handleGetDirections(h);
                          }}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-xl border border-slate-700 transition-colors"
                          title="Navigate directly to this hospital"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
          <a
            href="tel:108"
            className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-xl font-bold flex items-center gap-1.5 transition-colors"
          >
            <Phone className="w-3.5 h-3.5" /> Call Ambulance (108)
          </a>

          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Close Navigation
          </button>
        </div>
      </div>
    </div>
  );
};