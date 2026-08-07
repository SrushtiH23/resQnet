#include "state_machine.hpp"

std::string fall_stage_to_string(FallStage stage) {
    switch (stage) {
        case FallStage::NORMAL: return "NORMAL";
        case FallStage::FREE_FALL: return "FREE_FALL";
        case FallStage::IMPACT: return "IMPACT";
        case FallStage::ROTATION: return "ROTATION";
        case FallStage::STILLNESS: return "STILLNESS";
        case FallStage::CONFIDENCE_ESCALATION: return "CONFIDENCE_ESCALATION";
        case FallStage::MOVEMENT_RECOVERY: return "MOVEMENT_RECOVERY";
        default: return "UNKNOWN";
    }
}

FallDetectionStateMachine::FallDetectionStateMachine()
    : current_stage(FallStage::NORMAL), stage_start_time(0) {}

void FallDetectionStateMachine::reset() {
    current_stage = FallStage::NORMAL;
    stage_start_time = 0;
}

FallStage FallDetectionStateMachine::get_current_stage() const {
    return current_stage;
}

FallStage FallDetectionStateMachine::process_frame(const SensorSample& sample, const SlidingWindowBuffer& buffer) {
    double accel = sample.get_accel_magnitude();
    double gyro = sample.get_gyro_magnitude();
    double variance = buffer.get_accel_variance();

    switch (current_stage) {
        case FallStage::NORMAL:
            if (accel < FREEFALL_THRESHOLD) {
                current_stage = FallStage::FREE_FALL;
                stage_start_time = sample.timestamp;
            }
            break;

        case FallStage::FREE_FALL:
            if (accel > IMPACT_THRESHOLD) {
                current_stage = FallStage::IMPACT;
                stage_start_time = sample.timestamp;
            } else if (accel >= FREEFALL_THRESHOLD && (sample.timestamp - stage_start_time) > 1500) {
                // Timeout freefall -> return to normal
                current_stage = FallStage::NORMAL;
            }
            break;

        case FallStage::IMPACT:
            if (gyro > ROTATION_THRESHOLD) {
                current_stage = FallStage::ROTATION;
                stage_start_time = sample.timestamp;
            } else {
                current_stage = FallStage::STILLNESS;
                stage_start_time = sample.timestamp;
            }
            break;

        case FallStage::ROTATION:
            if (variance < STILLNESS_VARIANCE) {
                current_stage = FallStage::STILLNESS;
                stage_start_time = sample.timestamp;
            }
            break;

        case FallStage::STILLNESS:
            if (variance < STILLNESS_VARIANCE) {
                current_stage = FallStage::CONFIDENCE_ESCALATION;
            } else if (variance > 4.0) {
                current_stage = FallStage::MOVEMENT_RECOVERY;
            }
            break;

        case FallStage::CONFIDENCE_ESCALATION:
            if (variance > 4.0) {
                current_stage = FallStage::MOVEMENT_RECOVERY;
            }
            break;

        case FallStage::MOVEMENT_RECOVERY:
            current_stage = FallStage::NORMAL;
            break;
    }

    return current_stage;
}
