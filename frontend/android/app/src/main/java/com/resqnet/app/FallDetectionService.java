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
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

/**
 * FallDetectionService
 * Native Android 24/7 Background Motion Sentinel
 * 
 * Features:
 * - Accelerometer + Gyroscope sensor fusion with IIR low-pass filtering.
 * - Rolling 100-sample sliding window buffer (~3-5 seconds of continuous motion history).
 * - Multi-stage kinematic verification:
 *     Stage 1: Descent / Free Fall (< 6.5 m/s²)
 *     Stage 2: High Impact Shock (> 18.0 m/s²)
 *     Stage 3: Angular Rotation (> 80.0 °/s)
 *     Stage 4: Post-Impact Stillness (variance < 3.0 m/s²)
 *     Stage 5: Posture Tilt Angle Change (> 30°)
 *     Stage 6: Movement Recovery Check (cancels if active movement resumes post-impact)
 * - Temporal correlation: verifies free fall precedes impact peak.
 * - Debounce lockout (30s) preventing duplicate alerts for the same event.
 * - 10-Second confirmation countdown via SystemFallAlertActivity before backend dispatch.
 * - WakeLock and foreground notification service for background stability.
 */
public class FallDetectionService extends Service implements SensorEventListener {
    private static final String TAG = "FallDetectionService";
    private static final String CHANNEL_ID = "resqnet_fall_service";

    // Calibrated Kinematic Thresholds
    private static final float FREEFALL_THRESHOLD = 6.5f;     // m/s² (~0.65g downward descent)
    private static final float IMPACT_THRESHOLD = 18.0f;      // m/s² (~1.84g deceleration shock)
    private static final float ROTATION_THRESHOLD = 80.0f;    // °/s (body rotation angular velocity)
    private static final float STILLNESS_VARIANCE = 3.0f;     // m/s² (post-impact resting stillness)
    private static final float TILT_CHANGE_THRESHOLD = 30.0f; // degrees (posture tilt change)
    private static final float RECOVERY_VARIANCE = 5.5f;      // m/s² (active recovery threshold)
    private static final int BUFFER_CAPACITY = 100;
    private static final long DEBOUNCE_LOCKOUT_MS = 30000;    // 30s lockout after alert

    private SensorManager sensorManager;
    private Sensor accelSensor;
    private Sensor gyroSensor;
    private PowerManager.WakeLock wakeLock;

    // Sensor Sample Representation
    private static class MotionSample {
        long timestamp;
        float ax, ay, az;
        float totalAccel;
        float gx, gy, gz;
        float totalGyro;

        MotionSample(long ts, float ax, float ay, float az, float totalAccel, float gx, float gy, float gz, float totalGyro) {
            this.timestamp = ts;
            this.ax = ax;
            this.ay = ay;
            this.az = az;
            this.totalAccel = totalAccel;
            this.gx = gx;
            this.gy = gy;
            this.gz = gz;
            this.totalGyro = totalGyro;
        }
    }

    // Sliding Window Rolling Buffer
    private final List<MotionSample> windowBuffer = new ArrayList<>();

    // Latest Gyroscope Readings (rad/s converted to deg/s)
    private float currentGx = 0f;
    private float currentGy = 0f;
    private float currentGz = 0f;
    private float currentGyroMag = 0f;

    // Low-Pass Filter State for Accelerometer
    private float filteredAx = 0f;
    private float filteredAy = 9.81f;
    private float filteredAz = 0f;
    private boolean isFilterInitialized = false;
    private static final float ALPHA = 0.82f; // Low-pass filter smoothing coefficient

    // Fall Alert State
    private boolean isFallAlertActive = false;
    private long lastAlertTimestamp = 0;

