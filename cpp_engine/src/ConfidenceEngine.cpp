#include "../include/ConfidenceEngine.hpp"
#include <algorithm>
#include <sstream>
#include <iomanip>

std::map<std::string, double> ConfidenceEngine::default_weights = {
    {"accelerometer", 25.0},
    {"gyroscope", 15.0},
    {"stillness", 20.0},
    {"gps", 10.0},
    {"chatbot", 20.0},
    {"user_response", 40.0},
    {"qr_confirmation", 25.0},
    {"sensor_consistency", 10.0}
};

ConfidenceResult ConfidenceEngine::calculate_score(
    const ConfidenceRequestInput& input,
    const std::map<std::string, double>& custom_weights
) {
    std::map<std::string, double> weights = default_weights;
    for (const auto& kv : custom_weights) {
        weights[kv.first] = kv.second;
    }

    double score = 0.0;
    std::map<std::string, double> breakdown;
    std::vector<std::string> explanations;

    if (input.accelerometer) {
        double w = weights["accelerometer"];
        score += w;
        breakdown["Accelerometer (Impact/Freefall)"] = w;
        explanations.push_back("• Accelerometer: +" + std::to_string(w) + "% (High impact force / free fall vector detected)");
    }

    if (input.gyroscope) {
        double w = weights["gyroscope"];
        score += w;
        breakdown["Gyroscope (Body Rotation)"] = w;
        explanations.push_back("• Gyroscope: +" + std::to_string(w) + "% (Rapid angular body rotation > 180°/s)");
    }

    if (input.stillness) {
        double w = weights["stillness"];
        score += w;
        breakdown["Stillness (Post-Impact)"] = w;
        explanations.push_back("• Stillness: +" + std::to_string(w) + "% (Post-impact variance < 1.5 m/s², patient unmoving)");
    }

    if (input.gps) {
        double w = weights["gps"];
        score += w;
        breakdown["GPS (Location Verification)"] = w;
        explanations.push_back("• GPS: +" + std::to_string(w) + "% (Geospatial coordinates locked & verified)");
    }

    if (input.chatbot > 0.0) {
        double max_cb = weights["chatbot"];
        double contrib = std::min(input.chatbot, max_cb);
        score += contrib;
        breakdown["Chatbot (AI Symptom Triage)"] = contrib;
        explanations.push_back("• Chatbot: +" + std::to_string(contrib) + "% (Symptom triage identified high-risk indicators)");
    }

    if (input.user_response) {
        double w = weights["user_response"];
        score += w;
        breakdown["User Response (SOS / Need Help)"] = w;
        explanations.push_back("• User Response: +" + std::to_string(w) + "% (Manual SOS pressed or 'Need Help' confirmed)");
    }

    if (input.qr_confirmation) {
        double w = weights["qr_confirmation"];
        score += w;
        breakdown["QR Confirmation (Doctor / Scan)"] = w;
        explanations.push_back("• QR Confirmation: +" + std::to_string(w) + "% (Doctor / Bystander verified via encrypted QR scan)");
    }

    if (input.sensor_consistency) {
        double w = weights["sensor_consistency"];
        score += w;
        breakdown["Sensor Consistency"] = w;
        explanations.push_back("• Sensor Consistency: +" + std::to_string(w) + "% (Cross-validated accel + gyro telemetry)");
    }

    double total_score = std::min(score, 100.0);

    std::string severity;
    std::string recommended_action;
    std::string recommended_status;
    std::string action_desc;

    if (total_score >= 80.0) {
        severity = "CRITICAL";
        recommended_action = "DISPATCH_AMBULANCE_IMMEDIATELY";
        recommended_status = "Hospital Dispatched";
        action_desc = "Confidence >= 80%: Auto-assign nearest ER hospital via Dijkstra routing & allocate priority ambulance.";
    } else if (total_score >= 60.0) {
        severity = "HIGH";
        recommended_action = "ESCALATE_TO_FAMILY_QUEUE";
        recommended_status = "Family Notified";
        action_desc = "Confidence 60-79%: Trigger sequential family contact escalation queue.";
    } else if (total_score >= 30.0) {
        severity = "MEDIUM";
        recommended_action = "TRIGGER_30S_USER_CHECKOUT_POPUP";
        recommended_status = "Asking User";
        action_desc = "Confidence 30-59%: Display 30-second 'Possible Fall Detected' checkout popup.";
    } else {
        severity = "LOW";
        recommended_action = "STANDBY_MONITORING";
        recommended_status = "Standby";
        action_desc = "Confidence < 30%: Maintain active background monitoring.";
    }

    std::ostringstream ss;
    ss << "Emergency Confidence Score: " << std::fixed << std::setprecision(1) << total_score << "% | Severity: " << severity << " | Action: " << recommended_action << "\n\nEvidence Breakdown:\n";
    if (explanations.empty()) {
        ss << "• No active emergency evidence factors detected.\n";
    } else {
        for (const auto& exp : explanations) {
            ss << exp << "\n";
        }
    }
    ss << "\nDecision Rationale:\n" << action_desc;

    bool fall_detected = (total_score >= 40.0) || (input.accelerometer && input.gyroscope);

    return ConfidenceResult{
        total_score,
        severity,
        fall_detected,
        recommended_action,
        recommended_status,
        breakdown,
        ss.str(),
        action_desc
    };
}
