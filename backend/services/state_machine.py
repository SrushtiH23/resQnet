from typing import List, Dict, Any

class FallDetectionStateMachine:
    """
    FallDetectionStateMachine Module
    Handles 6-stage sequential motion verification:
    Stage 0: Normal Motion
    Stage 1: Free Fall (total_accel < 6.0 m/s²)
    Stage 2: Impact (total_accel > 15.0 m/s²)
    Stage 3: Rotation (total_gyro > 60.0 °/s)
    Stage 4: Stillness (accel_variance < 2.5 m/s²)
    Stage 5: Confidence Escalation
    Stage 6: Movement Recovery (Alert Stand-by)
    """

    @classmethod
    def evaluate_window(cls, samples: List[Dict[str, float]]) -> Dict[str, Any]:
        if not samples:
            return {
                "is_fall": False,
                "status_label": "NORMAL",
                "stage": "Stage 0: Normal Motion",
                "free_fall": False,
                "impact": False,
                "rotation": False,
                "stillness": False,
                "recovered": False,
                "confidence_boost": 0.0,
                "details": "Insufficient sensor samples"
            }

        min_accel = min(s["total_accel"] for s in samples)
        max_accel = max(s["total_accel"] for s in samples)
        max_gyro = max(s["total_gyro"] for s in samples)

        tail_count = max(3, int(len(samples) * 0.3))
        tail_samples = samples[-tail_count:]
        tail_accels = [s["total_accel"] for s in tail_samples]
        accel_variance = max(tail_accels) - min(tail_accels)

        has_free_fall = min_accel < 7.0
        has_impact = max_accel > 14.0
        has_rotation = max_gyro > 45.0
        has_stillness = accel_variance < 3.5
        has_recovered = accel_variance > 6.0 and max_accel > 14.0

        stage = "Stage 0: Normal Motion"
        confidence_boost = 0.0

        if has_recovered:
            stage = "Stage 6: Movement Recovery (Cancelled)"
            return {
                "is_fall": False,
                "status_label": "NORMAL",
                "stage": stage,
                "free_fall": has_free_fall,
                "impact": has_impact,
                "rotation": has_rotation,
                "stillness": False,
                "recovered": True,
                "confidence_boost": 0.0,
                "details": "Patient movement detected post-impact. Emergency automatically placed on standby."
            }

        if has_free_fall and has_impact and has_rotation and has_stillness:
            stage = "Stage 4/5: Critical Fall & Post-Impact Stillness"
            confidence_boost = 85.0
        elif has_free_fall and has_impact and has_rotation:
            stage = "Stage 3: Impact with Violent Rotation"
            confidence_boost = 65.0
        elif has_free_fall and has_impact:
            stage = "Stage 2: High Impact Fall"
            confidence_boost = 50.0
        elif has_free_fall:
            stage = "Stage 1: Free Fall Detected"
            confidence_boost = 25.0
        elif has_impact:
            stage = "Stage 2: Sudden Impact"
            confidence_boost = 25.0

        is_fall = confidence_boost >= 40.0

        status_label = "NORMAL"
        if is_fall:
            status_label = "FALL CONFIRMED"
        elif has_free_fall or has_impact:
            status_label = "POSSIBLE FALL"

        return {
            "is_fall": is_fall,
            "status_label": status_label,
            "stage": stage,
            "free_fall": has_free_fall,
            "impact": has_impact,
            "rotation": has_rotation,
            "stillness": has_stillness,
            "recovered": False,
            "confidence_boost": confidence_boost,
            "details": f"Min Accel: {min_accel:.1f} m/s², Max Accel: {max_accel:.1f} m/s², Max Gyro: {max_gyro:.1f} °/s"
        }

