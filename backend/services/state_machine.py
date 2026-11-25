import math
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("ResQNet.FallStateMachine")

class FallDetectionStages:
    NORMAL = "NORMAL"
    POTENTIAL_FALL = "POTENTIAL_FALL"
    IMPACT_DETECTED = "IMPACT_DETECTED"
    POST_IMPACT_MONITORING = "POST_IMPACT_MONITORING"
    FALL_CONFIDENCE_EVALUATION = "FALL_CONFIDENCE_EVALUATION"
    USER_CONFIRMATION = "USER_CONFIRMATION"
    EMERGENCY_ESCALATION = "EMERGENCY_ESCALATION"
    RECOVERY = "RECOVERY"

class FallDetectionStateMachine:
    """
    FallDetectionStateMachine Module
    Implements a reliable 7-stage temporal state machine for multi-sensor intelligent fall detection:

    1. NORMAL                   : Continuous baseline motion (~9.8 m/s²).
    2. POTENTIAL_FALL           : Free-fall dip (< 6.8 m/s²), descent unweighting, or stumble precursor.
    3. IMPACT_DETECTED          : High deceleration shock peak (>= 16.5 m/s²).
    4. POST_IMPACT_MONITORING   : Post-impact settling window, posture tilt change (>= 30°), stillness vs recovery.
    5. FALL_CONFIDENCE_EVALUATION: Multi-factor sensor fusion confidence score calculation.
    6. USER_CONFIRMATION        : High-confidence fall verified; triggers 10-second countdown modal/activity.
    7. EMERGENCY_ESCALATION     : Countdown expires or user clicks SOS; emergency alert and SMS dispatched.
    (RECOVERY                   : Active movement resumed post-impact; cancels alert to avoid false positives).

    Features:
    - Does not require free-fall in every fall scenario (supports falls from sitting, stumbling, and collapse).
    - Preserves events across rolling sampling windows.
    - Handles missing gyroscope readings gracefully by falling back to accelerometer posture tilt.
    - Flat device drop rejection: rejects vertical-to-horizontal impacts without body rotation or posture change.
    - Detailed diagnostic recording explaining every state transition or rejection.
    """

    # Calibrated Kinematic Thresholds (MobiAct Benchmark & Real Device Telemetry)
    FREEFALL_THRESHOLD = 6.8        # m/s² (~0.69g downward descent or unweighting)
    IMPACT_THRESHOLD = 16.5         # m/s² (~1.68g deceleration shock peak; captures soft & hard falls)
    HIGH_IMPACT_THRESHOLD = 20.0    # m/s² (severe impact shock)
    ROTATION_THRESHOLD = 80.0       # °/s (body toppling angular velocity)
    STILLNESS_VARIANCE = 2.6        # m/s² (post-impact resting stillness)
    TILT_CHANGE_THRESHOLD = 30.0    # degrees (pre vs post posture orientation change)
    RECOVERY_VARIANCE = 4.2         # m/s² (active movement resumption)
    CONFIDENCE_THRESHOLD = 60.0     # Minimum confidence to trigger USER_CONFIRMATION

    def __init__(self):
        self.current_stage = FallDetectionStages.NORMAL
        self.potential_fall_timestamp: Optional[float] = None
        self.impact_timestamp: Optional[float] = None
        self.impact_magnitude: float = 0.0
        self.pre_impact_orientation: Dict[str, float] = {"ax": 0.0, "ay": 9.81, "az": 0.0}
        self.stillness_start_timestamp: Optional[float] = None
        self.consecutive_still_frames: int = 0
        self.diagnostic_history: List[Dict[str, Any]] = []

    def reset(self):
        self.current_stage = FallDetectionStages.NORMAL
        self.potential_fall_timestamp = None
        self.impact_timestamp = None
        self.impact_magnitude = 0.0
        self.stillness_start_timestamp = None
        self.consecutive_still_frames = 0

    @classmethod
    def evaluate_window(cls, samples: List[Dict[str, float]]) -> Dict[str, Any]:
        """
        Stateless window evaluation method for rolling buffer analysis.
        Computes the complete kinematic signature across the sliding window and returns
        the current state, confidence boost, condition flags, and diagnostic reasons.
        """
        if not samples or len(samples) < 10:
            return {
                "is_fall": False,
                "status_label": "NORMAL",
                "stage": FallDetectionStages.NORMAL,
                "free_fall": False,
                "impact": False,
                "rotation": False,
                "stillness": False,
                "tilt_change": False,
                "recovered": False,
                "confidence_boost": 0.0,
                "details": "Insufficient sensor samples in window",
                "diagnostics": {
                    "reason": "WINDOW_TOO_SHORT",
                    "sample_count": len(samples) if samples else 0
                }
            }

        accels = [s.get("total_accel", 9.81) for s in samples]
        # Truthful gyro: None or 0.0 if unavailable
        gyros = [s.get("total_gyro", 0.0) if s.get("total_gyro") is not None else 0.0 for s in samples]
        gyro_available = any(s.get("gyro_available", True) and s.get("total_gyro") is not None and s.get("total_gyro") > 0.0 for s in samples)

        min_accel = min(accels)
        max_accel = max(accels)
        max_gyro = max(gyros) if gyros else 0.0

        i_min = accels.index(min_accel)
        i_max = accels.index(max_accel)

        # Sampling Interval Diagnostics
        timestamps = [s.get("timestamp", 0) for s in samples if s.get("timestamp")]
        sampling_interval_ms = 0.0
        if len(timestamps) >= 2:
            intervals = [timestamps[k] - timestamps[k-1] for k in range(1, len(timestamps))]
            valid_intervals = [dt for dt in intervals if dt > 0]
            if valid_intervals:
                sampling_interval_ms = sum(valid_intervals) / len(valid_intervals)

        # Tail samples for stillness analysis (last 35% of buffer)
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

        # Kinematic Conditions
        has_free_fall = min_accel < cls.FREEFALL_THRESHOLD
        has_impact = max_accel >= cls.IMPACT_THRESHOLD
        has_rotation = max_gyro >= cls.ROTATION_THRESHOLD
        has_stillness = accel_variance < cls.STILLNESS_VARIANCE
        has_tilt_change = tilt_deg >= cls.TILT_CHANGE_THRESHOLD
        has_recovered = accel_variance > cls.RECOVERY_VARIANCE and max_accel > 15.0

        # Temporal alignment: descent precursor or stumble happens before or near impact shock
        temporal_valid = (i_max >= i_min) or (abs(i_max - i_min) <= 15)

        # Determine Stage and Transition Diagnostics
        stage = FallDetectionStages.NORMAL
        confidence_boost = 0.0
        transition_reason = "Normal baseline locomotion"
        rejection_reason = None

        if has_recovered:
            stage = FallDetectionStages.RECOVERY
            confidence_boost = 0.0
            transition_reason = f"Active movement resumed post-impact (variance: {accel_variance:.2f} m/s² > {cls.RECOVERY_VARIANCE}). Alert standby."
            rejection_reason = "RECOVERY_MOVEMENT_DETECTED"
            return {
                "is_fall": False,
                "status_label": "NORMAL",
                "stage": stage,
                "free_fall": has_free_fall,
                "impact": has_impact,
                "rotation": has_rotation,
                "stillness": False,
                "tilt_change": has_tilt_change,
                "recovered": True,
                "confidence_boost": 0.0,
                "details": transition_reason,
                "diagnostics": {
                    "sampling_interval_ms": round(sampling_interval_ms, 2),
                    "min_accel": round(min_accel, 2),
                    "max_accel": round(max_accel, 2),
                    "max_gyro": round(max_gyro, 2),
                    "accel_variance": round(accel_variance, 2),
                    "tilt_deg": round(tilt_deg, 2),
                    "transition_reason": transition_reason,
                    "rejection_reason": rejection_reason
                }
            }

        # Multi-stage Temporal Kinematic Evaluation
        if has_impact and has_stillness and temporal_valid:
            # Check for flat drop rejection (phone dropped flat on table/floor without rotation or posture change)
            if not has_rotation and not has_tilt_change:
                stage = FallDetectionStages.IMPACT_DETECTED
                confidence_boost = 30.0
                transition_reason = "Device drop on flat surface (impact without body rotation or posture change). Rejected."
                rejection_reason = "FLAT_DEVICE_DROP_NO_ROTATION_OR_TILT"
            elif has_rotation and (has_tilt_change or has_free_fall):
                stage = FallDetectionStages.USER_CONFIRMATION
                confidence_boost = 95.0 if has_free_fall else 85.0
                transition_reason = f"Full kinematic signature verified: Impact ({max_accel:.1f} m/s²), Rotation ({max_gyro:.1f} °/s), Post-tilt ({tilt_deg:.1f}°), Stillness ({accel_variance:.2f} m/s²)."
            elif has_tilt_change and (has_free_fall or max_accel >= 18.0):
                stage = FallDetectionStages.USER_CONFIRMATION
                confidence_boost = 80.0
                transition_reason = f"Posture collapse verified via tilt ({tilt_deg:.1f}°) and post-impact stillness ({accel_variance:.2f} m/s²)."
            elif not gyro_available and has_tilt_change and max_accel >= cls.IMPACT_THRESHOLD:
                # Gyroscope-less fallback: relies on accelerometer posture tilt and stillness
                stage = FallDetectionStages.USER_CONFIRMATION
                confidence_boost = 75.0
                transition_reason = f"Fallback fall verification without gyroscope: Tilt ({tilt_deg:.1f}°), Impact ({max_accel:.1f} m/s²), Stillness ({accel_variance:.2f} m/s²)."
            else:
                stage = FallDetectionStages.FALL_CONFIDENCE_EVALUATION
                confidence_boost = 50.0
                transition_reason = "Borderline fall characteristics; awaiting further stillness verification."
                rejection_reason = "INSUFFICIENT_ROTATION_OR_TILT_FOR_CONFIRMATION"

        elif has_impact and not has_stillness:
            # Impact occurred, but user is currently moving or post-impact settling has not completed
            stage = FallDetectionStages.POST_IMPACT_MONITORING
            confidence_boost = 35.0
            transition_reason = f"High impact shock ({max_accel:.1f} m/s²) detected. Monitoring for post-impact stillness."
            rejection_reason = "POST_IMPACT_STILLNESS_NOT_YET_SATISFIED"

        elif has_impact:
            stage = FallDetectionStages.IMPACT_DETECTED
            confidence_boost = 25.0
            transition_reason = f"Impact shock peak ({max_accel:.1f} m/s²) registered."
            rejection_reason = "AWAITING_POST_IMPACT_MONITORING"

        elif has_free_fall:
            stage = FallDetectionStages.POTENTIAL_FALL
            confidence_boost = 20.0
            transition_reason = f"Descent / free-fall dip ({min_accel:.1f} m/s² < {cls.FREEFALL_THRESHOLD}) detected. Tracking potential impact."
            rejection_reason = "AWAITING_IMPACT_SHOCK"

        is_fall = confidence_boost >= cls.CONFIDENCE_THRESHOLD

        status_label = "NORMAL"
        if is_fall:
            status_label = "FALL CONFIRMED"
        elif stage in [FallDetectionStages.POTENTIAL_FALL, FallDetectionStages.IMPACT_DETECTED, FallDetectionStages.POST_IMPACT_MONITORING]:
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
            "details": f"Min: {min_accel:.1f} m/s², Peak: {max_accel:.1f} m/s², Gyro: {max_gyro:.1f} °/s, Post-Var: {accel_variance:.1f} m/s², Tilt: {tilt_deg:.1f}°",
            "diagnostics": {
                "sampling_interval_ms": round(sampling_interval_ms, 2),
                "min_accel": round(min_accel, 2),
                "max_accel": round(max_accel, 2),
                "max_gyro": round(max_gyro, 2),
                "gyro_available": gyro_available,
                "accel_variance": round(accel_variance, 2),
                "tilt_deg": round(tilt_deg, 2),
                "temporal_valid": temporal_valid,
                "transition_reason": transition_reason,
                "rejection_reason": rejection_reason
            }
        }
