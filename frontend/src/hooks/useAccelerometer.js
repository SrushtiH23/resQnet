import { useState, useEffect, useCallback } from 'react';

/**
 * useAccelerometer React Hook
 * Captures real smartphone Accelerometer readings via DeviceMotionEvent.
 * Returns: { ax, ay, az, total_accel, timestamp, isSupported, permissionGranted, requestPermission }
 */
export const useAccelerometer = () => {
  const [data, setData] = useState({
    ax: 0,
    ay: 9.81,
    az: 0,
    total_accel: 9.81,
    timestamp: Date.now(),
  });
  const [isSupported, setIsSupported] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      setIsSupported(true);
      // Auto-grant for standard Android / Chrome if permission API isn't restricted
      if (typeof DeviceMotionEvent.requestPermission !== 'function') {
        setPermissionGranted(true);
      }
    }
  }, []);

  const handleMotion = useCallback((event) => {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc) return;

    const ax = acc.x !== null && acc.x !== undefined ? acc.x : 0;
    const ay = acc.y !== null && acc.y !== undefined ? acc.y : 9.81;
    const az = acc.z !== null && acc.z !== undefined ? acc.z : 0;
    const total_accel = Math.sqrt(ax * ax + ay * ay + az * az);

    setData({
      ax: +ax.toFixed(2),
      ay: +ay.toFixed(2),
      az: +az.toFixed(2),
      total_accel: +total_accel.toFixed(2),
      timestamp: Date.now(),
    });
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const response = await DeviceMotionEvent.requestPermission();
        if (response === 'granted') {
          setPermissionGranted(true);
          return true;
        } else {
          setPermissionGranted(false);
          return false;
        }
      } catch (err) {
        console.warn('DeviceMotionEvent permission error:', err);
        setPermissionGranted(false);
        return false;
      }
    } else {
      setPermissionGranted(true);
      return true;
    }
  }, []);

  useEffect(() => {
    if (isSupported && permissionGranted) {
      window.addEventListener('devicemotion', handleMotion, true);
    }
    return () => {
      if (isSupported) {
        window.removeEventListener('devicemotion', handleMotion, true);
      }
    };
  }, [isSupported, permissionGranted, handleMotion]);

  return {
    ...data,
    isSupported,
    permissionGranted,
    requestPermission,
  };
};
