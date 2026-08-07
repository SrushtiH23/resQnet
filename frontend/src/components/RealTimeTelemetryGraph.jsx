import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Activity, LineChart } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export const RealTimeTelemetryGraph = ({ currentAccel = 9.81, isMonitoring = true }) => {
  const [dataPoints, setDataPoints] = useState([
    { time: '18:20:00', accel: 9.81 },
    { time: '18:20:01', accel: 9.79 },
    { time: '18:20:02', accel: 9.84 },
    { time: '18:20:03', accel: 9.81 },
    { time: '18:20:04', accel: 9.82 },
    { time: '18:20:05', accel: 9.80 },
  ]);

  useEffect(() => {
    let interval;
    if (isMonitoring) {
      interval = setInterval(() => {
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];
        const val = currentAccel !== undefined ? currentAccel : +(9.81 + (Math.random() * 0.1 - 0.05)).toFixed(2);

        setDataPoints((prev) => {
          const updated = [...prev, { time: timeStr, accel: val }];
          return updated.slice(-20); // Keep last 20 real-time waveform points
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isMonitoring, currentAccel]);

  const chartData = {
    labels: dataPoints.map((dp) => dp.time),
    datasets: [
      {
        label: 'Acceleration Waveform (m/s²)',
        data: dataPoints.map((dp) => dp.accel),
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.15)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#06b6d4',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#38bdf8',
        borderColor: '#334155',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: { color: '#94a3b8', font: { size: 10 } },
      },
      y: {
        min: 0,
        max: 30,
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: { color: '#94a3b8', font: { size: 10 } },
      },
    },
  };

  return (
    <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3 shadow-2xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400 animate-pulse" />
          <div>
            <h3 className="text-base font-bold text-white">Live Telemetry Waveform Graph</h3>
            <p className="text-[11px] text-slate-400">Real-time Acceleration (m/s²) vs Time (s)</p>
          </div>
        </div>
        <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-mono font-bold rounded-xl">
          Live Stream: {currentAccel} m/s²
        </span>
      </div>

      <div className="h-48 w-full">
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};
