import os
import pandas as pd
import numpy as np
from typing import List, Dict, Any

def compute_trial_level_metrics(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes primary trial-level evaluation metrics:
    TP, TN, FP, FN, Accuracy, Precision, Recall, Specificity, F1-Score, FPR.
    """
    tp = sum(1 for r in results if r["detection_status"] == "TP")
    tn = sum(1 for r in results if r["detection_status"] == "TN")
    fp = sum(1 for r in results if r["detection_status"] == "FP")
    fn = sum(1 for r in results if r["detection_status"] == "FN")
    
    total = len(results)
    fall_trials = sum(1 for r in results if r["actual_label"] == "FALL")
    normal_trials = sum(1 for r in results if r["actual_label"] == "NORMAL")
    
    accuracy = round((tp + tn) / total, 4) if total > 0 else 0.0
    precision = round(tp / (tp + fp), 4) if (tp + fp) > 0 else 0.0
    recall = round(tp / (tp + fn), 4) if (tp + fn) > 0 else 0.0
    specificity = round(tn / (tn + fp), 4) if (tn + fp) > 0 else 0.0
    
    if (precision + recall) > 0:
        f1_score = round(2 * (precision * recall) / (precision + recall), 4)
    else:
        f1_score = 0.0
        
    fpr = round(fp / (fp + tn), 4) if (fp + tn) > 0 else 0.0
    
    latencies = [r["detection_latency_ms"] for r in results if r["detection_status"] == "TP" and r["detection_latency_ms"] is not None]
    avg_latency_ms = round(float(np.mean(latencies)), 2) if latencies else None
    
    return {
        "total_trials": total,
        "fall_trials": fall_trials,
        "normal_trials": normal_trials,
        "tp": tp,
        "tn": tn,
        "fp": fp,
        "fn": fn,
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "specificity": specificity,
        "f1_score": f1_score,
        "false_positive_rate": fpr,
        "avg_detection_latency_ms": avg_latency_ms
    }

def export_results_to_csv(results: List[Dict[str, Any]], output_csv_path: str):
    """
    Generates and saves trial-level predictions to a CSV file for full reproducibility.
    """
    rows = []
    for r in results:
        rows.append({
            "subject_id": r["subject_id"],
            "activity_code": r["activity_code"],
            "activity_type": r["activity_type"],
            "trial_id": r["trial_id"],
            "actual_label": r["actual_label"],
            "predicted_label": r["predicted_label"],
            "detection_status": r["detection_status"],
            "is_correct": "Yes" if r["is_correct"] else "No",
            "detection_latency_ms": r["detection_latency_ms"] if r["detection_latency_ms"] is not None else "N/A",
            "number_of_windows_processed": r["windows_processed"],
            "total_frames_20hz": r["total_frames_20hz"],
            "raw_duration_sec": round(r["raw_duration_sec"], 2),
            "first_fall_stage": r["first_fall_stage"],
            "first_fall_details": r["first_fall_details"]
        })
        
    df = pd.DataFrame(rows)
    os.makedirs(os.path.dirname(os.path.abspath(output_csv_path)), exist_ok=True)
    df.to_csv(output_csv_path, index=False)
    print(f"[EVALUATION Exported trial-level CSV: {output_csv_path}]")

def export_secondary_window_diagnostics_csv(results: List[Dict[str, Any]], output_csv_path: str):
    """
    Generates a secondary window-level diagnostic CSV report.
    (Clearly marked as secondary diagnostic output).
    """
    diag_rows = []
    for r in results:
        for w in r.get("window_diagnostics", []):
            diag_rows.append({
                "trial_id": r["trial_id"],
                "subject_id": r["subject_id"],
                "activity_code": r["activity_code"],
                "actual_label": r["actual_label"],
                "frame_index": w["frame_index"],
                "timestamp_ns": w["timestamp"],
                "is_fall_detected": "Yes" if w["is_fall"] else "No",
                "stage": w["stage"],
                "confidence_boost": w["confidence_boost"]
            })
            
    df = pd.DataFrame(diag_rows)
    os.makedirs(os.path.dirname(os.path.abspath(output_csv_path)), exist_ok=True)
    df.to_csv(output_csv_path, index=False)
    print(f"[EVALUATION Exported secondary window diagnostic CSV: {output_csv_path}]")

def print_confusion_matrix_and_report(metrics: Dict[str, Any]):
    """
    Prints a formatted ASCII confusion matrix and metrics summary table.
    """
    tp = metrics["tp"]
    tn = metrics["tn"]
    fp = metrics["fp"]
    fn = metrics["fn"]
    
    print("\n" + "="*70)
    print("      RESQNET MOBIACT EVALUATION RESULTS (PRIMARY TRIAL-LEVEL)")
    print("="*70)
    print(f"Total Trials Evaluated : {metrics['total_trials']} (Falls: {metrics['fall_trials']}, ADLs: {metrics['normal_trials']})")
    print("-" * 70)
    print("CONFUSION MATRIX:")
    print("                      ACTUAL FALL         ACTUAL NORMAL")
    print(f"PREDICTED FALL     |   TP = {tp:5d}       |   FP = {fp:5d}       |")
    print(f"PREDICTED NORMAL   |   FN = {fn:5d}       |   TN = {tn:5d}       |")
    print("-" * 70)
    print("PERFORMANCE METRICS:")
    print(f"  * Accuracy             : {metrics['accuracy']*100:.2f}%  ({tp+tn}/{metrics['total_trials']})")
    print(f"  * Sensitivity (Recall) : {metrics['recall']*100:.2f}%  ({tp}/{tp+fn})")
    print(f"  * Specificity          : {metrics['specificity']*100:.2f}%  ({tn}/{tn+fp})")
    print(f"  * Precision            : {metrics['precision']*100:.2f}%  ({tp}/{tp+fp})")
    print(f"  * F1-Score             : {metrics['f1_score']*100:.2f}%")
    print(f"  * False Positive Rate  : {metrics['false_positive_rate']*100:.2f}%  ({fp}/{fp+tn})")
    if metrics["avg_detection_latency_ms"] is not None:
        print(f"  * Avg Detection Latency: {metrics['avg_detection_latency_ms']:.2f} ms")
    print("="*70)
