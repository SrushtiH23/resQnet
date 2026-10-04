import os
import sys
import argparse
import time

# Ensure workspace root and backend directory are in sys.path
WORKSPACE_ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(WORKSPACE_ROOT, "backend")

if WORKSPACE_ROOT not in sys.path:
    sys.path.insert(0, WORKSPACE_ROOT)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from backend.evaluation.mobiact_loader import discover_all_mobiact_trials, load_and_preprocess_trial
from backend.evaluation.evaluator import evaluate_single_trial
from backend.evaluation.metrics import (
    compute_trial_level_metrics,
    export_results_to_csv,
    export_secondary_window_diagnostics_csv,
    print_confusion_matrix_and_report
)

DEFAULT_DATASET_PATH = r"C:\Users\SRUSHTI\Downloads\MobiAct_Dataset_v2.0-MobiFall_Dataset_v2.0-main\MobiAct_Dataset_v2.0-MobiFall_Dataset_v2.0-main"

def main():
    parser = argparse.ArgumentParser(description="ResQNet Research Evaluation Suite for MobiAct Dataset")
    parser.add_argument("--dataset-dir", type=str, default=DEFAULT_DATASET_PATH, help="Path to MobiAct dataset directory")
    parser.add_argument("--output-csv", type=str, default=os.path.join(BACKEND_DIR, "evaluation", "mobiact_trial_predictions.csv"), help="Output path for trial-level predictions CSV")
    parser.add_argument("--secondary-diag-csv", type=str, default=os.path.join(BACKEND_DIR, "evaluation", "mobiact_secondary_window_diagnostics.csv"), help="Output path for secondary window diagnostics CSV")
    args = parser.parse_args()

    print("="*70)
    print("RESQNET RESEARCH EVALUATION PIPELINE FOR MOBIACT DATASET")
    print("="*70)
    print(f"Dataset Location : {args.dataset_dir}")
    print(f"Primary Output CSV: {args.output_csv}")
    print("-" * 70)

    start_time = time.time()

    # Step 1: Discover matched trial files
    matched_trials = discover_all_mobiact_trials(args.dataset_dir)
    print(f"Discovered {len(matched_trials)} matched trial pairs (acc + gyro).")

    eval_results = []
    skipped_trials = []
    
    # Step 2: Process and Evaluate each trial
    print("\n[Processing & Evaluating Trials through ResQNet Fall Detector...]")
    for idx, trial_info in enumerate(matched_trials):
        preprocessed = load_and_preprocess_trial(
            acc_path=trial_info["acc_path"],
            gyro_path=trial_info["gyro_path"],
            target_fps=20.0
        )
        
        if preprocessed is None:
            skipped_trials.append({
                "trial_id": trial_info["trial_id"],
                "reason": "Insufficient frames or empty/corrupt file"
            })
            continue
            
        full_trial_data = {**trial_info, **preprocessed}
        res = evaluate_single_trial(full_trial_data)
        eval_results.append(res)
        
        if (idx + 1) % 100 == 0 or (idx + 1) == len(matched_trials):
            print(f"  Processed {idx + 1} / {len(matched_trials)} trials...")

    elapsed = time.time() - start_time
    print(f"\nCompleted evaluation in {elapsed:.2f} seconds.")
    print(f"Successfully Evaluated: {len(eval_results)} trials.")
    print(f"Skipped / Invalid     : {len(skipped_trials)} trials.")
    if skipped_trials:
        for sk in skipped_trials:
            print(f"  - Skipped {sk['trial_id']}: {sk['reason']}")

    # Step 3: Compute trial-level metrics
    metrics = compute_trial_level_metrics(eval_results)

    # Step 4: Export CSV outputs
    export_results_to_csv(eval_results, args.output_csv)
    export_secondary_window_diagnostics_csv(eval_results, args.secondary_diag_csv)

    # Step 5: Output confusion matrix and metrics summary
    print_confusion_matrix_and_report(metrics)

if __name__ == "__main__":
    main()
