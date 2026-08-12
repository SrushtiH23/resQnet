import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, RefreshCw, ShieldCheck, XCircle, QrCode } from 'lucide-react';

export const QRMedicalCardModal = ({ isOpen, onClose, qrToken, user, medicalProfile, onRegenerate }) => {
  if (!isOpen) return null;

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://resqnet-ten.vercel.app';
  const qrUrl = qrToken?.startsWith('http') ? qrToken : `${baseUrl}/qr/patient/${qrToken}`;

  const handleDownload = () => {
    const canvas = document.getElementById('resqnet-qr-canvas');
    if (!canvas) {
      alert('QR Canvas not found');
      return;
    }
    const imageURI = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = imageURI;
    link.download = `ResQNet-Medical-Card-${user?.full_name || 'Patient'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRegenerateClick = () => {
    if (window.confirm('Are you sure you want to regenerate your QR Code? Any printed or saved copies of the old QR code will become permanently inactive.')) {
      if (onRegenerate) onRegenerate();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass-panel p-6 rounded-3xl max-w-md w-full border border-slate-700 space-y-5 shadow-2xl relative">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">ResQNet Privacy-Preserving Emergency QR Card</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Card Area */}
        <div id="printable-medical-card" className="p-5 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-700 rounded-2xl shadow-xl space-y-4 text-center">
          <div className="flex items-center justify-between text-left">
            <div>
              <p className="text-[10px] text-cyan-400 font-extrabold uppercase tracking-widest">ResQNet Emergency Card</p>
              <h4 className="text-lg font-black text-white">{user?.full_name || 'Patient Emergency Card'}</h4>
            </div>
            <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-mono font-bold rounded-lg flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              ACTIVE
            </span>
          </div>

          {/* Secure Canvas QR Code (Contains ONLY secure URL/Token) */}
          <div className="p-4 bg-white rounded-2xl inline-block shadow-2xl mx-auto border-4 border-slate-800">
            <QRCodeCanvas
              id="resqnet-qr-canvas"
              value={qrUrl}
              size={190}
              level="H"
              includeMargin={true}
            />
          </div>

          <p className="text-[11px] font-mono text-slate-400 truncate max-w-xs mx-auto">
            Token: <span className="text-cyan-300">{qrToken || 'generating...'}</span>
          </p>

          {/* Privacy Protocol Notice */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[10px] text-slate-300 flex items-center gap-2 text-left">
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span>
              <strong>Zero-Privacy-Leak Guarantee:</strong> No medical records or phone numbers are encoded in this image. Scanner authorization dictates what information is exposed.
            </span>
          </div>
        </div>

        {/* Action Buttons: Download & Regenerate */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={handleDownload}
            className="py-3 px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 transition-all hover:scale-105 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Download PNG
          </button>
          <button
            onClick={handleRegenerateClick}
            className="py-3 px-4 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-amber-500/40 transition-all hover:scale-105 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-amber-400" /> Regenerate QR
          </button>
        </div>
      </div>
    </div>
  );
};
