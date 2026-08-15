import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import { 
  MessageSquare, 
  AlertTriangle, 
  ShieldAlert, 
  Send, 
  Sparkles, 
  CheckCircle, 
  HelpCircle, 
  RotateCcw, 
  Check, 
  Activity,
  ArrowRight,
  Info
} from 'lucide-react';

export const DashboardTriageChatbot = ({ activeEmergency, onRequestEmergency }) => {
  const [triageState, setTriageState] = useState({
    is_conscious: true,
    fell_or_fainted: false,
    has_chest_pain: false,
    has_breathing_difficulty: false,
    is_bleeding: false,
    can_stand_or_walk: true,
    sudden_dizziness: false,
    has_headache: false,
    severe_headache: false,
    speech_difficulty: false,
    weakness_numbness: false,
    vision_problems: false,
    is_alone: true
  });

  const [textInput, setTextInput] = useState('');
  const [triageResult, setTriageResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [askedFollowUps, setAskedFollowUps] = useState(new Set());

  const messagesEndRef = useRef(null);

  const [messages, setMessages] = useState([
    {
      id: 'init-1',
      sender: 'ai',
      text: 'Hello! I am your ResQNet Clinical Triage Assistant. Describe how you are feeling below or select symptoms from the checklist to run a rule-based triage assessment.'
    }
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleToggle = (key) => {
    setTriageState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleReset = () => {
    setTriageState({
      is_conscious: true,
      fell_or_fainted: false,
      has_chest_pain: false,
      has_breathing_difficulty: false,
      is_bleeding: false,
      can_stand_or_walk: true,
      sudden_dizziness: false,
      has_headache: false,
      severe_headache: false,
      speech_difficulty: false,
      weakness_numbness: false,
      vision_problems: false,
      is_alone: true
    });
    setTextInput('');
    setTriageResult(null);
    setAskedFollowUps(new Set());
    setMessages([
      {
        id: 'init-1',
        sender: 'ai',
        text: 'Triage assessment reset. Describe how you are feeling below or select symptoms from the checklist to start a new evaluation.'
      }
    ]);
  };

  const executeTriageEvaluation = async (stateToSend, textPrompt = '', isFollowUp = false) => {
    setLoading(true);

    try {
      const res = await api.post('/emergency/triage-chatbot', {
        emergency_id: activeEmergency ? activeEmergency.id : null,
        text_input: textPrompt,
        ...stateToSend
      });

      const data = res.data;
      setTriageResult(data);

      // Sync detected symptoms back to checkboxes
      if (data.mapped_flags) {
        setTriageState((prev) => ({
          ...prev,
          has_headache: prev.has_headache || data.mapped_flags.has_headache,
          sudden_dizziness: prev.sudden_dizziness || data.mapped_flags.sudden_dizziness,
          fell_or_fainted: prev.fell_or_fainted || data.mapped_flags.fell_or_fainted,
          has_chest_pain: prev.has_chest_pain || data.mapped_flags.has_chest_pain,
          has_breathing_difficulty: prev.has_breathing_difficulty || data.mapped_flags.has_breathing_difficulty,
          is_bleeding: prev.is_bleeding || data.mapped_flags.is_bleeding,
          can_stand_or_walk: data.mapped_flags.can_stand_or_walk !== undefined ? data.mapped_flags.can_stand_or_walk : prev.can_stand_or_walk
        }));
      }

      // Symptom-Specific Follow-Up Routing
      const flags = data.mapped_flags || {};
      let nextFollowUpType = null;
      let nextFollowUpText = '';

      if (!isFollowUp) {
        if (flags.has_headache && !askedFollowUps.has('headache')) {
          nextFollowUpType = 'headache';
          nextFollowUpText = 'Is the headache sudden/severe or accompanied by any of these warning signs?';
        } else if (flags.sudden_dizziness && !askedFollowUps.has('dizziness')) {
          nextFollowUpType = 'dizziness';
          nextFollowUpText = 'Are you currently able to stand or walk normally without assistance?';
        } else if (flags.has_chest_pain && !askedFollowUps.has('chest_pain')) {
          nextFollowUpType = 'chest_pain';
          nextFollowUpText = 'Are you experiencing any of these associated warning signs with the chest pain?';
        } else if (flags.has_breathing_difficulty && !askedFollowUps.has('breathing')) {
          nextFollowUpType = 'breathing';
          nextFollowUpText = 'Are you having severe difficulty breathing right now?';
        } else if (flags.fell_or_fainted && !askedFollowUps.has('fainting')) {
          nextFollowUpType = 'fainting';
          nextFollowUpText = 'Did you lose consciousness or are you currently unable to stand or walk?';
        } else if (flags.is_bleeding && !askedFollowUps.has('bleeding')) {
          nextFollowUpType = 'bleeding';
          nextFollowUpText = 'Is the bleeding severe/uncontrolled or accompanied by weakness or dizziness?';
        }
      }

      if (nextFollowUpType) {
        setAskedFollowUps((prev) => new Set(prev).add(nextFollowUpType));
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: nextFollowUpText,
            followUpType: nextFollowUpType
          }
        ]);
      } else {
        // Output complete Explainable Risk Assessment Card
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            isResultCard: true,
            resultData: data
          }
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: 'Triage risk assessment completed. Please sit down and stay calm. Press SOS if you require immediate help.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendText = (e) => {
    if (e) e.preventDefault();
    if (loading) return;

    const trimmed = textInput.trim();
    const hasChecked = (
      triageState.sudden_dizziness ||
      triageState.has_headache ||
      triageState.fell_or_fainted ||
      triageState.has_chest_pain ||
      triageState.has_breathing_difficulty ||
      triageState.is_bleeding ||
      !triageState.can_stand_or_walk
    );

    if (!trimmed && !hasChecked) {
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          sender: 'user',
          text: 'Attempted assessment without symptoms selected.'
        },
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: "I couldn't identify a specific emergency indicator from that description. Please select an applicable symptom below or describe your symptoms more specifically."
        }
      ]);
      return;
    }

    const userMsgText = trimmed || 'Assessing selected symptoms from checklist...';
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: userMsgText
      }
    ]);

    setTextInput('');
    executeTriageEvaluation(triageState, trimmed);
  };

  const handleFollowUpAnswer = (option) => {
    if (loading) return;

    const userMsgText = option.label;
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: userMsgText
      }
    ]);

    let updatedState = { ...triageState };
    if (option.symptomKeys) {
      option.symptomKeys.forEach((item) => {
        updatedState[item.key] = item.value;
      });
      setTriageState(updatedState);
    } else if (option.symptomKey) {
      updatedState[option.symptomKey] = option.value;
      setTriageState(updatedState);
    }

    executeTriageEvaluation(updatedState, '', true);
  };

  return (
    <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-slate-800 space-y-5 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Clinical Triage & Decision Support
            </h3>
            <p className="text-xs text-slate-400">
              Rule-based emergency assessment (Not a medical diagnosis)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {triageResult && (
            <span className={`px-3 py-1 text-xs font-black rounded-xl uppercase tracking-wider ${
              triageResult.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' :
              triageResult.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
              triageResult.severity === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40' :
              'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
            }`}>
              {triageResult.priority_level || `${triageResult.severity} PRIORITY`}
            </span>
          )}
          <button
            type="button"
            onClick={handleReset}
            title="Start New Assessment"
            className="p-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition-all text-xs font-medium flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" /> Start New Assessment
          </button>
        </div>
      </div>

      {/* Symptom Checklist Toggles */}
      <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <p className="font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-cyan-400" /> Triage Checklist (Select applicable symptoms):
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
            triageState.has_headache 
              ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200' 
              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}>
            <input
              type="checkbox"
              checked={triageState.has_headache}
              onChange={() => handleToggle('has_headache')}
              className="accent-cyan-500 rounded"
            />
            <span className="font-medium">🤯 Headache / Migraine</span>
          </label>

          <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
            triageState.sudden_dizziness 
              ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200' 
              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}>
            <input
              type="checkbox"
              checked={triageState.sudden_dizziness}
              onChange={() => handleToggle('sudden_dizziness')}
              className="accent-cyan-500 rounded"
            />
            <span className="font-medium">💫 Sudden Dizziness</span>
          </label>

          <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
            triageState.fell_or_fainted 
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-200' 
              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}>
            <input
              type="checkbox"
              checked={triageState.fell_or_fainted}
              onChange={() => handleToggle('fell_or_fainted')}
              className="accent-rose-500 rounded"
            />
            <span className="font-medium">🤕 Fell or Fainted</span>
          </label>

          <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
            triageState.has_chest_pain 
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-200' 
              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}>
            <input
              type="checkbox"
              checked={triageState.has_chest_pain}
              onChange={() => handleToggle('has_chest_pain')}
              className="accent-rose-500 rounded"
            />
            <span className="font-medium">🫀 Acute Chest Pain</span>
          </label>

          <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
            triageState.has_breathing_difficulty 
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-200' 
              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}>
            <input
              type="checkbox"
              checked={triageState.has_breathing_difficulty}
              onChange={() => handleToggle('has_breathing_difficulty')}
              className="accent-rose-500 rounded"
            />
            <span className="font-medium">🫁 Difficulty Breathing</span>
          </label>

          <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
            triageState.is_bleeding 
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-200' 
              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}>
            <input
              type="checkbox"
              checked={triageState.is_bleeding}
              onChange={() => handleToggle('is_bleeding')}
              className="accent-rose-500 rounded"
            />
            <span className="font-medium">🩸 Severe Bleeding</span>
          </label>

          <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
            !triageState.can_stand_or_walk 
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-200' 
              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}>
            <input
              type="checkbox"
              checked={!triageState.can_stand_or_walk}
              onChange={() => handleToggle('can_stand_or_walk')}
              className="accent-rose-500 rounded"
            />
            <span className="font-medium">🚶 Cannot Stand / Walk</span>
          </label>
        </div>
      </div>

      {/* Messages Stream Container */}
      <div className="p-4 bg-slate-950/90 rounded-2xl border border-slate-800 max-h-80 overflow-y-auto space-y-3 font-sans text-xs scroll-smooth">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`p-3.5 rounded-2xl max-w-[90%] leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-cyan-600 text-white font-medium rounded-tr-none shadow-lg'
                  : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none space-y-3 shadow-md'
              }`}
            >
              {!msg.isResultCard ? (
                <div>
                  <p>{msg.text}</p>

                  {/* Symptom-Specific Follow-Up Option Chips */}
                  {msg.followUpType === 'headache' && (
                    <div className="mt-3 space-y-2 pt-2 border-t border-slate-800">
                      <span className="text-[11px] font-bold text-cyan-400 block">Select any warning sign that applies:</span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleFollowUpAnswer({ label: "⚡ Sudden / Severe headache", symptomKey: "severe_headache", value: true })}
                          className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500 rounded-lg text-slate-200 text-[11px] font-semibold transition-all"
                        >
                          ⚡ Sudden / Severe headache
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleFollowUpAnswer({ label: "🗣️ Difficulty speaking", symptomKey: "speech_difficulty", value: true })}
                          className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500 rounded-lg text-slate-200 text-[11px] font-semibold transition-all"
                        >
                          🗣️ Difficulty speaking
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleFollowUpAnswer({ label: "💪 Weakness / Numbness", symptomKey: "weakness_numbness", value: true })}
                          className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500 rounded-lg text-slate-200 text-[11px] font-semibold transition-all"
                        >
                          💪 Weakness / Numbness
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleFollowUpAnswer({ label: "👁️ Vision problems", symptomKey: "vision_problems", value: true })}
                          className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500 rounded-lg text-slate-200 text-[11px] font-semibold transition-all"
                        >
                          👁️ Vision problems
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleFollowUpAnswer({ label: "🤕 Fainted / Fell", symptomKey: "fell_or_fainted", value: true })}
                          className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500 rounded-lg text-slate-200 text-[11px] font-semibold transition-all"
                        >
                          🤕 Fainted / Fell
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleFollowUpAnswer({ label: "None of these warning signs", symptomKey: null, value: null })}
                          className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-600 rounded-lg text-slate-400 hover:text-slate-200 text-[11px] transition-all"
                        >
                          None of these
                        </button>
                      </div>
                    </div>
                  )}

                  {msg.followUpType === 'dizziness' && (
                    <div className="mt-3 space-y-2 pt-2 border-t border-slate-800">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleFollowUpAnswer({ label: "✓ Yes, I can walk", symptomKey: "can_stand_or_walk", value: true })}
                          className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-xl text-emerald-300 text-[11px] font-bold transition-all"
                        >
                          ✓ Yes, I can walk
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleFollowUpAnswer({ label: "⊘ No, cannot walk", symptomKey: "can_stand_or_walk", value: false })}
                          className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-xl text-rose-300 text-[11px] font-bold transition-all"
                        >
                          ⊘ No, cannot walk
                        </button>
                      </div>
                    </div>
                  )}

                  {msg.followUpType === 'chest_pain' && (
                    <div className="mt-3 space-y-2 pt-2 border-t border-slate-800">
                      <span className="text-[11px] font-bold text-cyan-400 block">Select associated signs:</span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleFollowUpAnswer({ label: "🫁 Difficulty breathing", symptomKey: "has_breathing_difficulty", value: true })}
                          className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500 rounded-lg text-slate-200 text-[11px] font-semibold transition-all"
                        >
                          🫁 Difficulty breathing
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleFollowUpAnswer({ label: "🤕 Fainting", symptomKey: "fell_or_fainted", value: true })}
                          className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500 rounded-lg text-slate-200 text-[11px] font-semibold transition-all"
                        >
                          🤕 Fainting
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleFollowUpAnswer({ label: "⚡ Severe weakness", symptomKey: "weakness_numbness", value: true })}
                          className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500 rounded-lg text-slate-200 text-[11px] font-semibold transition-all"
                        >
                          ⚡ Severe weakness
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleFollowUpAnswer({ label: "None of these", symptomKey: null, value: null })}
                          className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-600 rounded-lg text-slate-400 hover:text-slate-200 text-[11px] transition-all"
                        >
                          None of these
                        </button>
                      </div>
                    </div>
                  )}

                  {msg.followUpType === 'breathing' && (
                    <div className="mt-3 space-y-2 pt-2 border-t border-slate-800">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleFollowUpAnswer({ label: "Yes, severe difficulty", symptomKey: "has_breathing_difficulty", value: true })}
                          className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-xl text-rose-300 text-[11px] font-bold transition-all"
                        >
                          Yes, severe difficulty
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleFollowUpAnswer({ label: "No, mild/moderate", symptomKey: "has_breathing_difficulty", value: false })}
                          className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 text-[11px] font-medium transition-all"
                        >
                          No, mild/moderate
                        </button>
                      </div>
                    </div>
                  )}

                  {msg.followUpType === 'fainting' && (
                    <div className="mt-3 space-y-2 pt-2 border-t border-slate-800">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleFollowUpAnswer({ label: "Lost consciousness", symptomKey: "fell_or_fainted", value: true })}
                          className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500 rounded-lg text-slate-200 text-[11px] font-semibold transition-all"
                        >
                          Lost consciousness
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleFollowUpAnswer({ label: "Cannot stand / walk", symptomKey: "can_stand_or_walk", value: false })}
                          className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500 rounded-lg text-slate-200 text-[11px] font-semibold transition-all"
                        >
                          Cannot stand / walk
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleFollowUpAnswer({ label: "Conscious & able to walk", symptomKey: "can_stand_or_walk", value: true })}
                          className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 text-[11px] transition-all"
                        >
                          Conscious & able to walk
                        </button>
                      </div>
                    </div>
                  )}

                  {msg.followUpType === 'bleeding' && (
                    <div className="mt-3 space-y-2 pt-2 border-t border-slate-800">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleFollowUpAnswer({ label: "Uncontrolled bleeding", symptomKey: "is_bleeding", value: true })}
                          className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500 rounded-lg text-slate-200 text-[11px] font-semibold transition-all"
                        >
                          Uncontrolled bleeding
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleFollowUpAnswer({ label: "Accompanied by dizziness", symptomKey: "sudden_dizziness", value: true })}
                          className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500 rounded-lg text-slate-200 text-[11px] font-semibold transition-all"
                        >
                          Accompanied by dizziness
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleFollowUpAnswer({ label: "Controlled / mild", symptomKey: "is_bleeding", value: false })}
                          className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 text-[11px] transition-all"
                        >
                          Controlled / mild
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* EXPLAINABLE RISK ASSESSMENT RESULT CARD */
                <div className="space-y-3">
                  {/* Badge & Title */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider ${
                      msg.resultData.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' :
                      msg.resultData.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                      msg.resultData.severity === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40' :
                      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    }`}>
                      {msg.resultData.priority_level || `${msg.resultData.severity} PRIORITY`}
                    </span>
                    <span className="text-slate-300 font-extrabold text-xs">
                      {msg.resultData.rule_based_score_label || `Rule-Based Risk Score: ${msg.resultData.confidence_score} points`}
                    </span>
                  </div>

                  {/* Guidance Overview */}
                  <p className="text-slate-200 text-[11px] font-medium leading-relaxed">
                    {msg.resultData.guidance_message}
                  </p>

                  {/* Detected Symptoms Checklist */}
                  {msg.resultData.detected_symptoms && msg.resultData.detected_symptoms.length > 0 && (
                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider block">
                        Detected Symptoms:
                      </span>
                      <div className="space-y-0.5">
                        {msg.resultData.detected_symptoms.map((symptom, sIdx) => (
                          <div key={sIdx} className="flex items-center gap-1.5 text-slate-200 text-[11px]">
                            <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                            <span>{symptom}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Why / Scoring Reasons / Risk Factors */}
                  {msg.resultData.scoring_reasons && msg.resultData.scoring_reasons.length > 0 && (
                    <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-cyan-400 font-bold text-[10px] uppercase tracking-wider block">
                        Risk Factors (Scoring Reasons):
                      </span>
                      <ul className="space-y-0.5 text-slate-300 text-[11px]">
                        {msg.resultData.scoring_reasons.map((reason, rIdx) => (
                          <li key={rIdx} className="flex items-start gap-1.5">
                            <span className="text-cyan-400 font-bold">•</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Contributing Factors (Numerical Rule Score) */}
                  {msg.resultData.contributing_factors && msg.resultData.contributing_factors.length > 0 && (
                    <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider block">
                        Contributing Factors (Rule-Based Breakdown):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                        {msg.resultData.contributing_factors.map((factor, fIdx) => (
                          <div key={fIdx} className="flex items-center justify-between bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800 text-[11px]">
                            <span className="text-slate-300">{factor.factor}</span>
                            <span className="text-cyan-400 font-black ml-2">+{factor.points} pts</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommended Action */}
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider block">
                      Recommended Action:
                    </span>
                    <p className="text-slate-200 text-[11px] font-semibold">
                      {msg.resultData.recommended_action || "Maintain background monitoring."}
                    </p>
                  </div>

                  {/* Emergency Escalation Button inside card if High/Critical Risk */}
                  {(msg.resultData.severity === 'HIGH' || msg.resultData.severity === 'CRITICAL' || msg.resultData.emergency_required) && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={onRequestEmergency}
                        className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black rounded-xl text-xs shadow-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                      >
                        <ShieldAlert className="w-4 h-4" /> Trigger Emergency SOS Assistance
                      </button>
                    </div>
                  )}

                  {/* Start New Assessment Button inside Result Card */}
                  <div className="pt-2 border-t border-slate-800/80 flex justify-center">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/60 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Start New Assessment
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-400 animate-pulse">
            <Activity className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            <span>Evaluating clinical decision rules...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Natural-Language Chat Input Form */}
      <form onSubmit={handleSendText} className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            disabled={loading}
            placeholder="Describe how you're feeling... (e.g. 'I have a headache' or 'I suddenly feel dizzy and cannot stand')"
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-cyan-500/60 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all"
          />
          <button
            type="submit"
            disabled={loading}
            className="py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Assess Symptoms</span>
          </button>
        </div>
      </form>
    </div>
  );
};



