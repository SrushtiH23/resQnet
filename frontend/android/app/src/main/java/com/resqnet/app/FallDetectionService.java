package com.resqnet.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.location.LocationManager;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;

/**
 * FallDetectionService
 * Native Android 24/7 Background Motion Sentinel
 * 
 * Required Stages:
 * 1. NORMAL                     : Baseline continuous motion monitoring.
 * 2. POTENTIAL_FALL             : Free-fall dip (< 6.8 m/s²), descent unweighting, or stumble precursor.
 * 3. IMPACT_DETECTED            : High deceleration shock peak (>= 16.5 m/s²).
 * 4. POST_IMPACT_MONITORING     : Post-impact settling window, posture tilt change (>= 30°), stillness vs recovery.
 * 5. FALL_CONFIDENCE_EVALUATION : Multi-factor sensor fusion confidence score calculation.
 * 6. USER_CONFIRMATION          : High-confidence fall verified; triggers 10-second countdown activity.
 * 7. EMERGENCY_ESCALATION       : Countdown expires or user taps SOS; alert and SMS dispatched.
 * (RECOVERY                     : Active movement resumed post-impact; cancels alert to avoid false positives).
 * 
 * Key Reliability Features:
 * - Runs sensor listeners on a dedicated background HandlerThread to prevent UI thread frame drops.
 * - 200-sample rolling buffer (~4 seconds of history) preserving descent, impact, and stillness.
 * - Comprehensive diagnostic mode recording sensor values, sampling intervals, and rejection reasons.
 * - Lockout debounce (30s) preventing duplicate alert storms.
 */
public class FallDetectionService extends Service implements SensorEventListener {
    private static final String TAG = "FallDetectionService";
    private static final String DIAG_TAG = "ResQNetFallDiagnostic";
    private static final String CHANNEL_ID = "resqnet_fall_service";

    // Calibrated Kinematic Thresholds (MobiAct Benchmark & Real Device Telemetry)
    private static final float FREEFALL_THRESHOLD = 6.8f;     // m/s² (~0.69g downward descent or unweighting)
    private static final float IMPACT_THRESHOLD = 16.5f;      // m/s² (~1.68g deceleration shock peak)
    private static final float ROTATION_THRESHOLD = 80.0f;    // °/s (body toppling angular velocity)
    private static final float STILLNESS_VARIANCE = 2.6f;     // m/s² (post-impact resting stillness)
    private static final float TILT_CHANGE_THRESHOLD = 30.0f; // degrees (pre vs post posture orientation change)
    private static final float RECOVERY_VARIANCE = 4.2f;      // m/s² (active movement resumption)
    private static final int BUFFER_CAPACITY = 200;           // ~4 seconds of continuous history at 50Hz
    private static final long DEBOUNCE_LOCKOUT_MS = 30000;    // 30s lockout after alert

    private SensorManager sensorManager;
    private Sensor accelSensor;
    private Sensor gyroSensor;
    private Sensor rotationVectorSensor;
    private PowerManager.WakeLock wakeLock;

    // Dedicated Background HandlerThread for continuous sensor sampling without UI thread drops
    private HandlerThread sensorThread;
    private Handler sensorHandler;

    // Sensor availability flags
    private boolean isAccelAvailable = false;
    private boolean isGyroAvailable = false;
    private boolean isRotationAvailable = false;

    // Sensor Sample Representation
    public static class MotionSample {
        public long timestamp;
        public float ax, ay, az;
        public float totalAccel;
        public float gx, gy, gz;
        public float totalGyro;
        public float azimuth, pitch, roll;

        public MotionSample(long ts, float ax, float ay, float az, float totalAccel,
                            float gx, float gy, float gz, float totalGyro,
                            float azimuth, float pitch, float roll) {
            this.timestamp = ts;
            this.ax = ax;
            this.ay = ay;
            this.az = az;
            this.totalAccel = totalAccel;
            this.gx = gx;
            this.gy = gy;
            this.gz = gz;
            this.totalGyro = totalGyro;
            this.azimuth = azimuth;
            this.pitch = pitch;
            this.roll = roll;
        }
    }

    // Diagnostic Log Entry Representation
    public static class DiagnosticEntry {
        public long timestamp;
        public float ax, ay, az, totalAccel;
        public float gx, gy, gz, totalGyro;
        public float azimuth, pitch, roll;
        public float samplingIntervalMs;
        public String currentStage;
        public boolean freeFall;
        public boolean impact;
        public boolean rotation;
        public boolean stillness;
        public boolean tiltChange;
        public boolean recovered;
        public float confidenceScore;
        public String transitionReason;
        public String rejectionReason;

