from typing import Dict, Any, Optional
from services.confidence_engine import ConfidenceScoringEngine

class EmergencyTriageChatbot:
    """
    Module 9: AI / Rule-Based Triage Chatbot Engine
    Evaluates self-reported symptoms through structured follow-up questions:
    1. Conscious & able to respond?
    2. Fall or lost consciousness?
    3. Chest pain?
    4. Difficulty breathing?
    5. Severe bleeding?
    6. Can stand or walk normally?
    7. Dizziness began suddenly?
    8. Are you alone?
    """

    @staticmethod
    def evaluate_triage(
        is_conscious: bool = True,
        fell_or_fainted: bool = False,
        has_chest_pain: bool = False,
        has_breathing_difficulty: bool = False,
        is_bleeding: bool = False,
        can_stand_or_walk: bool = True,
        sudden_dizziness: bool = False,
        is_alone: bool = True
    ) -> Dict[str, Any]:
        
        loss_of_consciousness = (not is_conscious) or fell_or_fainted

        # Calculate using ConfidenceScoringEngine
        score_res = ConfidenceScoringEngine.calculate_score(
            fall_detected=fell_or_fainted,
            loss_of_consciousness=loss_of_consciousness,
            chest_pain=has_chest_pain,
            breathing_difficulty=has_breathing_difficulty,
            severe_bleeding=is_bleeding,
            stillness=not can_stand_or_walk
        )

        score = score_res["confidence_score"]
        severity = score_res["severity"]
        emergency_required = score_res["emergency_required"]
        reasons = score_res["reasons"]

        # Formulate guidance message based on risk level
        if severity == "CRITICAL":
            guidance = "CRITICAL EMERGENCY THREAT DETECTED. Creating emergency event, locking current GPS coordinates, and initiating family contact & voice escalation immediately."
        elif severity == "HIGH":
            guidance = "HIGH RISK CONDITION DETECTED. High threat symptoms identified. Standby while we prepare emergency contact notification."
        elif severity == "MEDIUM":
            guidance = "MEDIUM RISK: Dizziness or mild symptoms recorded. Please sit or lie down and avoid walking alone. If symptoms worsen, press the SOS button for immediate emergency assistance."
        else:
            guidance = "LOW RISK: Mild symptoms recorded. Please sit or lie down, hydrate, and rest. Maintain monitoring. No automatic emergency notification triggered."

        return {
            "confidence_score": score,
            "severity": severity,
            "emergency_required": emergency_required,
            "reasons": reasons,
            "guidance_message": guidance,
            "score_added": score
        }

