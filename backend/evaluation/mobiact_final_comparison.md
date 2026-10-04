# ResQNet vs. Baseline Simple Threshold: Final Comparative Evaluation Report (MobiAct Dataset)

**Authors / Evaluators:** ResQNet Research Team  
**Date:** October 4, 2026  
**Dataset:** MobiAct Dataset v2.0 (630 matched trials)  
**Status:** Final Comparative Audit Complete & Methodologically Validated  

---

## 1. Executive Summary & Audit Declaration

This report provides the final, methodologically audited experimental comparison between:
1. **Simple Acceleration-Magnitude Threshold Baseline:** Fixed impact threshold ($A = \sqrt{a_x^2 + a_y^2 + a_z^2} > 14.0\text{ m/s}^2$).
2. **ResQNet Finite State Machine (FSM):** Multi-stage sequential kinematic fall detector.

> [!IMPORTANT]
> **Audit Confirmation:**  
> - **Zero Code Mutations:** Neither model's codebase nor threshold configuration was modified or tuned using the test set.
> - **Input Equivalence:** Both models were evaluated on identical 20 Hz resampled, timestamp-aligned sensor streams across all 630 MobiAct trials.
> - **Event Equivalence:** Both models used an identical rising-edge ($False \rightarrow True$) event definition to quantify false alarm frequency.
> - **Conclusion:** This comparison is **methodologically valid** and ready for reporting in the research paper.

---

## 2. Experimental Setup & Preprocessing

- **Dataset:** MobiAct Dataset v2.0 / MobiFall Dataset v2.0
- **Total Matched Trials:** **630 trials** (288 Fall trials + 342 ADL trials).
- **Subjects:** 24 human subjects (IDs 1–11 performed ADLs & Falls; IDs 12–31 performed Falls).
- **Total Recorded ADL Duration:** **9,031.3 seconds** ($150.52\text{ minutes} / 2.51\text{ hours}$).

### Preprocessing Pipeline:
1. **Header Parsing:** Extracted data rows following the `@DATA` header line.
2. **Gyroscope Unit Conversion:** Converted radians/second ($rad/s$) to degrees/second ($^\circ/s$) using $\text{gyro}_{\text{deg\_s}} = \text{gyro}_{\text{rad\_s}} \times \frac{180}{\pi}$.
3. **Stream Alignment:** Joined Gyroscope streams onto Accelerometer timestamps using `pd.merge_asof` (nearest-neighbor timestamp matching).
4. **20 Hz Resampling:** Interpolated aligned streams onto a uniform 20 Hz timeline (50 ms time steps) to match ResQNet's 5-second / 100-sample rolling window requirement (`SlidingWindowBuffer(capacity=100)`).

---

## 3. Evaluated Model Definitions

### Model 1: Simple Acceleration Threshold Baseline
- **Criterion:** Evaluates raw 3-axis acceleration magnitude $A_i = \sqrt{a_{x,i}^2 + a_{y,i}^2 + a_{z,i}^2}$ at each 20 Hz sample frame $i$.
- **Fixed Threshold:** $A_i > 14.0\text{ m/s}^2$ (un-tuned, matches ResQNet impact threshold constant).
- **Trial Rule:** If $\exists i$ in trial such that $A_i > 14.0\text{ m/s}^2 \implies \text{PREDICTED FALL}$, else $\text{NORMAL}$.

### Model 2: ResQNet Finite State Machine (FSM)
- **Criterion:** Evaluates 5-second rolling windows (100 samples @ 20Hz) through a 6-stage finite-state machine checking sequential motion signatures:
  1. *Free Fall:* $\text{min\_accel} < 7.0\text{ m/s}^2$
  2. *Impact:* $\text{max\_accel} > 14.0\text{ m/s}^2$
  3. *Rotation:* $\text{max\_gyro} > 45.0\ ^\circ/s$
  4. *Stillness:* $\text{accel\_variance} < 3.5\text{ m/s}^2$
  5. *Movement Recovery Check:* $\text{accel\_variance} > 6.0\text{ m/s}^2$ and $\text{max\_accel} > 14.0\text{ m/s}^2$
