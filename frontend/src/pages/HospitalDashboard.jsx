import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Building2, Navigation, Truck, Bed, ShieldAlert, CheckCircle, MapPin, Activity, Zap } from 'lucide-react';

export const HospitalDashboard = () => {
  const [emergencies, setEmergencies] = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [hospitalRoutes, setHospitalRoutes] = useState([]);
  const [beds, setBeds] = useState(14);

  useEffect(() => {
    fetchActiveEmergencies();
    fetchAmbulances();
    fetchRoutes();
  }, []);

  const fetchActiveEmergencies = async () => {
    try {
      const res = await api.get('/emergency/active');
      setEmergencies(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAmbulances = async () => {
    try {
      const res = await api.get('/hospital/ambulances');
      setAmbulances(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRoutes = async () => {
    try {
      const res = await api.get('/hospital/routing?lat=37.7755&lon=-122.4210');
      setHospitalRoutes(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <CheckCircle className="w-3.5 h-3.5" /> Verified ResQNet Emergency Hospital Account
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Hospital Dispatch & Dijkstra Routing
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Verified ResQNet hospital account linked with Google Places API ID. Emergency dispatch active.
          </p>
        </div>

        {/* ER Bed Status Counter */}
        <div className="flex items-center gap-3 bg-slate-900 px-5 py-3 rounded-2xl border border-slate-800">
          <Bed className="w-6 h-6 text-indigo-400" />
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Available ER Beds</p>
            <p className="text-xl font-extrabold text-white font-mono">{beds} Beds Available</p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Incoming Dispatch Queue & Dijkstra Pathfinding */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Emergency Dispatch Queue */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                Active Emergency Dispatch Queue
              </h3>
              <span className="px-3 py-1 bg-rose-500/10 text-rose-400 font-mono text-xs font-bold rounded-full border border-rose-500/20">
                {emergencies.length} Active Cases
              </span>
            </div>

            <div className="space-y-3">
              {emergencies.length === 0 ? (
                <div className="p-6 bg-slate-900 rounded-2xl text-center text-xs text-slate-400">
                  No active emergencies pending dispatch right now.
                </div>
              ) : (
                emergencies.map((em) => (
                  <div key={em.id} className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-rose-600 text-white font-black rounded text-[10px] uppercase font-mono">
                          Case #{em.id}
                        </span>
                        {em.is_demo && (
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-mono font-bold rounded uppercase">
                            🧪 TEST MODE / DEMO DATA
                          </span>
                        )}
                        <h4 className="font-bold text-white text-sm">
                          Trigger: {em.trigger_source}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 font-bold text-xs rounded border border-amber-500/40">
                          Confidence: {em.confidence_score}%
                        </span>
                        <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 font-bold text-xs rounded border border-indigo-500/40">
                          {em.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-300 font-mono pt-1">
                      <div>Location: ({em.latitude.toFixed(4)}, {em.longitude.toFixed(4)})</div>
                      <div>Network: {em.network_status}</div>
                      <div>Battery: {em.battery_level}%</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Module 12: Graph Routing (Dijkstra / A*) */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Navigation className="w-5 h-5 text-cyan-400" />
              Graph-Based Dijkstra & A* Hospital Routing Engine
            </h3>
            <p className="text-xs text-slate-400">
              Evaluates weighted shortest path based on geographic distance + hospital bed availability + speed.
            </p>

            <div className="space-y-3">
              {hospitalRoutes.map((route, i) => (
                <div key={route.hospital_id || i} className={`p-4 rounded-2xl border ${i === 0 ? 'bg-indigo-950/40 border-indigo-500/50' : 'bg-slate-900 border-slate-800'} space-y-2`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white text-sm flex items-center gap-2">
                      {i === 0 && <span className="px-2 py-0.5 bg-emerald-500 text-slate-950 font-black rounded text-[9px] uppercase">Optimal Route</span>}
                      {route.hospital_name}
                    </span>
                    <span className="font-mono font-bold text-cyan-400">ETA: {route.eta_minutes} mins</span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono pt-1 border-t border-slate-800/80">
                    <span>Distance: <strong>{route.distance_km} km</strong></span>
                    <span>Beds: <strong className="text-emerald-400">{route.available_beds} Available</strong></span>
                    <span>Algorithm: <strong className="text-purple-400">{route.algorithm} Pathfinding</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar: Priority Queue Ambulance Allocator (Module 13) */}
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-400" />
              Ambulance Priority Queue (Heap)
            </h3>
            <p className="text-xs text-slate-400">
              Prioritizes Critical cases ($Rank = 1$) over High/Medium.
            </p>

            <div className="space-y-3">
              {ambulances.map((amb) => (
                <div key={amb.id} className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white font-mono">{amb.vehicle_number}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      amb.status === 'Available' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {amb.status}
                    </span>
                  </div>
                  <p className="text-slate-400">Driver: {amb.driver_name} ({amb.driver_phone})</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
