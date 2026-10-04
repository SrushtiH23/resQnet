import os
import json
import pandas as pd
from typing import Dict, Any

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVALUATION_DIR = os.path.join(BACKEND_DIR, "evaluation")

def get_mobiact_evaluation_data() -> Dict[str, Any]:
    """
    Read-only service returning the audited MobiAct research evaluation findings.
    Serves verified experimental metrics without modifying production fall detector logic.
    """
    return {
        "title": "MobiAct Research Evaluation",
        "subtitle": "Audited evaluation of the production ResQNet finite-state fall detector on MobiAct v2.0",
        "badges": [
            "630 Trials Evaluated",
            "Production Detector — Unmodified",
            "MobiAct v2.0 Benchmark"
        ],
        "dataset": {
            "name": "MobiAct v2.0 / MobiFall Dataset v2.0",
            "total_trials": 630,
            "fall_trials": 288,
            "adl_trials": 342,
            "skipped_trials": 0,
            "total_adl_duration_min": 150.52,
            "total_adl_duration_sec": 9031.3
        },
        "preprocessing": {
            "accelerometer_unit": "m/s²",
            "gyroscope_conversion": "rad/s → °/s (gyro_deg_s = gyro_rad_s × 180/π)",
            "timestamp_alignment": "Nearest-neighbor timestamp matching via pd.merge_asof",
            "resampling": "20 Hz uniform timeline (50 ms time steps)",
            "sliding_window": "5-second rolling window / 100 samples",
            "detector": "Production ResQNet FSM (Unmodified)"
        },
        "resqnet_primary_metrics": {
            "tp": 283,
            "tn": 212,
            "fp": 130,
            "fn": 5,
            "accuracy": 0.7857,
            "precision": 0.6852,
            "recall": 0.9826,
            "specificity": 0.6199,
            "f1_score": 0.8074,
            "false_positive_rate": 0.3801
        },
        "trigger_timing": {
            "label": "Time from Trial Start to Detector Trigger",
            "mean_s": 3.754,
            "median_s": 3.700,
            "min_s": 1.600,
            "max_s": 6.100,
            "std_s": 0.681,
            "mean_ms": 3754.06,
            "median_ms": 3700.00,
            "min_ms": 1600.00,
            "max_ms": 6100.00,
            "std_ms": 680.85,
            "methodology_note": "Because MobiAct does not provide micro-annotated timestamps for exact physical fall onset, these measurements represent elapsed time from trial start to detector trigger rather than physical fall-detection latency."
        },
        "fall_type_performance": [
            {"code": "FKL", "description": "Front-Knees-Lying Fall", "trials": 72, "detected": 72, "missed": 0, "recall": 100.00},
            {"code": "FOL", "description": "Forward-Lying Fall", "trials": 72, "detected": 71, "missed": 1, "recall": 98.61},
            {"code": "BSC", "description": "Back-Sitting-Chair Fall", "trials": 72, "detected": 70, "missed": 2, "recall": 97.22},
            {"code": "SDL", "description": "Sideward-Lying Fall", "trials": 72, "detected": 70, "missed": 2, "recall": 97.22}
        ],
        "adl_false_alarms": [
            {"code": "WAL", "description": "Walking", "trials": 9, "fp_trials": 7, "fp_rate": 77.78},
            {"code": "CSI", "description": "Car-Step In", "trials": 54, "fp_trials": 32, "fp_rate": 59.26},
            {"code": "STN", "description": "Stairs Down", "trials": 54, "fp_trials": 30, "fp_rate": 55.56},
            {"code": "STU", "description": "Stairs Up", "trials": 54, "fp_trials": 30, "fp_rate": 55.56},
            {"code": "CSO", "description": "Car-Step Out", "trials": 54, "fp_trials": 27, "fp_rate": 50.00},
            {"code": "STD", "description": "Standing", "trials": 9, "fp_trials": 1, "fp_rate": 11.11},
            {"code": "JOG", "description": "Jogging", "trials": 27, "fp_trials": 1, "fp_rate": 3.70},
            {"code": "JUM", "description": "Jumping", "trials": 27, "fp_trials": 1, "fp_rate": 3.70},
            {"code": "SCH", "description": "Sit Chair", "trials": 54, "fp_trials": 1, "fp_rate": 1.85}
        ],
        "event_based_false_alarms": {
            "definition": "A distinct detector-trigger event is defined as a False → True rising-edge transition of the binary detector output during an ADL stream.",
            "total_adl_duration_min": 150.52,
            "total_distinct_trigger_events": 159,
            "event_fa_rate_per_min": 1.056,
            "event_fa_rate_per_hour": 63.38,
            "per_activity": [
                {"code": "CSI", "events": 48, "events_per_min": 9.078},
                {"code": "CSO", "events": 31, "events_per_min": 5.875},
                {"code": "STU", "events": 36, "events_per_min": 4.062},
                {"code": "STN", "events": 31, "events_per_min": 3.480},
                {"code": "WAL", "events": 9, "events_per_min": 0.200},
                {"code": "SCH", "events": 1, "events_per_min": 0.188},
                {"code": "JOG", "events": 1, "events_per_min": 0.074},
                {"code": "JUM", "events": 1, "events_per_min": 0.074},
                {"code": "STD", "events": 1, "events_per_min": 0.022}
            ]
        },
        "baseline_comparison": {
            "model_name": "Simple Acceleration Threshold Baseline",
            "rule": "A = sqrt(ax² + ay² + az²) > 14.0 m/s²",
            "metrics": {
                "tp": 288,
                "tn": 74,
                "fp": 268,
                "fn": 0,
                "accuracy": 0.5746,
                "precision": 0.5180,
                "recall": 1.0000,
                "specificity": 0.2164,
                "f1_score": 0.6825,
                "false_positive_rate": 0.7836,
                "distinct_trigger_events": 11160,
                "event_fa_rate_per_min": 74.142
            },
            "comparison": {
                "accuracy_diff": "+21.11 percentage points",
                "specificity_diff": "+40.35 percentage points",
                "f1_diff": "+12.49 percentage points",
                "fpr_reduction": "40.35 percentage points",
                "event_reduction_factor": "70.19×"
            }
        },
        "methodological_notes": [
            "630/630 trials successfully processed.",
            "No production detector files were modified.",
            "No detector thresholds were tuned using MobiAct results.",
            "Both baseline and ResQNet processed the identical preprocessed stream.",
            "Trial prediction uses the existing evaluation rule: any qualifying detector window causes the trial to be classified as FALL.",
            "Window-level sensitivity is NOT displayed as a primary metric because the fall recordings contain substantial post-fall stillness and the available labels are trial-level rather than micro-annotated frame-level labels."
        ],
        "conclusion": {
            "finding_1": "On the evaluated MobiAct dataset, ResQNet maintained 98.26% fall sensitivity while improving specificity from 21.64% to 61.99% compared with the simple acceleration-magnitude baseline.",
            "finding_2": "The FSM reduced distinct ADL detector-trigger events from 11,160 to 159, corresponding to a 70.19× reduction under the defined rising-edge event metric.",
            "label": "MobiAct evaluation findings"
        }
    }
