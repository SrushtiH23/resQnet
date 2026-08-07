import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Printer, ShieldCheck, XCircle, Heart, PhoneCall, QrCode, User } from 'lucide-react';

export const QRMedicalCardModal = ({ isOpen, onClose, qrToken, user, medicalProfile }) => {
  const canvasRef = useRef(null);

  if (!isOpen) return null;

  const handleDownload = () => {
    // Find canvas rendered inside the modal
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-panel p-6 rounded-3xl max-w-md w-full border border-slate-700 space-y-5 shadow-2xl relative">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">ResQNet Encrypted Medical Card</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
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
            <span className="px-2.5 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/40 text-xs font-mono font-bold rounded-lg">
              Blood: {medicalProfile?.blood_group || 'O+'}
            </span>
          </div>

          {/* Real Canvas QR Code */}
          <div className="p-4 bg-white rounded-2xl inline-block shadow-2xl mx-auto border-4 border-slate-800">
            <QRCodeCanvas
              id="resqnet-qr-canvas"
              value={qrToken || 'resqnet_medical_card_placeholder'}
              size={180}
              level="H"
              includeMargin={true}
            />
          </div>

          {/* Patient Summary Snapshot */}
          <div className="grid grid-cols-2 gap-2 text-[11px] text-left">
            <div className="p-2 bg-slate-900/90 rounded-xl border border-slate-800 space-y-0.5">
              <span className="text-slate-400 text-[10px]">Primary Doctor:</span>
              <p className="font-semibold text-cyan-300 truncate">{medicalProfile?.doctor_name || 'Dr. Robert Chen'}</p>
            </div>
            <div className="p-2 bg-slate-900/90 rounded-xl border border-slate-800 space-y-0.5">
              <span className="text-slate-400 text-[10px]">Emergency Phone:</span>
              <p className="font-semibold text-amber-300 truncate">{user?.phone || '+1 (555) 019-2831'}</p>
            </div>
          </div>

          {/* Privacy Footnote */}
          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[10px] text-slate-400 flex items-center gap-2 text-left">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Encrypted Token: Only verified Doctor & Hospital roles can decrypt records.</span>
          </div>
        </div>

        {/* Action Buttons: Download & Print */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={handleDownload}
            className="py-3 px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 transition-all hover:scale-105"
          >
            <Download className="w-4 h-4" /> Download QR (PNG)
          </button>
          <button
            onClick={handlePrint}
            className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 transition-all hover:scale-105"
          >
            <Printer className="w-4 h-4 text-amber-400" /> Print Medical Card
          </button>
        </div>
      </div>
    </div>
  );
};
