/**
 * FallDetectionStateMachine
 * Client-Side State Machine for 6-Stage Multi-Sensor Intelligent Fall Detection
 * 
 * Pipeline Flow:
 * Normal -> Descent (Free Fall < 6.5 m/s²) -> Impact (> 18.0 m/s²) -> Rotation (> 80°/s) 
 * -> Stillness (variance < 3.0 m/s²) & Orientation Tilt -> Confidence Engine Escalation (or Movement Recovery)
 */

export const FALL_STAGES = {
  NORMAL: { key: 'NORMAL', stageNum: 0, label: 'Stage 0: Normal Motion', color: 'emerald' },
  FREE_FALL: { key: 'FREE_FALL', stageNum: 1, label: 'Stage 1: Descent / Free Fall (< 6.5 m/s²)', color: 'cyan' },
  IMPACT: { key: 'IMPACT', stageNum: 2, label: 'Stage 2: High Impact Force (> 18.0 m/s²)', color: 'amber' },
  ROTATION: { key: 'ROTATION', stageNum: 3, label: 'Stage 3: Angular Body Rotation (> 80°/s)', color: 'purple' },
  STILLNESS: { key: 'STILLNESS', stageNum: 4, label: 'Stage 4: Post-Impact Stillness & Orientation Tilt', color: 'rose' },
  CONFIDENCE_ENGINE: { key: 'CONFIDENCE_ENGINE', stageNum: 5, label: 'Stage 5: High-Confidence Fall Escalation', color: 'red' },
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
        flags: { freeFall: false, impact: false, rotation: false, stillness: false, tiltChange: false, recovered: false },
        details: 'Waiting for sensor data'
      };
    }

    const accels = samples.map(s => (s.total_accel !== undefined ? s.total_accel : 9.8));
    const gyros = samples.map(s => (s.total_gyro !== undefined ? s.total_gyro : 0));

    const minAccel = Math.min(...accels);
    const maxAccel = Math.max(...accels);
    const maxGyro = Math.max(...gyros);

    const iMin = accels.indexOf(minAccel);
    const iMax = accels.indexOf(maxAccel);

    // Tail samples for stillness vs movement check (last 35% of buffer)
    const tailCount = Math.max(4, Math.floor(samples.length * 0.35));
    const tailSamples = samples.slice(-tailCount);
    const tailAccels = tailSamples.map(s => (s.total_accel !== undefined ? s.total_accel : 9.8));
    const accelVariance = Math.max(...tailAccels) - Math.min(...tailAccels);

    // Orientation tilt change calculation (pre vs post posture)
    const headCount = Math.min(10, samples.length);
    const headSamples = samples.slice(0, headCount);
    const postCount = Math.min(10, samples.length);
    const postSamples = samples.slice(-postCount);

    const avgHeadAx = headSamples.reduce((sum, s) => sum + (s.ax || 0), 0) / headCount;
    const avgHeadAy = headSamples.reduce((sum, s) => sum + (s.ay !== undefined ? s.ay : 9.8), 0) / headCount;
    const avgHeadAz = headSamples.reduce((sum, s) => sum + (s.az || 0), 0) / headCount;

    const avgPostAx = postSamples.reduce((sum, s) => sum + (s.ax || 0), 0) / postCount;
    const avgPostAy = postSamples.reduce((sum, s) => sum + (s.ay !== undefined ? s.ay : 9.8), 0) / postCount;
    const avgPostAz = postSamples.reduce((sum, s) => sum + (s.az || 0), 0) / postCount;

    const normHead = Math.sqrt(avgHeadAx ** 2 + avgHeadAy ** 2 + avgHeadAz ** 2) || 1.0;
    const normPost = Math.sqrt(avgPostAx ** 2 + avgPostAy ** 2 + avgPostAz ** 2) || 1.0;
    let dot = (avgHeadAx * avgPostAx + avgHeadAy * avgPostAy + avgHeadAz * avgPostAz) / (normHead * normPost);
    dot = Math.max(-1.0, Math.min(1.0, dot));
    const tiltDeg = (Math.acos(dot) * 180.0) / Math.PI;

    // Kinematic signature thresholds
    const hasFreeFall = minAccel < 6.5;
    const hasImpact = maxAccel > 18.0;
    const hasRotation = maxGyro > 80.0;
    const hasStillness = accelVariance < 3.0;
    const hasTiltChange = tiltDeg > 30.0;
    const hasRecovered = accelVariance > 5.5 && maxAccel > 16.0;

    // Temporal order: free fall must be near or before impact
    const temporalValid = (iMax >= iMin) || (Math.abs(iMax - iMin) <= 15);

    let nextState = FALL_STAGES.NORMAL;
    let confidenceDelta = 0;

    if (hasRecovered) {
      nextState = FALL_STAGES.RECOVERY;
      confidenceDelta = 0;
    } else if (hasImpact && hasRotation && hasStillness && hasFreeFall && temporalValid) {
      nextState = FALL_STAGES.CONFIDENCE_ENGINE;
      confidenceDelta = 90.0;
    } else if (hasImpact && hasRotation && (hasStillness || hasTiltChange) && temporalValid) {
      nextState = FALL_STAGES.CONFIDENCE_ENGINE;
      confidenceDelta = 75.0;
    } else if (hasImpact && hasFreeFall && hasStillness && temporalValid) {
      nextState = FALL_STAGES.STILLNESS;
      confidenceDelta = 70.0;
    } else if (hasImpact && hasTiltChange && hasStillness) {
      nextState = FALL_STAGES.STILLNESS;
      confidenceDelta = 65.0;
    } else if (hasImpact && hasRotation) {
      nextState = FALL_STAGES.ROTATION;
      confidenceDelta = 35.0; // Needs stillness before emergency escalation!
    } else if (hasImpact) {
      nextState = FALL_STAGES.IMPACT;
      confidenceDelta = 25.0;
    } else if (hasFreeFall) {
      nextState = FALL_STAGES.FREE_FALL;
      confidenceDelta = 20.0;
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
      details: `Min: ${minAccel.toFixed(1)} m/s² | Impact: ${maxAccel.toFixed(1)} m/s² | Gyro: ${maxGyro.toFixed(1)} °/s | Post-Var: ${accelVariance.toFixed(1)} m/s² | Tilt: ${tiltDeg.toFixed(1)}°`
    };
  }
}

export const fallStateMachine = new FallDetectionStateMachine();
