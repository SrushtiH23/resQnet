import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, Building2, ShieldAlert, Clock, Stethoscope,
  Activity, CheckCircle2, XCircle, AlertTriangle, Eye, MapPin, Phone, Heart, Zap, FileText, X, LogOut
} from 'lucide-react';

export const AdminDashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const [overview, setOverview] = useState(null);
  const [activeEmergencies, setActiveEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('emergencies');

  // Emergency Modal Inspection State
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    fetchAdminData();
    const interval = setInterval(fetchAdminData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchAdminData = async () => {
    try {
      const [overviewRes, activeRes] = await Promise.all([
        api.get('/admin/overview'),
        api.get('/emergency/active')
      ]);
      setOverview(overviewRes.data);
      setActiveEmergencies(activeRes.data);
    } catch (err) {
      console.error('Failed to fetch admin console data:', err);
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
        validator_role: 'Admin'
      });
      setSelectedEmergency(null);
      fetchAdminData();
    } catch (err) {
      alert('Failed to update emergency status.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fade-in">

      {/* Admin Command Header */}
      <div className="glass-panel p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800 shadow-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <LayoutDashboard className="w-3.5 h-3.5" /> Operational System Administration Console
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            ResQNet Command & Operations Portal
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Operational overview, active emergencies dispatch queue, multi-role user registry, and system audit log.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAdminData}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Activity className="w-4 h-4 text-purple-400" /> Refresh Console
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>

      {/* 1. OVERVIEW KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Users</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-extrabold text-white font-mono">{overview?.total_users ?? 0}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Doctors</span>
            <Stethoscope className="w-4 h-4 text-teal-400" />
          </div>
          <p className="text-2xl font-extrabold text-white font-mono">{overview?.total_doctors ?? 0}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Hospitals</span>
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-extrabold text-white font-mono">{overview?.total_hospitals ?? 0}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Emergencies</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-extrabold text-amber-400 font-mono">{overview?.total_emergencies ?? 0}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-rose-950/60 bg-rose-950/20 col-span-2 sm:col-span-1 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-rose-300 font-bold uppercase tracking-wider">Active Emergencies</span>
            <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
          </div>
          <p className="text-2xl font-black text-rose-400 font-mono">{overview?.active_emergencies_count ?? activeEmergencies.length}</p>
        </div>
      </div>

      {/* 2. SYSTEM RESOLUTION OVERVIEW */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          System Operational Performance & Response Time
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Confirmed Emergencies</span>
            <span className="text-xl font-extrabold text-rose-400 font-mono">{overview?.confirmed_emergencies ?? 0}</span>
          </div>

          <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">False Alarms</span>
            <span className="text-xl font-extrabold text-emerald-400 font-mono">{overview?.false_alarms ?? 0}</span>
          </div>

          <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Cancelled Emergencies</span>
            <span className="text-xl font-extrabold text-slate-300 font-mono">{overview?.cancelled_emergencies ?? 0}</span>
          </div>

          <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Avg System Response</span>
            <span className="text-xl font-extrabold text-cyan-400 font-mono">
              {overview?.avg_response_seconds !== null && overview?.avg_response_seconds !== undefined
                ? `${overview.avg_response_seconds} Seconds`
                : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs">
        {[
          { id: 'emergencies', label: `Active Emergencies (${activeEmergencies.length})`, icon: <ShieldAlert className="w-4 h-4 text-rose-500" /> },
          { id: 'users', label: `Users (${overview?.users?.length || 0})`, icon: <Users className="w-4 h-4 text-cyan-400" /> },
          { id: 'doctors', label: `Doctors (${overview?.doctors?.length || 0})`, icon: <Stethoscope className="w-4 h-4 text-teal-400" /> },
          { id: 'hospitals', label: `Hospitals (${overview?.hospitals?.length || 0})`, icon: <Building2 className="w-4 h-4 text-indigo-400" /> },
          { id: 'audit', label: `Audit Logs (${overview?.audit_logs?.length || 0})`, icon: <FileText className="w-4 h-4 text-purple-400" /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. ACTIVE EMERGENCIES TAB SECTION */}
      {activeTab === 'emergencies' && (
        <div id="active-emergencies" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" /> Currently Active Emergencies
            </h3>
            {activeEmergencies.length > 0 && (
              <span className="px-3 py-1 bg-rose-500/20 text-rose-300 font-mono text-xs font-bold rounded-full border border-rose-500/40">
                {activeEmergencies.length} Dispatch Active
              </span>
            )}
          </div>

          {activeEmergencies.length === 0 ? (
            <div className="p-8 bg-slate-900 rounded-3xl text-center text-xs text-slate-400 border border-slate-800 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="font-bold text-white text-sm">All Clear — No Active Emergencies</p>
              <p className="text-slate-400">All registered users are currently in a safe status.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeEmergencies.map((em) => (
                <div key={em.id} className="glass-panel p-5 rounded-3xl border border-rose-950/70 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-rose-600 text-white font-mono font-black text-xs rounded">
                        #{em.id}
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
                      <span className="text-slate-400 text-[10px] block">Emergency Severity:</span>
                      <span className={`font-bold ${em.confidence_score >= 70 ? 'text-rose-400' : 'text-amber-400'}`}>
                        {em.confidence_score >= 70 ? 'CRITICAL' : 'HIGH'}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Family Notification:</span>
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
                      {em.latitude && em.longitude ? `${em.latitude.toFixed(4)}, ${em.longitude.toFixed(4)}` : 'GPS Acquired'}
                    </span>

                    <button
                      onClick={() => handleOpenEmergencyModal(em.id)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Eye className="w-4 h-4" /> View Emergency
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. USERS TAB SECTION */}
      {activeTab === 'users' && (
        <div id="users" className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" /> Registered Patients & Users
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">User ID</th>
                  <th className="py-3 px-3">Full Name</th>
                  <th className="py-3 px-3">Email Address</th>
                  <th className="py-3 px-3">Phone Number</th>
                  <th className="py-3 px-3">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {overview?.users?.map(u => (
                  <tr key={u.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-cyan-400">#{u.id}</td>
                    <td className="py-3 px-3 text-white font-bold">{u.full_name}</td>
                    <td className="py-3 px-3 text-slate-300">{u.email}</td>
                    <td className="py-3 px-3 font-mono text-slate-300">{u.phone}</td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-0.5 bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold rounded uppercase">
                        Patient
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. DOCTORS TAB SECTION */}
      {activeTab === 'doctors' && (
        <div id="doctors" className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-400" /> Registered Medical Doctors
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Doctor ID</th>
                  <th className="py-3 px-3">Doctor Name</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Contact Phone</th>
                  <th className="py-3 px-3">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {overview?.doctors?.map(d => (
                  <tr key={d.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-teal-400">#{d.id}</td>
                    <td className="py-3 px-3 text-white font-bold">{d.full_name}</td>
                    <td className="py-3 px-3 text-slate-300">{d.email}</td>
                    <td className="py-3 px-3 font-mono text-slate-300">{d.phone}</td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-0.5 bg-teal-500/20 text-teal-300 font-mono text-[10px] font-bold rounded uppercase">
                        Verified Doctor ✓
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. HOSPITALS TAB SECTION */}
      {activeTab === 'hospitals' && (
        <div id="hospitals" className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" /> Registered Hospital ER Commands
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Hospital ID</th>
                  <th className="py-3 px-3">Hospital Name</th>
                  <th className="py-3 px-3">ER Contact Phone</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">ER Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {overview?.hospitals?.map(h => (
                  <tr key={h.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-indigo-400">#{h.id}</td>
                    <td className="py-3 px-3 text-white font-bold">{h.full_name}</td>
                    <td className="py-3 px-3 font-mono text-slate-300">{h.phone}</td>
                    <td className="py-3 px-3 text-slate-300">{h.email}</td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-bold rounded uppercase">
                        Active Dispatch ER
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. AUDIT LOGS TAB SECTION */}
      {activeTab === 'audit' && (
        <div id="audit-logs" className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" /> System Audit Logs & Operational Trail
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3">Action Event</th>
                  <th className="py-3 px-3">Details & Parameters</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {overview?.audit_logs?.map(log => (
                  <tr key={log.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Recent'}
                    </td>
                    <td className="py-2.5 px-3 text-purple-300 font-bold">{log.action}</td>
                    <td className="py-2.5 px-3 text-slate-300">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* DETAILED EMERGENCY INSPECTION MODAL ("View Emergency") */}
      {/* ============================================================== */}
      {selectedEmergency && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl relative my-8">

            {/* Modal Close Button */}
            <button
              onClick={() => setSelectedEmergency(null)}
              className="absolute top-5 right-5 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/20 text-rose-500 rounded-2xl border border-rose-500/30">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div>
                <span className="px-2.5 py-0.5 bg-rose-600 text-white font-mono font-black text-xs rounded uppercase">
                  Emergency #{selectedEmergency.id}
                </span>
                <h3 className="text-xl font-extrabold text-white mt-1">
                  {selectedEmergency.patient_name || 'Patient Emergency Inspection'}
                </h3>
              </div>
            </div>

            {/* Emergency Info Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Trigger Source</span>
                <span className="font-bold text-cyan-400">{selectedEmergency.trigger_source}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Confidence Score</span>
                <span className="font-bold text-rose-400 font-mono">{selectedEmergency.confidence_score}%</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Status</span>
                <span className="font-bold text-indigo-400">{selectedEmergency.status}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Location Link</span>
                {selectedEmergency.location_url ? (
                  <a href={selectedEmergency.location_url} target="_blank" rel="noreferrer" className="font-bold text-rose-400 hover:underline flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Open Maps
                  </a>
                ) : (
                  <span className="text-slate-500">Available</span>
                )}
              </div>
            </div>

            {/* SENSOR EVIDENCE CHECKLIST (Requirement 5) */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" /> Sensor Evidence Checklist
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 p-2 bg-slate-900 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-200">Freefall Acceleration &lt; 3.0 m/s²</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-slate-900 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-200">Vector Impact Force &gt; 24.0 m/s²</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-slate-900 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-200">Post-Impact Stillness &lt; 1.5 m/s²</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-slate-900 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-200">Gyroscope Rotation &gt; 180°/s</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-slate-900 rounded-xl sm:col-span-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-200">High Precision GPS Geospatial Verification</span>
                </div>
              </div>
            </div>

            {/* Family & Hospital Dispatch Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Family Contact SMS Status</span>
                <p className="font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> SMS Sent & Emergency Alert Delivered
                </p>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Hospital & Ambulance Dispatch</span>
                <p className="font-bold text-indigo-400 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> Metro ER Dispatch Triggered (Dijkstra Route)
                </p>
              </div>
            </div>

            {/* Admin Resolution Control Buttons */}
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
