import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { UserDashboard } from './pages/UserDashboard';
import { FamilyDashboard } from './pages/FamilyDashboard';
import { DoctorDashboard } from './pages/DoctorDashboard';
import { HospitalDashboard } from './pages/HospitalDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { LiveMonitoringPage } from './pages/LiveMonitoringPage';
import { SensorAnalyticsPage } from './pages/SensorAnalyticsPage';
import { EmergencyAnalysisPage } from './pages/EmergencyAnalysisPage';
import { AIDecisionEnginePage } from './pages/AIDecisionEnginePage';
import { EmergencyHistoryPage } from './pages/EmergencyHistoryPage';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading ResQNet...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function AppRoutes() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/user-dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
          <Route path="/live-monitoring" element={<ProtectedRoute><LiveMonitoringPage /></ProtectedRoute>} />
          <Route path="/sensor-analytics" element={<ProtectedRoute><SensorAnalyticsPage /></ProtectedRoute>} />
          <Route path="/emergency-analysis" element={<ProtectedRoute><EmergencyAnalysisPage /></ProtectedRoute>} />
          <Route path="/ai-decision-engine" element={<ProtectedRoute><AIDecisionEnginePage /></ProtectedRoute>} />
          <Route path="/emergency-history" element={<ProtectedRoute><EmergencyHistoryPage /></ProtectedRoute>} />

          <Route path="/family-dashboard" element={<ProtectedRoute><FamilyDashboard /></ProtectedRoute>} />
          <Route path="/doctor-dashboard" element={<ProtectedRoute><DoctorDashboard /></ProtectedRoute>} />
          <Route path="/hospital-dashboard" element={<ProtectedRoute><HospitalDashboard /></ProtectedRoute>} />
          <Route path="/admin-dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        ResQNet Emergency Intelligence Platform &copy; 2026. 4-Layer Architecture & DSA Decision Engine.
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
