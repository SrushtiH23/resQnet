/**
 * MobileSensorManager
 * Features:
 * - DeviceMotionEvent (Accelerometer & Gyroscope rotation rate)
 * - DeviceOrientationEvent (Device orientation fallback)
 * - Geolocation API (GPS watchPosition with high accuracy)
 * - Screen Wake Lock API (keeps background active during monitoring)
 * - 20Hz Rolling Sliding Window Queue (100 samples capacity = 5 seconds)
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
    this.latestGyro = { gx: 0, gy: 0, gz: 0, total: 0 };
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
    let gpsAllowed = false;

    // iOS 13+ / Mobile permission request
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const response = await DeviceMotionEvent.requestPermission();
        motionAllowed = response === 'granted';
      } catch (err) {
        console.warn('DeviceMotionEvent permission error:', err);
        motionAllowed = false;
      }
    } else {
      // Standard Android / Chrome
      motionAllowed = 'DeviceMotionEvent' in window;
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

    this.hasPermission = motionAllowed;
    return { motionAllowed, gpsAllowed };
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

    // Attach sensor motion listener
    if (typeof window !== 'undefined') {
      window.addEventListener('devicemotion', this.handleMotion, true);
      window.addEventListener('deviceorientation', this.handleOrientation, true);
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
      window.removeEventListener('devicemotion', this.handleMotion, true);
      window.removeEventListener('deviceorientation', this.handleOrientation, true);
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

    const ax = acc && acc.x !== null ? acc.x : 0;
    const ay = acc && acc.y !== null ? acc.y : 9.8;
    const az = acc && acc.z !== null ? acc.z : 0;
    const total_accel = Math.sqrt(ax * ax + ay * ay + az * az);

    const gx = rot && rot.alpha !== null ? rot.alpha : 0;
    const gy = rot && rot.beta !== null ? rot.beta : 0;
    const gz = rot && rot.gamma !== null ? rot.gamma : 0;
    const total_gyro = Math.sqrt(gx * gx + gy * gy + gz * gz);

    this.latestAccel = { ax, ay, az, total: total_accel };
    this.latestGyro = { gx, gy, gz, total: total_gyro };

    const sample = {
      timestamp: Date.now(),
      ax, ay, az, total_accel,
      gx, gy, gz, total_gyro
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
    if (!this.isMonitoring || this.latestGyro.total > 0) return;
    // Fallback if rotationRate is not available
    const gx = event.alpha || 0;
    const gy = event.beta || 0;
    const gz = event.gamma || 0;
    const total_gyro = Math.sqrt(gx * gx + gy * gy + gz * gz);
    this.latestGyro = { gx, gy, gz, total: total_gyro };
  }

  getBuffer() {
    return [...this.buffer];
  }

  getLatestTelemetry() {
    return {
      accel: this.latestAccel,
      gyro: this.latestGyro,
      gps: this.latestGps,
      isMonitoring: this.isMonitoring,
      bufferSize: this.buffer.length,
    };
  }
}

export const mobileSensorManager = new MobileSensorManager(100);
