import { useState, useEffect, useCallback } from 'react';

/**
 * useGyroscope React Hook
 * Captures real smartphone Gyroscope angular velocity & Device Orientation.
 * Returns: { gx, gy, gz, total_gyro, alpha, beta, gamma, timestamp, isSupported, permissionGranted }
 */
export const useGyroscope = () => {
  const [data, setData] = useState({
    gx: 0,
    gy: 0,
    gz: 0,
    total_gyro: 0,
    alpha: 0, // Yaw
    beta: 0,  // Pitch
    gamma: 0, // Roll
    timestamp: Date.now(),
  });
  const [isSupported, setIsSupported] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('DeviceMotionEvent' in window || 'DeviceOrientationEvent' in window)) {
      setIsSupported(true);
      if (typeof DeviceMotionEvent.requestPermission !== 'function') {
        setPermissionGranted(true);
      }
    }
  }, []);

  const handleMotion = useCallback((event) => {
    const rot = event.rotationRate;
    if (!rot) return;

    const gx = rot.alpha !== null && rot.alpha !== undefined ? rot.alpha : 0;
    const gy = rot.beta !== null && rot.beta !== undefined ? rot.beta : 0;
    const gz = rot.gamma !== null && rot.gamma !== undefined ? rot.gamma : 0;
    const total_gyro = Math.sqrt(gx * gx + gy * gy + gz * gz);

    setData((prev) => ({
      ...prev,
      gx: +gx.toFixed(2),
      gy: +gy.toFixed(2),
      gz: +gz.toFixed(2),
      total_gyro: +total_gyro.toFixed(2),
      timestamp: Date.now(),
    }));
  }, []);

  const handleOrientation = useCallback((event) => {
    const alpha = event.alpha !== null && event.alpha !== undefined ? event.alpha : 0;
    const beta = event.beta !== null && event.beta !== undefined ? event.beta : 0;
    const gamma = event.gamma !== null && event.gamma !== undefined ? event.gamma : 0;

    setData((prev) => ({
      ...prev,
      alpha: +alpha.toFixed(1),
      beta: +beta.toFixed(1),
      gamma: +gamma.toFixed(1),
      timestamp: Date.now(),
    }));
  }, []);

  useEffect(() => {
    if (isSupported && permissionGranted) {
      window.addEventListener('devicemotion', handleMotion, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
    return () => {
      if (isSupported) {
        window.removeEventListener('devicemotion', handleMotion, true);
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, [isSupported, permissionGranted, handleMotion, handleOrientation]);

  return {
    ...data,
    isSupported,
    permissionGranted,
  };
};
