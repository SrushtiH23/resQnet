import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { PhoneCall, MessageSquare, ShieldAlert, CheckCircle, Clock, Building2, UserCheck, AlertTriangle, ExternalLink } from 'lucide-react';

export const EmergencyEscalationCard = ({ emergency, onStatusChange }) => {
  const [contacts, setContacts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [emergency?.id]);

  const fetchData = async () => {
    if (!emergency) return;
    try {
      const [contactsRes, notifsRes] = await Promise.all([
        api.get('/user/family-contacts'),
        api.get(`/emergency/${emergency.id}/notifications`)
      ]);
      setContacts(contactsRes.data || []);
      setNotifications(notifsRes.data || []);
    } catch (err) {
      console.error("Error fetching escalation info:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (contactId, responseText) => {
    if (!emergency) return;
    setAcknowledging(true);
    try {
      await api.post('/emergency/acknowledge', {
        emergency_id: emergency.id,
        contact_id: contactId,
        response: responseText
      });
      await fetchData();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      console.error("Acknowledgement error:", err);
    } finally {
      setAcknowledging(false);
    }
  };

  if (!emergency) return null;

  const lat = emergency.latitude;
  const lon = emergency.longitude;
  const hasGps = lat && lon && (lat !== 0 || lon !== 0);
  const mapsUrl = hasGps ? `https://www.google.com/maps?q=${lat},${lon}` : null;

  const isHospitalDispatched = emergency.status === "Hospital Dispatched" || emergency.confidence_score >= 80;

  return (
    <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500 animate-pulse" />
            Emergency Active Status & Escalation
          </h3>
          <p className="text-xs text-slate-400">Real-Time Provider Provider Status (Twilio SMS & Call Audit)</p>
        </div>
        <span className="px-2.5 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-mono font-bold rounded-xl uppercase tracking-wider">
          {emergency.status}
        </span>
      </div>

      {/* GPS Location Banner */}
      <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
        <div>
          <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">Location Coordinate</span>
          {hasGps ? (
            <p className="font-mono font-bold text-emerald-400">
              {lat.toFixed(4)}, {lon.toFixed(4)}
            </p>
          ) : (
            <p className="font-semibold text-amber-400">Location: Unavailable (GPS offline)</p>
          )}
        </div>
        {hasGps && mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 border border-rose-500/30 font-bold rounded-xl flex items-center gap-1.5 text-xs transition-colors"
          >
            Google Maps <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Emergency Contact Escalation List */}
      <div className="space-y-3">
        <h4 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
          Emergency Contact Priority Escalation:
        </h4>

        {contacts.length === 0 ? (
          <div className="p-3 bg-slate-900 rounded-xl text-center text-xs text-slate-400">
            No family emergency contacts configured. Escalated directly to Hospital Network.
          </div>
        ) : (
          contacts.map((contact) => {
            const contactNotifs = notifications.filter((n) => n.contact_id === contact.id);
            const smsNotif = contactNotifs.find((n) => n.channel === "SMS");
            const callNotif = contactNotifs.find((n) => n.channel === "VOICE_CALL");
            const isAck = contactNotifs.some((n) => n.status === "ACKNOWLEDGED");

            const getSmsLabel = () => {
              if (!smsNotif) return "Preparing notification";
              if (smsNotif.status === "PENDING" || smsNotif.status === "SENDING") return "SMS sending...";
              if (["SENT", "DELIVERED", "ACKNOWLEDGED"].includes(smsNotif.status)) return "SMS sent ✓";
              if (smsNotif.status === "FAILED") {
                const err = smsNotif.error_message?.toLowerCase() || "";
                if (err.includes("configured") || err.includes("credentials")) return "SMS provider not configured";
                return "SMS failed ✕";
              }
              return `SMS ${smsNotif.status}`;
            };

            const getCallLabel = () => {
              if (!callNotif) return "Preparing call";
              if (callNotif.status === "PENDING") return "Call initiating...";
              if (["INITIATED", "RINGING", "ANSWERED", "COMPLETED", "SENT", "DELIVERED", "ACKNOWLEDGED"].includes(callNotif.status)) return "Call initiated ✓";
              if (callNotif.status === "FAILED") {
                const err = callNotif.error_message?.toLowerCase() || "";
                if (err.includes("configured") || err.includes("credentials")) return "Voice provider not configured";
                return "Call failed ✕";
              }
              return `Call ${callNotif.status}`;
            };

            const smsStatusStr = getSmsLabel();
            const callStatusStr = getCallLabel();

            const smsFailed = smsNotif?.status === "FAILED";
            const smsOk = smsNotif && ["SENT", "DELIVERED", "ACKNOWLEDGED"].includes(smsNotif.status);

            const callFailed = callNotif?.status === "FAILED";
            const callOk = callNotif && ["INITIATED", "RINGING", "ANSWERED", "COMPLETED", "SENT", "DELIVERED", "ACKNOWLEDGED"].includes(callNotif.status);

            return (
              <div key={contact.id} className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white text-sm">{contact.contact_name}</span>
                    <span className="ml-2 text-xs text-slate-400 font-medium">({contact.relationship_type})</span>
                  </div>
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono font-bold rounded-md">
                    Priority #{contact.escalation_order}
                  </span>
                </div>

                {/* Live Channel Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {/* SMS Status */}
                  <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${
                    smsOk
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : smsFailed
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}>
                    {smsOk ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : smsFailed ? <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> : <Clock className="w-3.5 h-3.5 text-slate-500 animate-spin" />}
                    <span className="font-semibold">{smsStatusStr}</span>
                  </div>

                  {/* Call Status */}
                  <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${
                    callOk
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                      : callFailed
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}>
                    {callOk ? <CheckCircle className="w-3.5 h-3.5 text-cyan-400" /> : callFailed ? <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> : <Clock className="w-3.5 h-3.5 text-slate-500 animate-spin" />}
                    <span className="font-semibold">{callStatusStr}</span>
                  </div>

                  {/* Acknowledgement Status */}
                  <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${
                    isAck ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}>
                    {isAck ? <UserCheck className="w-3.5 h-3.5 text-amber-400" /> : <Clock className="w-3.5 h-3.5 text-slate-500" />}
                    <span className="font-semibold">{isAck ? '✓ Contact acknowledged' : '○ Pending Ack'}</span>
                  </div>
                </div>

                {/* Show failure details if any */}
                {(smsFailed || callFailed) && (
                  <div className="p-2.5 bg-rose-950/50 border border-rose-500/30 rounded-xl text-[11px] text-rose-300 space-y-0.5">
                    <p className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-400" /> Family Notification Notice:
                    </p>
                    {smsFailed && <p>• SMS provider failed: {smsNotif?.error_message || "Delivery error"}</p>}
                    {callFailed && <p>• Call provider failed: {callNotif?.error_message || "Call initiation error"}</p>}
                  </div>
                )}

                {/* Acknowledgement Interactive Buttons */}
                {!isAck && (
                  <div className="flex gap-2 pt-1">
                    <button
                      disabled={acknowledging}
                      onClick={() => handleAcknowledge(contact.id, "I am responding")}
                      className="flex-1 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold rounded-xl transition-all"
                    >
                      Respond ("I am responding")
                    </button>
                    <button
                      disabled={acknowledging}
                      onClick={() => handleAcknowledge(contact.id, "I cannot respond")}
                      className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-bold rounded-xl transition-all"
                    >
                      Cannot Respond
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Hospital Escalation Status Card */}
        {(() => {
          const hasAssignedHospital = Boolean(emergency.assigned_hospital_id || emergency.assigned_ambulance_id);
          const hospitalStatusLabel = hasAssignedHospital
            ? (emergency.status === "Hospital Dispatched" ? "Hospital Notified" : "Ambulance Dispatch Confirmed")
            : "Hospital escalation not configured";

          return (
            <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs ${
              hasAssignedHospital
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                : 'bg-slate-900/90 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center gap-2">
                <Building2 className={`w-4 h-4 ${hasAssignedHospital ? 'text-indigo-400' : 'text-slate-500'}`} />
                <div>
                  <p className="font-bold">Hospital & ER Network Integration</p>
                  <p className="text-[10px] text-slate-400">Dijkstra Geospatial Route & Bed Allocation</p>
                </div>
              </div>
              <span className={`font-bold px-2.5 py-1 rounded-lg text-[10px] border ${
                hasAssignedHospital ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {hasAssignedHospital ? `✓ ${hospitalStatusLabel}` : '○ Hospital escalation not configured'}
              </span>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
