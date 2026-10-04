import os
import sys
import pandas as pd
import numpy as np
from typing import List, Dict, Any

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BACKEND_DIR = os.path.join(WORKSPACE_ROOT, "backend")

if WORKSPACE_ROOT not in sys.path:
    sys.path.insert(0, WORKSPACE_ROOT)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from backend.evaluation.mobiact_loader import discover_all_mobiact_trials, load_and_preprocess_trial, FALL_CODES, ADL_CODES
from backend.evaluation.evaluator import evaluate_single_trial

DEFAULT_DATASET_PATH = r"C:\Users\SRUSHTI\Downloads\MobiAct_Dataset_v2.0-MobiFall_Dataset_v2.0-main\MobiAct_Dataset_v2.0-MobiFall_Dataset_v2.0-main"

ALL_ACTIVITY_NAMES = {
    # Falls
    "FOL": "Forward-Lying Fall",
    "FKL": "Front-Knees-Lying Fall",
    "BSC": "Back-Sitting-Chair Fall",
    "SDL": "Sideward-Lying Fall",
    # ADLs
    "STD": "Standing",
    "WAL": "Walking",
    "JOG": "Jogging",
    "JUM": "Jumping",
    "STU": "Stairs Up",
    "STN": "Stairs Down",
    "SCH": "Sit Chair",
    "CSI": "Car-step In",
    "CSO": "Car-step Out"
}

