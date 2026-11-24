import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, MapPin, ShieldAlert, Eye, X, ExternalLink, Navigation, Clock } from 'lucide-react';
import { InteractiveLiveMap } from './InteractiveLiveMap';
import api from '../services/api';

export const SimpleEmergencyStatusCard = ({ emergency, onStatusChange, gpsData, onOpenHospitalNav }) => {
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  if (!emergency) return null;

  const smsStatus = emergency.sms_status || 'PENDING';
  const isSmsDelivered = smsStatus === 'DELIVERED';
  const isSmsSent = smsStatus === 'SENT';
  const isSmsPending = smsStatus === 'PENDING';
  const isSmsNoContacts = smsStatus === 'NO_CONTACTS';
  const isSmsNotConfigured = smsStatus === 'PROVIDER_NOT_CONFIGURED';
  const isSmsFailed = smsStatus === 'FAILED' || (!isSmsDelivered && !isSmsSent && !isSmsPending && !isSmsNoContacts && !isSmsNotConfigured);

  const confidenceScore = emergency.confidence_score ? Math.round(emergency.confidence_score) : 95;
  const locationUrl = emergency.location_url || (gpsData?.available ? `https://www.google.com/maps?q=${gpsData.latitude},${gpsData.longitude}` : null);

  const getHeaderInfo = () => {
    if (isSmsDelivered) {
      return {
        title: '🚨 EMERGENCY ALERT DELIVERED',
        subtitle: 'SMS delivery confirmed by cellular network to emergency contacts.',
        borderColor: 'border-emerald-500',
        bgColor: 'bg-emerald-950/80 shadow-emerald-950/90',
        iconColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
      };
    }
    if (isSmsSent) {
      return {
        title: '🚨 EMERGENCY ALERT SENT TO GATEWAY',
        subtitle: 'TextBee has accepted the SMS request for cellular transmission.',
        borderColor: 'border-cyan-500',
        bgColor: 'bg-cyan-950/80 shadow-cyan-950/90',
        iconColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
      };
    }
    if (isSmsPending) {
      return {
        title: '⏳ EMERGENCY ALERT PROCESSING',
        subtitle: 'Initiating SMS notification dispatch to emergency contacts...',
        borderColor: 'border-amber-500/60',
        bgColor: 'bg-slate-900/90 shadow-slate-950/90',
        iconColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40'
      };
    }
    if (isSmsNoContacts) {
      return {
        title: '⚠️ NO EMERGENCY CONTACTS CONFIGURED',
        subtitle: 'No emergency contacts found in your profile. Please add contacts in your Medical Profile.',
        borderColor: 'border-amber-500',
        bgColor: 'bg-amber-950/80 shadow-amber-950/90',
        iconColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40'
      };
    }
    if (isSmsNotConfigured) {
      return {
        title: '⚠️ SMS GATEWAY NOT CONFIGURED',
        subtitle: 'TextBee credentials are not configured in system settings.',
        borderColor: 'border-amber-500',
        bgColor: 'bg-amber-950/80 shadow-amber-950/90',
        iconColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40'
      };
    }
    return {
      title: '⚠️ EMERGENCY NOTIFICATION FAILED',
      subtitle: emergency.sms_error || 'SMS provider could not send the notification. Emergency event remains active.',
      borderColor: 'border-rose-500',
      bgColor: 'bg-rose-950/80 shadow-rose-950/90',
      iconColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40'
    };
  };

  const headerInfo = getHeaderInfo();

  const handleResolveEmergency = async () => {
    if (!window.confirm('Are you sure you want to cancel this emergency alert?')) return;
    setCancelling(true);
    try {
      await api.post('/emergency/validate', {
        emergency_id: emergency.id,
        action: 'false_alarm',
        validator_role: 'user'
      });
      if (onStatusChange) onStatusChange();
    } catch (err) {
      alert('Failed to cancel emergency alert.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* SIMPLE EMERGENCY STATUS CARD */}
      <div className={`p-6 rounded-3xl border-2 space-y-5 shadow-2xl transition-all ${headerInfo.borderColor} ${headerInfo.bgColor}`}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl border animate-bounce ${headerInfo.iconColor}`}>
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                  {headerInfo.title}
                </h2>
                {emergency.is_demo && (
                  <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-mono font-extrabold rounded-full uppercase tracking-wider">
                    🧪 TEST MODE / DEMO DATA
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-300 mt-0.5">
                {headerInfo.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenHospitalNav && (
              <button
                onClick={onOpenHospitalNav}
                className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-cyan-600/30 flex items-center gap-1.5 transition-all hover:scale-105 cursor-pointer"
                title="View nearest hospital navigation and get directions on Google Maps"
              >
                <Navigation className="w-3.5 h-3.5 animate-pulse" />
                Hospital Directions
              </button>
            )}
            <button
              onClick={handleResolveEmergency}
              disabled={cancelling}
              className="px-3.5 py-1.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Alert'}
            </button>
            <button
              onClick={() => setShowDetailsModal(true)}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-xl text-xs shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Eye className="w-4 h-4" /> View Details
            </button>
          </div>
        </div>

        {/* Real Provider Error Message Display (If Failed or Not Configured) */}
        {(isSmsFailed || isSmsNotConfigured || isSmsNoContacts) && (
          <div className="p-4 bg-slate-950/90 rounded-2xl border border-amber-500/50 text-amber-300 text-xs space-y-1">
            <span className="font-extrabold uppercase tracking-wider block text-amber-400">
              Notification Status Details:
            </span>
            <p className="font-mono">{emergency.sms_error || 'SMS provider could not send the notification.'}</p>
          </div>
        )}

        {/* 3 Status Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {/* SMS Status */}
          <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">SMS:</span>
            {isSmsDelivered ? (
              <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5 font-mono">
                <CheckCircle className="w-4 h-4 text-emerald-400" /> Delivered
              </span>
            ) : isSmsSent ? (
              <span className="text-xs font-black text-cyan-400 flex items-center gap-1.5 font-mono">
                <CheckCircle className="w-4 h-4 text-cyan-400" /> Sent
              </span>
            ) : isSmsPending ? (
              <span className="text-xs font-black text-amber-400 flex items-center gap-1.5 font-mono animate-pulse">
                <Clock className="w-4 h-4 text-amber-400" /> Sending...
              </span>
            ) : isSmsNoContacts ? (
              <span className="text-xs font-black text-amber-400 flex items-center gap-1.5 font-mono">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> No Contacts
              </span>
            ) : isSmsNotConfigured ? (
              <span className="text-xs font-black text-amber-400 flex items-center gap-1.5 font-mono">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Not Configured
              </span>
            ) : (
              <span className="text-xs font-black text-rose-400 flex items-center gap-1.5 font-mono">
                <XCircle className="w-4 h-4 text-rose-400" /> Failed
              </span>
            )}
          </div>

          {/* Location Status */}
          <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Location:</span>
            <span className="text-xs font-black text-cyan-400 flex items-center gap-1.5 font-mono">
              <CheckCircle className="w-4 h-4 text-cyan-400" /> Shared
            </span>
          </div>

          {/* Confidence Score */}
          <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Confidence:</span>
            <span className="text-xs font-black text-rose-300 font-mono">
              {confidenceScore}%
            </span>
          </div>
        </div>
      </div>

      {/* EMERGENCY DETAILS MODAL */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-fade-in">
          <div className="glass-panel p-6 rounded-3xl max-w-2xl w-full border border-slate-800 bg-slate-900 text-slate-100 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <h3 className="text-lg font-black text-white tracking-wide">Emergency Event Details</h3>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Emergency ID</span>
                <span className="font-mono font-bold text-white">#{emergency.id}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Trigger Source</span>
                <span className="font-bold text-rose-400">{emergency.trigger_source}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Confidence</span>
                <span className="font-mono font-bold text-rose-300">{confidenceScore}%</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Time</span>
                <span className="font-mono text-slate-300">
                  {emergency.created_at ? new Date(emergency.created_at).toLocaleTimeString() : 'Just now'}
                </span>
              </div>
            </div>

            {/* Live Location & Map */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-400" /> Location Coordinates
                </span>
                {locationUrl && (
                  <a
                    href={locationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 font-mono text-[11px] flex items-center gap-1 underline"
                  >
                    Open in Google Maps <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {emergency.latitude && emergency.longitude ? (
                <InteractiveLiveMap
                  userLat={emergency.latitude}
                  userLon={emergency.longitude}
                  isEmergency={true}
                />
              ) : (
                <div className="p-4 bg-slate-950 rounded-xl text-center text-xs text-slate-400">
                  Location coordinates unavailable.
                </div>
              )}
            </div>

            {/* Provider Status Details */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs space-y-2">
              <span className="font-bold text-slate-300 uppercase tracking-wider block">
                Notification Dispatch Log:
              </span>
              <div className="flex items-center justify-between font-mono text-slate-400">
                <span>SMS Status:</span>
                <span className={isSmsSent ? 'text-emerald-400 font-bold' : isSmsNotConfigured ? 'text-amber-400 font-bold' : 'text-rose-400 font-bold'}>
                  {emergency.sms_status || 'PENDING'}
                </span>
              </div>
              {emergency.sms_error && (
                <div className="p-2 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 text-[11px] font-mono">
                  Error: {emergency.sms_error}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="py-2 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
