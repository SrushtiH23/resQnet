#include "../include/FallDetector.hpp"
#include <algorithm>
#include <sstream>
#include <iomanip>

std::string fall_state_to_string(FallState state) {
    switch (state) {
        case FallState::NORMAL: return "NORMAL";
        case FallState::FREE_FALL: return "FREE_FALL";
        case FallState::IMPACT: return "IMPACT";
        case FallState::ROTATION_CHANGE: return "ROTATION_CHANGE";
        case FallState::STILLNESS: return "STILLNESS";
        case FallState::VERIFY: return "VERIFY";
        case FallState::FALL_CONFIRMED: return "FALL_CONFIRMED";
        case FallState::RESOLVED: return "RESOLVED";
        default: return "UNKNOWN";
    }
}

FallDetector::FallDetector() : current_state(FallState::NORMAL), state_entry_timestamp(0) {}

void FallDetector::reset() {
    current_state = FallState::NORMAL;
    state_entry_timestamp = 0;
}

FallState FallDetector::get_current_state() const {
    return current_state;
}

FallDetectionResult FallDetector::evaluate_window(const std::vector<SensorSample>& samples) {
    if (samples.empty()) {
        return FallDetectionResult{
            false,
            FallState::NORMAL,
            "NORMAL",
            false, false, false, false, false,
            0.0,
            "Insufficient sensor samples"
        };
    }

    double min_accel = samples[0].get_accel_magnitude();
    double max_accel = samples[0].get_accel_magnitude();
    double max_gyro = samples[0].get_gyro_magnitude();

    for (const auto& s : samples) {
        double amag = s.get_accel_magnitude();
        double gmag = s.get_gyro_magnitude();
        if (amag < min_accel) min_accel = amag;
        if (amag > max_accel) max_accel = amag;
        if (gmag > max_gyro) max_gyro = gmag;
    }

    size_t tail_count = std::max(static_cast<size_t>(3), static_cast<size_t>(samples.size() * 0.3));
    double tail_min = samples[samples.size() - tail_count].get_accel_magnitude();
    double tail_max = samples[samples.size() - tail_count].get_accel_magnitude();

    for (size_t i = samples.size() - tail_count; i < samples.size(); ++i) {
        double mag = samples[i].get_accel_magnitude();
        if (mag < tail_min) tail_min = mag;
        if (mag > tail_max) tail_max = mag;
    }
    double accel_variance = tail_max - tail_min;

    bool has_free_fall = min_accel < FREEFALL_THRESHOLD;
    bool has_impact = max_accel > IMPACT_THRESHOLD;
    bool has_rotation = max_gyro > ROTATION_THRESHOLD;
    bool has_stillness = accel_variance < STILLNESS_VARIANCE;
    bool has_recovered = accel_variance > RECOVERY_VARIANCE && max_accel > IMPACT_THRESHOLD;

    FallState state = FallState::NORMAL;
    double confidence_boost = 0.0;

    if (has_recovered) {
        state = FallState::RESOLVED;
        current_state = state;
        return FallDetectionResult{
            false,
            state,
            fall_state_to_string(state),
            has_free_fall, has_impact, has_rotation, false, true,
            0.0,
            "Patient movement detected post-impact. Emergency automatically resolved."
        };
    }

    // State transition logic combining multi-threshold accelerometer & gyroscope
    if (has_free_fall && has_impact && has_rotation && has_stillness) {
        state = FallState::FALL_CONFIRMED;
        confidence_boost = 85.0;
    } else if (has_free_fall && has_impact && has_rotation) {
        state = FallState::VERIFY;
        confidence_boost = 65.0;
    } else if (has_free_fall && has_impact) {
        state = FallState::IMPACT;
        confidence_boost = 50.0;
    } else if (has_free_fall) {
        state = FallState::FREE_FALL;
        confidence_boost = 25.0;
    } else if (has_impact) {
        state = FallState::ROTATION_CHANGE;
        confidence_boost = 25.0;
    }

    current_state = state;
    bool is_fall = confidence_boost >= 40.0;

    std::ostringstream ss;
    ss << "Min Accel: " << std::fixed << std::setprecision(1) << min_accel << " m/s², "
       << "Max Accel: " << max_accel << " m/s², "
       << "Max Gyro: " << max_gyro << " °/s";

    return FallDetectionResult{
        is_fall,
        state,
        fall_state_to_string(state),
        has_free_fall,
        has_impact,
        has_rotation,
        has_stillness,
        false,
        confidence_boost,
        ss.str()
    };
}

FallState FallDetector::process_single_frame(const SensorSample& sample, const SlidingWindowBuffer& buffer) {
    auto samples = buffer.get_samples();
    samples.push_back(sample);
    auto res = evaluate_window(samples);
    return res.state;
}
