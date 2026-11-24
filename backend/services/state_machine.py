import math
from typing import List, Dict, Any

class FallDetectionStateMachine:
    """
    FallDetectionStateMachine Module
    Handles 6-stage sequential multi-sensor kinematic verification:
    Stage 0: Normal Motion
    Stage 1: Descent / Free Fall (total_accel < 6.5 m/s² / 0.65g)
    Stage 2: High Impact Force (total_accel > 18.0 m/s²)
    Stage 3: Angular Body Rotation (total_gyro > 80.0 °/s / 1.4 rad/s)
    Stage 4: Post-Impact Stillness & Orientation Change (variance < 3.0 m/s², tilt > 30°)
    Stage 5: High Confidence Critical Fall (Confidence >= 60.0)
    Stage 6: Movement Recovery (Alert Stand-by / Cancelled)
    """

    # Calibrated kinematic thresholds based on MobiAct benchmark & real-device sensors
    FREEFALL_THRESHOLD = 6.5       # m/s² (~0.65g downward descent)
    IMPACT_THRESHOLD = 18.0        # m/s² (~1.84g deceleration shock)
    ROTATION_THRESHOLD = 80.0      # °/s (body toppling angular velocity)
    STILLNESS_VARIANCE = 3.0       # m/s² (post-impact resting stillness)
    TILT_CHANGE_THRESHOLD = 30.0   # degrees (posture orientation change)
    RECOVERY_VARIANCE = 5.5        # m/s² (immediate movement post-impact)
    CONFIDENCE_THRESHOLD = 60.0    # Minimum confidence to confirm emergency

    @classmethod
    def evaluate_window(cls, samples: List[Dict[str, float]]) -> Dict[str, Any]:
        if not samples or len(samples) < 10:
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

        accels = [s.get("total_accel", 9.81) for s in samples]
        gyros = [s.get("total_gyro", 0.0) for s in samples]

        min_accel = min(accels)
        max_accel = max(accels)
        max_gyro = max(gyros)

        i_min = accels.index(min_accel)
        i_max = accels.index(max_accel)

        # Post-impact tail samples for stillness analysis (last 35% of buffer)
        tail_count = max(4, int(len(samples) * 0.35))
        tail_samples = samples[-tail_count:]
        tail_accels = [s.get("total_accel", 9.81) for s in tail_samples]
        accel_variance = max(tail_accels) - min(tail_accels)

        # Pre-impact vs post-impact tilt angle orientation calculation
        head_count = min(10, len(samples))
        head_samples = samples[:head_count]
        post_count = min(10, len(samples))
        post_samples = samples[-post_count:]

        avg_head_ax = sum(s.get("ax", 0.0) for s in head_samples) / head_count
        avg_head_ay = sum(s.get("ay", 9.81) for s in head_samples) / head_count
        avg_head_az = sum(s.get("az", 0.0) for s in head_samples) / head_count

        avg_post_ax = sum(s.get("ax", 0.0) for s in post_samples) / post_count
        avg_post_ay = sum(s.get("ay", 9.81) for s in post_samples) / post_count
        avg_post_az = sum(s.get("az", 0.0) for s in post_samples) / post_count

        norm_head = math.sqrt(avg_head_ax**2 + avg_head_ay**2 + avg_head_az**2) or 1.0
        norm_post = math.sqrt(avg_post_ax**2 + avg_post_ay**2 + avg_post_az**2) or 1.0
        dot = (avg_head_ax * avg_post_ax + avg_head_ay * avg_post_ay + avg_head_az * avg_post_az) / (norm_head * norm_post)
        dot = max(-1.0, min(1.0, dot))
        tilt_deg = math.degrees(math.acos(dot))

        # Kinematic signature evaluation
        has_free_fall = min_accel < cls.FREEFALL_THRESHOLD
        has_impact = max_accel > cls.IMPACT_THRESHOLD
        has_rotation = max_gyro > cls.ROTATION_THRESHOLD
        has_stillness = accel_variance < cls.STILLNESS_VARIANCE
        has_tilt_change = tilt_deg > cls.TILT_CHANGE_THRESHOLD
        has_recovered = accel_variance > cls.RECOVERY_VARIANCE and max_accel > 16.0

        # Temporal correlation: free-fall dip occurs before or closely around impact shock
        temporal_valid = (i_max >= i_min) or (abs(i_max - i_min) <= 15)

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
                "details": "Movement detected post-impact. Emergency alert automatically placed on stand-by."
            }

        # Multi-stage confidence scoring
        if has_impact and has_rotation and has_stillness and has_free_fall and temporal_valid:
            stage = "Stage 5: High Confidence Critical Fall"
            confidence_boost = 90.0
        elif has_impact and has_rotation and (has_stillness or has_tilt_change) and temporal_valid:
            stage = "Stage 4: Verified Rotational Fall"
            confidence_boost = 75.0
        elif has_impact and has_rotation and has_free_fall and temporal_valid:
            stage = "Stage 4: Rotational Impact with Descent"
            confidence_boost = 70.0
        elif has_impact and has_tilt_change and has_stillness and has_rotation:
            stage = "Stage 4: Posture Change with Angular Rotation"
            confidence_boost = 65.0
        elif has_impact and has_free_fall and has_stillness and not has_rotation:
            # Device dropped flat without body rotation
            stage = "Stage 2: Device Drop on Flat Surface (No Rotation)"
            confidence_boost = 30.0
        elif has_impact and has_rotation:
            stage = "Stage 3: Impact with Violent Rotation (Unverified Stillness)"
            confidence_boost = 35.0  # Does not cross threshold alone without stillness/tilt!
        elif has_impact:
            stage = "Stage 2: Sudden Impact Only"
            confidence_boost = 25.0
        elif has_free_fall:
            stage = "Stage 1: Free Fall Only"
            confidence_boost = 20.0

        is_fall = confidence_boost >= cls.CONFIDENCE_THRESHOLD

        status_label = "NORMAL"
        if is_fall:
            status_label = "FALL CONFIRMED"
        elif has_free_fall or has_impact or has_rotation:
            status_label = "POSSIBLE FALL"

        return {
            "is_fall": is_fall,
            "status_label": status_label,
            "stage": stage,
            "free_fall": has_free_fall,
            "impact": has_impact,
            "rotation": has_rotation,
            "stillness": has_stillness,
            "tilt_change": has_tilt_change,
            "recovered": False,
            "confidence_boost": confidence_boost,
            "details": f"Min: {min_accel:.1f} m/s², Peak: {max_accel:.1f} m/s², Gyro: {max_gyro:.1f} °/s, Post-Var: {accel_variance:.1f} m/s², Tilt: {tilt_deg:.1f}°"
        }
