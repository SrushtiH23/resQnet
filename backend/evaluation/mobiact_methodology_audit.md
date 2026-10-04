# ResQNet Fall Detector: MobiAct Methodological Audit & Verification Report

**Author / Evaluator:** Antigravity Evaluation Suite  
**Date:** October 4, 2026  
**Target Dataset:** MobiAct / MobiFall Dataset v2.0  
**Target System:** ResQNet Production Python Fall Detector (`backend/services/state_machine.py`)  
**Status:** Methodological Audit Complete & Independently Verified  

---

## 1. Executive Summary & Audit Scope

This document provides a methodological audit and independent validation of the evaluation protocol used to test the existing **ResQNet finite-state fall detector** on the **MobiAct v2.0 dataset** (630 matched trials).

> [!IMPORTANT]
> **Audit Constraint & Code Integrity Notice:**  
> The production ResQNet detector logic, finite-state transitions, and threshold values were **kept 100% unchanged**. Zero production code files were modified. All evaluation modules operate strictly in an external evaluation suite (`backend/evaluation/`).

---

## 2. Dataset Composition & Sensor Properties

- **Dataset:** MobiAct Dataset v2.0 / MobiFall Dataset v2.0
- **Total Matched Trials:** **630 trials** (342 ADL trials + 288 Fall trials).
- **Subjects:** 24 total human subjects (IDs: 1–11 performed both ADLs & Falls; 12–31 performed Falls).
- **Sensor Streams:** 3-axis Accelerometer (`*_acc_*.txt`) and 3-axis Gyroscope (`*_gyro_*.txt`).
- **Raw Sampling Rates:**
  - Accelerometer: $\approx 84.06\text{ Hz}$ (Mean $\Delta t = 11.39\text{ ms}$)
  - Gyroscope: $\approx 199.88\text{ Hz}$ (Mean $\Delta t = 5.00\text{ ms}$)

### Activity Code Definitions:
1. **Fall Activities (4 types, 288 trials total):**
   - `FOL`: Forward-Lying Fall (72 trials)
   - `FKL`: Front-Knees-Lying Fall (72 trials)
   - `BSC`: Back-Sitting-Chair Fall (72 trials)
   - `SDL`: Sideward-Lying Fall (72 trials)
2. **Activities of Daily Living (ADLs) (9 types, 342 trials total):**
   - `STD`: Standing (9 trials)
   - `WAL`: Walking (9 trials)
   - `JOG`: Jogging (27 trials)
   - `JUM`: Jumping (27 trials)
   - `STU`: Stairs Up (54 trials)
   - `STN`: Stairs Down (54 trials)
   - `SCH`: Sit Chair (54 trials)
   - `CSI`: Car-Step In (54 trials)
   - `CSO`: Car-Step Out (54 trials)

---

## 3. Data Preprocessing & Stream Alignment

1. **Header Parsing:** Extracted data rows following the `@DATA` header marker.
2. **Gyroscope Unit Conversion:** Raw gyroscope readings in radians/second ($rad/s$) were converted to degrees/second ($^\circ/s$) using:
   $$\text{gyro}_{\text{deg\_s}} = \text{gyro}_{\text{rad\_s}} \times \frac{180}{\pi}$$
   *Rationale:* ResQNet's [`services/state_machine.py`](file:///d:/ResQnet/backend/services/state_machine.py#L43) evaluates rotational motion in $^\circ/s$ (`max_gyro > 45.0 °/s`).
3. **Timestamp Alignment:** Stream alignment was performed using `pd.merge_asof` (nearest-neighbor timestamp matching), joining Gyroscope readings onto Accelerometer timestamps.
4. **20 Hz Timeline Resampling:** Sensor data was interpolated onto a uniform 20 Hz timeline (50 ms steps) to match ResQNet's 5-second / 100-sample sliding window buffer (`SlidingWindowBuffer(capacity=100)`).

---

## 4. Primary Trial-Level Evaluation Protocol & Verified Results

