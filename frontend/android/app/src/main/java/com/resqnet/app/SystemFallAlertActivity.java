package com.resqnet.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class SystemFallAlertActivity extends Activity {

    private CountDownTimer timer;
    private TextView textCountdown;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Turn screen on and display over Lock Screen or background apps
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            );
        }

        // Build System Alert Layout Programmatically
        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setGravity(Gravity.CENTER);
        container.setBackgroundColor(Color.parseColor("#090D16"));
        container.setPadding(60, 80, 60, 80);

        TextView titleText = new TextView(this);
        titleText.setText("🚨 FALL DETECTED!");
        titleText.setTextColor(Color.parseColor("#FF2A55"));
        titleText.setTextSize(32);
        titleText.setTypeface(null, Typeface.BOLD);
        titleText.setGravity(Gravity.CENTER);

        TextView subTitle = new TextView(this);
        subTitle.setText("ARE YOU OKAY?");
        subTitle.setTextColor(Color.WHITE);
        subTitle.setTextSize(24);
        subTitle.setTypeface(null, Typeface.BOLD);
        subTitle.setGravity(Gravity.CENTER);
        subTitle.setPadding(0, 20, 0, 30);

        textCountdown = new TextView(this);
        textCountdown.setText("10s");
        textCountdown.setTextColor(Color.parseColor("#38BDF8"));
        textCountdown.setTextSize(54);
        textCountdown.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        textCountdown.setGravity(Gravity.CENTER);
        textCountdown.setPadding(0, 20, 0, 40);

        TextView descText = new TextView(this);
        descText.setText("ResQNet background Android sentinel detected a high-impact fall sequence. Emergency contacts will be notified automatically.");
        descText.setTextColor(Color.parseColor("#94A3B8"));
        descText.setTextSize(14);
        descText.setGravity(Gravity.CENTER);
        descText.setPadding(0, 0, 0, 50);

        // Action Button 1: I'M OKAY
        Button btnOkay = new Button(this);
        btnOkay.setText("I'M OKAY (CANCEL ALERT)");
        btnOkay.setBackgroundColor(Color.parseColor("#059669"));
        btnOkay.setTextColor(Color.WHITE);
        btnOkay.setTextSize(16);
        btnOkay.setTypeface(null, Typeface.BOLD);
        btnOkay.setPadding(20, 30, 20, 30);

        LinearLayout.LayoutParams btnParams1 = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        btnParams1.setMargins(0, 0, 0, 30);
        btnOkay.setLayoutParams(btnParams1);

        btnOkay.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                cancelTimer();
                Intent cancelIntent = new Intent(SystemFallAlertActivity.this, FallDetectionService.class);
                cancelIntent.setAction("CANCEL_ALERT");
                startService(cancelIntent);
                finish();
            }
        });

        // Action Button 2: NEED HELP NOW
        Button btnSos = new Button(this);
        btnSos.setText("NEED HELP NOW (SEND SOS)");
        btnSos.setBackgroundColor(Color.parseColor("#E11D48"));
        btnSos.setTextColor(Color.WHITE);
        btnSos.setTextSize(16);
        btnSos.setTypeface(null, Typeface.BOLD);
        btnSos.setPadding(20, 30, 20, 30);

        btnSos.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                cancelTimer();
                Intent sosIntent = new Intent(SystemFallAlertActivity.this, FallDetectionService.class);
                sosIntent.setAction("DISPATCH_SOS");
                startService(sosIntent);
                finish();
            }
        });

        container.addView(titleText);
        container.addView(subTitle);
        container.addView(textCountdown);
        container.addView(descText);
        container.addView(btnOkay);
        container.addView(btnSos);

        setContentView(container);

        start10SecondTimer();
    }

    private void start10SecondTimer() {
        timer = new CountDownTimer(10000, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                textCountdown.setText((millisUntilFinished / 1000) + "s");
            }

            @Override
            public void onFinish() {
                textCountdown.setText("0s");
                finish();
            }
        }.start();
    }

    private void cancelTimer() {
        if (timer != null) {
            timer.cancel();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        cancelTimer();
    }
}
