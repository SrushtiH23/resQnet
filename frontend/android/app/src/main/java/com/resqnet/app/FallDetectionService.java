package com.resqnet.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import androidx.core.app.NotificationCompat;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class FallDetectionService extends Service implements SensorEventListener {
    private static final String TAG = "FallDetectionService";
    private static final String CHANNEL_ID = "resqnet_fall_service";

    private SensorManager sensorManager;
    private Sensor accelSensor;
    private Sensor gyroSensor;

    // State machine threshold flags
    private boolean isFreeFall = false;
    private long freeFallTimestamp = 0;
    private boolean isFallAlertActive = false;

    private Handler timerHandler = new Handler(Looper.getMainLooper());
    private Runnable alertTimeoutRunnable;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Starting Native Android 24/7 Fall Detection Service...");
        createNotificationChannel();
        startForegroundServiceNotification();

        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            accelSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
            gyroSensor = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE);

            if (accelSensor != null) {
                sensorManager.registerListener(this, accelSensor, SensorManager.SENSOR_DELAY_GAME);
            }
            if (gyroSensor != null) {
                sensorManager.registerListener(this, gyroSensor, SensorManager.SENSOR_DELAY_GAME);
            }
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

        if (event.sensor.getType() == Sensor.TYPE_ACCELEROMETER) {
            float ax = event.values[0];
            float ay = event.values[1];
            float az = event.values[2];

            double totalAccel = Math.sqrt(ax * ax + ay * ay + az * az);

            // Stage 1: Free Fall Detection (< 3.0 m/s²)
            if (totalAccel < 3.0) {
                isFreeFall = true;
                freeFallTimestamp = System.currentTimeMillis();
            }

            // Stage 2: High Impact Detection (> 24.0 m/s²) within 1.2s of Free Fall
            if (isFreeFall && (System.currentTimeMillis() - freeFallTimestamp < 1200)) {
                if (totalAccel > 24.0) {
                    Log.w(TAG, "🚨 CRITICAL FALL DETECTED BY NATIVE SENSOR SERVICE! Total Accel: " + totalAccel);
                    isFreeFall = false;
                    triggerSystemFallAlert();
                }
            }
        }
    }

    public void triggerSystemFallAlert() {
        if (isFallAlertActive) return;
        isFallAlertActive = true;

        // Launch System Full-Screen Alert Activity over Home Screen / WhatsApp / Lock Screen
        Intent dialogIntent = new Intent(this, SystemFallAlertActivity.class);
        dialogIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(dialogIntent);

        // Schedule 10-second timeout auto-escalation to FastAPI backend
        alertTimeoutRunnable = new Runnable() {
            @Override
            public void run() {
                Log.w(TAG, "10-Second Countdown Expired with no user cancel response. Dispatching Emergency POST...");
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
                try {
                    URL url = new URL("http://10.0.2.2:8000/api/emergency/create"); // localhost emulator bridge
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json; utf-8");
                    conn.setRequestProperty("Accept", "application/json");
                    conn.setDoOutput(true);

                    String jsonInputString = "{"
                            + "\"trigger_source\": \"Android Native Background Fall Service\","
                            + "\"latitude\": 37.7749,"
                            + "\"longitude\": -122.4194,"
                            + "\"speed\": 0.0,"
                            + "\"battery_level\": 95,"
                            + "\"network_status\": \"5G\""
                            + "}";

                    try (OutputStream os = conn.getOutputStream()) {
                        byte[] input = jsonInputString.getBytes("utf-8");
                        os.write(input, 0, input.length);
                    }

                    int code = conn.getResponseCode();
                    Log.i(TAG, "Emergency dispatch response HTTP Code: " + code);
                    conn.disconnect();
                } catch (Exception e) {
                    Log.e(TAG, "Emergency dispatch HTTP error:", e);
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
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