### Classification Rule:
A rolling 5-second window (100 samples @ 20Hz) slides frame-by-frame across each trial. If **any single window** $W_k$ in a trial triggers $\text{confidence\_boost}(W_k) \ge 40.0$, the trial is assigned:
$$\text{PREDICTED LABEL} = \text{FALL}$$
Otherwise, the trial is assigned $\text{PREDICTED LABEL} = \text{NORMAL}$.

### Independent Arithmetic Verification of Metrics:

| Metric | Formula | Raw Counts | Calculated Value | Verified % |
| :--- | :--- | :---: | :---: | :---: |
| **True Positives (TP)** | Actual Fall, Predicted Fall | — | 283 | — |
| **True Negatives (TN)** | Actual Normal, Predicted Normal | — | 212 | — |
| **False Positives (FP)** | Actual Normal, Predicted Fall | — | 130 | — |
| **False Negatives (FN)** | Actual Fall, Predicted Normal | — | 5 | — |
| **Accuracy** | $\frac{TP + TN}{TP + TN + FP + FN}$ | $\frac{283 + 212}{630} = \frac{495}{630}$ | $0.785714...$ | **78.57%** |
| **Sensitivity (Recall)** | $\frac{TP}{TP + FN}$ | $\frac{283}{288}$ | $0.982638...$ | **98.26%** |
| **Specificity** | $\frac{TN}{TN + FP}$ | $\frac{212}{342}$ | $0.619883...$ | **61.99%** |
| **Precision** | $\frac{TP}{TP + FP}$ | $\frac{283}{413}$ | $0.685230...$ | **68.52%** |
| **F1-Score** | $2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}}$ | $2 \times \frac{0.685230 \times 0.982638}{0.685230 + 0.982638}$ | $0.807406...$ | **80.74%** |
| **False Positive Rate (FPR)** | $\frac{FP}{FP + TN}$ | $\frac{130}{342}$ | $0.380116...$ | **38.01%** |

---

## 5. False-Alarm Event Definition & Time-Normalized Rates

### Methodological Definition of a False-Alarm Event:
To avoid mislabeling trial counts as time rates, a **Distinct Detector-Trigger Event** is defined as a discrete $False \rightarrow True$ state transition of the fall detector (`is_fall` rising edge) during an ADL trial stream.

### Time-Normalized ADL False Alarm Breakdown:

- **Total ADL Recorded Duration:** **9,031.3 seconds** ($150.52\text{ minutes} / 2.51\text{ hours}$).
- **Total ADL Trials:** 342 trials (130 FP trials = 38.01% trial FP rate).
- **Total Distinct Trigger Events:** **159 events** across all 342 ADL trials.
- **Overall ADL Event-Based False Alarm Rate:** **1.056 events / minute** ($63.38\text{ events / hour}$).

#### Per-ADL Event Rate Table:

| ADL Code | ADL Description | Trials | Duration (min) | FP Trials | FP Trial Rate (%) | Distinct Trigger Events | Event FA / Min | Event FA / Hour |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **CSI** | Car-Step In | 54 | 5.29 | 32 | 59.26% | 48 | **9.078 / min** | 544.68 / hr |
| **CSO** | Car-Step Out | 54 | 5.28 | 27 | 50.00% | 31 | **5.875 / min** | 352.50 / hr |
| **STU** | Stairs Up | 54 | 8.86 | 30 | 55.56% | 36 | **4.062 / min** | 243.72 / hr |
| **STN** | Stairs Down | 54 | 8.91 | 30 | 55.56% | 31 | **3.480 / min** | 208.80 / hr |
| **WAL** | Walking | 9 | 44.99 | 7 | 77.78% | 9 | **0.200 / min** | 12.00 / hr |
| **SCH** | Sit Chair | 54 | 5.31 | 1 | 1.85% | 1 | **0.188 / min** | 11.28 / hr |
| **JOG** | Jogging | 27 | 13.46 | 1 | 3.70% | 1 | **0.074 / min** | 4.44 / hr |
| **JUM** | Jumping | 27 | 13.45 | 1 | 3.70% | 1 | **0.074 / min** | 4.44 / hr |
| **STD** | Standing | 9 | 44.99 | 1 | 11.11% | 1 | **0.022 / min** | 1.32 / hr |

