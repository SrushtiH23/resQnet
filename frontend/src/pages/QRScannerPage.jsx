import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, QrCode, ArrowRight, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../services/api';

export const QRScannerPage = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [tokenInput, setTokenInput] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraActive(true);
        }
      } else {
        setCameraError('Camera access not supported on this browser.');
      }
    } catch (err) {
      console.warn('Camera permission notice:', err);
      setCameraError('Camera permission denied or camera unavailable. You can enter or paste the QR token manually below.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const handleScanSubmit = (e) => {
    e && e.preventDefault();
    if (!tokenInput.trim()) return;

    let cleanToken = tokenInput.trim();
    if (cleanToken.includes('/qr/patient/')) {
      cleanToken = cleanToken.split('/qr/patient/')[1].trim();
    }
    navigate(`/qr/patient/${cleanToken}`);
  };

  const handleSampleScan = async () => {
    setLoading(true);
    try {
      const res = await api.get('/qr/generate');
      if (res.data && res.data.qr_token) {
        navigate(`/qr/patient/${res.data.qr_token}`);
      }
    } catch (err) {
      alert('Failed to generate sample patient QR token.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-2 text-center shadow-2xl">
        <div className="mx-auto w-14 h-14 bg-cyan-500/20 text-cyan-400 rounded-2xl border border-cyan-500/40 flex items-center justify-center mb-2">
          <QrCode className="w-8 h-8" />
        </div>
        <h1 className="text-2xl md:text-4xl font-black text-white">ResQNet QR Code Scanner</h1>
        <p className="text-xs md:text-sm text-slate-400 max-w-md mx-auto">
          Scan a patient's ResQNet Emergency QR code to immediately retrieve role-authorized medical information.
        </p>
      </div>

      {/* Camera Viewport / Stream Container */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6 shadow-2xl text-center relative overflow-hidden">
        <div className="relative mx-auto max-w-sm w-full aspect-square rounded-3xl overflow-hidden border-2 border-cyan-500/50 bg-slate-950 flex flex-col items-center justify-center">
          {cameraActive ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="p-6 text-slate-400 space-y-3 flex flex-col items-center justify-center h-full">
              <Camera className="w-12 h-12 text-slate-600 animate-pulse" />
              <p className="text-xs text-slate-400 max-w-xs">{cameraError || 'Initializing camera viewfinder...'}</p>
            </div>
          )}

          {/* Scanner Target Box Overlay */}
          <div className="absolute inset-8 border-2 border-dashed border-cyan-400/80 rounded-2xl pointer-events-none flex items-center justify-center shadow-inner">
            <span className="bg-cyan-500/20 text-cyan-300 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-cyan-400/50 backdrop-blur-md animate-pulse">
              Align QR Code Inside Frame
            </span>
          </div>
        </div>

        {/* Camera Error / Manual Toggle Notice */}
        {cameraError && (
          <div className="p-4 bg-amber-950/70 border border-amber-500/40 rounded-2xl text-xs text-amber-200 flex items-start gap-2.5 text-left max-w-md mx-auto">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-300">Camera Notice</p>
              <p className="text-[11px] text-amber-200/90">{cameraError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Manual Token Input Fallback */}
      <form onSubmit={handleScanSubmit} className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 shadow-2xl">
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
            Or Enter / Paste QR Token / URL Manually:
          </label>
          <p className="text-[11px] text-slate-400">
            Paste full QR URL (<code className="text-cyan-400">https://resqnet-ten.vercel.app/qr/patient/rq_tok_...</code>) or token string.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="rq_tok_..."
            className="flex-1 px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={!tokenInput.trim()}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <span>Inspect QR Profile</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="pt-2 border-t border-slate-900 flex justify-between items-center text-xs">
          <span className="text-slate-400">Want to test with a active sample token?</span>
          <button
            type="button"
            onClick={handleSampleScan}
            disabled={loading}
            className="text-cyan-400 hover:text-cyan-300 font-bold underline flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Generating...' : 'Scan Sample Patient QR'}
          </button>
        </div>
      </form>
    </div>
  );
};
