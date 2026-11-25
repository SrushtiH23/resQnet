/**
 * MobileSensorManager
 * Features:
 * - DeviceMotionEvent (Accelerometer & Gyroscope rotation rate)
 * - DeviceOrientationEvent (Device orientation Euler angles)
 * - Geolocation API (GPS watchPosition with high accuracy)
 * - Screen Wake Lock API (keeps background active during monitoring)
 * - 20Hz Rolling Sliding Window Queue (100 samples capacity = 5 seconds)
 * 
 * Strict Telemetry Separation:
 * - Gyroscope angular velocity (gx, gy, gz in °/s) is strictly separated from
 *   Orientation Euler angles (alpha, beta, gamma in °). Orientation angles are
 *   never assigned to gyroscope velocity.
 */

export class MobileSensorManager {
  constructor(bufferCapacity = 100) {
    this.bufferCapacity = bufferCapacity;
    this.buffer = [];
    this.isMonitoring = false;
    this.hasPermission = false;
    this.wakeLock = null;
    this.watchId = null;

    // Latest Telemetry
    this.latestAccel = { ax: 0, ay: 9.8, az: 0, total: 9.8 };
    this.latestGyro = { gx: null, gy: null, gz: null, total: null, available: false };
    this.latestOrientation = { alpha: null, beta: null, gamma: null, available: false };
    this.latestGps = { latitude: 0, longitude: 0, speed: 0, accuracy: 0, altitude: 0 };

    // Event Callbacks
    this.onSampleCallback = null;
    this.onGpsCallback = null;
    this.onStatusCallback = null;

    this.handleMotion = this.handleMotion.bind(this);
    this.handleOrientation = this.handleOrientation.bind(this);
  }

  static isSensorSupported() {
    return typeof window !== 'undefined' && ('DeviceMotionEvent' in window || 'navigator' in window);
  }