- **Confidence Rule:** Assigns confidence boost score; triggers fall detection if $\text{confidence\_boost} \ge 40.0$.
- **Trial Rule:** If $\exists \text{ window } W_k$ in trial such that $\text{confidence\_boost}(W_k) \ge 40.0 \implies \text{PREDICTED FALL}$, else $\text{NORMAL}$.

---

## 4. Primary Trial-Level Evaluation Results

### Confusion Matrices:

#### Simple Acceleration Threshold Baseline:
$$\begin{pmatrix} \text{TP} & \text{FP} \\ \text{FN} & \text{TN} \end{pmatrix} = \begin{pmatrix} 288 & 268 \\ 0 & 74 \end{pmatrix}$$

#### ResQNet Finite State Machine (FSM):
$$\begin{pmatrix} \text{TP} & \text{FP} \\ \text{FN} & \text{TN} \end{pmatrix} = \begin{pmatrix} 283 & 130 \\ 5 & 212 \end{pmatrix}$$

### Side-by-Side Primary Performance Table:

| Metric | Simple Acceleration Baseline ($A > 14.0\text{ m/s}^2$) | ResQNet FSM (Production) | Absolute Improvement |
| :--- | :---: | :---: | :---: |
| **Accuracy** | **57.46%** (362 / 630) | **78.57%** (495 / 630) | **+21.11%** |
| **Precision** | **51.80%** (288 / 556) | **68.52%** (283 / 413) | **+16.72%** |
| **Sensitivity (Recall)** | **100.00%** (288 / 288) | **98.26%** (283 / 288) | **-1.74%** |
| **Specificity** | **21.64%** (74 / 342) | **61.99%** (212 / 342) | **+40.35%** |
| **F1-Score** | **68.25%** | **80.74%** | **+12.49%** |
| **False Positive Rate (FPR)** | **78.36%** (268 / 342) | **38.01%** (130 / 342) | **-40.35%** |

---

## 5. Event-Level False Alarm Analysis & Reduction Factor

### Definition:
A **Distinct Detector-Trigger Event** is defined identically for both methods as a discrete $False \rightarrow True$ rising-edge state transition of the binary detector output during an ADL stream.

### Event-Level Comparison Table:

| Model | Total ADL Duration | Total FP Trials | Distinct Trigger Events | Event FA / Minute | Event FA / Hour |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Simple Acceleration Baseline** | 150.52 min | 268 / 342 | **11,160 events** | **74.142 / min** | 4,448.52 / hr |
| **ResQNet FSM** | 150.52 min | 130 / 342 | **159 events** | **1.056 / min** | 63.38 / hr |

### Event Reduction Factor Calculation:
$$\text{Event Reduction Factor} = \frac{\text{Baseline Events}}{\text{ResQNet FSM Events}} = \frac{11,160}{159} = \mathbf{70.19\times}$$

> [!TIP]
> **Key Finding:** ResQNet FSM achieves a **70.19-fold reduction in false alarm event frequency** compared to the simple acceleration magnitude threshold, while retaining **98.26% fall detection sensitivity**.

---

## 6. Per-Fall-Type Recall Breakdown

| Fall Code | Fall Description | Total Trials | Simple Baseline Recall | ResQNet FSM Recall |
| :--- | :--- | :---: | :---: | :---: |
| **FKL** | Front-Knees-Lying Fall | 72 | 100.00% (72/72) | **100.00%** (72/72) |
| **FOL** | Forward-Lying Fall | 72 | 100.00% (72/72) | **98.61%** (71/72) |
| **BSC** | Back-Sitting-Chair Fall | 72 | 100.00% (72/72) | **97.22%** (70/72) |
| **SDL** | Sideward-Lying Fall | 72 | 100.00% (72/72) | **97.22%** (70/72) |
| **OVERALL** | **All Falls Combined** | **288** | **100.00%** (288/288) | **98.26%** (283/288) |

