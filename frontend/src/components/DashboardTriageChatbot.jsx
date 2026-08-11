import React, { useState } from 'react';
import api from '../services/api';
import { MessageSquare, Heart, Activity, AlertTriangle, ShieldAlert, Send, Sparkles, CheckCircle, ShieldCheck, HelpCircle } from 'lucide-react';

export const DashboardTriageChatbot = ({ activeEmergency, onRequestEmergency }) => {
  const [triageState, setTriageState] = useState({
    is_conscious: true,
    fell_or_fainted: false,
    has_chest_pain: false,
    has_breathing_difficulty: false,
    is_bleeding: false,
    can_stand_or_walk: true,
    sudden_dizziness: false,
    is_alone: true
  });

  const [triageResult, setTriageResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Hello! I am your ResQNet Triage Assistant. How are you feeling right now? Select your symptoms or answer the questions below to evaluate emergency threat level.'
    }
  ]);

  const handleToggle = (key) => {
    setTriageState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRunTriage = async (overrideState = null) => {
    setLoading(true);
    const stateToSend = overrideState || triageState;

    try {
      const userSummary = [];
      if (stateToSend.sudden_dizziness) userSummary.push("Sudden Dizziness");
      if (stateToSend.fell_or_fainted) userSummary.push("Fell / Lost Consciousness");
      if (stateToSend.has_chest_pain) userSummary.push("Chest Pain");
      if (stateToSend.has_breathing_difficulty) userSummary.push("Difficulty Breathing");
      if (stateToSend.is_bleeding) userSummary.push("Severe Bleeding");
      if (!stateToSend.can_stand_or_walk) userSummary.push("Cannot Stand / Walk");
      if (!stateToSend.is_conscious) userSummary.push("Unconscious / Semi-conscious");

      const promptText = userSummary.length > 0
        ? `Evaluated symptoms: ${userSummary.join(', ')}`
        : 'Reported mild / stable symptoms';

      setMessages((prev) => [...prev, { sender: 'user', text: promptText }]);

      const res = await api.post('/emergency/triage-chatbot', {
        emergency_id: activeEmergency ? activeEmergency.id : null,
        ...stateToSend
      });

      const data = res.data;
      setTriageResult(data);

      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: data.guidance_message,
          severity: data.severity,
          confidence: data.confidence_score,
          reasons: data.reasons
        }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: 'Triage evaluation complete. Please sit down and stay calm. Press SOS if you require immediate help.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Clinical Triage & Decision Support</h3>
            <p className="text-xs text-slate-400">Rule-based emergency assessment (Not a medical diagnosis)</p>
          </div>
        </div>
        {triageResult && (
          <span className={`px-3 py-1 text-xs font-black rounded-xl uppercase tracking-wider ${
            triageResult.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' :
            triageResult.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
            triageResult.severity === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40' :
            'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
          }`}>
            {triageResult.severity} RISK ({triageResult.confidence_score}%)
          </span>
        )}
      </div>

      {/* Symptom Questionnaire Toggles */}
      <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-3 text-xs">
        <p className="font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-cyan-400" /> Triage Check (Select applicable symptoms):
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-700">
            <input
              type="checkbox"
              checked={triageState.sudden_dizziness}
              onChange={() => handleToggle('sudden_dizziness')}
              className="accent-rose-500 rounded"
            />
            <span className="text-slate-200">💫 Sudden Dizziness</span>
          </label>

          <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-700">
            <input
              type="checkbox"
              checked={triageState.fell_or_fainted}
              onChange={() => handleToggle('fell_or_fainted')}
              className="accent-rose-500 rounded"
            />
            <span className="text-slate-200">🤕 Fell or Fainted</span>
          </label>

          <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-700">
            <input
              type="checkbox"
              checked={triageState.has_chest_pain}
              onChange={() => handleToggle('has_chest_pain')}
              className="accent-rose-500 rounded"
            />
            <span className="text-slate-200">🫀 Acute Chest Pain</span>
          </label>

          <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-700">
            <input
              type="checkbox"
              checked={triageState.has_breathing_difficulty}
              onChange={() => handleToggle('has_breathing_difficulty')}
              className="accent-rose-500 rounded"
            />
            <span className="text-slate-200">🫁 Difficulty Breathing</span>
          </label>

          <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-700">
            <input
              type="checkbox"
              checked={triageState.is_bleeding}
              onChange={() => handleToggle('is_bleeding')}
              className="accent-rose-500 rounded"
            />
            <span className="text-slate-200">🩸 Severe Bleeding</span>
          </label>

          <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-700">
            <input
              type="checkbox"
              checked={!triageState.can_stand_or_walk}
              onChange={() => handleToggle('can_stand_or_walk')}
              className="accent-rose-500 rounded"
            />
            <span className="text-slate-200">🚶 Cannot Stand / Walk</span>
          </label>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => handleRunTriage()}
          className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
        >
          <Sparkles className="w-4 h-4" /> Evaluate Triage Risk
        </button>
      </div>

      {/* Messages Stream */}
      <div className="p-4 bg-slate-950/90 rounded-2xl border border-slate-800 max-h-56 overflow-y-auto space-y-3 font-sans text-xs">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-rose-600 text-white font-medium rounded-tr-none'
                  : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none space-y-2'
              }`}
            >
              <p>{msg.text}</p>

              {msg.reasons && msg.reasons.length > 0 && (
                <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 text-[11px] space-y-1">
                  <span className="text-cyan-400 font-bold block">Scoring Reasons:</span>
                  <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                    {msg.reasons.map((r, rIdx) => (
                      <li key={rIdx}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-xs text-slate-400 animate-pulse italic">
            Evaluating clinical decision factors...
          </div>
        )}
      </div>

      {/* High/Critical Risk Banner */}
      {triageResult && (triageResult.severity === 'HIGH' || triageResult.severity === 'CRITICAL' || triageResult.emergency_required) && (
        <div className="p-4 bg-rose-950/70 border border-rose-500/60 rounded-2xl space-y-2 animate-fade-in text-center shadow-xl">
          <p className="text-xs font-extrabold text-rose-200 flex items-center justify-center gap-1.5 uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />
            {triageResult.severity} Emergency Threat Identified
          </p>
          <p className="text-[11px] text-rose-300">
            High threat symptoms detected. Immediate emergency response is recommended.
          </p>
          <button
            type="button"
            onClick={onRequestEmergency}
            className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black rounded-xl text-xs shadow-xl flex items-center justify-center gap-2 transition-all hover:scale-105"
          >
            <ShieldAlert className="w-4 h-4" /> Trigger Emergency SOS Assistance
          </button>
        </div>
      )}
    </div>
  );
};

