import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useAccelerometer React Hook
 * Captures smartphone Accelerometer readings via DeviceMotionEvent.
 * Eliminates all hardcoded 9.81 m/s² defaults and returns truthful sensorState.
 * Maintains an internal frame buffer so high-frequency peak impacts are preserved.
 */
export const useAccelerometer = () => {
  const [data, setData] = useState({
    ax: null,
    ay: null,
    az: null,
    total_accel: null,
    timestamp: null,
  });
  const [isSupported, setIsSupported] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [hasEmittedData, setHasEmittedData] = useState(false);

  const frameBufferRef = useRef([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      setIsSupported(true);
      // Auto-grant for standard Android / Chrome if permission API isn't restricted
      if (typeof DeviceMotionEvent.requestPermission !== 'function') {
        setPermissionGranted(true);
      }
    } else {
      setIsSupported(false);
    }
  }, []);

  const handleMotion = useCallback((event) => {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc) return;

    if (acc.x !== null && acc.x !== undefined && acc.y !== null && acc.y !== undefined && acc.z !== null && acc.z !== undefined) {
      const ax = Number(acc.x);
      const ay = Number(acc.y);
      const az = Number(acc.z);
      const total_accel = Math.sqrt(ax * ax + ay * ay + az * az);

      const sample = {
        ax: +ax.toFixed(2),
        ay: +ay.toFixed(2),
        az: +az.toFixed(2),
        total_accel: +total_accel.toFixed(2),
        timestamp: Date.now(),
      };

      frameBufferRef.current.push(sample);
      if (frameBufferRef.current.length > 200) {
        frameBufferRef.current.shift();
      }

      setData(sample);
      setHasEmittedData(true);
    }
  }, []);

  const getAndClearBuffer = useCallback(() => {
    const samples = [...frameBufferRef.current];
    frameBufferRef.current = [];
    return samples;
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
    requestPermission,
    getAndClearBuffer,
  };
};