def run_deep_diagnostics(dataset_path: str = DEFAULT_DATASET_PATH):
    print("="*80)
    print("RESQNET MOBIACT EVALUATION - DEEP DIAGNOSTIC & METHODOLOGY VALIDATION")
    print("="*80)

    matched_trials = discover_all_mobiact_trials(dataset_path)
    
    trial_results = []
    window_records = []
    
    for trial_info in matched_trials:
        preprocessed = load_and_preprocess_trial(trial_info["acc_path"], trial_info["gyro_path"], target_fps=20.0)
        if preprocessed is None:
            continue
            
        full_trial_data = {**trial_info, **preprocessed}
        res = evaluate_single_trial(full_trial_data)
        trial_results.append(res)
        
        # Collect window diagnostics
        for w in res.get("window_diagnostics", []):
            window_records.append({
                "trial_id": res["trial_id"],
                "subject_id": res["subject_id"],
                "activity_code": res["activity_code"],
                "actual_label": res["actual_label"],
                "frame_index": w["frame_index"],
                "timestamp": w["timestamp"],
                "is_fall_window": w["is_fall"],
                "stage": w["stage"],
                "confidence_boost": w["confidence_boost"]
            })

    df_trials = pd.DataFrame(trial_results)
    df_windows = pd.DataFrame(window_records)
    
    # ---------------------------------------------------------
    # TASK 1: PER-ACTIVITY BREAKDOWN (630 TRIALS)
    # ---------------------------------------------------------
    print("\n" + "="*80)
    print("1. PER-ACTIVITY BREAKDOWN (TRIAL-LEVEL)")
    print("="*80)
    
    activity_rows = []
    
    for code in sorted(ALL_ACTIVITY_NAMES.keys()):
        name = ALL_ACTIVITY_NAMES[code]
        sub_df = df_trials[df_trials["activity_code"] == code]
        n_trials = len(sub_df)
        
        tp = sum(1 for _, r in sub_df.iterrows() if r["detection_status"] == "TP")
        tn = sum(1 for _, r in sub_df.iterrows() if r["detection_status"] == "TN")
        fp = sum(1 for _, r in sub_df.iterrows() if r["detection_status"] == "FP")
        fn = sum(1 for _, r in sub_df.iterrows() if r["detection_status"] == "FN")
        
        if code in FALL_CODES:
            det_rate = (tp / n_trials * 100) if n_trials > 0 else 0.0
            false_alarm_rate = 0.0
        else:
            det_rate = 0.0
            false_alarm_rate = (fp / n_trials * 100) if n_trials > 0 else 0.0
            
        activity_rows.append({
            "Code": code,
            "Activity Name": name,
            "Category": "FALL" if code in FALL_CODES else "ADL",
            "Trials": n_trials,
            "TP": tp,
            "TN": tn,
            "FP": fp,
            "FN": fn,
            "Detection Rate (%)": round(det_rate, 2),
            "False Alarm Rate (%)": round(false_alarm_rate, 2)
        })
        
    df_act_breakdown = pd.DataFrame(activity_rows)
    print(df_act_breakdown.to_string(index=False))

    # ---------------------------------------------------------
    # TASK 2: PER-FALL-TYPE DETECTION TABLE
    # ---------------------------------------------------------
    print("\n" + "="*80)
    print("2. PER-FALL-TYPE DETECTION TABLE")
    print("="*80)
    
    fall_rows = []
    for code in sorted(FALL_CODES.keys()):
        sub_df = df_trials[df_trials["activity_code"] == code]
        n_trials = len(sub_df)
        detected = sum(1 for _, r in sub_df.iterrows() if r["predicted_label"] == "FALL")
        missed = n_trials - detected
        recall = (detected / n_trials * 100) if n_trials > 0 else 0.0
        
        fall_rows.append({
            "Fall Code": code,
            "Fall Description": ALL_ACTIVITY_NAMES[code],
            "Total Trials": n_trials,
            "Detected (TP)": detected,
            "Missed (FN)": missed,
            "Recall (%)": round(recall, 2)
        })
    print(pd.DataFrame(fall_rows).to_string(index=False))

    # ---------------------------------------------------------
    # TASK 3: ADL FALSE ALARM TABLE
    # ---------------------------------------------------------
    print("\n" + "="*80)
    print("3. ADL FALSE-ALARM TABLE (TRIAL-LEVEL)")
    print("="*80)
    
    adl_rows = []
    for code in sorted(ADL_CODES.keys()):
        sub_df = df_trials[df_trials["activity_code"] == code]
        n_trials = len(sub_df)
        fa_trials = sum(1 for _, r in sub_df.iterrows() if r["predicted_label"] == "FALL")
        fa_rate = (fa_trials / n_trials * 100) if n_trials > 0 else 0.0
        
        adl_rows.append({
            "ADL Code": code,
            "ADL Activity": ALL_ACTIVITY_NAMES[code],
            "Total Trials": n_trials,
            "False Alarm Trials (FP)": fa_trials,
            "False Alarm Rate (%)": round(fa_rate, 2)
        })
    print(pd.DataFrame(adl_rows).to_string(index=False))

    # ---------------------------------------------------------
    # TASK 4: FALSE ALARMS NORMALIZED BY TIME
    # ---------------------------------------------------------
    print("\n" + "="*80)
    print("4. FALSE ALARMS NORMALIZED BY TIME (PER ADL ACTIVITY)")
    print("="*80)
    
    norm_rows = []
    for code in sorted(ADL_CODES.keys()):
        sub_df = df_trials[df_trials["activity_code"] == code]
        sub_win = df_windows[df_windows["activity_code"] == code]
        
        total_duration_sec = sub_df["raw_duration_sec"].sum()
        total_duration_min = total_duration_sec / 60.0
        
        # Trial-level false alarms
        trial_fa_count = sum(1 for _, r in sub_df.iterrows() if r["predicted_label"] == "FALL")
        trial_fa_per_min = trial_fa_count / total_duration_min if total_duration_min > 0 else 0.0
        trial_fa_per_hour = trial_fa_per_min * 60.0
        
        # Window-level false positive windows
        window_fa_count = sum(1 for _, w in sub_win.iterrows() if w["is_fall_window"])
        window_fa_per_min = window_fa_count / total_duration_min if total_duration_min > 0 else 0.0
        
        norm_rows.append({
            "ADL Code": code,
            "Trials": len(sub_df),
            "Total Duration (s)": round(total_duration_sec, 1),
            "Total Duration (min)": round(total_duration_min, 2),
            "Trial-Level FPs": trial_fa_count,
            "Trial FA / Min": round(trial_fa_per_min, 3),
            "Trial FA / Hour": round(trial_fa_per_hour, 2),
            "Window FPs": window_fa_count,
            "Window FA / Min": round(window_fa_per_min, 3)
        })
        
    df_norm = pd.DataFrame(norm_rows)
    print(df_norm.to_string(index=False))

    # ---------------------------------------------------------
    # TASK 5: INVESTIGATION OF 130 FALSE-POSITIVE TRIALS
    # ---------------------------------------------------------
    print("\n" + "="*80)
    print("5. INVESTIGATION OF FALSE-POSITIVE TRIALS (130 TRIALS TOTAL)")
    print("="*80)
    
    fp_df = df_trials[df_trials["detection_status"] == "FP"]
    print(f"Total False-Positive Trials: {len(fp_df)}")
    print("\nFP Distribution across ADLs:")
    print(fp_df["activity_code"].value_counts().to_string())
    
    print("\nSample False-Positive Trials Breakdown (First 15):")
    cols_fp = ["subject_id", "activity_code", "trial_id", "detection_latency_ms", "first_fall_stage", "first_fall_details"]
    print(fp_df[cols_fp].head(15).to_string(index=False))
    
    # Save full 130 FP breakdown to CSV
    fp_csv_path = os.path.join(BACKEND_DIR, "evaluation", "mobiact_false_positives_breakdown.csv")
    fp_df.to_csv(fp_csv_path, index=False)
    print(f"\n[Exported full 130 false positive details to: {fp_csv_path}]")

    # ---------------------------------------------------------
    # TASK 6: DETECTION LATENCY ANALYSIS (FALL TRIALS ONLY)
    # ---------------------------------------------------------
    print("\n" + "="*80)
    print("6. DETECTION LATENCY STATISTICAL ANALYSIS (FALL TRIALS ONLY)")
    print("="*80)
    
    tp_df = df_trials[df_trials["detection_status"] == "TP"]
    latencies = tp_df["detection_latency_ms"].dropna().values
    
    print(f"Total Fall Trials Detected (TP): {len(latencies)}")
    print(f"  • Mean Latency   : {np.mean(latencies):.2f} ms ({np.mean(latencies)/1000:.2f} s)")
    print(f"  • Median Latency : {np.median(latencies):.2f} ms ({np.median(latencies)/1000:.2f} s)")
    print(f"  • Min Latency    : {np.min(latencies):.2f} ms ({np.min(latencies)/1000:.2f} s)")
    print(f"  • Max Latency    : {np.max(latencies):.2f} ms ({np.max(latencies)/1000:.2f} s)")
    print(f"  • Std Deviation  : {np.std(latencies):.2f} ms ({np.std(latencies)/1000:.2f} s)")
    
    print("\nMethodological Definition of Latency Measurement:")
    print("  1. Trial Start ($t=0$): Timestamp of the first sensor frame in the trial file.")
    print("  2. Trigger Timestamp ($t_{\\text{trigger}}$): Timestamp of the frame where SlidingWindowBuffer filled with 100 samples (5s @ 20Hz) first satisfies FallDetectionStateMachine threshold criteria (confidence_boost >= 40.0).")
    print("  3. Latency Formula: $\\text{Latency} = t_{\\text{trigger}} - t_0$ (ms).")

    # ---------------------------------------------------------
    # TASK 7: TRIAL-LEVEL AGGREGATION LOGIC CONFIRMATION
    # ---------------------------------------------------------
    print("\n" + "="*80)
    print("7. CONFIRMATION OF TRIAL-LEVEL AGGREGATION LOGIC")
    print("="*80)
    print("Current Protocol: 'ANY-WINDOW DETECTED = TRIAL FALL'")
    print("Logic Explanation:")
    print("  - A rolling 5-second window (100 samples @ 20Hz) slides frame-by-frame across the trial stream.")
    print("  - For every 5-second window $W_k$, FallDetectionStateMachine evaluates features.")
    print("  - If $\\exists W_k$ such that confidence_boost(W_k) >= 40.0, trial is assigned PREDICTED LABEL = FALL.")
    print("  - Otherwise, PREDICTED LABEL = NORMAL.")
    print("  - Impact of Protocol: Highly conservative for real-time safety (never miss a fall), but susceptible to single transient spikes in high-dynamic ADLs (e.g. Jumping, Jogging).")

    # ---------------------------------------------------------
    # TASK 9: SECONDARY WINDOW-LEVEL CONFUSION MATRIX
    # ---------------------------------------------------------
    print("\n" + "="*80)
    print("9. SECONDARY WINDOW-LEVEL CONFUSION MATRIX & DIAGNOSTICS")
    print("="*80)
    
    w_tp = sum(1 for _, w in df_windows.iterrows() if w["actual_label"] == "FALL" and w["is_fall_window"])
    w_fn = sum(1 for _, w in df_windows.iterrows() if w["actual_label"] == "FALL" and not w["is_fall_window"])
    w_fp = sum(1 for _, w in df_windows.iterrows() if w["actual_label"] == "NORMAL" and w["is_fall_window"])
    w_tn = sum(1 for _, w in df_windows.iterrows() if w["actual_label"] == "NORMAL" and not w["is_fall_window"])
    
    w_total = len(df_windows)
    w_acc = (w_tp + w_tn) / w_total if w_total > 0 else 0.0
    w_sens = w_tp / (w_tp + w_fn) if (w_tp + w_fn) > 0 else 0.0
    w_spec = w_tn / (w_tn + w_fp) if (w_tn + w_fp) > 0 else 0.0
    w_prec = w_tp / (w_tp + w_fp) if (w_tp + w_fp) > 0 else 0.0
    
    print(f"Total Valid 5-Second Windows Evaluated: {w_total}")
    print("-" * 80)
    print("WINDOW-LEVEL CONFUSION MATRIX (SECONDARY DIAGNOSTIC ONLY):")
    print("                      ACTUAL FALL WINDOW     ACTUAL NORMAL WINDOW")
    print(f"PREDICTED FALL WINDOW|   TP = {w_tp:7d}       |   FP = {w_fp:7d}       |")
    print(f"PREDICTED NORM WINDOW|   FN = {w_fn:7d}       |   TN = {w_tn:7d}       |")
    print("-" * 80)
    print(f"  * Window-Level Accuracy   : {w_acc*100:.2f}% ({w_tp+w_tn}/{w_total})")
    print(f"  * Window-Level Sensitivity: {w_sens*100:.2f}% ({w_tp}/{w_tp+w_fn})")
    print(f"  * Window-Level Specificity: {w_spec*100:.2f}% ({w_tn}/{w_tn+w_fp})")
    print(f"  * Window-Level Precision  : {w_prec*100:.2f}% ({w_tp}/{w_tp+w_fp})")
    print("="*80)

if __name__ == "__main__":
    run_deep_diagnostics()
