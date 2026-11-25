/**
 * FallDetectionStateMachine
 * Client-Side Temporal State Machine for Multi-Sensor Intelligent Fall Detection
 * 
 * Required Stages:
 * NORMAL
 * -> POTENTIAL_FALL
 * -> IMPACT_DETECTED
 * -> POST_IMPACT_MONITORING
 * -> FALL_CONFIDENCE_EVALUATION
 * -> USER_CONFIRMATION
 * -> EMERGENCY_ESCALATION
 * (and RECOVERY for movement resumption)
 */

export const FALL_STAGES = {
  NORMAL: {
    key: 'NORMAL',
    stageNum: 0,
    label: 'Stage 0: Normal Motion',
    color: 'emerald',
    description: 'Continuous baseline motion (~9.8 m/s²)'
  },
  POTENTIAL_FALL: {
    key: 'POTENTIAL_FALL',
    stageNum: 1,
    label: 'Stage 1: Potential Fall (Descent / Unweighting < 6.8 m/s²)',
    color: 'cyan',
    description: 'Free-fall dip or stumble unweighting precursor'
  },
  IMPACT_DETECTED: {
    key: 'IMPACT_DETECTED',
    stageNum: 2,
    label: 'Stage 2: Impact Detected (Shock Peak >= 16.5 m/s²)',
    color: 'amber',
    description: 'High deceleration collision with surface'
  },
  POST_IMPACT_MONITORING: {
    key: 'POST_IMPACT_MONITORING',
    stageNum: 3,
    label: 'Stage 3: Post-Impact Monitoring (Stillness & Tilt)',
    color: 'purple',
    description: 'Monitoring post-impact stillness and posture change'
  },
  FALL_CONFIDENCE_EVALUATION: {
    key: 'FALL_CONFIDENCE_EVALUATION',
    stageNum: 4,
    label: 'Stage 4: Fall Confidence Evaluation',
    color: 'rose',
    description: 'Evaluating multi-factor kinematic confidence score'
  },
  USER_CONFIRMATION: {
    key: 'USER_CONFIRMATION',
    stageNum: 5,
    label: 'Stage 5: User Confirmation (10s Countdown)',
    color: 'red',
    description: 'High-confidence fall confirmed; waiting for user response'
  },
  EMERGENCY_ESCALATION: {
    key: 'EMERGENCY_ESCALATION',
    stageNum: 6,
    label: 'Stage 6: Emergency Escalation Dispatched',
    color: 'red',
    description: 'Emergency alert and family SMS notifications dispatched'
  },
  RECOVERY: {
    key: 'RECOVERY',
    stageNum: 7,
    label: 'Stage 7: Movement Recovery (Alert Standby)',
    color: 'blue',
    description: 'Active motion resumed post-impact; alert cancelled'
  },
};

export class FallDetectionStateMachine {
  constructor() {
    this.currentState = FALL_STAGES.NORMAL;
    this.diagnosticLogs = [];
    this.maxLogs = 100;
  }

  reset() {
    this.currentState = FALL_STAGES.NORMAL;
  }

  logDiagnostic(entry) {
    this.diagnosticLogs.push({
      timestamp: Date.now(),
      ...entry,
    });
    if (this.diagnosticLogs.length > this.maxLogs) {
      this.diagnosticLogs.shift();
    }
  }

  getDiagnosticHistory() {
    return [...this.diagnosticLogs];
  }