---

## 7. Per-ADL False-Alarm Breakdown & Event Rates

| ADL Code | Description | Trials | Duration (min) | Simple Baseline FPs | Baseline FA / min | ResQNet FSM FPs | ResQNet FA / min |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **CSI** | Car-Step In | 54 | 5.29 min | 44 (81.48%) | 18.724 / min | 32 (59.26%) | 9.078 / min |
| **CSO** | Car-Step Out | 54 | 5.28 min | 39 (72.22%) | 13.265 / min | 27 (50.00%) | 5.875 / min |
| **STU** | Stairs Up | 54 | 8.86 min | 54 (100.0%) | 61.151 / min | 30 (55.56%) | 4.062 / min |
| **STN** | Stairs Down | 54 | 8.91 min | 54 (100.0%) | 80.835 / min | 30 (55.56%) | 3.480 / min |
| **WAL** | Walking | 9 | 44.99 min | 9 (100.0%) | 122.679 / min | 7 (77.78%) | 0.200 / min |
| **SCH** | Sit Chair | 54 | 5.31 min | 12 (22.22%) | 2.262 / min | 1 (1.85%) | 0.188 / min |
| **JOG** | Jogging | 27 | 13.46 min | 27 (100.0%) | 195.753 / min | 1 (3.70%) | 0.074 / min |
| **JUM** | Jumping | 27 | 13.45 min | 27 (100.0%) | 116.082 / min | 1 (3.70%) | 0.074 / min |
| **STD** | Standing | 9 | 44.99 min | 2 (22.22%) | 0.044 / min | 1 (11.11%) | 0.022 / min |

---

## 8. Methodological Limitations & Paper Recommendations

1. **Trial-Level Protocol Conservatism:** Under the *"any single window = Fall"* rule, both detectors prioritize safety by triggering on peak dynamic windows. While ResQNet FSM eliminates 70.2x of false trigger events, vehicle entry/exit (`CSI`/`CSO`) and stairs (`STU`/`STN`) remain the primary source of residual ADL false positives due to sharp vertical deceleration.
2. **Evaluation Metric Recommendation:**
   - Report **Trial-Level Fall Sensitivity (98.26%)** to establish high emergency detection coverage.
   - Report **Event-Based False Alarm Rate (1.056 events / min vs 74.142 events / min)** to demonstrate the real-world operational advantage of ResQNet's multi-stage FSM over single-threshold systems.

---

## 9. Exact Reproducibility Commands

To execute and verify all experimental output files, execute the following commands from the workspace root:

```bash
# 1. Run primary ResQNet evaluation suite
python evaluate_mobiact.py

# 2. Run deep diagnostics and methodology audit
python backend/evaluation/diagnostics.py

# 3. Run baseline simple threshold evaluator
python backend/evaluation/baseline_evaluator.py
```

### Generated Output Artifacts:
- [`backend/evaluation/mobiact_trial_predictions.csv`](file:///d:/ResQnet/backend/evaluation/mobiact_trial_predictions.csv)
- [`backend/evaluation/mobiact_secondary_window_diagnostics.csv`](file:///d:/ResQnet/backend/evaluation/mobiact_secondary_window_diagnostics.csv)
- [`backend/evaluation/mobiact_baseline_predictions.csv`](file:///d:/ResQnet/backend/evaluation/mobiact_baseline_predictions.csv)
- [`backend/evaluation/mobiact_false_positives_breakdown.csv`](file:///d:/ResQnet/backend/evaluation/mobiact_false_positives_breakdown.csv)
- [`backend/evaluation/mobiact_methodology_audit.md`](file:///d:/ResQnet/backend/evaluation/mobiact_methodology_audit.md)
- [`backend/evaluation/mobiact_baseline_report.md`](file:///d:/ResQnet/backend/evaluation/mobiact_baseline_report.md)
- [`backend/evaluation/mobiact_final_comparison.md`](file:///d:/ResQnet/backend/evaluation/mobiact_final_comparison.md)
