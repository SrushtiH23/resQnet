#ifndef FALL_DETECTOR_HPP
#define FALL_DETECTOR_HPP

#include "SensorProcessor.hpp"
#include <string>
#include <vector>

enum class FallState {
    NORMAL,
    FREE_FALL,
    IMPACT,
    ROTATION_CHANGE,
    STILLNESS,
    VERIFY,
    FALL_CONFIRMED,
    RESOLVED
};

std::string fall_state_to_string(FallState state);

struct FallDetectionResult {
    bool is_fall;
    FallState state;
    std::string state_name;
    bool free_fall;
    bool impact;
    bool rotation;
    bool stillness;
    bool recovered;
    double confidence_boost;
    std::string details;
};

class FallDetector {
private:
    FallState current_state;
    int64_t state_entry_timestamp;

    static constexpr double FREEFALL_THRESHOLD = 3.0;   // m/s²
    static constexpr double IMPACT_THRESHOLD = 24.0;     // m/s²
    static constexpr double ROTATION_THRESHOLD = 180.0;  // °/s
    static constexpr double STILLNESS_VARIANCE = 1.5;   // m/s²
    static constexpr double RECOVERY_VARIANCE = 5.0;    // m/s²

public:
    FallDetector();

    FallDetectionResult evaluate_window(const std::vector<SensorSample>& samples);
    FallState process_single_frame(const SensorSample& sample, const SlidingWindowBuffer& buffer);

    FallState get_current_state() const;
    void reset();
};

#endif // FALL_DETECTOR_HPP
