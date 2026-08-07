#include "sliding_window.hpp"
#include <numeric>
#include <algorithm>
#include <stdexcept>

SlidingWindowBuffer::SlidingWindowBuffer(size_t cap) : capacity(cap) {}

void SlidingWindowBuffer::push(const SensorSample& sample) {
    if (window.size() >= capacity) {
        window.pop_front(); // O(1) eviction of oldest sample
    }
    window.push_back(sample); // O(1) push of newest sample
}

void SlidingWindowBuffer::clear() {
    window.clear();
}

size_t SlidingWindowBuffer::size() const {
    return window.size();
}

size_t SlidingWindowBuffer::get_capacity() const {
    return capacity;
}

double SlidingWindowBuffer::get_mean_accel() const {
    if (window.empty()) return 0.0;
    double sum = 0.0;
    for (const auto& s : window) {
        sum += s.get_accel_magnitude();
    }
    return sum / window.size();
}

double SlidingWindowBuffer::get_accel_variance() const {
    if (window.size() < 2) return 0.0;
    double mean = get_mean_accel();
    double sum_sq_diff = 0.0;
    for (const auto& s : window) {
        double diff = s.get_accel_magnitude() - mean;
        sum_sq_diff += diff * diff;
    }
    return sum_sq_diff / window.size();
}

double SlidingWindowBuffer::get_max_accel() const {
    if (window.empty()) return 0.0;
    double max_v = 0.0;
    for (const auto& s : window) {
        max_v = std::max(max_v, s.get_accel_magnitude());
    }
    return max_v;
}

double SlidingWindowBuffer::get_min_accel() const {
    if (window.empty()) return 0.0;
    double min_v = 1e9;
    for (const auto& s : window) {
        min_v = std::min(min_v, s.get_accel_magnitude());
    }
    return min_v;
}

double SlidingWindowBuffer::get_max_gyro() const {
    if (window.empty()) return 0.0;
    double max_g = 0.0;
    for (const auto& s : window) {
        max_g = std::max(max_g, s.get_gyro_magnitude());
    }
    return max_g;
}

SensorSample SlidingWindowBuffer::get_latest() const {
    if (window.empty()) {
        return {0.0, 9.81, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0, 0};
    }
    return window.back();
}

std::vector<SensorSample> SlidingWindowBuffer::get_samples() const {
    return std::vector<SensorSample>(window.begin(), window.end());
}
