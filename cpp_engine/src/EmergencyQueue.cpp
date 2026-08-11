#include "../include/EmergencyQueue.hpp"
#include <stdexcept>

void EmergencyPriorityQueue::add_emergency(int emergency_id, double confidence_score, double eta_minutes, int64_t timestamp, const std::string& details) {
    std::string severity;
    if (confidence_score >= 80.0) severity = "CRITICAL";
    else if (confidence_score >= 60.0) severity = "HIGH";
    else if (confidence_score >= 30.0) severity = "MEDIUM";
    else severity = "LOW";

    EmergencyItem item{
        emergency_id,
        confidence_score,
        eta_minutes,
        timestamp,
        severity,
        details
    };
    pq.push(item);
}

EmergencyItem EmergencyPriorityQueue::get_next_emergency() {
    if (pq.empty()) {
        throw std::runtime_error("Emergency queue is empty");
    }
    EmergencyItem top_item = pq.top();
    pq.pop();
    return top_item;
}

bool EmergencyPriorityQueue::empty() const {
    return pq.empty();
}

size_t EmergencyPriorityQueue::size() const {
    return pq.size();
}

void EmergencyPriorityQueue::clear() {
    while (!pq.empty()) {
        pq.pop();
    }
}
