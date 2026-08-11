import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
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
import { MedicalProfilePage } from './pages/MedicalProfilePage';

function FallbackRedirect() {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (user && role) {
    return <Navigate to={`/${role}-dashboard`} replace />;
  }
  return <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Role-Specific Dashboards */}
          <Route
            path="/user-dashboard"
            element={
              <ProtectedRoute allowedRoles={['user']}>
                <UserDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/family-dashboard"
            element={
              <ProtectedRoute allowedRoles={['family']}>
                <FamilyDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor-dashboard"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hospital-dashboard"
            element={
              <ProtectedRoute allowedRoles={['hospital']}>
                <HospitalDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Shared Technical Modules */}
          <Route
            path="/live-monitoring"
            element={
              <ProtectedRoute allowedRoles={['user', 'family', 'hospital', 'admin']}>
                <LiveMonitoringPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sensor-analytics"
            element={
              <ProtectedRoute allowedRoles={['user', 'admin']}>
                <SensorAnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/emergency-analysis"
            element={
              <ProtectedRoute allowedRoles={['user', 'doctor', 'hospital', 'admin']}>
                <EmergencyAnalysisPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-decision-engine"
            element={
              <ProtectedRoute allowedRoles={['user', 'admin']}>
                <AIDecisionEnginePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/emergency-history"
            element={
              <ProtectedRoute allowedRoles={['user', 'family', 'doctor', 'hospital', 'admin']}>
                <EmergencyHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/medical-profile"
            element={
              <ProtectedRoute allowedRoles={['user', 'doctor', 'hospital', 'admin']}>
                <MedicalProfilePage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<FallbackRedirect />} />
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

