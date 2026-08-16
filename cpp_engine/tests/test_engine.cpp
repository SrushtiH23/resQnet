#include <iostream>
#include <cassert>
#include <cmath>
#include "../include/SensorProcessor.hpp"
#include "../include/FallDetector.hpp"
#include "../include/ConfidenceEngine.hpp"
#include "../include/EmergencyQueue.hpp"
#include "../include/RoutingEngine.hpp"

void test_sliding_window() {
    std::cout << "[Test 1] Testing SlidingWindowBuffer..." << std::endl;
    SlidingWindowBuffer buf(5);
    for (int i = 1; i <= 10; ++i) {
        buf.push(SensorSample{static_cast<double>(i), 0.0, 0.0, 0.0, 0.0, 0.0, i});
    }
    assert(buf.size() == 5);
    assert(buf.get_max_accel() == 10.0);
    assert(buf.get_min_accel() == 6.0);
    assert(buf.get_accel_variance() == 4.0);
    std::cout << "  ✓ SlidingWindowBuffer test passed!" << std::endl;
}

void test_fall_detection() {
    std::cout << "[Test 2] Testing FallDetector State Machine..." << std::endl;
    FallDetector detector;
    std::vector<SensorSample> samples;

    // Normal samples
    for (int i = 0; i < 5; ++i) {
        samples.push_back(SensorSample{0.0, 9.8, 0.0, 0.0, 0.0, 0.0, i});
    }
    auto res_normal = detector.evaluate_window(samples);
    assert(!res_normal.is_fall);

    // Free fall + Impact + Rotation + Stillness
    samples.clear();
    samples.push_back(SensorSample{0.1, 0.1, 0.1, 10.0, 10.0, 10.0, 1}); // Free fall
    samples.push_back(SensorSample{15.0, 20.0, 15.0, 200.0, 50.0, 50.0, 2}); // Impact & Rotation
    samples.push_back(SensorSample{0.0, 9.8, 0.1, 2.0, 1.0, 1.0, 3}); // Stillness
    samples.push_back(SensorSample{0.0, 9.8, 0.0, 1.0, 1.0, 1.0, 4}); // Stillness

    auto res_fall = detector.evaluate_window(samples);
    assert(res_fall.is_fall);
    assert(res_fall.free_fall);
    assert(res_fall.impact);
    assert(res_fall.rotation);
    std::cout << "  ✓ FallDetector state machine test passed!" << std::endl;
}

void test_confidence_engine() {
    std::cout << "[Test 3] Testing ConfidenceEngine..." << std::endl;
    ConfidenceRequestInput input;
    input.accelerometer = true;
    input.gyroscope = true;
    input.stillness = true;
    input.gps = true;

    auto res = ConfidenceEngine::calculate_score(input);
    assert(res.confidence_score >= 70.0);
    assert(res.severity == "HIGH" || res.severity == "CRITICAL");
    assert(res.fall_detected);
    std::cout << "  ✓ ConfidenceEngine test passed! Score: " << res.confidence_score << "%" << std::endl;
}

void test_priority_queue() {
    std::cout << "[Test 4] Testing EmergencyPriorityQueue..." << std::endl;
    EmergencyPriorityQueue pq;
    pq.add_emergency(101, 45.0, 10.0, 1000, "Medium Emergency");
    pq.add_emergency(102, 95.0, 5.0, 1001, "Critical Emergency");
    pq.add_emergency(103, 65.0, 8.0, 1002, "High Emergency");

    assert(pq.size() == 3);
    auto first = pq.get_next_emergency();
    assert(first.emergency_id == 102); // Critical score 95% first
    assert(first.severity == "CRITICAL");

    auto second = pq.get_next_emergency();
    assert(second.emergency_id == 103); // High score 65% second
    std::cout << "  ✓ EmergencyPriorityQueue test passed!" << std::endl;
}

void test_dijkstra_and_astar() {
    std::cout << "[Test 5] Testing Dijkstra and A* RoutingEngine..." << std::endl;
    RoutingEngine router;

    std::vector<HospitalData> hospitals = {
        {1, "City ER Hospital", 37.7749, -122.4194, "+919876543220", "100 ER Street", 12, "Trauma, ICU"},
        {2, "Metro General", 37.7833, -122.4167, "+919876543221", "200 Metro Ave", 0, "Emergency"}
    };

    double user_lat = 37.7700;
    double user_lon = -122.4200;

    auto dijkstra_results = router.dijkstra_routing(user_lat, user_lon, hospitals);
    assert(!dijkstra_results.empty());
    assert(dijkstra_results[0].hospital_id == 1); // City ER has beds and shortest ETA

    auto astar_result = router.a_star_routing(user_lat, user_lon, hospitals[0]);
    assert(astar_result.hospital_id == 1);
    assert(astar_result.algorithm == "A*");
    assert(astar_result.distance_km > 0.0);
    std::cout << "  ✓ Dijkstra and A* Routing tests passed! Distance: " << astar_result.distance_km << " km" << std::endl;
}

int main() {
    std::cout << "==========================================" << std::endl;
    std::cout << "   ResQNet C++ Engine Test Suite Runner   " << std::endl;
    std::cout << "==========================================" << std::endl;
    try {
        test_sliding_window();
        test_fall_detection();
        test_confidence_engine();
        test_priority_queue();
        test_dijkstra_and_astar();
        std::cout << "==========================================" << std::endl;
        std::cout << "   ALL C++ ENGINE UNIT TESTS PASSED!      " << std::endl;
        std::cout << "==========================================" << std::endl;
        return 0;
    } catch (const std::exception& ex) {
        std::cerr << "TEST FAILED WITH EXCEPTION: " << ex.what() << std::endl;
        return 1;
    }
}
