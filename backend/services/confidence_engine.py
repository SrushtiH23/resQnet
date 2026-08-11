from typing import Dict, Any, Optional

class ConfidenceScoringEngine:
    """
    ConfidenceScoringEngine Module
    Calculates dynamic emergency threat confidence score (0-100%) based on 7 multi-factor inputs:
    1. Accelerometer (Impact / Free fall magnitude)
    2. Gyroscope (Body angular spin rate)
    3. Stillness (Post-impact lack of motion)
    4. GPS (Geospatial verification & movement velocity)
    5. Chatbot (AI Triage symptom severity)
    6. User Response (Manual SOS or 'Need Help' confirmation)
    7. QR Confirmation (Doctor or Bystander QR verification scan)
    """

    DEFAULT_WEIGHTS: Dict[str, float] = {
        "accelerometer": 25.0,
        "gyroscope": 15.0,
        "stillness": 20.0,
        "gps": 10.0,
        "chatbot": 20.0,
        "user_response": 40.0,
        "qr_confirmation": 25.0,
    }

    _current_weights: Dict[str, float] = DEFAULT_WEIGHTS.copy()

    @classmethod
    def set_weights(cls, custom_weights: Dict[str, float]) -> Dict[str, float]:
        """Dynamically reconfigures engine factor weights."""
        for key, value in custom_weights.items():
            if key in cls._current_weights:
                cls._current_weights[key] = float(value)
        return cls._current_weights.copy()

    @classmethod
    def reset_weights(cls) -> Dict[str, float]:
        """Resets weights to default values."""
        cls._current_weights = cls.DEFAULT_WEIGHTS.copy()
        return cls._current_weights.copy()

    @classmethod
    def get_weights(cls) -> Dict[str, float]:
        """Returns active weight configuration."""
        return cls._current_weights.copy()

    @classmethod
    def calculate_score(
        cls,
        accelerometer: bool = False,
        gyroscope: bool = False,
        stillness: bool = False,
        gps: bool = False,
        chatbot: float = 0.0,
        user_response: bool = False,
        qr_confirmation: bool = False,
        fall_detected: bool = False,
        strong_impact: bool = False,
        rotation_change: bool = False,
        loss_of_consciousness: bool = False,
        chest_pain: bool = False,
        breathing_difficulty: bool = False,
        severe_bleeding: bool = False,
        weights_override: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Computes explainable emergency confidence score (0-100%), risk severity,
        reasons breakdown, and recommended action.
        """
        score = 0.0
        breakdown = {}
        reasons = []
        explanations = []

        # 1. Fall Motion Components
        if fall_detected:
            score += 30.0
            breakdown["Fall Detected"] = 30.0
            reasons.append("Fall detected (+30%)")
            explanations.append("• Fall Detected: +30.0% (Free fall pattern identified)")

        if strong_impact or accelerometer:
            contrib = 20.0 if strong_impact else 15.0
            score += contrib
            breakdown["Strong Impact"] = contrib
            reasons.append(f"Strong impact (+{contrib:.0f}%)")
            explanations.append(f"• Strong Impact: +{contrib:.1f}% (High acceleration G-force magnitude)")

        if rotation_change or gyroscope:
            contrib = 15.0
            score += contrib
            breakdown["Rotation Change"] = contrib
            reasons.append("Rotation change (+15%)")
            explanations.append("• Rotation Change: +15.0% (Angular spin > 180°/s)")

        if stillness:
            score += 15.0
            breakdown["Post-Impact Stillness"] = 15.0
            reasons.append("Post-impact stillness (+15%)")
            explanations.append("• Post-Impact Stillness: +15.0% (Patient unmoving post-impact)")

        # 2. Symptoms & Triage Components
        if loss_of_consciousness:
            score += 25.0
            breakdown["Loss of Consciousness"] = 25.0
            reasons.append("Loss of consciousness (+25%)")
            explanations.append("• Loss of Consciousness: +25.0% (Unresponsive / fainted)")

        if chest_pain:
            score += 25.0
            breakdown["Chest Pain"] = 25.0
            reasons.append("Severe chest pain (+25%)")
            explanations.append("• Chest Pain: +25.0% (Acute cardiac warning symptom)")

        if breathing_difficulty:
            score += 30.0
            breakdown["Breathing Difficulty"] = 30.0
            reasons.append("Breathing difficulty (+30%)")
            explanations.append("• Breathing Difficulty: +30.0% (Severe respiratory distress)")

        if severe_bleeding:
            score += 30.0
            breakdown["Severe Bleeding"] = 30.0
            reasons.append("Severe bleeding (+30%)")
            explanations.append("• Severe Bleeding: +30.0% (Active hemorrhage)")

        if chatbot > 0 and not (loss_of_consciousness or chest_pain or breathing_difficulty or severe_bleeding):
            contrib = min(float(chatbot), 20.0)
            score += contrib
            breakdown["Chatbot Triage"] = contrib
            reasons.append(f"Chatbot symptom score (+{contrib:.0f}%)")
            explanations.append(f"• Chatbot Triage: +{contrib:.1f}% (Self-reported symptom severity)")

        # 3. User SOS Confirmation
        if user_response:
            score += 40.0
            breakdown["Manual SOS Confirmed"] = 40.0
            reasons.append("Manual SOS confirmed (+40%)")
            explanations.append("• User Response: +40.0% (Manual SOS confirmed by patient)")

        if gps:
            score += 10.0
            breakdown["GPS Locked"] = 10.0
            reasons.append("GPS location verified (+10%)")
            explanations.append("• GPS: +10.0% (Coordinates locked)")

        if qr_confirmation:
            score += 25.0
            breakdown["QR Scan Verified"] = 25.0
            reasons.append("QR scan verified (+25%)")
            explanations.append("• QR Confirmation: +25.0% (Verified doctor / scan)")

        total_score = min(score, 100.0)

        # Categorization
        if total_score >= 80.0:
            severity = "CRITICAL"
            emergency_required = True
            recommended_action = "DISPATCH_AMBULANCE_IMMEDIATELY"
            recommended_status = "Hospital Dispatched"
            action_description = "CRITICAL RISK: Auto-assign nearest ER hospital & allocate priority ambulance."
        elif total_score >= 60.0:
            severity = "HIGH"
            emergency_required = True
            recommended_action = "ESCALATE_TO_FAMILY_QUEUE"
            recommended_status = "Family Notified"
            action_description = "HIGH RISK: Initiate emergency contact notification & call escalation."
        elif total_score >= 30.0:
            severity = "MEDIUM"
            emergency_required = False
            recommended_action = "PROVIDE_SAFETY_ADVICE_AND_MONITOR"
            recommended_status = "Asking User"
            action_description = "MEDIUM RISK: Provide safety advice and active monitoring. Do not auto-notify family."
        else:
            severity = "LOW"
            emergency_required = False
            recommended_action = "STANDBY_MONITORING"
            recommended_status = "Standby"
            action_description = "LOW RISK: Maintain standard background monitoring."

        explanation_header = f"ResQNet Emergency Decision Support | Score: {total_score:.1f}% | Risk: {severity}"
        explanation_body = "\n".join(explanations) if explanations else "• No emergency threat factors detected."
        full_explanation = f"{explanation_header}\n\nReasons:\n{explanation_body}\n\nAction Plan:\n{action_description}\n\nDisclaimer: Decision support engine only; not a formal medical diagnosis."

        return {
            "confidence_score": round(total_score, 1),
            "severity": severity,
            "emergency_required": emergency_required,
            "reasons": reasons if reasons else ["No active risk factors"],
            "recommended_action": recommended_action,
            "recommended_status": recommended_status,
            "weight_breakdown": breakdown,
            "scoring_explanation": full_explanation
        }