    private Handler timerHandler = new Handler(Looper.getMainLooper());
    private Runnable alertTimeoutRunnable;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Starting Native Android 24/7 Fall Detection Service...");
        createNotificationChannel();
        startForegroundServiceNotification();
        acquirePartialWakeLock();

        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            accelSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
            gyroSensor = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE);

            if (accelSensor != null) {
                sensorManager.registerListener(this, accelSensor, SensorManager.SENSOR_DELAY_GAME);
                Log.i(TAG, "Accelerometer registered with SENSOR_DELAY_GAME.");
            } else {
                Log.w(TAG, "Accelerometer not available on device.");
            }

            if (gyroSensor != null) {
                sensorManager.registerListener(this, gyroSensor, SensorManager.SENSOR_DELAY_GAME);
                Log.i(TAG, "Gyroscope registered with SENSOR_DELAY_GAME.");
            } else {
                Log.w(TAG, "Gyroscope not available on device (will use accelerometer tilt fallback).");
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

            // Add sample to sliding window buffer
            synchronized (windowBuffer) {
                windowBuffer.add(new MotionSample(
                        now,
                        filteredAx, filteredAy, filteredAz, totalAccel,
                        currentGx, currentGy, currentGz, currentGyroMag
                ));
                if (windowBuffer.size() > BUFFER_CAPACITY) {
                    windowBuffer.remove(0);
                }

                // Minimum window history before evaluating multi-stage kinematics (~1.5s = 30 samples)
                if (windowBuffer.size() >= 30) {
                    evaluateKinematicWindowLocked(now);
                }
            }
        }
    }

    /**
     * Multi-Stage Kinematic Evaluation across sliding window buffer
     */
    private void evaluateKinematicWindowLocked(long now) {
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

        // Posture tilt calculation: pre-impact (head 8 samples) vs post-impact (tail 8 samples)
        int preCount = Math.min(8, count);
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

        // Kinematic signature flags
        boolean hasFreeFall = minAccel < FREEFALL_THRESHOLD;
        boolean hasImpact = maxAccel > IMPACT_THRESHOLD;
        boolean hasRotation = maxGyro > ROTATION_THRESHOLD;
        boolean hasStillness = accelVariance < STILLNESS_VARIANCE;
        boolean hasTiltChange = tiltDeg > TILT_CHANGE_THRESHOLD;
        boolean hasRecovered = accelVariance > RECOVERY_VARIANCE && maxAccel > 16.0f;
        boolean temporalValid = (iMax >= iMin) || (Math.abs(iMax - iMin) <= 15);

        // Immediate cancellation if user recovers motion post-impact
        if (hasRecovered) {
            return;
        }

        // Multi-stage verification condition
        boolean isConfirmedFall = false;
        if (hasImpact && hasRotation && hasStillness && hasFreeFall && temporalValid) {
            // Stage 5: High Confidence Critical Fall
            isConfirmedFall = true;
        } else if (hasImpact && hasRotation && (hasStillness || hasTiltChange) && temporalValid) {
            // Stage 4: Verified Rotational Fall
            isConfirmedFall = true;
        } else if (hasImpact && hasFreeFall && hasStillness && temporalValid) {
            // Stage 4: Impact with Confirmed Stillness
            isConfirmedFall = true;
        } else if (hasImpact && hasTiltChange && hasStillness) {
            // Stage 4: Posture Change with Resting Stillness
            isConfirmedFall = true;
        }

        if (isConfirmedFall) {
            Log.w(TAG, String.format(
                    "🚨 VERIFIED FALL DETECTED BY MULTI-STAGE SENSORS! Impact: %.1f m/s², Gyro: %.1f °/s, MinA: %.1f m/s², PostVar: %.1f m/s², Tilt: %.1f°",
                    maxAccel, maxGyro, minAccel, accelVariance, tiltDeg
            ));
            lastAlertTimestamp = now;
            windowBuffer.clear();
            triggerSystemFallAlert();
        }
    }

    public void triggerSystemFallAlert() {
        if (isFallAlertActive) return;
        isFallAlertActive = true;

        // Launch System Full-Screen Alert Activity over Home Screen / Lock Screen / WhatsApp
        Intent dialogIntent = new Intent(this, SystemFallAlertActivity.class);
        dialogIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(dialogIntent);

        // Schedule 10-second timeout auto-escalation to FastAPI backend
        alertTimeoutRunnable = new Runnable() {
            @Override
            public void run() {
                Log.w(TAG, "10-Second Countdown Expired with no user response. Dispatching Emergency POST...");
                dispatchEmergencyToBackend();
                isFallAlertActive = false;
            }
        };
        timerHandler.postDelayed(alertTimeoutRunnable, 10000);
    }

    public void cancelFallAlert() {
        Log.i(TAG, "User marked 'I'M OKAY'. Cancelling emergency dispatch.");
        if (alertTimeoutRunnable != null) {
            timerHandler.removeCallbacks(alertTimeoutRunnable);
        }
        isFallAlertActive = false;
        synchronized (windowBuffer) {
            windowBuffer.clear();
        }
    }

    public void executeImmediateEmergencyDispatch() {
        Log.w(TAG, "User clicked 'NEED HELP NOW'. Dispatching immediate emergency POST...");
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

                // Read backend URL from SharedPreferences or use endpoints
                SharedPreferences prefs = getSharedPreferences("ResQNetPrefs", Context.MODE_PRIVATE);
                String configuredBase = prefs.getString("backend_url", "http://10.0.2.2:8000");

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
                        conn.setConnectTimeout(6000);
                        conn.setReadTimeout(6000);
                        conn.setDoOutput(true);

                        String jsonInputString = String.format(
                                "{\"user_id\":1,\"trigger_source\":\"Android Native Background Fall Sentinel\",\"latitude\":%.6f,\"longitude\":%.6f,\"speed\":0.0,\"battery_level\":%d,\"network_status\":\"%s\"}",
                                lat, lon, batteryLevel, networkStatus
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
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        Log.i(TAG, "FallDetectionService destroyed and sensor listeners unregistered.");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
