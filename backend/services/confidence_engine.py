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
        weights_override: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Computes emergency confidence score (0-100%), severity rating, recommended action,
        and step-by-step mathematical scoring explanation.
        """
        weights = weights_override if weights_override else cls._current_weights

        score = 0.0
        breakdown = {}
        explanations = []

        # Factor 1: Accelerometer
        if accelerometer:
            contrib = weights.get("accelerometer", 25.0)
            score += contrib
            breakdown["Accelerometer (Impact/Freefall)"] = contrib
            explanations.append(f"• Accelerometer: +{contrib:.1f}% (High impact force / free fall vector detected)")

        # Factor 2: Gyroscope
        if gyroscope:
            contrib = weights.get("gyroscope", 15.0)
            score += contrib
            breakdown["Gyroscope (Body Rotation)"] = contrib
            explanations.append(f"• Gyroscope: +{contrib:.1f}% (Rapid angular body rotation > 180°/s)")

        # Factor 3: Stillness
        if stillness:
            contrib = weights.get("stillness", 20.0)
            score += contrib
            breakdown["Stillness (Post-Impact)"] = contrib
            explanations.append(f"• Stillness: +{contrib:.1f}% (Post-impact variance < 1.5 m/s², patient unmoving)")

        # Factor 4: GPS
        if gps:
            contrib = weights.get("gps", 10.0)
            score += contrib
            breakdown["GPS (Location Verification)"] = contrib
            explanations.append(f"• GPS: +{contrib:.1f}% (Geospatial coordinates locked & verified)")

        # Factor 5: Chatbot Triage
        if chatbot > 0:
            max_cb = weights.get("chatbot", 20.0)
            contrib = min(float(chatbot), max_cb)
            score += contrib
            breakdown["Chatbot (AI Symptom Triage)"] = contrib
            explanations.append(f"• Chatbot: +{contrib:.1f}% (Symptom triage identified high-risk indicators)")

        # Factor 6: User Response / Manual SOS
        if user_response:
            contrib = weights.get("user_response", 40.0)
            score += contrib
            breakdown["User Response (SOS / Need Help)"] = contrib
            explanations.append(f"• User Response: +{contrib:.1f}% (Manual SOS pressed or 'Need Help' confirmed)")

        # Factor 7: QR Confirmation
        if qr_confirmation:
            contrib = weights.get("qr_confirmation", 25.0)
            score += contrib
            breakdown["QR Confirmation (Doctor / Scan)"] = contrib
            explanations.append(f"• QR Confirmation: +{contrib:.1f}% (Doctor / Bystander verified via encrypted QR scan)")

        # Cap total score at 100.0%
        total_score = min(score, 100.0)

        # Output Categorization: Severity & Recommended Action
        if total_score >= 80.0:
            severity = "CRITICAL"
            recommended_action = "DISPATCH_AMBULANCE_IMMEDIATELY"
            recommended_status = "Hospital Dispatched"
            action_description = "Confidence >= 80%: Auto-assign nearest ER hospital via Dijkstra routing & allocate priority ambulance."
        elif total_score >= 60.0:
            severity = "HIGH"
            recommended_action = "ESCALATE_TO_FAMILY_QUEUE"
            recommended_status = "Family Notified"
            action_description = "Confidence 60-79%: Trigger sequential family contact escalation queue (Mother -> Father)."
        elif total_score >= 30.0:
            severity = "MEDIUM"
            recommended_action = "TRIGGER_30S_USER_CHECKOUT_POPUP"
            recommended_status = "Asking User"
            action_description = "Confidence 30-59%: Display 30-second 'Possible Fall Detected' checkout popup on patient device."
        else:
            severity = "LOW"
            recommended_action = "STANDBY_MONITORING"
            recommended_status = "Standby"
            action_description = "Confidence < 30%: Maintain active 20Hz background monitoring without alerting emergency contacts."

        # Natural Language Scoring Rationale
        explanation_header = f"Emergency Confidence Score: {total_score:.1f}% | Severity: {severity} | Action: {recommended_action}"
        explanation_body = "\n".join(explanations) if explanations else "• No active emergency evidence factors detected."
        full_explanation = f"{explanation_header}\n\nEvidence Breakdown:\n{explanation_body}\n\nDecision Rationale:\n{action_description}"

        return {
            "confidence_score": round(total_score, 1),
            "severity": severity,
            "recommended_action": recommended_action,
            "recommended_status": recommended_status,
            "weight_breakdown": breakdown,
            "scoring_explanation": full_explanation,
            "active_weights": weights.copy()
        }
