import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Building2, ShieldCheck, Clock, CheckCircle2, XCircle, AlertTriangle,
  Search, ExternalLink, RefreshCw, MapPin, Phone, Star, Filter, Eye, Check, X, Layers, Activity
} from 'lucide-react';

export const AdminHospitalRegistryTab = () => {
  const [registryData, setRegistryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('all'); // all, pending, verified, unregistered
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMetrics, setSyncMetrics] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchRegistry();
  }, []);

  const fetchRegistry = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/hospitals/registry');
      setRegistryData(res.data);
    } catch (err) {
      console.error('Failed to fetch hospital registry data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshBengaluruCoverage = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/hospitals/discover-bengaluru');
      setSyncMetrics(res.data);
      fetchRegistry();
    } catch (err) {
      console.error('Failed to refresh Bengaluru hospitals dataset:', err);
      alert('Error triggering Google Places hospital discovery.');
    } finally {
      setSyncing(false);
    }
  };

  const handleVerifyAction = async (hospitalId, action) => {
    setActionLoading(hospitalId);
    try {
      await api.post('/admin/hospitals/verify', {
        hospital_id: hospitalId,
        action: action
      });
      fetchRegistry();
    } catch (err) {
      console.error(`Failed to ${action} hospital:`, err);
      alert(`Error setting hospital status to ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredHospitals = (registryData?.hospitals || []).filter((h) => {
    const matchesSearch = !searchQuery ||
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.google_place_id && h.google_place_id.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeSubTab === 'pending') return h.verification_status === 'PENDING';
    if (activeSubTab === 'verified') return h.verification_status === 'VERIFIED';
    if (activeSubTab === 'unregistered') return h.verification_status === 'UNREGISTERED' || !h.is_registered_resqnet;

    return true;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 1. Official Header & Refresh Control */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Building2 className="w-3.5 h-3.5" /> Google Places Hospitals — Bengaluru Coverage
            </span>
          </div>
          <h2 className="text-xl md:text-3xl font-black text-white tracking-tight">
            Google Places Hospitals — Bengaluru Coverage
          </h2>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Multi-zone discovery across Bengaluru. Cached database registry with explicit ResQNet status separation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshBengaluruCoverage}
            disabled={syncing}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Querying Google Places (12 Zones)...' : 'Refresh Bengaluru Hospitals'}
          </button>
        </div>
      </div>

      {/* 2. Multi-Zone Discovery Metrics Banner (When Refresh Triggered) */}
      {syncMetrics && (
        <div className="glass-panel p-6 rounded-3xl border border-cyan-500/40 bg-cyan-950/20 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2 font-mono">
              <Activity className="w-4 h-4 text-cyan-400" /> Google Places Discovery Results — {syncMetrics.label}
            </h4>
            <span className="text-[10px] text-cyan-400/80 font-mono">
              {new Date().toLocaleTimeString()}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Unique Hospitals</span>
              <span className="text-xl font-black text-white font-mono">{syncMetrics.unique_hospitals_discovered}</span>
            </div>
            <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Search Zones Used</span>
              <span className="text-xl font-black text-cyan-400 font-mono">{syncMetrics.search_zones_used} Zones</span>
            </div>
            <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">API Requests Made</span>
              <span className="text-xl font-black text-indigo-400 font-mono">{syncMetrics.api_requests_made} Calls</span>
            </div>
            <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Duplicates Removed</span>
              <span className="text-xl font-black text-amber-400 font-mono">{syncMetrics.duplicates_removed}</span>
            </div>
            <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Stored in Database</span>
              <span className="text-xl font-black text-emerald-400 font-mono">{syncMetrics.total_in_db} Records</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Discovered Hospitals</span>
          <p className="text-2xl font-black text-white font-mono">{registryData?.discovered_count ?? 0}</p>
          <span className="text-[10px] text-slate-500 block">Google Places Places API (New)</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Unregistered Hospitals</span>
          <p className="text-2xl font-black text-slate-300 font-mono">
            {(registryData?.discovered_count || 0) - (registryData?.registered_count || 0)}
          </p>
          <span className="text-[10px] text-slate-500 block">Discovered Google Places</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-amber-500/30 bg-amber-950/20 space-y-1">
          <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider block">Pending Verification</span>
          <p className="text-2xl font-black text-amber-400 font-mono">{registryData?.pending_count ?? 0}</p>
          <span className="text-[10px] text-amber-400/80 block">Requires Admin approval</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 space-y-1">
          <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">Verified ResQNet Hospitals</span>
          <p className="text-2xl font-black text-emerald-400 font-mono">{registryData?.verified_count ?? 0}</p>
          <span className="text-[10px] text-emerald-400/80 block">Emergency Dispatch Active</span>
        </div>
      </div>

      {/* 4. Filter Tabs & Search Bar */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 overflow-x-auto text-xs w-full sm:w-auto">
            {[
              { id: 'all', label: `All Discovered (${registryData?.discovered_count || 0})` },
              { id: 'unregistered', label: 'Unregistered' },
              { id: 'pending', label: `Pending Approval (${registryData?.pending_count || 0})` },
              { id: 'verified', label: `Verified ResQNet (${registryData?.verified_count || 0})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeSubTab === tab.id
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search hospital, place ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* 5. Hospitals Table */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
            <p className="text-xs font-bold text-white">Loading Google Places Bengaluru Hospital Registry...</p>
          </div>
        ) : filteredHospitals.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-white">No Hospitals Match Filter</p>
            <p className="text-xs text-slate-500">
              Click <strong className="text-cyan-400">[Refresh Bengaluru Hospitals]</strong> above to execute multi-zone Google Places discovery.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider font-mono">
                  <th className="p-3">Hospital Name</th>
                  <th className="p-3">Google Place ID</th>
                  <th className="p-3">Address</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Rating</th>
                  <th className="p-3">ResQNet Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredHospitals.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="p-3 font-sans font-bold text-white">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-100">{h.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{h.place_type || 'Hospital'}</span>
                    </td>
                    <td className="p-3 text-cyan-400 font-mono text-[11px]">
                      {h.google_place_id ? (
                        <span className="px-2 py-0.5 bg-cyan-950/40 border border-cyan-500/30 rounded text-[10px]" title={h.google_place_id}>
                          {h.google_place_id.length > 18 ? `${h.google_place_id.substring(0, 18)}...` : h.google_place_id}
                        </span>
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-300 font-sans text-[11px] max-w-xs truncate" title={h.address}>
                      {h.address}
                    </td>
                    <td className="p-3 text-slate-300">{h.phone || 'N/A'}</td>
                    <td className="p-3">
                      {h.rating ? (
                        <span className="flex items-center gap-1 text-amber-400 font-bold">
                          <Star className="w-3 h-3 fill-amber-400" /> {h.rating}
                        </span>
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </td>
                    <td className="p-3 font-sans">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-extrabold uppercase ${
                        h.verification_status === 'VERIFIED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : h.verification_status === 'PENDING'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                          : h.verification_status === 'REJECTED'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {h.verification_status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {h.maps_url && (
                          <a
                            href={h.maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg transition-colors border border-slate-700"
                            title="View on Google Maps"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {h.verification_status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleVerifyAction(h.id, 'approve')}
                              disabled={actionLoading === h.id}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-emerald-600/30"
                              title="Approve ResQNet Verification"
                            >
                              <Check className="w-3 h-3" /> Approve
                            </button>
                            <button
                              onClick={() => handleVerifyAction(h.id, 'reject')}
                              disabled={actionLoading === h.id}
                              className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer transition-all"
                              title="Reject Verification Claim"
                            >
                              <X className="w-3 h-3" /> Reject
                            </button>
                          </>
                        )}

                        {h.verification_status === 'VERIFIED' && (
                          <button
                            onClick={() => handleVerifyAction(h.id, h.is_active ? 'disable' : 'enable')}
                            disabled={actionLoading === h.id}
                            className={`px-2.5 py-1 font-bold rounded-lg text-[10px] cursor-pointer transition-all ${
                              h.is_active
                                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {h.is_active ? 'Disable' : 'Enable'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