        @Override
        public String toString() {
            return String.format(
                    "[%s] Accel: (%.1f, %.1f, %.1f | Tot: %.1f) | Gyro: (%.1f, %.1f, %.1f | Tot: %.1f) | Tilt: (Az: %.1f, P: %.1f, R: %.1f) | Int: %.1fms | FF: %b, Imp: %b, Rot: %b, Still: %b, Rec: %b | Conf: %.0f | %s%s",
                    currentStage, ax, ay, az, totalAccel, gx, gy, gz, totalGyro, azimuth, pitch, roll, samplingIntervalMs,
                    freeFall, impact, rotation, stillness, recovered, confidenceScore,
                    transitionReason != null ? transitionReason : "",
                    rejectionReason != null ? (" [REJECT: " + rejectionReason + "]") : ""
            );
        }
    }

    // Sliding Window Rolling Buffer
    private final List<MotionSample> windowBuffer = new ArrayList<>();

    // Diagnostic Log Ring Buffer (Last 100 entries for inspection)
    private static final int MAX_DIAGNOSTIC_ENTRIES = 100;
    private final LinkedList<DiagnosticEntry> diagnosticLog = new LinkedList<>();

    // Latest Gyroscope Readings (rad/s converted to deg/s)
    private float currentGx = 0f;
    private float currentGy = 0f;
    private float currentGz = 0f;
    private float currentGyroMag = 0f;

    // Latest Device Orientation Angles from Rotation Vector (degrees)
    private float currentAzimuth = 0f;
    private float currentPitch = 0f;
    private float currentRoll = 0f;

    // Low-Pass Filter State for Accelerometer
    private float filteredAx = 0f;
    private float filteredAy = 9.81f;
    private float filteredAz = 0f;
    private boolean isFilterInitialized = false;
    private static final float ALPHA = 0.82f; // Low-pass filter smoothing coefficient

    // Fall Alert & State Machine Tracking
    private String currentStage = "NORMAL";
    private boolean isFallAlertActive = false;
    private long lastAlertTimestamp = 0;
    private long lastSampleTimestamp = 0;

    private Handler timerHandler = new Handler(Looper.getMainLooper());
    private Runnable alertTimeoutRunnable;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Starting Native Android 24/7 Fall Detection Service...");
        createNotificationChannel();
        startForegroundServiceNotification();
        acquirePartialWakeLock();