---

## 6. Time from Trial Start to Detector Trigger (Fall Trials Only)

### Terminology Audit:
The MobiAct dataset files provide continuous trial recordings without frame-level annotations for exact physical fall onset. Therefore, measuring elapsed time from the start of the recording file to the detector trigger timestamp is **strictly designated as**:

$$\mathbf{\text{Time from Trial Start to Detector Trigger } (T_{\text{trigger\_from\_start}})}$$

> [!CAUTION]
> This metric MUST NOT be termed "fall-detection latency" in the paper unless measured relative to an annotated physical fall impact timestamp.

### Statistical Distribution across 283 Detected Fall Trials (TP):

$$\text{Trigger Time Formula: } T_{\text{trigger\_from\_start}} = t_{\text{trigger}} - t_0 \quad (\text{ms})$$

- **Mean Time to Trigger:** **3,754.06 ms** ($3.75\text{ s}$)
- **Median Time to Trigger:** **3,700.00 ms** ($3.70\text{ s}$)
- **Minimum Time to Trigger:** **1,600.00 ms** ($1.60\text{ s}$)
- **Maximum Time to Trigger:** **6,100.00 ms** ($6.10\text{ s}$)
- **Standard Deviation:** **680.85 ms** ($0.68\text{ s}$)

---

## 7. Window-Level Labeling Audit & Methodological Limitations

### Current Window Labeling Method (Method A):
- Every 5-second sliding window extracted from a Fall trial file was assigned `actual_label = FALL`.
- Every 5-second sliding window extracted from an ADL trial file was assigned `actual_label = NORMAL`.

### Methodological Limitation of Method A:
A typical 10-second fall trial recording comprises three distinct physical phases:
1. **Pre-Fall Phase (~2-3s):** Normal standing/walking motion.
2. **Fall Dynamic Phase (~1s):** Free fall, high impact, and body rotation.
3. **Post-Fall Stillness Phase (~6s):** Patient lying motionless on the ground.

When the 5-second sliding window advances into the **post-fall stillness phase**, the free-fall and impact acceleration spikes roll out of the 5-second buffer. The state machine observes low acceleration variance without a preceding impact in that immediate window, evaluating `is_fall == False`.

Under Method A (which forcibly labels post-fall stillness windows as `actual_label = FALL`), these windows are recorded as window-level False Negatives ($FN_{\text{window}} = 30,869$), driving window-level sensitivity down to **40.42%**.

> [!WARNING]
> **Paper Guidance:** Window-level sensitivity (40.42%) **must NOT be reported as a primary paper metric**. It is a diagnostic artifact caused by lack of temporal phase annotations in trial files.

### Secondary Window Diagnostic Summary (226,110 Windows):
- **Window-Level TP:** 20,939
- **Window-Level TN:** 171,174
- **Window-Level FP:** 3,128
- **Window-Level FN:** 30,869
- **Window-Level Accuracy:** **84.96%**
- **Window-Level Specificity:** **98.21%** (Confirms ADL false alarms are isolated transient windows)
- **Window-Level Precision:** **87.00%**

---

## 8. Summary of Methodological Conclusions for Paper Evaluation

1. **High Fall Recall (98.26%):** The un-tuned ResQNet detector successfully identifies **283 out of 288 real falls** under the trial-level protocol.
2. **Concentrated False Alarms:** False alarms are concentrated in specific high-impact ADL activities involving vehicle entry/exit (`CSI`/`CSO`) and stairs (`STU`/`STN`), where rapid vertical acceleration and body orientation changes mimic fall impact criteria.
3. **Primary Evaluation Protocol Recommendation:** Future paper evaluations should present both:
   - **Trial-Level Safety Performance** (98.26% sensitivity, prioritizing emergency detection).
   - **Event-Based False Alarm Rate** (1.056 events / minute of ADL activity) rather than raw trial FP percentages.
