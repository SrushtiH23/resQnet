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
    age: '',
    weight: '',
    diseases: '',
    medications: '',
    allergies: '',
    insurance_details: '',
    doctor_name: '',
    doctor_phone: '',
    emergency_notes: ''
  });
  const [contacts, setContacts] = useState([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrToken, setQrToken] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [newContact, setNewContact] = useState({
    contact_name: '',
    relationship_type: 'Mother',
    phone: '',
    email: '',
    escalation_order: 1
  });
  const [showAddContact, setShowAddContact] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [editingContact, setEditingContact] = useState(null);
  const [editPhoneError, setEditPhoneError] = useState('');

  useEffect(() => {
    fetchProfile();
    fetchContacts();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/user/medical-profile');
      if (res.data) {
        setProfile({
          blood_group: res.data.blood_group || 'O+',
          age: res.data.age !== null && res.data.age !== undefined ? res.data.age : '',
          weight: res.data.weight !== null && res.data.weight !== undefined ? res.data.weight : '',
          diseases: res.data.diseases || '',
          medications: res.data.medications || '',
          allergies: res.data.allergies || '',
          insurance_details: res.data.insurance_details || '',
          doctor_name: res.data.doctor_name || '',
          doctor_phone: res.data.doctor_phone || '',
          emergency_notes: res.data.emergency_notes || ''
        });
      }
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
    setSavingProfile(true);
    setProfileFeedback(null);
    try {
      const payload = {
        blood_group: profile.blood_group || 'O+',
        age: profile.age !== '' && profile.age !== null && !isNaN(profile.age) ? parseInt(profile.age, 10) : null,
        weight: profile.weight !== '' && profile.weight !== null && !isNaN(profile.weight) ? parseFloat(profile.weight) : null,
        diseases: profile.diseases ? profile.diseases.trim() : null,
        medications: profile.medications ? profile.medications.trim() : null,
        allergies: profile.allergies ? profile.allergies.trim() : null,
        insurance_details: profile.insurance_details ? profile.insurance_details.trim() : null,
        doctor_name: profile.doctor_name ? profile.doctor_name.trim() : null,
        doctor_phone: profile.doctor_phone ? profile.doctor_phone.trim() : null,
        emergency_notes: profile.emergency_notes ? profile.emergency_notes.trim() : null
      };

      const res = await api.put('/user/medical-profile', payload);
      if (res.data) {
        setProfile({
          blood_group: res.data.blood_group || 'O+',
          age: res.data.age !== null && res.data.age !== undefined ? res.data.age : '',
          weight: res.data.weight !== null && res.data.weight !== undefined ? res.data.weight : '',
          diseases: res.data.diseases || '',
          medications: res.data.medications || '',
          allergies: res.data.allergies || '',
          insurance_details: res.data.insurance_details || '',
          doctor_name: res.data.doctor_name || '',
          doctor_phone: res.data.doctor_phone || '',
          emergency_notes: res.data.emergency_notes || ''
        });
      }
      setEditingProfile(false);
      setProfileFeedback({ type: 'success', text: 'Medical profile permanently saved in database.' });
      setTimeout(() => setProfileFeedback(null), 6000);
    } catch (err) {
      console.error('Failed to update medical profile:', err);
      const detail = err.response?.data?.detail || 'Failed to update medical profile. Please try again.';
      setProfileFeedback({ type: 'error', text: detail });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!validateIndianPhone(newContact.phone)) {
      setPhoneError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setPhoneError('');

    try {
      await api.post('/user/family-contacts', {
        ...newContact,
        escalation_order: contacts.length + 1
      });
      setNewContact({ contact_name: '', relationship_type: 'Mother', phone: '', email: '', escalation_order: 1 });
      setShowAddContact(false);
      fetchContacts();
    } catch (err) {
      console.error('Error adding contact:', err);
      alert(err.response?.data?.detail || 'Failed to add contact.');
    }
  };

  const handleStartEdit = (contact) => {
    setEditingContact({
      id: contact.id,
      contact_name: contact.contact_name || '',
      relationship_type: contact.relationship_type || 'Mother',
      phone: contact.phone || '',
      email: contact.email || '',
      escalation_order: contact.escalation_order || 1
    });
    setEditPhoneError('');
  };

  const handleSaveEditContact = async (e) => {
    e.preventDefault();
    if (!validateIndianPhone(editingContact.phone)) {
      setEditPhoneError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setEditPhoneError('');

    try {
      await api.put(`/user/family-contacts/${editingContact.id}`, {
        contact_name: editingContact.contact_name,
        relationship_type: editingContact.relationship_type,
        phone: editingContact.phone,
        email: editingContact.email,
        escalation_order: editingContact.escalation_order
      });
      setEditingContact(null);
      fetchContacts();
    } catch (err) {
      console.error('Error updating contact:', err);
      alert(err.response?.data?.detail || 'Failed to update contact.');
    }
  };

  const handleDeleteContact = async (contactId) => {
    if (!window.confirm('Delete this emergency contact?')) return;
    try {
      await api.delete(`/user/family-contacts/${contactId}`);
      fetchContacts();
    } catch (err) {
      console.error('Error deleting contact:', err);
      alert(err.response?.data?.detail || 'Failed to delete contact.');
    }
  };

  const handleGenerateQR = async () => {
    setQrLoading(true);
    try {
      const res = await api.get('/qr/generate');
      if (res.data?.qr_token) {
        setQrToken(res.data.qr_token);
        setShowQrModal(true);
      } else {
        alert('Received empty QR token from server.');
      }
    } catch (err) {
      console.error('QR generation error:', err);
      alert('Failed to generate encrypted QR card. Please check your network and try again.');
    } finally {
      setQrLoading(false);
    }
  };

  const handleRegenerateQR = async () => {
    try {
      const res = await api.post('/qr/regenerate');
      setQrToken(res.data.qr_token);
      alert('New secure QR token generated! Previous QR code token is now permanently revoked.');
    } catch (err) {
      alert('Failed to regenerate QR card.');
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
          disabled={qrLoading}
          className="px-5 py-3 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-lg flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
        >
          <QrCode className={`w-4 h-4 ${qrLoading ? 'animate-spin' : ''}`} />
          {qrLoading ? 'Generating QR...' : 'Generate Encrypted QR Card'}
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
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                {editingProfile ? 'Cancel Editing' : 'Edit Profile'}
              </button>
            </div>

            {profileFeedback && (
              <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                profileFeedback.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
              }`}>
                {profileFeedback.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{profileFeedback.text}</span>
              </div>
            )}

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
                      placeholder="e.g. 32"
                      value={profile.age ?? ''}
                      onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 70.5"
                      value={profile.weight ?? ''}
                      onChange={(e) => setProfile({ ...profile, weight: e.target.value })}
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
                      placeholder="e.g. Policy #BS-994821"
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
                      placeholder="e.g. Dr. Rajesh Kumar"
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

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Special Emergency Notes / Instructions</label>
                  <textarea
                    rows={2}
                    value={profile.emergency_notes || ''}
                    onChange={(e) => setProfile({ ...profile, emergency_notes: e.target.value })}
                    placeholder="e.g. Keep glucose tablet in pocket; Patient carries emergency inhaler"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-rose-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-extrabold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Save className={`w-4 h-4 ${savingProfile ? 'animate-spin' : ''}`} />
                  {savingProfile ? 'Saving Changes to Database...' : 'Save Medical Profile'}
                </button>
              </form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Blood Group & Physical</span>
                  <p className="font-extrabold text-white text-base">
                    Blood: <span className="text-rose-400">{profile.blood_group || 'O+'}</span> | Age: {profile.age ? `${profile.age} yrs` : 'Not specified'} | {profile.weight ? `${profile.weight} kg` : 'Not specified'}
                  </p>
                </div>

                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Diagnosed Conditions</span>
                  <p className="font-bold text-amber-400 text-sm">{profile.diseases || 'None reported'}</p>
                </div>

                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Known Allergies</span>
                  <p className="font-bold text-rose-400 text-sm">{profile.allergies || 'None reported'}</p>
                </div>

                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Active Medications</span>
                  <p className="font-bold text-cyan-400 text-sm">{profile.medications || 'None reported'}</p>
                </div>

                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Primary Physician</span>
                  <p className="font-bold text-white text-sm">
                    {profile.doctor_name || 'Not specified'} {profile.doctor_phone ? `(${profile.doctor_phone.startsWith('+91') ? profile.doctor_phone : `+91 ${profile.doctor_phone}`})` : ''}
                  </p>
                </div>

                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Insurance Policy</span>
                  <p className="font-bold text-emerald-400 text-sm">{profile.insurance_details || 'Not specified'}</p>
                </div>

                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1 md:col-span-2">
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Special Emergency Notes / Instructions</span>
                  <p className="font-bold text-purple-300 text-sm">{profile.emergency_notes || 'No special emergency instructions recorded'}</p>
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
                  <div key={contact.id || idx} className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 text-xs space-y-3">
                    {editingContact && editingContact.id === contact.id ? (
                      <form onSubmit={handleSaveEditContact} className="space-y-3 p-1">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="font-extrabold text-amber-400">Edit Emergency Contact</span>
                          <button
                            type="button"
                            onClick={() => setEditingContact(null)}
                            className="text-slate-400 hover:text-white text-[11px]"
                          >
                            Cancel
                          </button>
                        </div>

                        <div>
                          <label className="text-slate-400 font-semibold block mb-1">Full Name</label>
                          <input
                            type="text"
                            required
                            value={editingContact.contact_name}
                            onChange={(e) => setEditingContact({ ...editingContact, contact_name: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="text-slate-400 font-semibold block mb-1">Relationship</label>
                          <select
                            value={editingContact.relationship_type}
                            onChange={(e) => setEditingContact({ ...editingContact, relationship_type: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white focus:outline-none focus:border-amber-500"
                          >
                            {['Mother', 'Father', 'Spouse', 'Brother', 'Sister', 'Friend', 'Physician', 'Other'].map((rel) => (
                              <option key={rel} value={rel}>{rel}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-slate-400 font-semibold block mb-1">Mobile Number (+91)</label>
                          <IndianPhoneInput
                            value={editingContact.phone}
                            onChange={(val) => {
                              setEditingContact({ ...editingContact, phone: val });
                              if (editPhoneError) setEditPhoneError('');
                            }}
                            error={editPhoneError}
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="submit"
                            className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" /> Save Changes
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingContact(null)}
                            className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-extrabold text-white">{contact.contact_name}</p>
                          <p className="text-[11px] text-slate-400">{contact.relationship_type} • <span className="font-mono text-amber-400">{contact.phone}</span></p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-mono font-bold rounded">
                            Priority #{contact.escalation_order || idx + 1}
                          </span>
                          <button
                            onClick={() => handleStartEdit(contact)}
                            className="p-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-all"
                            title="Edit contact"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteContact(contact.id)}
                            className="p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-all"
                            title="Delete contact"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
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
        user={user}
        medicalProfile={profile}
        onRegenerate={handleRegenerateQR}
      />
    </div>
  );
};
