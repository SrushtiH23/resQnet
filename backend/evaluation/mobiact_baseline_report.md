# ResQNet MobiAct Evaluation: Simple Acceleration Threshold Baseline Report

**Evaluation Suite:** ResQNet Research Evaluation Suite  
**Date:** October 4, 2026  
**Dataset:** MobiAct Dataset v2.0 (630 matched trials)  
**Baseline Model:** Simple Acceleration-Magnitude Threshold ($A = \sqrt{a_x^2 + a_y^2 + a_z^2} > 14.0\text{ m/s}^2$)  
**Baseline Threshold Value:** Fixed $14.0\text{ m/s}^2$ (matches ResQNet impact threshold constant, un-tuned)  
**Trial Classification Protocol:** "Any sample in trial $> 14.0\text{ m/s}^2 \implies \text{FALL}$, else $\text{NORMAL}$"  

---

## 1. Baseline Primary Trial-Level Performance Metrics

- **Total Trials Evaluated:** 630 (288 Falls, 342 ADLs)
- **True Positives (TP):** 288
- **True Negatives (TN):** 74
- **False Positives (FP):** 268
- **False Negatives (FN):** 0
- **Accuracy:** **57.46%** (362/630)
- **Precision:** **51.80%** (288/556)
- **Sensitivity (Recall):** **100.00%** (288/288)
- **Specificity:** **21.64%** (74/342)
- **F1-Score:** **68.25%**
- **False Positive Rate (FPR):** **78.36%** (268/342)

---

## 2. Baseline Per-Fall-Type Recall Breakdown

| Fall Code | Description | Trials | Detected (TP) | Missed (FN) | Recall (%) |
| --- | --- | --- | --- | --- | --- |
| BSC | Back-Sitting-Chair Fall | 72 | 72 | 0 | 100.0 |
| FKL | Front-Knees-Lying Fall | 72 | 72 | 0 | 100.0 |
| FOL | Forward-Lying Fall | 72 | 72 | 0 | 100.0 |
| SDL | Sideward-Lying Fall | 72 | 72 | 0 | 100.0 |

---

## 3. Baseline Per-ADL False Alarm Breakdown

| ADL Code | Description | Trials | FP Trials | FP Rate (%) | Duration (min) | Distinct Trigger Events | Event FA / Min |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CSI | Car-step In | 54 | 44 | 81.48 | 5.29 | 99 | 18.724 |
| CSO | Car-step Out | 54 | 39 | 72.22 | 5.28 | 70 | 13.265 |
| JOG | Jogging | 27 | 27 | 100.0 | 13.46 | 2635 | 195.753 |
| JUM | Jumping | 27 | 27 | 100.0 | 13.45 | 1561 | 116.082 |
| SCH | Sit Chair | 54 | 12 | 22.22 | 5.31 | 12 | 2.262 |
| STD | Standing | 9 | 2 | 22.22 | 44.99 | 2 | 0.044 |
| STN | Stairs Down | 54 | 54 | 100.0 | 8.91 | 720 | 80.835 |
| STU | Stairs Up | 54 | 54 | 100.0 | 8.86 | 542 | 61.151 |
| WAL | Walking | 9 | 9 | 100.0 | 44.99 | 5519 | 122.679 |

- **Total ADL Recorded Duration:** 150.52 minutes (9031.3 seconds)
- **Total Distinct Trigger Events ($A > 14.0\text{ m/s}^2$ rising edge):** **11160 events**
- **Overall Baseline Event FA / Min:** **74.142 events/min** (4448.51 events/hour)

---

## 4. Comparison Table: Simple Acceleration Threshold vs. ResQNet FSM

| Method | Accuracy | Precision | Recall | Specificity | F1-Score | FPR | Event FA / Min |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Simple Acceleration Threshold ($> 14.0\text{ m/s}^2$)** | **57.46%** | **51.80%** | **100.00%** | **21.64%** | **68.25%** | **78.36%** | **74.142 / min** |
| **ResQNet Finite State Machine (FSM)** | **78.57%** | **68.52%** | **98.26%** | **61.99%** | **80.74%** | **38.01%** | **1.056 / min** |

---

## 5. Comparative Analysis & Key Methodological Insights

1. **Fall Sensitivity:**
   - Simple threshold detects **288 out of 288 fall trials** (100.00% recall) because fall impact peaks exceed $14.0\text{ m/s}^2$.
   - ResQNet FSM detects **283 out of 288 fall trials** (98.26% recall).
2. **ADL Specificity Improvement:**
   - The Simple Acceleration Threshold suffers a catastrophic **78.36% False Positive Rate** (Specificity = **21.64%**, 268 FP trials out of 342).
   - In contrast, ResQNet's multi-stage FSM reduces FPR to **38.01%** (Specificity = **61.99%**, 130 FP trials out of 342) — nearly tripling specificity.
3. **Massive Reduction in False Trigger Frequency:**
   - Simple Acceleration Threshold generates **11,160 distinct false alarm events** (74.142 events/min = 4448.5 events/hour).
   - ResQNet FSM reduces distinct false alarm events to **159 events** (1.056 events/min = 63.38 events/hour) — demonstrating a **70.2x reduction in false alarm frequency** due to multi-stage kinematic verification (free-fall + impact + rotation + stillness).
