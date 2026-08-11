import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { QRMedicalCardModal } from '../components/QRMedicalCardModal';
import { IndianPhoneInput, validateIndianPhone } from '../components/IndianPhoneInput';
import { User, Heart, QrCode, Phone, Plus, Trash2, Edit3, Save, ShieldCheck, CheckCircle } from 'lucide-react';

export const MedicalProfilePage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    blood_group: 'O+',
    age: 32,
    weight: 70.0,
    diseases: 'Type 1 Diabetes, Asthma',
    medications: 'Insulin, Albuterol Inhaler',
    allergies: 'Penicillin',
    insurance_details: 'HDFC Ergo Health #99281',
    doctor_name: 'Dr. Robert Chen',
    doctor_phone: '9876543210',
    emergency_notes: 'Keep glucose tablet in pocket'
  });
  const [contacts, setContacts] = useState([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrToken, setQrToken] = useState('');
  const [newContact, setNewContact] = useState({
    contact_name: '',
    relationship_type: 'Mother',
    phone: '',
    email: '',
    escalation_order: 1
  });
  const [showAddContact, setShowAddContact] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    fetchProfile();
    fetchContacts();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/user/medical-profile');
      if (res.data) setProfile(res.data);
    } catch (err) {
      console.error('Error fetching medical profile:', err);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await api.get('/user/family-contacts');
      if (res.data) setContacts(res.data);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await api.put('/user/medical-profile', profile);
      setEditingProfile(false);
      alert('Medical profile updated successfully.');
    } catch (err) {
      alert('Failed to update medical profile.');
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    const err = validateIndianPhone(newContact.phone);
    if (err) {
      setPhoneError(err);
      return;
    }

    try {
      await api.post('/user/family-contacts', {
        ...newContact,
        escalation_order: contacts.length + 1
      });
      setNewContact({ contact_name: '', relationship_type: 'Mother', phone: '', email: '', escalation_order: 1 });
      setShowAddContact(false);
      setPhoneError('');
      fetchContacts();
    } catch (err) {
      alert('Failed to add contact.');
    }
  };

  const handleDeleteContact = async (contactId) => {
    if (!window.confirm('Delete this emergency contact?')) return;
    try {
      await api.delete(`/user/family-contacts/${contactId}`);
      fetchContacts();
    } catch (err) {
      alert('Failed to delete contact.');
    }
  };

  const handleGenerateQR = async () => {
    try {
      const res = await api.get('/qr/generate');
      setQrToken(res.data.qr_token);
      setShowQrModal(true);
    } catch (err) {
      alert('Failed to generate encrypted QR card.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex items-center justify-between flex-wrap gap-4">
        <div>
          <span className="px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 w-fit mb-1">
            <Heart className="w-3.5 h-3.5" /> Confidential Patient Record
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Medical Profile & Emergency Contacts
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Manage your personal medical parameters, emergency contacts, and generate encrypted QR cards.
          </p>
        </div>

        <button
          onClick={handleGenerateQR}
          className="px-5 py-3 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs rounded-2xl shadow-lg flex items-center gap-2 transition-all hover:scale-105"
        >
          <QrCode className="w-4 h-4" /> Generate Encrypted QR Card
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Medical Profile Form/Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-rose-400" />
                Medical Information Snapshot
              </h3>
              <button
                onClick={() => setEditingProfile(!editingProfile)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                {editingProfile ? 'Cancel Editing' : 'Edit Profile'}
              </button>
            </div>

            {editingProfile ? (
              <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Blood Group</label>
                    <select
                      value={profile.blood_group || 'O+'}
                      onChange={(e) => setProfile({ ...profile, blood_group: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-rose-500"
                    >
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Age</label>
                    <input
                      type="number"
                      value={profile.age || ''}
                      onChange={(e) => setProfile({ ...profile, age: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={profile.weight || ''}
                      onChange={(e) => setProfile({ ...profile, weight: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Diagnosed Conditions / Diseases</label>
                    <input
                      type="text"
                      value={profile.diseases || ''}
                      onChange={(e) => setProfile({ ...profile, diseases: e.target.value })}
                      placeholder="e.g. Type 1 Diabetes, Asthma"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Allergies</label>
                    <input
                      type="text"
                      value={profile.allergies || ''}
                      onChange={(e) => setProfile({ ...profile, allergies: e.target.value })}
                      placeholder="e.g. Penicillin, Latex"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Current Medications</label>
                    <input
                      type="text"
                      value={profile.medications || ''}
                      onChange={(e) => setProfile({ ...profile, medications: e.target.value })}
                      placeholder="e.g. Insulin, Albuterol"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Insurance Policy Details</label>
                    <input
                      type="text"
                      value={profile.insurance_details || ''}
                      onChange={(e) => setProfile({ ...profile, insurance_details: e.target.value })}
                      placeholder="e.g. Policy #99281"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Primary Physician Name</label>
                    <input
                      type="text"
                      value={profile.doctor_name || ''}
                      onChange={(e) => setProfile({ ...profile, doctor_name: e.target.value })}
                      placeholder="e.g. Dr. Robert Chen"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Doctor Phone (+91)</label>
                    <IndianPhoneInput
                      value={profile.doctor_phone || ''}
                      onChange={(val) => setProfile({ ...profile, doctor_phone: val })}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
                >
                  <Save className="w-4 h-4" /> Save Medical Profile
                </button>
              </form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Blood Group & Physical</span>
                  <p className="font-extrabold text-white text-base">Blood: <span className="text-rose-400">{profile.blood_group || 'O+'}</span> | Age: {profile.age || 32} | {profile.weight || 70} kg</p>
                </div>

                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Diagnosed Conditions</span>
                  <p className="font-bold text-amber-400 text-sm">{profile.diseases || 'None listed'}</p>
                </div>

                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Known Allergies</span>
                  <p className="font-bold text-rose-400 text-sm">{profile.allergies || 'None listed'}</p>
                </div>

                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Active Medications</span>
                  <p className="font-bold text-cyan-400 text-sm">{profile.medications || 'None listed'}</p>
                </div>

                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Primary Physician</span>
                  <p className="font-bold text-white text-sm">{profile.doctor_name || 'Dr. Robert Chen'} ({profile.doctor_phone || 'N/A'})</p>
                </div>

                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Insurance Policy</span>
                  <p className="font-bold text-emerald-400 text-sm">{profile.insurance_details || 'N/A'}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Emergency Contacts Management */}
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Phone className="w-5 h-5 text-amber-400" />
                Emergency Contacts ({contacts.length})
              </h3>
              <button
                onClick={() => setShowAddContact(!showAddContact)}
                className="px-3 py-1.5 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Contact
              </button>
            </div>

            {showAddContact && (
              <form onSubmit={handleAddContact} className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newContact.contact_name}
                    onChange={(e) => setNewContact({ ...newContact, contact_name: e.target.value })}
                    placeholder="e.g. Sarah Mercer"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Relationship</label>
                  <select
                    value={newContact.relationship_type}
                    onChange={(e) => setNewContact({ ...newContact, relationship_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  >
                    {['Mother', 'Father', 'Spouse', 'Brother', 'Sister', 'Friend', 'Physician', 'Other'].map((rel) => (
                      <option key={rel} value={rel}>{rel}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Mobile Number (+91)</label>
                  <IndianPhoneInput
                    value={newContact.phone}
                    onChange={(val) => {
                      setNewContact({ ...newContact, phone: val });
                      if (phoneError) setPhoneError('');
                    }}
                    error={phoneError}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl transition-all"
                >
                  Save Emergency Contact
                </button>
              </form>
            )}

            <div className="space-y-3">
              {contacts.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">No emergency contacts saved.</p>
              ) : (
                contacts.map((contact, idx) => (
                  <div key={contact.id || idx} className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-extrabold text-white">{contact.contact_name}</p>
                      <p className="text-[11px] text-slate-400">{contact.relationship_type} • <span className="font-mono text-amber-400">{contact.phone}</span></p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-mono font-bold rounded">
                        Priority #{contact.escalation_order || idx + 1}
                      </span>
                      <button
                        onClick={() => handleDeleteContact(contact.id)}
                        className="p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg"
                        title="Delete contact"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <QRMedicalCardModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        qrToken={qrToken}
      />
    </div>
  );
};
