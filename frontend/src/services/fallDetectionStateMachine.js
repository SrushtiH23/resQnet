/**
 * FallDetectionStateMachine
 * Client-Side State Machine for 6-Stage Intelligent Fall Detection
 * 
 * Pipeline Flow:
 * Accelerometer -> Free Fall -> Impact -> Gyroscope Rotation -> Stillness -> Confidence Engine (or Movement Recovery)
 */

export const FALL_STAGES = {
  NORMAL: { key: 'NORMAL', stageNum: 0, label: 'Stage 0: Normal Motion', color: 'emerald' },
  FREE_FALL: { key: 'FREE_FALL', stageNum: 1, label: 'Stage 1: Free Fall Detection (< 3.0 m/s²)', color: 'cyan' },
  IMPACT: { key: 'IMPACT', stageNum: 2, label: 'Stage 2: High Impact Force (> 24.0 m/s²)', color: 'amber' },
  ROTATION: { key: 'ROTATION', stageNum: 3, label: 'Stage 3: Angular Body Rotation (> 180°/s)', color: 'purple' },
  STILLNESS: { key: 'STILLNESS', stageNum: 4, label: 'Stage 4: Post-Impact Stillness Detected', color: 'rose' },
  CONFIDENCE_ENGINE: { key: 'CONFIDENCE_ENGINE', stageNum: 5, label: 'Stage 5: Confidence Engine Escalation', color: 'red' },
  RECOVERY: { key: 'RECOVERY', stageNum: 6, label: 'Stage 6: Movement Recovery (Alert Cancelled)', color: 'blue' },
};

export class FallDetectionStateMachine {
  constructor() {
    this.currentState = FALL_STAGES.NORMAL;
    this.history = [];
    this.freeFallTime = null;
    this.impactTime = null;
    this.rotationTime = null;
  }

  reset() {
    this.currentState = FALL_STAGES.NORMAL;
    this.freeFallTime = null;
    this.impactTime = null;
    this.rotationTime = null;
    this.history = [];
  }

  evaluateWindow(samples) {
    if (!samples || samples.length === 0) {
      return {
        state: this.currentState,
        confidenceDelta: 0,
        flags: { freeFall: false, impact: false, rotation: false, stillness: false, recovered: false },
        details: 'Waiting for sensor data'
      };
    }

    const now = Date.now();
    const minAccel = Math.min(...samples.map(s => s.total_accel || 9.8));
    const maxAccel = Math.max(...samples.map(s => s.total_accel || 9.8));
    const maxGyro = Math.max(...samples.map(s => s.total_gyro || 0));

    // Tail samples for stillness vs movement check
    const tailCount = Math.max(3, Math.floor(samples.length * 0.3));
    const tailSamples = samples.slice(-tailCount);
    const tailAccels = tailSamples.map(s => s.total_accel || 9.8);
    const accelVariance = Math.max(...tailAccels) - Math.min(...tailAccels);

    const hasFreeFall = minAccel < 3.0;
    const hasImpact = maxAccel > 24.0;
    const hasRotation = maxGyro > 180.0;
    const hasStillness = accelVariance < 1.5;
    const hasRecovered = accelVariance > 5.0 && hasImpact;

    let nextState = FALL_STAGES.NORMAL;
    let confidenceDelta = 0;

    if (hasRecovered) {
      nextState = FALL_STAGES.RECOVERY;
      confidenceDelta = 0;
    } else if (hasFreeFall && hasImpact && hasRotation && hasStillness) {
      nextState = FALL_STAGES.CONFIDENCE_ENGINE;
      confidenceDelta = 85.0; // 25 + 25 + 20 + 15
    } else if (hasFreeFall && hasImpact && hasRotation) {
      nextState = FALL_STAGES.STILLNESS;
      confidenceDelta = 65.0;
    } else if (hasFreeFall && hasImpact) {
      nextState = FALL_STAGES.ROTATION;
      confidenceDelta = 50.0;
    } else if (hasFreeFall) {
      nextState = FALL_STAGES.FREE_FALL;
      confidenceDelta = 25.0;
    } else if (hasImpact) {
      nextState = FALL_STAGES.IMPACT;
      confidenceDelta = 25.0;
    } else {
      nextState = FALL_STAGES.NORMAL;
      confidenceDelta = 0;
    }

    this.currentState = nextState;

    return {
      state: nextState,
      confidenceDelta,
      flags: {
        freeFall: hasFreeFall,
        impact: hasImpact,
        rotation: hasRotation,
        stillness: hasStillness,
        recovered: hasRecovered,
      },
      metrics: {
        minAccel: minAccel.toFixed(1),
        maxAccel: maxAccel.toFixed(1),
        maxGyro: maxGyro.toFixed(1),
        accelVariance: accelVariance.toFixed(1),
      },
      details: `Min Accel: ${minAccel.toFixed(1)} m/s² | Max Accel: ${maxAccel.toFixed(1)} m/s² | Gyro: ${maxGyro.toFixed(1)} °/s`
    };
  }
}

export const fallStateMachine = new FallDetectionStateMachine();
