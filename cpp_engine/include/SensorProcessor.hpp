#ifndef SENSOR_PROCESSOR_HPP
#define SENSOR_PROCESSOR_HPP

#include <vector>
#include <deque>
#include <cmath>
#include <cstdint>

struct SensorSample {
    double ax, ay, az;
    double gx, gy, gz;
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

class SensorProcessor {
public:
    static double compute_accel_magnitude(double ax, double ay, double az);
    static double compute_gyro_magnitude(double gx, double gy, double gz);
    static SensorSample create_sample(double ax, double ay, double az, double gx, double gy, double gz, int64_t timestamp = 0);
};

#endif // SENSOR_PROCESSOR_HPP
