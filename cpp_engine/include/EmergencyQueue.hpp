#ifndef EMERGENCY_QUEUE_HPP
#define EMERGENCY_QUEUE_HPP

#include <string>
#include <vector>
#include <queue>
#include <cstdint>

struct EmergencyItem {
    int emergency_id;
    double confidence_score;
    double eta_minutes;
    int64_t timestamp;
    std::string severity;
    std::string details;

    int get_severity_rank() const {
        if (severity == "CRITICAL" || severity == "Critical") return 1;
        if (severity == "HIGH" || severity == "High") return 2;
        if (severity == "MEDIUM" || severity == "Medium") return 3;
        return 4;
    }

    // Comparison for std::priority_queue (max-priority / min-rank first)
    bool operator<(const EmergencyItem& other) const {
        if (get_severity_rank() != other.get_severity_rank()) {
            return get_severity_rank() > other.get_severity_rank(); // lower rank number = higher priority
        }
        if (std::abs(confidence_score - other.confidence_score) > 0.01) {
            return confidence_score < other.confidence_score; // higher confidence = higher priority
        }
        return timestamp > other.timestamp; // earlier timestamp = higher priority
    }
};

class EmergencyPriorityQueue {
private:
    std::priority_queue<EmergencyItem> pq;

public:
    EmergencyPriorityQueue() = default;

    void add_emergency(int emergency_id, double confidence_score, double eta_minutes, int64_t timestamp = 0, const std::string& details = "");
    EmergencyItem get_next_emergency();
    bool empty() const;
    size_t size() const;
    void clear();
};

#endif // EMERGENCY_QUEUE_HPP
