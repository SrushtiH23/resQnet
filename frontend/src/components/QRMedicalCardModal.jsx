import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, RefreshCw, ShieldCheck, XCircle, QrCode } from 'lucide-react';

export const QRMedicalCardModal = ({ isOpen, onClose, qrToken, user, medicalProfile, onRegenerate }) => {
  if (!isOpen) return null;

  // Extract clean token
  let cleanToken = qrToken || '';
  if (cleanToken.includes('/qr/patient/')) {
    cleanToken = cleanToken.split('/qr/patient/')[1].trim();
  }

  // Construct standard public URL for Android Camera & Google Lens scanning
  const qrUrl = cleanToken
    ? `https://resqnet-ten.vercel.app/qr/patient/${cleanToken}`
    : 'https://resqnet-ten.vercel.app';

  // Log exact payload string being encoded for verification
  console.log('==================================================');
  console.log('ResQNet QR Code Canvas Encoded Payload URL:');
  console.log(qrUrl);
  console.log('==================================================');

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in select-none">
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

          {/* High-Contrast Canvas QR Code with White Quiet Zone (4 Module Margin) */}
          <div className="p-4 bg-white rounded-3xl inline-block shadow-2xl mx-auto">
            <QRCodeCanvas
              id="resqnet-qr-canvas"
              value={qrUrl}
              size={220}
              level="M"
              marginSize={4}
              bgColor="#FFFFFF"
              fgColor="#000000"
            />
          </div>

          <div className="space-y-0.5 max-w-xs mx-auto">
            <p className="text-[11px] font-mono text-cyan-300 truncate">
              URL: {qrUrl}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">
              Token: {cleanToken || 'Generating...'}
            </p>
          </div>

          {/* Privacy Protocol Notice */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[10px] text-slate-300 flex items-center gap-2 text-left">
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span>
              <strong>Zero-Privacy-Leak Guarantee:</strong> Medical details are stored server-side. Phone cameras decode only the secure token URL.
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
