#ifndef CONFIDENCE_ENGINE_HPP
#define CONFIDENCE_ENGINE_HPP

#include <string>
#include <map>

struct ConfidenceRequestInput {
    bool accelerometer = false;
    bool gyroscope = false;
    bool stillness = false;
    bool gps = false;
    double chatbot = 0.0;
    bool user_response = false;
    bool qr_confirmation = false;
    bool sensor_consistency = true;
};

struct ConfidenceResult {
    double confidence_score;
    std::string severity;
    bool fall_detected;
    std::string recommended_action;
    std::string recommended_status;
    std::map<std::string, double> weight_breakdown;
    std::string scoring_explanation;
    std::string reason;
};

class ConfidenceEngine {
private:
    static std::map<std::string, double> default_weights;

public:
    static ConfidenceResult calculate_score(
        const ConfidenceRequestInput& input,
        const std::map<std::string, double>& custom_weights = {}
    );
};

#endif // CONFIDENCE_ENGINE_HPP
