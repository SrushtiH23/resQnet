import { useState, useEffect, useCallback } from 'react';

/**
 * useGyroscope React Hook
 * Captures smartphone Gyroscope angular velocity & Device Orientation.
 * Returns truthful sensor data without mock defaults.
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
  const [hasEmittedData, setHasEmittedData] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('DeviceMotionEvent' in window || 'DeviceOrientationEvent' in window)) {
      setIsSupported(true);
      if (typeof DeviceMotionEvent.requestPermission !== 'function') {
        setPermissionGranted(true);
      }
    } else {
      setIsSupported(false);
    }
  }, []);

  const handleMotion = useCallback((event) => {
    const rot = event.rotationRate;
    if (!rot) return;

    if (rot.alpha !== null && rot.alpha !== undefined && rot.beta !== null && rot.beta !== undefined && rot.gamma !== null && rot.gamma !== undefined) {
      const gx = Number(rot.alpha);
      const gy = Number(rot.beta);
      const gz = Number(rot.gamma);
      const total_gyro = Math.sqrt(gx * gx + gy * gy + gz * gz);

      setData((prev) => ({
        ...prev,
        gx: +gx.toFixed(2),
        gy: +gy.toFixed(2),
        gz: +gz.toFixed(2),
        total_gyro: +total_gyro.toFixed(2),
        timestamp: Date.now(),
      }));
      setHasEmittedData(true);
    }
  }, []);

  const handleOrientation = useCallback((event) => {
    if (event.alpha !== null && event.alpha !== undefined && event.beta !== null && event.beta !== undefined && event.gamma !== null && event.gamma !== undefined) {
      const alpha = Number(event.alpha);
      const beta = Number(event.beta);
      const gamma = Number(event.gamma);

      setData((prev) => ({
        ...prev,
        alpha: +alpha.toFixed(1),
        beta: +beta.toFixed(1),
        gamma: +gamma.toFixed(1),
        timestamp: Date.now(),
      }));
      setHasEmittedData(true);
    }
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

  const sensorState = !isSupported
    ? 'NOT_AVAILABLE'
    : !permissionGranted
    ? 'WAITING_FOR_PERMISSION'
    : hasEmittedData
    ? 'ACTIVE'
    : 'NOT_AVAILABLE';

  return {
    ...data,
    isSupported,
    permissionGranted,
    sensorState,
    hasEmittedData,
  };
};
