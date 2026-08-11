import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { History, Clock, AlertTriangle, ShieldCheck, CheckCircle2, XCircle, MapPin, Eye, FileText, X } from 'lucide-react';

export const EmergencyHistoryPage = () => {
  const [historyEvents, setHistoryEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    fetchEmergencyHistory();
  }, []);

  const fetchEmergencyHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/emergency/history');
      setHistoryEvents(res.data);
    } catch (err) {
      console.error('Failed to load emergency history from database:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = historyEvents.filter(e => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'CONFIRMED') return ['Confirmed', 'Hospital Dispatched', 'Ambulance Dispatched'].includes(e.status);
    if (filterStatus === 'FALSE_ALARM') return e.status === 'False Alarm';
    if (filterStatus === 'RESOLVED') return e.status === 'Resolved';
    if (filterStatus === 'CANCELLED') return e.status === 'Cancelled';
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
        <div>
          <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 w-fit mb-1 font-mono">
            <History className="w-3.5 h-3.5" /> Database Emergency Incident Log Archive
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Emergency Incident History & Timelines
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Database-backed historical incident archive, stage progression logs, and resolution audits.
          </p>
        </div>

        <button
          onClick={fetchEmergencyHistory}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-all"
        >
          <Clock className="w-4 h-4 text-amber-400" /> Refresh Incident Log
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Incident Records</span>
          <span className="text-2xl font-extrabold text-white font-mono">{historyEvents.length}</span>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Confirmed Emergencies</span>
          <span className="text-2xl font-extrabold text-rose-400 font-mono">
            {historyEvents.filter(e => ['Confirmed', 'Hospital Dispatched', 'Ambulance Dispatched'].includes(e.status)).length}
          </span>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">False Alarms</span>
          <span className="text-2xl font-extrabold text-emerald-400 font-mono">
            {historyEvents.filter(e => e.status === 'False Alarm').length}
          </span>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Resolved Incidents</span>
          <span className="text-2xl font-extrabold text-cyan-400 font-mono">
            {historyEvents.filter(e => e.status === 'Resolved').length}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs">
        {[
          { id: 'ALL', label: `All Incidents (${historyEvents.length})` },
          { id: 'CONFIRMED', label: 'Confirmed / Dispatched' },
          { id: 'FALSE_ALARM', label: 'False Alarms' },
          { id: 'RESOLVED', label: 'Resolved' },
          { id: 'CANCELLED', label: 'Cancelled' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterStatus === tab.id
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Incident History List */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400 font-mono animate-pulse">
          Loading actual emergency history from database...
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl border border-slate-800 text-center space-y-2">
          <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-base font-bold text-slate-300">No Incident Records Found</p>
          <p className="text-xs text-slate-500">There are no matching emergency incident records in the database archive.</p>
        </div>
      ) : (
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Case ID</th>
                  <th className="py-3 px-3">Patient Name</th>
                  <th className="py-3 px-3">Trigger Source</th>
                  <th className="py-3 px-3">Confidence</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredEvents.map(e => (
                  <tr key={e.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3.5 px-3 font-mono font-bold text-amber-400">#{e.id}</td>
                    <td className="py-3.5 px-3 text-white font-bold">{e.patient_name}</td>
                    <td className="py-3.5 px-3 text-cyan-400">{e.trigger_source}</td>
                    <td className="py-3.5 px-3 font-mono font-bold text-rose-400">{e.confidence_score}%</td>
                    <td className="py-3.5 px-3">
                      <span className={`px-2.5 py-0.5 font-mono text-[10px] font-bold rounded uppercase border ${
                        e.status === 'Resolved' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' :
                        e.status === 'False Alarm' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                        'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-slate-400 font-mono text-[11px]">
                      {e.created_at ? new Date(e.created_at).toLocaleString() : 'N/A'}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <button
                        onClick={() => setSelectedEvent(e)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 ml-auto cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-400" /> View Timeline Logs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed Timeline Inspection Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative my-8 text-slate-100">
            
            <button
              onClick={() => setSelectedEvent(null)}
              className="absolute top-5 right-5 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                <FileText className="w-7 h-7" />
              </div>
              <div>
                <span className="px-2.5 py-0.5 bg-amber-600 text-white font-mono font-black text-xs rounded uppercase">
                  Incident #{selectedEvent.id} Logs
                </span>
                <h3 className="text-xl font-extrabold text-white mt-1">
                  {selectedEvent.patient_name} — Stage Timeline
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Trigger Source:</span>
                <span className="font-bold text-cyan-400">{selectedEvent.trigger_source}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Final Status:</span>
                <span className="font-bold text-emerald-400">{selectedEvent.status}</span>
              </div>
            </div>

            {/* Time-Stamped Emergency Log Progression */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Database Time-Stamped Escalation Logs ({selectedEvent.logs?.length || 0}):
              </h4>
              
              {selectedEvent.logs && selectedEvent.logs.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {selectedEvent.logs.map((log, index) => (
                    <div key={log.id || index} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <span className="font-bold text-amber-400 block">{log.stage_name}</span>
                        <p className="text-slate-300 text-[11px] mt-0.5">{log.description}</p>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'Recent'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 text-center">
                  Incident registered in database at {selectedEvent.created_at ? new Date(selectedEvent.created_at).toLocaleString() : 'N/A'}.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
