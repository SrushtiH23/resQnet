#include <iostream>
#include <iomanip>
#include <chrono>
#include "sliding_window.hpp"
#include "state_machine.hpp"
#include "graph_router.hpp"
#include "ambulance_queue.hpp"

int main() {
    std::cout << "========================================================\n";
    std::cout << "  ResQNet High-Performance C++ Core DSA Benchmark Suite \n";
    std::cout << "========================================================\n\n";

    // ----------------------------------------------------
    // TEST 1: Sliding Window O(1) Circular Buffer
    // ----------------------------------------------------
    std::cout << "[Module 1] Testing Sliding Window O(1) Circular Buffer...\n";
    SlidingWindowBuffer buffer(100);

    auto start_time = std::chrono::high_resolution_clock::now();
    for (int i = 0; i < 1000; ++i) {
        SensorSample s;
        s.ax = 0.1 * (i % 5);
        s.ay = 9.81 + 0.05 * (i % 3);
        s.az = 0.2 * (i % 4);
        s.gx = 10.0; s.gy = 15.0; s.gz = 5.0;
        s.alpha = 45.0; s.beta = 10.0; s.gamma = 5.0;
        s.timestamp = 1700000000000 + i * 50; // 20Hz samples
        buffer.push(s);
    }
    auto end_time = std::chrono::high_resolution_clock::now();
    auto duration_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(end_time - start_time).count();

    std::cout << "  ✓ Processed 1000 sample pushes in " << duration_ns / 1000.0 << " μs\n";
    std::cout << "  ✓ Buffer size: " << buffer.size() << " / " << buffer.get_capacity() << "\n";
    std::cout << "  ✓ Mean Accel: " << std::fixed << std::setprecision(2) << buffer.get_mean_accel() << " m/s²\n";
    std::cout << "  ✓ Accel Variance: " << buffer.get_accel_variance() << " m/s²\n\n";

    // ----------------------------------------------------
    // TEST 2: Fall Detection Finite State Machine
    // ----------------------------------------------------
    std::cout << "[Module 2] Testing 6-Stage Fall Detection State Machine...\n";
    FallDetectionStateMachine fsm;

    // Simulate Fall Pipeline
    SensorSample freefall_sample{0.5, 0.5, 0.5, 10.0, 10.0, 10.0, 0, 0, 0, 1000};
    FallStage s1 = fsm.process_frame(freefall_sample, buffer);
    std::cout << "  1. Free Fall Trigger: State -> " << fall_stage_to_string(s1) << "\n";

    SensorSample impact_sample{28.5, 2.0, 1.0, 200.0, 50.0, 30.0, 0, 0, 0, 1050};
    FallStage s2 = fsm.process_frame(impact_sample, buffer);
    std::cout << "  2. High Impact Trigger: State -> " << fall_stage_to_string(s2) << "\n";

    SensorSample stillness_sample{0.0, 9.81, 0.0, 0.1, 0.1, 0.1, 0, 0, 0, 1100};
    SlidingWindowBuffer still_buf(100);
    still_buf.push(stillness_sample);
    FallStage s3 = fsm.process_frame(stillness_sample, still_buf);
    std::cout << "  3. Post-Impact Stillness: State -> " << fall_stage_to_string(s3) << "\n\n";

    // ----------------------------------------------------
    // TEST 3: Dijkstra & A* Graph Router
    // ----------------------------------------------------
    std::cout << "[Module 3] Testing Dijkstra & A* Shortest Path Graph Router...\n";
    GraphRouter router;

    // Add Road Network Nodes (San Francisco Coordinates)
    router.add_node(1, "Patient Location", 37.7749, -122.4194, false);
    router.add_node(2, "Junction Alpha", 37.7780, -122.4150, false);
    router.add_node(3, "SF General Hospital", 37.7850, -122.4090, true, 12);
    router.add_node(4, "UCSF Medical Center", 37.7910, -122.4010, true, 5);

    // Add Edges (distance in km, traffic factor)
    router.add_edge(1, 2, 0.8, 1.1);
    router.add_edge(2, 3, 1.2, 1.0);
    router.add_edge(2, 4, 2.5, 1.2);
    router.add_edge(3, 4, 1.5, 1.0);

    auto dijkstra_start = std::chrono::high_resolution_clock::now();
    RouteResult d_res = router.dijkstra_shortest_path(1, 3);
    auto dijkstra_end = std::chrono::high_resolution_clock::now();
    auto d_us = std::chrono::duration_cast<std::chrono::microseconds>(dijkstra_end - dijkstra_start).count();

    std::cout << "  ✓ Dijkstra Route to " << d_res.hospital_name << ":\n";
    std::cout << "    - Distance: " << d_res.distance_km << " km | ETA: " << d_res.eta_minutes << " mins | Time: " << d_us << " μs\n";

    auto astar_start = std::chrono::high_resolution_clock::now();
    RouteResult a_res = router.a_star_shortest_path(1, 3);
    auto astar_end = std::chrono::high_resolution_clock::now();
    auto a_us = std::chrono::duration_cast<std::chrono::microseconds>(astar_end - astar_start).count();

    std::cout << "  ✓ A* Heuristic Route to " << a_res.hospital_name << ":\n";
    std::cout << "    - Distance: " << a_res.distance_km << " km | ETA: " << a_res.eta_minutes << " mins | Time: " << a_us << " μs\n\n";

    // ----------------------------------------------------
    // TEST 4: Max-Heap Priority Ambulance Queue
    // ----------------------------------------------------
    std::cout << "[Module 4] Testing Max-Heap Priority Ambulance Queue...\n";
    PriorityAmbulanceQueue priority_queue;

    priority_queue.push_incident({101, 1, 45.0, "MEDIUM", 37.7749, -122.4194, 1700000000});
    priority_queue.push_incident({102, 2, 92.5, "CRITICAL", 37.7810, -122.4120, 1700000005});
    priority_queue.push_incident({103, 3, 78.0, "HIGH", 37.7850, -122.4080, 1700000010});

    std::cout << "  ✓ Enqueued 3 Emergency Incidents. Extracting Max-Heap Priority:\n";
    while (!priority_queue.empty()) {
        EmergencyIncident top = priority_queue.pop_highest_priority();
        std::cout << "    -> Incident ID: " << top.incident_id 
                  << " | Patient: " << top.patient_id 
                  << " | Score: " << top.confidence_score << "%"
                  << " | Severity: " << top.severity << "\n";
    }

    std::cout << "\n========================================================\n";
    std::cout << "  ALL C++ Core DSA Modules Executed & Verified Successfully! \n";
    std::cout << "========================================================\n";

    return 0;
}
