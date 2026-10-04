import sys
import os
from typing import List, Dict, Any

# Ensure backend directory is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.sliding_window import SlidingWindowBuffer
from services.state_machine import FallDetectionStateMachine

def evaluate_single_trial(trial_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates a preprocessed MobiAct trial using the EXISTING ResQNet fall detector.
    
    Streaming process:
    - Pushes 20 Hz frames sequentially into SlidingWindowBuffer.
    - Evaluates FallDetectionStateMachine.evaluate_window() on rolling buffer.
    - Marks trial predicted label as FALL if fall detection triggers at any point during trial.
    """
    frames = trial_data["frames"]
    actual_label = trial_data["actual_label"]
    
    buffer = SlidingWindowBuffer(capacity=100)
    
    windows_processed = 0
    trial_fall_detected = False
    first_fall_trigger_frame = None
    first_fall_stage = None
    first_fall_details = None
    
    window_diagnostics = []
    
    for idx, frame in enumerate(frames):
        buffer.push(
            ax=frame["ax"],
            ay=frame["ay"],
            az=frame["az"],
            gx=frame["gx"],
            gy=frame["gy"],
            gz=frame["gz"]
        )
        
        current_samples = buffer.get_samples()
        
        # Start evaluating windows once buffer has accumulated minimum required history (e.g. >= 20 samples / 1 sec)
        if len(current_samples) >= 20:
            windows_processed += 1
            res = FallDetectionStateMachine.evaluate_window(current_samples)
            
            is_fall_frame = res.get("is_fall", False)
            
            # Secondary window diagnostic log
            window_diagnostics.append({
                "frame_index": idx,
                "timestamp": frame["timestamp"],
                "is_fall": is_fall_frame,
                "stage": res.get("stage", ""),
                "confidence_boost": res.get("confidence_boost", 0.0)
            })
            
            if is_fall_frame and not trial_fall_detected:
                trial_fall_detected = True
                first_fall_trigger_frame = idx
                first_fall_stage = res.get("stage", "")
                first_fall_details = res.get("details", "")

    predicted_label = "FALL" if trial_fall_detected else "NORMAL"
    
    # Classification determination:
    # TP: Actual FALL, Predicted FALL
    # TN: Actual NORMAL, Predicted NORMAL
    # FP: Actual NORMAL, Predicted FALL
    # FN: Actual FALL, Predicted NORMAL
    if actual_label == "FALL":
        detection_status = "TP" if predicted_label == "FALL" else "FN"
    else:
        detection_status = "FP" if predicted_label == "FALL" else "TN"

    # Compute latency if detected
    detection_latency_ms = None
    if first_fall_trigger_frame is not None and len(frames) > 0:
        start_ts = frames[0]["timestamp"]
        trigger_ts = frames[first_fall_trigger_frame]["timestamp"]
        detection_latency_ms = round((trigger_ts - start_ts) / 1e6, 2)
        
    return {
        "subject_id": trial_data["subject_id"],
        "activity_code": trial_data["activity_code"],
        "activity_type": trial_data["activity_type"],
        "trial_id": trial_data["trial_id"],
        "actual_label": actual_label,
        "predicted_label": predicted_label,
        "detection_status": detection_status,
        "is_correct": detection_status in ["TP", "TN"],
        "detection_latency_ms": detection_latency_ms,
        "windows_processed": windows_processed,
        "total_frames_20hz": len(frames),
        "raw_duration_sec": trial_data["raw_duration_sec"],
        "first_fall_stage": first_fall_stage or "N/A",
        "first_fall_details": first_fall_details or "N/A",
        "window_diagnostics": window_diagnostics
    }
