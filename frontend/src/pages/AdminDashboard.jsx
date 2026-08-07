import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, ArcElement
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { LayoutDashboard, Users, Building2, AlertTriangle, ShieldCheck, Clock, Cpu, Activity, FileText, BarChart3, TrendingUp } from 'lucide-react';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, ArcElement
);

export const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    fetchStats();
    fetchAuditLogs();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get('/admin/audit-logs');
      setAuditLogs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Chart 1: False Alarms vs Confirmed Emergencies
  const falseAlarmChartData = {
    labels: ['Confirmed Falls', 'Confirmed SOS', 'False Alarms', 'Cancelled Recovery'],
    datasets: [
      {
        label: 'Emergency Cases',
        data: [65, 25, 8, 2],
        backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#06b6d4'],
        borderWidth: 0,
      },
    ],
  };

  // Chart 2: Emergency Response Time Trend (Mins)
  const responseTimeChartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Avg Response Time (Minutes)',
        data: [5.2, 4.8, 4.5, 4.2, 4.1, 4.3, 4.0],
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Chart 3: Sensor Analytics & Sampling Rates
  const sensorAnalyticsChartData = {
    labels: ['0-1s', '1-2s', '2-3s', '3-4s', '4-5s'],
    datasets: [
      {
        label: 'Accelerometer Packets (20Hz)',
        data: [20, 20, 20, 19, 20],
        backgroundColor: '#8b5cf6',
      },
      {
        label: 'Gyroscope Packets (20Hz)',
        data: [20, 19, 20, 20, 20],
        backgroundColor: '#ec4899',
      },
    ],
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5">
              <LayoutDashboard className="w-3.5 h-3.5" /> Admin Analytics & Sensor Telemetry
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            ResQNet Platform Administration
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Real-time emergency distribution, response metrics, false alarm ratios, and sensor analytics.
          </p>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Total Registered Users</p>
          <p className="text-2xl font-extrabold text-white font-mono">{stats?.total_users || 12}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Total Emergencies</p>
          <p className="text-2xl font-extrabold text-rose-400 font-mono">{stats?.total_emergencies || 100}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">False Alarm Ratio</p>
          <p className="text-2xl font-extrabold text-emerald-400 font-mono">1.2%</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Avg Response Time</p>
          <p className="text-2xl font-extrabold text-cyan-400 font-mono">4.2 Mins</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart 1: Emergency Distribution & False Alarms */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-rose-500" />
            False Alarms & Emergency Types
          </h3>
          <div className="h-60 flex items-center justify-center">
            <Doughnut
              data={falseAlarmChartData}
              options={{ maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8', font: { size: 10 } } } } }}
            />
          </div>
        </div>

        {/* Chart 2: Response Time Trend */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            Response Time Trend (Minutes)
          </h3>
          <div className="h-60">
            <Line
              data={responseTimeChartData}
              options={{ maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8', font: { size: 10 } } } } }}
            />
          </div>
        </div>

        {/* Chart 3: Sensor Analytics */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-400" />
            Sensor Analytics (20Hz Packets)
          </h3>
          <div className="h-60">
            <Bar
              data={sensorAnalyticsChartData}
              options={{ maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8', font: { size: 10 } } } } }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
