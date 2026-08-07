#ifndef STATE_MACHINE_HPP
#define STATE_MACHINE_HPP

#include "sliding_window.hpp"
#include <string>

enum class FallStage {
    NORMAL,
    FREE_FALL,
    IMPACT,
    ROTATION,
    STILLNESS,
    CONFIDENCE_ESCALATION,
    MOVEMENT_RECOVERY
};

std::string fall_stage_to_string(FallStage stage);

class FallDetectionStateMachine {
private:
    FallStage current_stage;
    int64_t stage_start_time;

    // Motion Threshold Constants
    static constexpr double FREEFALL_THRESHOLD = 3.0; // m/s^2
    static constexpr double IMPACT_THRESHOLD = 24.0;   // m/s^2
    static constexpr double ROTATION_THRESHOLD = 180.0; // deg/s
    static constexpr double STILLNESS_VARIANCE = 1.5;  // m/s^2

public:
    FallDetectionStateMachine();

    FallStage process_frame(const SensorSample& sample, const SlidingWindowBuffer& buffer);
    FallStage get_current_stage() const;
    void reset();
};

#endif // STATE_MACHINE_HPP
