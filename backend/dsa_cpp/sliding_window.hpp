#ifndef SLIDING_WINDOW_HPP
#define SLIDING_WINDOW_HPP

#include <vector>
#include <deque>
#include <cmath>
#include <chrono>

struct SensorSample {
    double ax, ay, az;
    double gx, gy, gz;
    double alpha, beta, gamma;
    int64_t timestamp;

    double get_accel_magnitude() const {
        return std::sqrt(ax * ax + ay * ay + az * az);
    }

    double get_gyro_magnitude() const {
        return std::sqrt(gx * gx + gy * gy + gz * gz);
    }
};

class SlidingWindowBuffer {
private:
    size_t capacity;
    std::deque<SensorSample> window;

public:
    explicit SlidingWindowBuffer(size_t cap = 100);

    void push(const SensorSample& sample);
    void clear();

    size_t size() const;
    size_t get_capacity() const;

    double get_mean_accel() const;
    double get_accel_variance() const;
    double get_max_accel() const;
    double get_min_accel() const;
    double get_max_gyro() const;

    SensorSample get_latest() const;
    std::vector<SensorSample> get_samples() const;
};

#endif // SLIDING_WINDOW_HPP
