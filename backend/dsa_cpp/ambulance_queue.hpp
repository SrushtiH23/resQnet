#ifndef AMBULANCE_QUEUE_HPP
#define AMBULANCE_QUEUE_HPP

#include <vector>
#include <string>
#include <queue>
#include <cstdint>

struct EmergencyIncident {
    int incident_id;
    int patient_id;
    double confidence_score; // 0.0 - 100.0%
    std::string severity;    // "CRITICAL", "HIGH", "MEDIUM"
    double latitude;
    double longitude;
    int64_t timestamp;

    // Max-heap operator: higher confidence score has higher priority
    bool operator<(const EmergencyIncident& other) const {
        return confidence_score < other.confidence_score;
    }
};

class PriorityAmbulanceQueue {
private:
    std::priority_queue<EmergencyIncident> pqueue;

public:
    PriorityAmbulanceQueue() = default;

    void push_incident(const EmergencyIncident& incident);
    EmergencyIncident pop_highest_priority();
    EmergencyIncident peek_highest_priority() const;

    bool empty() const;
    size_t size() const;
    void clear();
};

#endif // AMBULANCE_QUEUE_HPP