  evaluateWindow(samples) {
    if (!samples || samples.length === 0) {
      return {
        state: this.currentState,
        confidenceDelta: 0,
        flags: { freeFall: false, impact: false, rotation: false, stillness: false, tiltChange: false, recovered: false },
        details: 'Waiting for sensor telemetry',
        diagnostics: { reason: 'EMPTY_WINDOW' }
      };
    }

    const accels = samples.map(s => (s.total_accel !== undefined ? s.total_accel : 9.81));
    const gyros = samples.map(s => (s.total_gyro !== undefined && s.total_gyro !== null ? s.total_gyro : 0.0));
    const gyroAvailable = samples.some(s => s.gyro_available === true && s.total_gyro > 0);

    const minAccel = Math.min(...accels);
    const maxAccel = Math.max(...accels);
    const maxGyro = Math.max(...gyros);

    const iMin = accels.indexOf(minAccel);
    const iMax = accels.indexOf(maxAccel);

    // Tail samples for stillness vs movement check (last 35% of buffer)
    const tailCount = Math.max(4, Math.floor(samples.length * 0.35));
    const tailSamples = samples.slice(-tailCount);
    const tailAccels = tailSamples.map(s => (s.total_accel !== undefined ? s.total_accel : 9.81));
    const accelVariance = Math.max(...tailAccels) - Math.min(...tailAccels);

    // Orientation tilt change calculation (pre vs post posture)
    const headCount = Math.min(10, samples.length);
    const headSamples = samples.slice(0, headCount);
    const postCount = Math.min(10, samples.length);
    const postSamples = samples.slice(-postCount);

    const avgHeadAx = headSamples.reduce((sum, s) => sum + (s.ax || 0), 0) / headCount;
    const avgHeadAy = headSamples.reduce((sum, s) => sum + (s.ay !== undefined ? s.ay : 9.81), 0) / headCount;
    const avgHeadAz = headSamples.reduce((sum, s) => sum + (s.az || 0), 0) / headCount;

    const avgPostAx = postSamples.reduce((sum, s) => sum + (s.ax || 0), 0) / postCount;
    const avgPostAy = postSamples.reduce((sum, s) => sum + (s.ay !== undefined ? s.ay : 9.81), 0) / postCount;
    const avgPostAz = postSamples.reduce((sum, s) => sum + (s.az || 0), 0) / postCount;

    const normHead = Math.sqrt(avgHeadAx ** 2 + avgHeadAy ** 2 + avgHeadAz ** 2) || 1.0;
    const normPost = Math.sqrt(avgPostAx ** 2 + avgPostAy ** 2 + avgPostAz ** 2) || 1.0;
    let dot = (avgHeadAx * avgPostAx + avgHeadAy * avgPostAy + avgHeadAz * avgPostAz) / (normHead * normPost);
    dot = Math.max(-1.0, Math.min(1.0, dot));
    const tiltDeg = (Math.acos(dot) * 180.0) / Math.PI;

    // Kinematic Conditions
    const hasFreeFall = minAccel < 6.8;
    const hasImpact = maxAccel >= 16.5;
    const hasRotation = maxGyro >= 80.0;
    const hasStillness = accelVariance < 2.6;
    const hasTiltChange = tiltDeg >= 30.0;
    const hasRecovered = accelVariance > 4.2 && maxAccel > 15.0;

    // Temporal order: free fall precursor or stumble is near or before impact
    const temporalValid = (iMax >= iMin) || (Math.abs(iMax - iMin) <= 15);

    let nextState = FALL_STAGES.NORMAL;
    let confidenceDelta = 0;
    let transitionReason = 'Normal baseline locomotion';
    let rejectionReason = null;

    if (hasRecovered) {
      nextState = FALL_STAGES.RECOVERY;
      confidenceDelta = 0;
      transitionReason = `Active movement resumed post-impact (variance: ${accelVariance.toFixed(1)} m/s²). Alert placed on standby.`;
      rejectionReason = 'RECOVERY_MOVEMENT_DETECTED';
    } else if (hasImpact && hasStillness && temporalValid) {
      if (!hasRotation && !hasTiltChange) {
        nextState = FALL_STAGES.IMPACT_DETECTED;
        confidenceDelta = 30.0;
        transitionReason = 'Device drop on flat surface (impact without body rotation or posture change). Rejected.';
        rejectionReason = 'FLAT_DEVICE_DROP_NO_ROTATION_OR_TILT';
      } else if (hasRotation && (hasTiltChange || hasFreeFall)) {
        nextState = FALL_STAGES.USER_CONFIRMATION;
        confidenceDelta = hasFreeFall ? 95.0 : 85.0;
        transitionReason = `Complete kinematic signature verified: Impact (${maxAccel.toFixed(1)} m/s²), Rotation (${maxGyro.toFixed(1)} °/s), Post-tilt (${tiltDeg.toFixed(1)}°), Stillness (${accelVariance.toFixed(1)} m/s²).`;
      } else if (hasTiltChange && (hasFreeFall || maxAccel >= 18.0)) {
        nextState = FALL_STAGES.USER_CONFIRMATION;
        confidenceDelta = 80.0;
        transitionReason = `Posture collapse verified via tilt (${tiltDeg.toFixed(1)}°) and post-impact stillness (${accelVariance.toFixed(1)} m/s²).`;
      } else if (!gyroAvailable && hasTiltChange && maxAccel >= 16.5) {
        nextState = FALL_STAGES.USER_CONFIRMATION;
        confidenceDelta = 75.0;
        transitionReason = `Fallback fall verification without gyroscope: Tilt (${tiltDeg.toFixed(1)}°), Impact (${maxAccel.toFixed(1)} m/s²), Stillness (${accelVariance.toFixed(1)} m/s²).`;
      } else {
        nextState = FALL_STAGES.FALL_CONFIDENCE_EVALUATION;
        confidenceDelta = 50.0;
        transitionReason = 'Borderline fall dynamics; awaiting further stillness evaluation.';
        rejectionReason = 'INSUFFICIENT_ROTATION_OR_TILT_FOR_CONFIRMATION';
      }
    } else if (hasImpact && !hasStillness) {
      nextState = FALL_STAGES.POST_IMPACT_MONITORING;
      confidenceDelta = 35.0;
      transitionReason = `High impact shock (${maxAccel.toFixed(1)} m/s²) registered. Monitoring post-impact stillness.`;
      rejectionReason = 'POST_IMPACT_STILLNESS_NOT_YET_SATISFIED';
    } else if (hasImpact) {
      nextState = FALL_STAGES.IMPACT_DETECTED;
      confidenceDelta = 25.0;
      transitionReason = `Impact shock peak (${maxAccel.toFixed(1)} m/s²) registered.`;
      rejectionReason = 'AWAITING_POST_IMPACT_MONITORING';
    } else if (hasFreeFall) {
      nextState = FALL_STAGES.POTENTIAL_FALL;
      confidenceDelta = 20.0;
      transitionReason = `Descent dip (${minAccel.toFixed(1)} m/s² < 6.8) detected. Tracking potential impact shock.`;
      rejectionReason = 'AWAITING_IMPACT_SHOCK';
    } else {
      nextState = FALL_STAGES.NORMAL;
      confidenceDelta = 0;
      transitionReason = 'Baseline motion';
    }

    this.currentState = nextState;

    const diagEntry = {
      state: nextState.key,
      minAccel: minAccel.toFixed(1),
      maxAccel: maxAccel.toFixed(1),
      maxGyro: maxGyro.toFixed(1),
      accelVariance: accelVariance.toFixed(1),
      tiltDeg: tiltDeg.toFixed(1),
      freeFall: hasFreeFall,
      impact: hasImpact,
      rotation: hasRotation,
      stillness: hasStillness,
      tiltChange: hasTiltChange,
      recovered: hasRecovered,
      confidenceDelta,
      transitionReason,
      rejectionReason,
    };
    this.logDiagnostic(diagEntry);

    return {
      state: nextState,
      confidenceDelta,
      flags: {
        freeFall: hasFreeFall,
        impact: hasImpact,
        rotation: hasRotation,
        stillness: hasStillness,
        tiltChange: hasTiltChange,
        recovered: hasRecovered,
      },
      metrics: {
        minAccel: minAccel.toFixed(1),
        maxAccel: maxAccel.toFixed(1),
        maxGyro: maxGyro.toFixed(1),
        accelVariance: accelVariance.toFixed(1),
        tiltDeg: tiltDeg.toFixed(1),
      },
      details: `Min: ${minAccel.toFixed(1)} m/s² | Impact: ${maxAccel.toFixed(1)} m/s² | Gyro: ${maxGyro.toFixed(1)} °/s | Post-Var: ${accelVariance.toFixed(1)} m/s² | Tilt: ${tiltDeg.toFixed(1)}°`,
      diagnostics: diagEntry,
    };
  }
}

export const fallStateMachine = new FallDetectionStateMachine();
