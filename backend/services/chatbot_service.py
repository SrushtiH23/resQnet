from typing import Dict, Any

class EmergencyTriageChatbot:
    """
    Module 9: AI / Rule-Based Triage Chatbot Engine
    Evaluates self-reported symptom severity to adjust emergency confidence score.
    """

    @staticmethod
    def evaluate_triage(
        can_move: bool,
        is_bleeding: bool,
        has_chest_pain: bool,
        has_breathing_difficulty: bool,
        is_conscious: bool
    ) -> Dict[str, Any]:
        score_added = 0.0
        symptoms = []

        if not is_conscious:
            score_added += 20.0
            symptoms.append("Unconscious Patient")
        
        if has_chest_pain:
            score_added += 15.0
            symptoms.append("Acute Chest Pain")
            
        if has_breathing_difficulty:
            score_added += 15.0
            symptoms.append("Breathing Difficulty")

        if is_bleeding:
            score_added += 10.0
            symptoms.append("Active Bleeding")

        if not can_move:
            score_added += 10.0
            symptoms.append("Immobilized / Unable to Move")

        # Cap max triage addition at +20.0 to match confidence matrix
        total_triage_score = min(score_added, 20.0)

        if total_triage_score >= 15.0:
            severity_level = "Critical Triage"
            guidance = "Stay still. Emergency responders and ambulance dispatch are being prioritized."
        elif total_triage_score >= 8.0:
            severity_level = "Moderate Triage"
            guidance = "Keep calm. Contacts have been alerted. Standby for medical check."
        else:
            severity_level = "Mild / Stable"
            guidance = "Verification recorded. Emergency contact notified."

        return {
            "score_added": round(total_triage_score, 1),
            "severity_level": severity_level,
            "symptoms_identified": symptoms,
            "guidance_message": guidance
        }
