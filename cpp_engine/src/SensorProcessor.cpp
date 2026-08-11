#include "../include/SensorProcessor.hpp"
#include <numeric>
#include <algorithm>
#include <stdexcept>

SlidingWindowBuffer::SlidingWindowBuffer(size_t cap) : capacity(cap) {}

void SlidingWindowBuffer::push(const SensorSample& sample) {
    if (window.size() >= capacity) {
        window.pop_front();
    }
    window.push_back(sample);
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
    if (window.empty()) return 0.0;
    double min_accel = get_min_accel();
    double max_accel = get_max_accel();
    return max_accel - min_accel;
}

double SlidingWindowBuffer::get_max_accel() const {
    if (window.empty()) return 0.0;
    double max_val = window[0].get_accel_magnitude();
    for (const auto& s : window) {
        double mag = s.get_accel_magnitude();
        if (mag > max_val) max_val = mag;
    }
    return max_val;
}

double SlidingWindowBuffer::get_min_accel() const {
    if (window.empty()) return 0.0;
    double min_val = window[0].get_accel_magnitude();
    for (const auto& s : window) {
        double mag = s.get_accel_magnitude();
        if (mag < min_val) min_val = mag;
    }
    return min_val;
}

double SlidingWindowBuffer::get_max_gyro() const {
    if (window.empty()) return 0.0;
    double max_val = window[0].get_gyro_magnitude();
    for (const auto& s : window) {
        double mag = s.get_gyro_magnitude();
        if (mag > max_val) max_val = mag;
    }
    return max_val;
}

SensorSample SlidingWindowBuffer::get_latest() const {
    if (window.empty()) {
        throw std::runtime_error("Buffer is empty");
    }
    return window.back();
}

std::vector<SensorSample> SlidingWindowBuffer::get_samples() const {
    return std::vector<SensorSample>(window.begin(), window.end());
}

double SensorProcessor::compute_accel_magnitude(double ax, double ay, double az) {
    return std::sqrt(ax * ax + ay * ay + az * az);
}

double SensorProcessor::compute_gyro_magnitude(double gx, double gy, double gz) {
    return std::sqrt(gx * gx + gy * gy + gz * gz);
}

SensorSample SensorProcessor::create_sample(double ax, double ay, double az, double gx, double gy, double gz, int64_t timestamp) {
    return SensorSample{ax, ay, az, gx, gy, gz, timestamp};
}