  async requestPermissions() {
    let motionAllowed = false;
    let orientAllowed = false;
    let gpsAllowed = false;

    // DeviceMotionEvent permission (iOS 13+ / mobile)
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const response = await DeviceMotionEvent.requestPermission();
        motionAllowed = response === 'granted';
      } catch (err) {
        console.warn('DeviceMotionEvent permission error:', err);
        motionAllowed = false;
      }
    } else {
      motionAllowed = typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
    }

    // DeviceOrientationEvent permission
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const response = await DeviceOrientationEvent.requestPermission();
        orientAllowed = response === 'granted';
      } catch (err) {
        console.warn('DeviceOrientationEvent permission error:', err);
        orientAllowed = false;
      }
    } else {
      orientAllowed = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    }

    // Geolocation permission request
    if ('geolocation' in navigator) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          });
        });
        if (pos) {
          gpsAllowed = true;
          this.latestGps = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            speed: pos.coords.speed || 0,
            accuracy: pos.coords.accuracy || 0,
            altitude: pos.coords.altitude || 0,
          };
        }
      } catch (err) {
        console.warn('GPS permission error:', err);
        gpsAllowed = false;
      }
    }

    this.hasPermission = motionAllowed || orientAllowed;
    return { motionAllowed, orientAllowed, gpsAllowed };
  }

  async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        console.log('Screen Wake Lock active');
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
      }
    }
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().then(() => {
        this.wakeLock = null;
      });
    }
  }

  startMonitoring({ onSample, onGps, onStatus }) {
    if (this.isMonitoring) return;

    this.onSampleCallback = onSample;
    this.onGpsCallback = onGps;
    this.onStatusCallback = onStatus;

    this.isMonitoring = true;

    // Attach sensor motion listeners (using standard bubbling for broad mobile browser compatibility)
    if (typeof window !== 'undefined') {
      window.addEventListener('devicemotion', this.handleMotion, false);
      window.addEventListener('deviceorientation', this.handleOrientation, false);
      window.addEventListener('deviceorientationabsolute', this.handleOrientation, false);
    }

    // Attach GPS listener
    if ('geolocation' in navigator) {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          this.latestGps = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            speed: pos.coords.speed || 0,
            accuracy: pos.coords.accuracy || 0,
            altitude: pos.coords.altitude || 0,
          };
          if (this.onGpsCallback) {
            this.onGpsCallback(this.latestGps);
          }
        },
        (err) => console.warn('GPS Watch error:', err),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
      );
    }

    // Request Screen WakeLock
    this.requestWakeLock();

    if (this.onStatusCallback) {
      this.onStatusCallback({ isMonitoring: true, message: 'Hardware sensors active (20Hz)' });
    }
  }

  stopMonitoring() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (typeof window !== 'undefined') {
      window.removeEventListener('devicemotion', this.handleMotion, false);
      window.removeEventListener('deviceorientation', this.handleOrientation, false);
      window.removeEventListener('deviceorientationabsolute', this.handleOrientation, false);
    }

    if (this.watchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    this.releaseWakeLock();

    if (this.onStatusCallback) {
      this.onStatusCallback({ isMonitoring: false, message: 'Sensor monitoring stopped' });
    }
  }

  handleMotion(event) {
    if (!this.isMonitoring) return;

    const acc = event.accelerationIncludingGravity || event.acceleration;
    const rot = event.rotationRate;

    const ax = acc && acc.x !== null && acc.x !== undefined ? Number(acc.x) : 0;
    const ay = acc && acc.y !== null && acc.y !== undefined ? Number(acc.y) : 9.81;
    const az = acc && acc.z !== null && acc.z !== undefined ? Number(acc.z) : 0;
    const total_accel = Math.sqrt(ax * ax + ay * ay + az * az);

    const hasGyro = rot && (
      (rot.alpha !== null && rot.alpha !== undefined) ||
      (rot.beta !== null && rot.beta !== undefined) ||
      (rot.gamma !== null && rot.gamma !== undefined)
    );

    let gx = null;
    let gy = null;
    let gz = null;
    let total_gyro = null;

    if (hasGyro) {
      gx = rot.alpha !== null && rot.alpha !== undefined ? Number(rot.alpha) : 0.0;
      gy = rot.beta !== null && rot.beta !== undefined ? Number(rot.beta) : 0.0;
      gz = rot.gamma !== null && rot.gamma !== undefined ? Number(rot.gamma) : 0.0;
      total_gyro = Math.sqrt(gx * gx + gy * gy + gz * gz);
      this.latestGyro = { gx, gy, gz, total: total_gyro, available: true };
    }

    this.latestAccel = { ax, ay, az, total: total_accel };

    const sample = {
      timestamp: Date.now(),
      ax: +ax.toFixed(2),
      ay: +ay.toFixed(2),
      az: +az.toFixed(2),
      total_accel: +total_accel.toFixed(2),
      gx: gx !== null ? +gx.toFixed(2) : null,
      gy: gy !== null ? +gy.toFixed(2) : null,
      gz: gz !== null ? +gz.toFixed(2) : null,
      total_gyro: total_gyro !== null ? +total_gyro.toFixed(2) : null,
      alpha: this.latestOrientation.alpha,
      beta: this.latestOrientation.beta,
      gamma: this.latestOrientation.gamma,
      gyro_available: hasGyro,
      orientation_available: this.latestOrientation.available,
    };

    // Push into sliding window queue
    if (this.buffer.length >= this.bufferCapacity) {
      this.buffer.shift(); // O(1) eviction
    }
    this.buffer.push(sample);

    if (this.onSampleCallback) {
      this.onSampleCallback(sample, this.getBuffer());
    }
  }

  handleOrientation(event) {
    if (!this.isMonitoring) return;
    if (event.alpha !== null && event.alpha !== undefined &&
        event.beta !== null && event.beta !== undefined &&
        event.gamma !== null && event.gamma !== undefined) {
      this.latestOrientation = {
        alpha: +Number(event.alpha).toFixed(1),
        beta: +Number(event.beta).toFixed(1),
        gamma: +Number(event.gamma).toFixed(1),
        available: true,
      };
    }
  }

  getBuffer() {
    return [...this.buffer];
  }

  getLatestTelemetry() {
    return {
      accel: this.latestAccel,
      gyro: this.latestGyro,
      orientation: this.latestOrientation,
      gps: this.latestGps,
      isMonitoring: this.isMonitoring,
      bufferSize: this.buffer.length,
    };
  }
}

export const mobileSensorManager = new MobileSensorManager(100);
