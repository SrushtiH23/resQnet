import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useGyroscope React Hook
 * Captures smartphone Gyroscope angular velocity (deg/s) via DeviceMotionEvent.rotationRate
 * and Device Orientation angles (deg) via DeviceOrientationEvent.
 * 
 * Crucial Design:
 * - Keeps Gyroscope angular velocity (gx, gy, gz in °/s) and Orientation angles (alpha, beta, gamma in °)
 *   strictly separated in data and semantics.
 * - Truthful availability reporting: does NOT fabricate 0.0 when sensors are unavailable.
 * - Maintains a timestamped frame buffer of rotation samples so RealSmartphoneSensor can synchronize
 *   readings by timestamp with accelerometer samples.
 */
export const useGyroscope = () => {
  const [data, setData] = useState({
    gx: null,
    gy: null,
    gz: null,
    total_gyro: null,
    alpha: null,
    beta: null,
    gamma: null,
    timestamp: null,
  });

  const [isSupported, setIsSupported] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [hasEmittedGyro, setHasEmittedGyro] = useState(false);
  const [hasEmittedOrientation, setHasEmittedOrientation] = useState(false);

  // Separate buffers for rotation rate samples
  const gyroBufferRef = useRef([]);

  useEffect(() => {
    const supported = typeof window !== 'undefined' &&
      ('DeviceMotionEvent' in window || 'DeviceOrientationEvent' in window);
    setIsSupported(supported);

    if (supported) {
      // Auto-grant permission if browser does not require permission API
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission !== 'function') {
        setPermissionGranted(true);
      }
    }
  }, []);

  // Handle DeviceMotionEvent rotationRate (Angular Velocity: deg/s)
  const handleMotion = useCallback((event) => {
    const rot = event.rotationRate;
    if (!rot) return;

    // Check if at least one axis has real values
    const hasAlpha = rot.alpha !== null && rot.alpha !== undefined;
    const hasBeta = rot.beta !== null && rot.beta !== undefined;
    const hasGamma = rot.gamma !== null && rot.gamma !== undefined;

    if (hasAlpha || hasBeta || hasGamma) {
      // Standard W3C DeviceMotionEvent rotationRate units: degrees per second (°/s)
      const gx = hasAlpha ? Number(rot.alpha) : 0.0;
      const gy = hasBeta ? Number(rot.beta) : 0.0;
      const gz = hasGamma ? Number(rot.gamma) : 0.0;
      const total_gyro = Math.sqrt(gx * gx + gy * gy + gz * gz);
      const now = Date.now();

      const sample = {
        gx: +gx.toFixed(2),
        gy: +gy.toFixed(2),
        gz: +gz.toFixed(2),
        total_gyro: +total_gyro.toFixed(2),
        timestamp: now,
      };

      // Store in buffer for temporal synchronization
      gyroBufferRef.current.push(sample);
      if (gyroBufferRef.current.length > 200) {
        gyroBufferRef.current.shift();
      }

      setData((prev) => ({
        ...prev,
        gx: sample.gx,
        gy: sample.gy,
        gz: sample.gz,
        total_gyro: sample.total_gyro,
        timestamp: now,
      }));
      setHasEmittedGyro(true);
    }
  }, []);

  // Handle DeviceOrientationEvent (Euler Angles: alpha [0, 360], beta [-180, 180], gamma [-90, 90] in degrees)
  const handleOrientation = useCallback((event) => {
    if (event.alpha !== null && event.alpha !== undefined &&
        event.beta !== null && event.beta !== undefined &&
        event.gamma !== null && event.gamma !== undefined) {
      const alpha = Number(event.alpha);
      const beta = Number(event.beta);
      const gamma = Number(event.gamma);
      const now = Date.now();

      setData((prev) => ({
        ...prev,
        alpha: +alpha.toFixed(1),
        beta: +beta.toFixed(1),
        gamma: +gamma.toFixed(1),
        timestamp: now,
      }));
      setHasEmittedOrientation(true);
    }
  }, []);

  const getAndClearBuffer = useCallback(() => {
    const samples = [...gyroBufferRef.current];
    gyroBufferRef.current = [];
    return samples;
  }, []);

  // Request permissions for DeviceMotionEvent and DeviceOrientationEvent
  const requestPermission = useCallback(async () => {
    let motionAllowed = false;
    let orientAllowed = false;

    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const resp = await DeviceMotionEvent.requestPermission();
        motionAllowed = resp === 'granted';
      } catch (err) {
        console.warn('DeviceMotionEvent permission error:', err);
      }
    } else {
      motionAllowed = true;
    }

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const resp = await DeviceOrientationEvent.requestPermission();
        orientAllowed = resp === 'granted';
      } catch (err) {
        console.warn('DeviceOrientationEvent permission error:', err);
      }
    } else {
      orientAllowed = true;
    }

    const granted = motionAllowed || orientAllowed;
    setPermissionGranted(granted);
    return granted;
  }, []);

  // Register listeners on window
  useEffect(() => {
    if (isSupported && permissionGranted) {
      // Standard bubbling listeners for broad Android WebView & mobile Chrome compatibility
      window.addEventListener('devicemotion', handleMotion, false);
      window.addEventListener('deviceorientation', handleOrientation, false);
      // Fallback for Android Chrome absolute orientation
      window.addEventListener('deviceorientationabsolute', handleOrientation, false);
    }

    return () => {
      if (isSupported) {
        window.removeEventListener('devicemotion', handleMotion, false);
        window.removeEventListener('deviceorientation', handleOrientation, false);
        window.removeEventListener('deviceorientationabsolute', handleOrientation, false);
      }
    };
  }, [isSupported, permissionGranted, handleMotion, handleOrientation]);

  const sensorState = !isSupported
    ? 'NOT_AVAILABLE'
    : !permissionGranted
    ? 'WAITING_FOR_PERMISSION'
    : (hasEmittedGyro || hasEmittedOrientation)
    ? 'ACTIVE'
    : 'STANDBY';

  return {
    ...data,
    isSupported,
    permissionGranted,
    sensorState,
    hasEmittedGyro,
    hasEmittedOrientation,
    requestPermission,
    getAndClearBuffer,
  };
};
