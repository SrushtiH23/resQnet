import React, { useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { QRCameraScannerModal } from '../components/QRCameraScannerModal';
import { Stethoscope, QrCode, ShieldCheck, Heart, AlertTriangle, UserCheck, FileText, CheckCircle2, Camera, Lock } from 'lucide-react';

export const DoctorDashboard = () => {
  const { user } = useAuth();
  const [qrToken, setQrToken] = useState('');
  const [scannedResult, setScannedResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showScannerModal, setShowScannerModal] = useState(false);

  const handleScanQR = async (tokenToUse) => {
    const target = tokenToUse || qrToken;
    if (!target) {
      setError('Please paste, upload, or scan a valid QR token.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/qr/scan', { qr_token: target });
      setScannedResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Doctor Authorization Failed / Invalid QR Card.');
    } finally {
      setLoading(false);
    }
  };

  const loadSampleQrToken = async () => {
    try {
      const res = await api.get('/qr/generate');
      setQrToken(res.data.qr_token);
      handleScanQR(res.data.qr_token);
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
            <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5" /> Doctor Medical Authorization Active ({user?.full_name || 'Dr. Practitioner'})
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Doctor Portal - Encrypted QR Decryptor
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Scan patient QR cards to securely unlock privacy-encrypted medical history.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowScannerModal(true)}
            className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-600/30 flex items-center gap-2 transition-all hover:scale-105"
          >
            <Camera className="w-4 h-4" /> Open Camera / Image Scanner
          </button>
          <button
            onClick={loadSampleQrToken}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2"
          >
            <QrCode className="w-4 h-4 text-cyan-400" /> Sample Patient QR
          </button>
        </div>
      </div>

      {/* Main Grid: QR Scanner + Patient Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* QR Scanner Tool */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-cyan-400" />
              Scan / Decrypt Encrypted QR Token
            </h3>

            {error && (
              <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl">
                {error}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <button
                onClick={() => setShowScannerModal(true)}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold rounded-xl shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4 animate-pulse" /> Launch Camera / Image QR Scanner
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-2 text-[10px] text-slate-500 font-mono">OR PASTE TOKEN</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              <textarea
                rows={4}
                value={qrToken}
                onChange={(e) => setQrToken(e.target.value)}
                placeholder="Paste encrypted JWT token from patient QR card..."
                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-[11px] placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />

              <button
                onClick={() => handleScanQR()}
                disabled={loading}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded-xl flex items-center justify-center gap-2"
              >
                {loading ? 'Decrypting Token...' : 'Decrypt Patient Profile'}
              </button>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <p className="font-bold text-cyan-400 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Doctor Permission Enforced:
              </p>
              <p>Only verified Doctor, Hospital, and Admin roles can decrypt medical records. Audit log auto-recorded.</p>
            </div>
          </div>
        </div>

        {/* Patient Profile View */}
        <div className="lg:col-span-2 space-y-6">
          {scannedResult ? (
            <div className="glass-panel p-6 rounded-3xl border border-cyan-500/40 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-2xl border border-cyan-500/30">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{scannedResult.patient_name}</h3>
                    <p className="text-xs text-slate-400">Phone: {scannedResult.phone || '+1-555-0192'}</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Decrypted & Verified by {scannedResult.decrypted_by || 'Doctor'}
                </span>
              </div>

              {/* Medical Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
                  <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Vital Metrics</p>
                  <p className="text-slate-200">Blood Group: <strong className="text-rose-400">{scannedResult.medical_profile?.blood_group || 'O+'}</strong></p>
                  <p className="text-slate-200">Age / Weight: <strong className="text-white">{scannedResult.medical_profile?.age || 29} yrs | {scannedResult.medical_profile?.weight || 72} kg</strong></p>
                </div>

                <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
                  <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Diagnosed Conditions</p>
                  <p className="text-amber-400 font-semibold">{scannedResult.medical_profile?.diseases || 'Type 1 Diabetes, Asthma'}</p>
                </div>

                <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
                  <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Allergies & Contraindications</p>
                  <p className="text-rose-400 font-semibold">{scannedResult.medical_profile?.allergies || 'Penicillin, Peanuts'}</p>
                </div>

                <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
                  <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Active Medications</p>
                  <p className="text-cyan-400 font-semibold">{scannedResult.medical_profile?.medications || 'Insulin Glargine 10U, Ventolin'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-12 rounded-3xl border border-slate-800 text-center space-y-3">
              <QrCode className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-base font-bold text-slate-300">No Patient Record Decrypted Yet</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Click "Open Camera / Image Scanner" above or paste a token to unlock patient medical records.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* QR Camera Scanner Modal */}
      <QRCameraScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onScanSuccess={(token) => {
          setQrToken(token);
          handleScanQR(token);
        }}
      />
    </div>
  );
};