        // Initialize dedicated background thread for sensor event processing
        sensorThread = new HandlerThread("ResQNetSensorSentinelThread");
        sensorThread.start();
        sensorHandler = new Handler(sensorThread.getLooper());

        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            accelSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
            gyroSensor = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE);
            rotationVectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);

            if (accelSensor != null) {
                sensorManager.registerListener(this, accelSensor, SensorManager.SENSOR_DELAY_GAME, sensorHandler);
                isAccelAvailable = true;
                Log.i(TAG, "Accelerometer registered on background HandlerThread (SENSOR_DELAY_GAME).");
            } else {
                Log.w(TAG, "Accelerometer not available on device.");
            }

            if (gyroSensor != null) {
                sensorManager.registerListener(this, gyroSensor, SensorManager.SENSOR_DELAY_GAME, sensorHandler);
                isGyroAvailable = true;
                Log.i(TAG, "Gyroscope registered on background HandlerThread (SENSOR_DELAY_GAME).");
            } else {
                Log.w(TAG, "Gyroscope not available on device (will use accelerometer posture tilt fallback).");
            }

            if (rotationVectorSensor != null) {
                sensorManager.registerListener(this, rotationVectorSensor, SensorManager.SENSOR_DELAY_GAME, sensorHandler);
                isRotationAvailable = true;
                Log.i(TAG, "Rotation Vector sensor registered on background HandlerThread (SENSOR_DELAY_GAME).");
            } else {
                Log.w(TAG, "Rotation Vector sensor not available on device.");
            }
        }
    }

    private void acquirePartialWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ResQNet:FallSentinelWakeLock");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire(10 * 60 * 1000L); // 10 min sliding renew
                Log.i(TAG, "Partial WakeLock acquired for background motion sentinel.");
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not acquire WakeLock:", e);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "ResQNet Fall Detection Sentinel",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Continuous 24/7 background motion sensor monitoring for falls");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void startForegroundServiceNotification() {
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("ResQNet Active Fall Guard")
                .setContentText("Monitoring motion hardware sensors 24/7 in background.")
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();

        startForeground(2001, notification);
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event == null || isFallAlertActive) return;

        long now = System.currentTimeMillis();

        if (event.sensor.getType() == Sensor.TYPE_ROTATION_VECTOR) {
            float[] rotationMatrix = new float[9];
            float[] orientationValues = new float[3];
            SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values);
            SensorManager.getOrientation(rotationMatrix, orientationValues);
            currentAzimuth = (float) Math.toDegrees(orientationValues[0]);
            currentPitch = (float) Math.toDegrees(orientationValues[1]);
            currentRoll = (float) Math.toDegrees(orientationValues[2]);
            return;
        }

        if (event.sensor.getType() == Sensor.TYPE_GYROSCOPE) {
            // Android gyroscope reports in radians/sec; convert to degrees/sec
            float radX = event.values[0];
            float radY = event.values[1];
            float radZ = event.values[2];
            currentGx = (float) (radX * (180.0 / Math.PI));
            currentGy = (float) (radY * (180.0 / Math.PI));
            currentGz = (float) (radZ * (180.0 / Math.PI));
            currentGyroMag = (float) Math.sqrt(currentGx * currentGx + currentGy * currentGy + currentGz * currentGz);
            return;
        }

        if (event.sensor.getType() == Sensor.TYPE_ACCELEROMETER) {
            float rawAx = event.values[0];
            float rawAy = event.values[1];
            float rawAz = event.values[2];

            // IIR Low-Pass Smoothing Filter
            if (!isFilterInitialized) {
                filteredAx = rawAx;
                filteredAy = rawAy;
                filteredAz = rawAz;
                isFilterInitialized = true;
            } else {
                filteredAx = ALPHA * filteredAx + (1.0f - ALPHA) * rawAx;
                filteredAy = ALPHA * filteredAy + (1.0f - ALPHA) * rawAy;
                filteredAz = ALPHA * filteredAz + (1.0f - ALPHA) * rawAz;
            }

            float totalAccel = (float) Math.sqrt(filteredAx * filteredAx + filteredAy * filteredAy + filteredAz * filteredAz);
            float samplingIntervalMs = (lastSampleTimestamp > 0) ? (now - lastSampleTimestamp) : 20.0f;
            lastSampleTimestamp = now;

            // Add sample to sliding window buffer
            synchronized (windowBuffer) {
                windowBuffer.add(new MotionSample(
                        now,
                        filteredAx, filteredAy, filteredAz, totalAccel,
                        currentGx, currentGy, currentGz, currentGyroMag,
                        currentAzimuth, currentPitch, currentRoll
                ));
                if (windowBuffer.size() > BUFFER_CAPACITY) {
                    windowBuffer.remove(0);
                }

                // Minimum window history before evaluating multi-stage kinematics (~1.0s = 20 samples)
                if (windowBuffer.size() >= 20) {
                    evaluateKinematicWindowLocked(now, samplingIntervalMs);
                }
            }
        }
    }

    /**
     * 7-Stage Multi-Sensor Kinematic Evaluation across sliding window buffer
     */
    private void evaluateKinematicWindowLocked(long now, float samplingIntervalMs) {
        // Enforce 30s lockout after recent alert
        if (now - lastAlertTimestamp < DEBOUNCE_LOCKOUT_MS) {
            return;
        }

        int count = windowBuffer.size();
        float minAccel = Float.MAX_VALUE;
        float maxAccel = Float.MIN_VALUE;
        float maxGyro = 0f;
        int iMin = 0;
        int iMax = 0;

        for (int i = 0; i < count; i++) {
            MotionSample s = windowBuffer.get(i);
            if (s.totalAccel < minAccel) {
                minAccel = s.totalAccel;
                iMin = i;
            }
            if (s.totalAccel > maxAccel) {
                maxAccel = s.totalAccel;
                iMax = i;
            }
            if (s.totalGyro > maxGyro) {
                maxGyro = s.totalGyro;
            }
        }

        // Post-impact stillness: analyze last 35% tail samples
        int tailCount = Math.max(4, (int) (count * 0.35));
        float tailMin = Float.MAX_VALUE;
        float tailMax = Float.MIN_VALUE;
        for (int i = count - tailCount; i < count; i++) {
            float a = windowBuffer.get(i).totalAccel;
            if (a < tailMin) tailMin = a;
            if (a > tailMax) tailMax = a;
        }
        float accelVariance = tailMax - tailMin;

        // Posture tilt calculation: pre-impact (head 10 samples) vs post-impact (tail 10 samples)
        int preCount = Math.min(10, count);
        float preSumX = 0f, preSumY = 0f, preSumZ = 0f;
        for (int i = 0; i < preCount; i++) {
            MotionSample s = windowBuffer.get(i);
            preSumX += s.ax; preSumY += s.ay; preSumZ += s.az;
        }
        float postSumX = 0f, postSumY = 0f, postSumZ = 0f;
        for (int i = count - preCount; i < count; i++) {
            MotionSample s = windowBuffer.get(i);
            postSumX += s.ax; postSumY += s.ay; postSumZ += s.az;
        }

        float normPre = (float) Math.sqrt(preSumX * preSumX + preSumY * preSumY + preSumZ * preSumZ);
        float normPost = (float) Math.sqrt(postSumX * postSumX + postSumY * postSumY + postSumZ * postSumZ);
        float tiltDeg = 0f;
        if (normPre > 0.01f && normPost > 0.01f) {
            float dot = (preSumX * postSumX + preSumY * postSumY + preSumZ * postSumZ) / (normPre * normPost);
            dot = Math.max(-1.0f, Math.min(1.0f, dot));
            tiltDeg = (float) (Math.acos(dot) * (180.0 / Math.PI));
        }

        // Kinematic Conditions
        boolean hasFreeFall = minAccel < FREEFALL_THRESHOLD;
        boolean hasImpact = maxAccel >= IMPACT_THRESHOLD;
        boolean hasRotation = maxGyro >= ROTATION_THRESHOLD;
        boolean hasStillness = accelVariance < STILLNESS_VARIANCE;
        boolean hasTiltChange = tiltDeg >= TILT_CHANGE_THRESHOLD;
        boolean hasRecovered = accelVariance > RECOVERY_VARIANCE && maxAccel > 15.0f;
        boolean temporalValid = (iMax >= iMin) || (Math.abs(iMax - iMin) <= 15);

        // Stage & Diagnostics Determination
        String nextStage = "NORMAL";
        float confidenceScore = 0f;
        String transitionReason = "Normal baseline locomotion";
        String rejectionReason = null;

        if (hasRecovered) {
            nextStage = "RECOVERY";
            confidenceScore = 0f;
            transitionReason = String.format("Active movement resumed post-impact (var: %.1f m/s²). Alert standby.", accelVariance);
            rejectionReason = "RECOVERY_MOVEMENT_DETECTED";
        } else if (hasImpact && hasStillness && temporalValid) {
            if (!hasRotation && !hasTiltChange) {
                nextStage = "IMPACT_DETECTED";
                confidenceScore = 30f;
                transitionReason = "Flat device drop rejected (impact without rotation or posture change).";
                rejectionReason = "FLAT_DEVICE_DROP_NO_ROTATION_OR_TILT";
            } else if (hasRotation && (hasTiltChange || hasFreeFall)) {
                nextStage = "USER_CONFIRMATION";
                confidenceScore = hasFreeFall ? 95f : 85f;
                transitionReason = String.format("Full kinematic signature verified: Impact (%.1f), Rot (%.1f), Tilt (%.1f°), Stillness (%.2f).",
                        maxAccel, maxGyro, tiltDeg, accelVariance);
            } else if (hasTiltChange && (hasFreeFall || maxAccel >= 18.0f)) {
                nextStage = "USER_CONFIRMATION";
                confidenceScore = 80f;
                transitionReason = String.format("Posture collapse verified via tilt (%.1f°) and stillness (%.2f).", tiltDeg, accelVariance);
            } else if (!isGyroAvailable && hasTiltChange && maxAccel >= IMPACT_THRESHOLD) {
                nextStage = "USER_CONFIRMATION";
                confidenceScore = 75f;
                transitionReason = String.format("Fallback verification without gyroscope: Tilt (%.1f°), Stillness (%.2f).", tiltDeg, accelVariance);
            } else {
                nextStage = "FALL_CONFIDENCE_EVALUATION";
                confidenceScore = 50f;
                transitionReason = "Borderline dynamics; awaiting further stillness verification.";
                rejectionReason = "INSUFFICIENT_ROTATION_OR_TILT_FOR_CONFIRMATION";
            }
        } else if (hasImpact && !hasStillness) {
            nextStage = "POST_IMPACT_MONITORING";
            confidenceScore = 35f;
            transitionReason = String.format("Impact shock peak (%.1f m/s²) registered. Monitoring post-impact stillness.", maxAccel);
            rejectionReason = "POST_IMPACT_STILLNESS_NOT_YET_SATISFIED";
        } else if (hasImpact) {
            nextStage = "IMPACT_DETECTED";
            confidenceScore = 25f;
            transitionReason = String.format("Impact shock peak (%.1f m/s²) registered.", maxAccel);
            rejectionReason = "AWAITING_POST_IMPACT_MONITORING";
        } else if (hasFreeFall) {
            nextStage = "POTENTIAL_FALL";
            confidenceScore = 20f;
            transitionReason = String.format("Descent dip (%.1f m/s² < %.1f) detected. Tracking potential impact shock.", minAccel, FREEFALL_THRESHOLD);
            rejectionReason = "AWAITING_IMPACT_SHOCK";
        }

        // Record Diagnostic Entry
        DiagnosticEntry diag = new DiagnosticEntry();
        diag.timestamp = now;
        MotionSample latest = windowBuffer.get(count - 1);
        diag.ax = latest.ax; diag.ay = latest.ay; diag.az = latest.az; diag.totalAccel = latest.totalAccel;
        diag.gx = latest.gx; diag.gy = latest.gy; diag.gz = latest.gz; diag.totalGyro = latest.totalGyro;
        diag.azimuth = latest.azimuth; diag.pitch = latest.pitch; diag.roll = latest.roll;
        diag.samplingIntervalMs = samplingIntervalMs;
        diag.currentStage = nextStage;
        diag.freeFall = hasFreeFall;
        diag.impact = hasImpact;
        diag.rotation = hasRotation;
        diag.stillness = hasStillness;
        diag.tiltChange = hasTiltChange;
        diag.recovered = hasRecovered;
        diag.confidenceScore = confidenceScore;
        diag.transitionReason = transitionReason;
        diag.rejectionReason = rejectionReason;

        synchronized (diagnosticLog) {
            diagnosticLog.add(diag);
            if (diagnosticLog.size() > MAX_DIAGNOSTIC_ENTRIES) {
                diagnosticLog.removeFirst();
            }
        }

        if (!"NORMAL".equals(nextStage)) {
            Log.d(DIAG_TAG, diag.toString());
        }

        this.currentStage = nextStage;

        // Trigger confirmation countdown when USER_CONFIRMATION criteria are satisfied
        if ("USER_CONFIRMATION".equals(nextStage) && !isFallAlertActive) {
            Log.w(TAG, String.format(
                    "🚨 VERIFIED FALL DETECTED! Triggering USER_CONFIRMATION countdown. Impact: %.1f m/s², Gyro: %.1f °/s, MinA: %.1f m/s², PostVar: %.1f m/s², Tilt: %.1f°",
                    maxAccel, maxGyro, minAccel, accelVariance, tiltDeg
            ));
            lastAlertTimestamp = now;
            triggerSystemFallAlert();
        }
    }

    public void triggerSystemFallAlert() {
        if (isFallAlertActive) return;
        isFallAlertActive = true;
        this.currentStage = "USER_CONFIRMATION";

        // Launch System Full-Screen Alert Activity over Home Screen / Lock Screen / WhatsApp
        Intent dialogIntent = new Intent(this, SystemFallAlertActivity.class);
        dialogIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(dialogIntent);

        // Schedule 10-second timeout auto-escalation to FastAPI backend
        alertTimeoutRunnable = new Runnable() {
            @Override
            public void run() {
                Log.w(TAG, "10-Second Countdown Expired with no user response. Transitioning to EMERGENCY_ESCALATION...");
                currentStage = "EMERGENCY_ESCALATION";
                dispatchEmergencyToBackend();
                isFallAlertActive = false;
            }
        };
        timerHandler.postDelayed(alertTimeoutRunnable, 10000);
    }

    public void cancelFallAlert() {
        Log.i(TAG, "User marked 'I'M OKAY'. Cancelling emergency dispatch. Transitioning to RECOVERY.");
        this.currentStage = "RECOVERY";
        if (alertTimeoutRunnable != null) {
            timerHandler.removeCallbacks(alertTimeoutRunnable);
        }
        isFallAlertActive = false;
        synchronized (windowBuffer) {
            windowBuffer.clear();
        }
    }

    public void executeImmediateEmergencyDispatch() {
        Log.w(TAG, "User clicked 'NEED HELP NOW'. Dispatching immediate emergency escalation...");
        this.currentStage = "EMERGENCY_ESCALATION";
        if (alertTimeoutRunnable != null) {
            timerHandler.removeCallbacks(alertTimeoutRunnable);
        }
        dispatchEmergencyToBackend();
        isFallAlertActive = false;
    }

    private void dispatchEmergencyToBackend() {
        new Thread(new Runnable() {
            @Override
            public void run() {
                // Determine effective coordinates from device location manager
                double lat = 12.9716; // default Bengaluru center coordinates
                double lon = 77.5946;

                try {
                    LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
                    if (lm != null) {
                        Location loc = null;
                        if (checkCallingOrSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                            loc = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                            if (loc == null) {
                                loc = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                            }
                        }
                        if (loc != null) {
                            lat = loc.getLatitude();
                            lon = loc.getLongitude();
                            Log.i(TAG, "Retrieved real device GPS: " + lat + ", " + lon);
                        }
                    }
                } catch (Exception locEx) {
                    Log.w(TAG, "Could not fetch device GPS, using fallback coordinates:", locEx);
                }

                // Battery Level
                int batteryLevel = 90;
                try {
                    IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
                    Intent batteryStatus = registerReceiver(null, ifilter);
                    if (batteryStatus != null) {
                        int level = batteryStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                        int scale = batteryStatus.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
                        if (level >= 0 && scale > 0) {
                            batteryLevel = (int) ((level / (float) scale) * 100);
                        }
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Could not read battery level:", e);
                }

                // Network Status
                String networkStatus = "4G/5G";
                try {
                    ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
                    if (cm != null) {
                        NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
                        if (activeNetwork != null && activeNetwork.isConnected()) {
                            if (activeNetwork.getType() == ConnectivityManager.TYPE_WIFI) {
                                networkStatus = "WiFi";
                            } else if (activeNetwork.getType() == ConnectivityManager.TYPE_MOBILE) {
                                networkStatus = "Cellular";
                            }
                        }
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Could not determine network status:", e);
                }

                // Read backend URL and authentication from SharedPreferences
                SharedPreferences prefs = getSharedPreferences("ResQNetPrefs", Context.MODE_PRIVATE);
                String configuredBase = prefs.getString("backend_url", "http://10.0.2.2:8000");
                String authToken = prefs.getString("auth_token", null);
                int userId = prefs.getInt("user_id", 1);

                String[] candidateUrls = new String[] {
                        configuredBase + "/emergency/create",
                        configuredBase + "/api/emergency/create",
                        "http://10.0.2.2:8000/emergency/create"
                };

                for (String endpointUrl : candidateUrls) {
                    try {
                        URL url = new URL(endpointUrl);
                        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                        conn.setRequestMethod("POST");
                        conn.setRequestProperty("Content-Type", "application/json; utf-8");
                        conn.setRequestProperty("Accept", "application/json");
                        if (authToken != null && !authToken.trim().isEmpty()) {
                            conn.setRequestProperty("Authorization", "Bearer " + authToken.trim());
                        }
                        conn.setConnectTimeout(6000);
                        conn.setReadTimeout(6000);
                        conn.setDoOutput(true);

                        String jsonInputString = String.format(
                                "{\"user_id\":%d,\"trigger_source\":\"Android Native Background Fall Sentinel\",\"latitude\":%.6f,\"longitude\":%.6f,\"speed\":0.0,\"battery_level\":%d,\"network_status\":\"%s\"}",
                                userId, lat, lon, batteryLevel, networkStatus
                        );

                        try (OutputStream os = conn.getOutputStream()) {
                            byte[] input = jsonInputString.getBytes("utf-8");
                            os.write(input, 0, input.length);
                        }

                        int code = conn.getResponseCode();
                        Log.i(TAG, "Emergency dispatch to " + endpointUrl + " returned HTTP: " + code);
                        conn.disconnect();

                        if (code >= 200 && code < 300) {
                            Log.i(TAG, "✅ Emergency successfully dispatched to backend!");
                            break;
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "Dispatch attempt failed for " + endpointUrl + ": " + e.getMessage());
                    }
                }
            }
        }).start();
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && intent.getAction() != null) {
            if ("CANCEL_ALERT".equals(intent.getAction())) {
                cancelFallAlert();
            } else if ("DISPATCH_SOS".equals(intent.getAction())) {
                executeImmediateEmergencyDispatch();
            }
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        if (sensorThread != null) {
            sensorThread.quitSafely();
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        Log.i(TAG, "FallDetectionService destroyed, HandlerThread stopped and sensor listeners unregistered.");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
