import os
import glob
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Tuple, Optional

# Constants for MobiAct
FALL_CODES = {"FOL": "Forward-Lying Fall", "FKL": "Front-Knees-Lying Fall", "BSC": "Back-Sitting-Chair Fall", "SDL": "Sideward-Lying Fall"}
ADL_CODES = {
    "STD": "Standing", "WAL": "Walking", "JOG": "Jogging", "JUM": "Jumping",
    "STU": "Stairs Up", "STN": "Stairs Down", "SCH": "Sit Chair",
    "CSI": "Car-step In", "CSO": "Car-step Out"
}

def parse_mobiact_file(filepath: str) -> Tuple[Dict[str, str], pd.DataFrame]:
    """
    Parses a single MobiAct .txt file.
    Extracts metadata from header comments and data rows after @DATA marker.
    """
    metadata = {}
    data_lines = []
    found_data = False
    
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line_str = line.strip()
            if line_str == "@DATA":
                found_data = True
                continue
            if not found_data:
                if line_str.startswith("#") and ":" in line_str:
                    key, val = line_str.lstrip("#").split(":", 1)
                    metadata[key.strip()] = val.strip()
            else:
                if line_str:
                    data_lines.append(line_str)
                    
    if not data_lines:
        return metadata, pd.DataFrame()
        
    records = [line.split(",") for line in data_lines]
    df = pd.DataFrame(records)
    if df.shape[1] >= 4:
        df = df.iloc[:, :4]
        df.columns = ["timestamp", "x", "y", "z"]
        df["timestamp"] = df["timestamp"].astype(float)
        df["x"] = df["x"].astype(float)
        df["y"] = df["y"].astype(float)
        df["z"] = df["z"].astype(float)
        
    return metadata, df

def load_and_preprocess_trial(
    acc_path: str,
    gyro_path: str,
    target_fps: float = 20.0
) -> Optional[Dict[str, Any]]:
    """
    Loads accelerometer and gyroscope trial files, performs unit conversion, timestamp alignment,
    and resamples to a uniform target_fps (20 Hz).
    """
    meta_acc, df_acc = parse_mobiact_file(acc_path)
    meta_gyro, df_gyro = parse_mobiact_file(gyro_path)
    
    if df_acc.empty or df_gyro.empty or len(df_acc) < 5 or len(df_gyro) < 5:
        return None
        
    # Sort by timestamp
    df_acc = df_acc.sort_values("timestamp").reset_index(drop=True)
    df_gyro = df_gyro.sort_values("timestamp").reset_index(drop=True)
    
    # Gyroscope unit conversion: rad/s -> deg/s
    # gyro_deg_s = gyro_rad_s * (180.0 / np.pi)
    df_gyro["x"] = df_gyro["x"] * (180.0 / np.pi)
    df_gyro["y"] = df_gyro["y"] * (180.0 / np.pi)
    df_gyro["z"] = df_gyro["z"] * (180.0 / np.pi)
    
    # Rename sensor columns prior to merge
    df_acc = df_acc.rename(columns={"x": "ax", "y": "ay", "z": "az"})
    df_gyro = df_gyro.rename(columns={"x": "gx", "y": "gy", "z": "gz"})
    
    # Align gyroscope to accelerometer timestamps using merge_asof (nearest neighbor)
    aligned_df = pd.merge_asof(
        df_acc,
        df_gyro,
        on="timestamp",
        direction="nearest"
    )
    
    # Ensure no NaN values after alignment
    aligned_df = aligned_df.dropna().reset_index(drop=True)
    if aligned_df.empty or len(aligned_df) < 5:
        return None

    # Resample to uniform 20 Hz timeline (50 ms steps)
    ts_start = aligned_df["timestamp"].iloc[0]
    ts_end = aligned_df["timestamp"].iloc[-1]
    
    # 20 Hz = 50ms = 50,000,000 nanoseconds
    step_ns = int(1e9 / target_fps)
    uniform_timestamps = np.arange(ts_start, ts_end, step_ns)
    
    if len(uniform_timestamps) < 5:
        return None
        
    # Interpolate ax, ay, az, gx, gy, gz onto uniform_timestamps
    resampled_data = {"timestamp": uniform_timestamps}
    for col in ["ax", "ay", "az", "gx", "gy", "gz"]:
        resampled_data[col] = np.interp(uniform_timestamps, aligned_df["timestamp"], aligned_df[col])
        
    resampled_df = pd.DataFrame(resampled_data)
    
    # Convert rows to list of frame dicts expected by ResQNet
    frames = []
    for row in resampled_df.itertuples(index=False):
        frames.append({
            "timestamp": row.timestamp,
            "ax": float(row.ax),
            "ay": float(row.ay),
            "az": float(row.az),
            "gx": float(row.gx),
            "gy": float(row.gy),
            "gz": float(row.gz)
        })
        
    return {
        "metadata": meta_acc,
        "frames": frames,
        "raw_duration_sec": (ts_end - ts_start) / 1e9,
        "sample_count_20hz": len(frames)
    }

def discover_all_mobiact_trials(dataset_path: str) -> List[Dict[str, str]]:
    """
    Discovers all matched (acc, gyro) trial pairs across the MobiAct dataset directory.
    """
    all_files = glob.glob(os.path.join(dataset_path, "**", "*.txt"), recursive=True)
    
    acc_files = {}
    gyro_files = {}
    
    for fpath in all_files:
        fname = os.path.basename(fpath)
        if fname == "DataDescribe.txt":
            continue
            
        parts = fname.replace(".txt", "").split("_")
        if len(parts) >= 4:
            act_code = parts[0]
            sensor_type = parts[1]
            subject_id = parts[2]
            trial_no = parts[3]
            
            key = (act_code, subject_id, trial_no)
            if sensor_type == "acc":
                acc_files[key] = fpath
            elif sensor_type == "gyro":
                gyro_files[key] = fpath
                
    matched_trials = []
    for key, acc_path in acc_files.items():
        if key in gyro_files:
            act_code, subject_id, trial_no = key
            is_fall = act_code in FALL_CODES
            act_type = FALL_CODES.get(act_code, ADL_CODES.get(act_code, "Unknown"))
            
            matched_trials.append({
                "activity_code": act_code,
                "subject_id": subject_id,
                "trial_no": trial_no,
                "trial_id": f"{act_code}_sub{subject_id}_t{trial_no}",
                "activity_type": act_type,
                "actual_label": "FALL" if is_fall else "NORMAL",
                "acc_path": acc_path,
                "gyro_path": gyro_files[key]
            })
            
    # Sort deterministically by actual_label, activity_code, subject_id, trial_no
    matched_trials.sort(key=lambda x: (x["actual_label"], x["activity_code"], int(x["subject_id"]) if x["subject_id"].isdigit() else x["subject_id"], int(x["trial_no"]) if x["trial_no"].isdigit() else x["trial_no"]))
    return matched_trials
