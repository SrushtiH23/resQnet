from typing import Dict, Any, Optional, List
from services.confidence_engine import ConfidenceScoringEngine

class EmergencyTriageChatbot:
    """
    Module 9: Rule-Based Clinical Triage & Decision Support Engine
    Evaluates self-reported symptoms through natural language parsing and structured checklist:
    - Sudden Dizziness
    - Headache & Neurological Warning Signs
    - Acute Chest Pain
    - Difficulty Breathing
    - Severe Bleeding
    - Fell or Lost Consciousness
    - Mobility (Can stand / walk)
    """

    @staticmethod
    def parse_natural_language(text: str) -> Dict[str, bool]:
        if not text:
            return {}
        txt = text.lower()
        return {
            "has_headache": any(kw in txt for kw in ["headache", "head pain", "migraine", "head hurting", "head aches"]),
            "sudden_dizziness": any(kw in txt for kw in ["dizz", "lighthead", "vertigo", "spin", "wooz", "faintish", "unsteady head"]),
            "fell_or_fainted": any(kw in txt for kw in ["fell", "fall", "faint", "passed out", "blackout", "blacked out", "lost consciousness", "syncope", "collapse"]),
            "has_chest_pain": any(kw in txt for kw in ["chest pain", "chest tightness", "chest pressure", "heart pain", "angina", "tight chest", "heavy chest"]),
            "has_breathing_difficulty": any(kw in txt for kw in ["breath", "breathing", "shortness of breath", "can't breathe", "cannot breathe", "trouble breathing", "gasping", "suffocating", "winded", "hard to breathe"]),
            "is_bleeding": any(kw in txt for kw in ["bleed", "bleeding", "blood", "hemorrhage", "gush"]),
            "cannot_stand_or_walk": any(kw in txt for kw in ["cannot stand", "can't stand", "unable to stand", "cannot walk", "can't walk", "unable to walk", "immobile", "can't move legs", "collapsed legs"])
        }

    @staticmethod
    def evaluate_triage(
        text_input: Optional[str] = None,
        is_conscious: bool = True,
        fell_or_fainted: bool = False,
        has_chest_pain: bool = False,
        has_breathing_difficulty: bool = False,
        is_bleeding: bool = False,
        can_stand_or_walk: bool = True,
        sudden_dizziness: bool = False,
        has_headache: bool = False,
        severe_headache: bool = False,
        speech_difficulty: bool = False,
        weakness_numbness: bool = False,
        vision_problems: bool = False,
        is_alone: bool = True
    ) -> Dict[str, Any]:
        
        parsed = EmergencyTriageChatbot.parse_natural_language(text_input or "")

        final_has_headache = has_headache or parsed.get("has_headache", False)
        final_sudden_dizziness = sudden_dizziness or parsed.get("sudden_dizziness", False)
        final_fell_or_fainted = fell_or_fainted or parsed.get("fell_or_fainted", False)
        final_has_chest_pain = has_chest_pain or parsed.get("has_chest_pain", False)
        final_has_breathing_difficulty = has_breathing_difficulty or parsed.get("has_breathing_difficulty", False)
        final_is_bleeding = is_bleeding or parsed.get("is_bleeding", False)
        
        parsed_immobile = parsed.get("cannot_stand_or_walk", False)
        final_can_stand_or_walk = False if parsed_immobile else can_stand_or_walk

        has_neuro_warning = severe_headache or speech_difficulty or weakness_numbness or vision_problems
        loss_of_consciousness = (not is_conscious) or final_fell_or_fainted or (final_has_headache and has_neuro_warning)
        chatbot_score = 20.0 if (final_sudden_dizziness or final_has_headache) else 0.0

        # Calculate using ConfidenceScoringEngine
        score_res = ConfidenceScoringEngine.calculate_score(
            fall_detected=final_fell_or_fainted,
            loss_of_consciousness=loss_of_consciousness,
            chest_pain=final_has_chest_pain,
            breathing_difficulty=final_has_breathing_difficulty,
            severe_bleeding=final_is_bleeding,
            stillness=not final_can_stand_or_walk,
            chatbot=chatbot_score
        )

        score = int(score_res["confidence_score"])
        severity = score_res["severity"]
        emergency_required = score_res["emergency_required"]
        reasons = score_res["reasons"]

        # Build list of detected symptoms
        detected_symptoms = []
        if final_has_breathing_difficulty:
            detected_symptoms.append("Difficulty breathing")
        if final_has_chest_pain:
            detected_symptoms.append("Acute chest pain")
        if final_fell_or_fainted:
            detected_symptoms.append("Fell / Lost consciousness")
        if final_is_bleeding:
            detected_symptoms.append("Severe bleeding")
        if not final_can_stand_or_walk:
            detected_symptoms.append("Cannot stand / walk")
        if final_sudden_dizziness:
            detected_symptoms.append("Sudden dizziness")
        if final_has_headache:
            detected_symptoms.append("Headache")
        if severe_headache:
            detected_symptoms.append("Sudden/severe headache")
        if speech_difficulty:
            detected_symptoms.append("Difficulty speaking")
        if weakness_numbness:
            detected_symptoms.append("Weakness / Numbness")
        if vision_problems:
            detected_symptoms.append("Vision problems")
        if not is_conscious:
            detected_symptoms.append("Unconscious / Unresponsive")

        # Build contributing factors breakdown
        contributing_factors = []
        if final_has_breathing_difficulty:
            contributing_factors.append({"factor": "Difficulty breathing", "points": 30})
        if final_is_bleeding:
            contributing_factors.append({"factor": "Severe bleeding", "points": 30})
        if final_fell_or_fainted:
            contributing_factors.append({"factor": "Fall / Lost consciousness", "points": 30})
        if final_has_chest_pain:
            contributing_factors.append({"factor": "Acute chest pain", "points": 25})
        if has_neuro_warning:
            contributing_factors.append({"factor": "Neurological warning sign", "points": 25})
        elif not is_conscious and not final_fell_or_fainted:
            contributing_factors.append({"factor": "Unconsciousness", "points": 25})
        if final_sudden_dizziness:
            contributing_factors.append({"factor": "Sudden dizziness", "points": 20})
        if not final_can_stand_or_walk:
            contributing_factors.append({"factor": "Cannot stand / walk", "points": 15})

        rule_based_score_label = f"Rule-Based Risk Score: {score} points"

        # Formulate terminology & reasons
        if severity == "CRITICAL":
            priority_level = "CRITICAL PRIORITY"
            guidance = "CRITICAL PRIORITY. Based on the reported symptoms, critical emergency indicators were detected. Emergency escalation recommended."
            recommended_action = "Initiate emergency escalation immediately."
            scoring_reasons = [
                "Multiple critical emergency indicators detected",
                "Severe threat to vital functions reported",
                "Immediate medical response required"
            ]
        elif severity == "HIGH":
            priority_level = "HIGH PRIORITY"
            guidance = "HIGH PRIORITY. Emergency indicators detected based on the reported symptoms. Emergency escalation recommended."
            recommended_action = "Emergency escalation recommended."
            scoring_reasons = [
                "Multiple emergency indicators detected",
                "Mobility or respiratory distress warning sign present",
                "Elevated threat level based on reported symptoms"
            ]
        elif severity == "MEDIUM":
            priority_level = "MEDIUM PRIORITY"
            guidance = "MEDIUM PRIORITY. Moderate emergency indicators reported based on symptoms. Please sit or lie down and avoid walking alone."
            recommended_action = "Sit or lie down immediately and monitor symptoms. Reassess if symptoms worsen or press SOS."
            scoring_reasons = [
                "Moderate warning signs reported",
                "No active severe respiratory or cardiac compromise detected",
                "Monitoring recommended"
            ]
        else:
            priority_level = "LOW PRIORITY"
            guidance = "LOW PRIORITY. Based on the reported symptoms, no high-risk emergency indicators were detected from the information provided. Please sit or lie down and rest if feeling unwell."
            recommended_action = "Continue monitoring and reassess if symptoms worsen or new warning signs appear."
            scoring_reasons = [
                "No additional high-risk indicators detected from the information provided",
                "Mild or stable symptom profile reported"
            ]

        return {
            "confidence_score": float(score),
            "rule_based_score_label": rule_based_score_label,
            "severity": severity,
            "priority_level": priority_level,
            "emergency_required": emergency_required,
            "reasons": reasons,
            "scoring_reasons": scoring_reasons,
            "guidance_message": guidance,
            "score_added": float(score),
            "detected_symptoms": detected_symptoms,
            "contributing_factors": contributing_factors,
            "recommended_action": recommended_action,
            "mapped_flags": {
                "has_headache": final_has_headache,
                "sudden_dizziness": final_sudden_dizziness,
                "fell_or_fainted": final_fell_or_fainted,
                "has_chest_pain": final_has_chest_pain,
                "has_breathing_difficulty": final_has_breathing_difficulty,
                "is_bleeding": final_is_bleeding,
                "can_stand_or_walk": final_can_stand_or_walk,
                "is_conscious": is_conscious
            }
        }



