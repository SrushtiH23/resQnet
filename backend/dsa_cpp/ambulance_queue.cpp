#include "ambulance_queue.hpp"
#include <stdexcept>

void PriorityAmbulanceQueue::push_incident(const EmergencyIncident& incident) {
    pqueue.push(incident); // O(log N) insert into Max-Heap
}

EmergencyIncident PriorityAmbulanceQueue::pop_highest_priority() {
    if (pqueue.empty()) {
        throw std::runtime_error("Priority queue is empty");
    }
    EmergencyIncident top = pqueue.top();
    pqueue.pop(); // O(log N) pop from Max-Heap
    return top;
}

EmergencyIncident PriorityAmbulanceQueue::peek_highest_priority() const {
    if (pqueue.empty()) {
        throw std::runtime_error("Priority queue is empty");
    }
    return pqueue.top(); // O(1) peek
}

bool PriorityAmbulanceQueue::empty() const {
    return pqueue.empty();
}

size_t PriorityAmbulanceQueue::size() const {
    return pqueue.size();
}

void PriorityAmbulanceQueue::clear() {
    while (!pqueue.empty()) {
        pqueue.pop();
    }
}
