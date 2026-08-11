#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include "../include/SensorProcessor.hpp"
#include "../include/FallDetector.hpp"
#include "../include/ConfidenceEngine.hpp"
#include "../include/EmergencyQueue.hpp"
#include "../include/RoutingEngine.hpp"

namespace py = pybind11;

// Global persistent instances for C++ engine state
static SlidingWindowBuffer g_sliding_buffer(100);
static FallDetector g_fall_detector;
static EmergencyPriorityQueue g_emergency_queue;
static RoutingEngine g_routing_engine;

// Convenience module wrapper functions
py::dict process_sensor_frame(double ax, double ay, double az, double gx, double gy, double gz, int64_t timestamp = 0) {
    SensorSample sample = SensorProcessor::create_sample(ax, ay, az, gx, gy, gz, timestamp);
    g_sliding_buffer.push(sample);

    py::dict result;
    result["ax"] = ax;
    result["ay"] = ay;
    result["az"] = az;
    result["gx"] = gx;
    result["gy"] = gy;
    result["gz"] = gz;
    result["total_accel"] = sample.get_accel_magnitude();
    result["total_gyro"] = sample.get_gyro_magnitude();
    result["buffer_size"] = g_sliding_buffer.size();
    result["accel_variance"] = g_sliding_buffer.get_accel_variance();
    return result;
}

py::dict detect_fall(const std::vector<py::dict>& py_samples) {
    std::vector<SensorSample> samples;
    for (const auto& item : py_samples) {
        double ax = item.contains("ax") ? item["ax"].cast<double>() : 0.0;
        double ay = item.contains("ay") ? item["ay"].cast<double>() : 0.0;
        double az = item.contains("az") ? item["az"].cast<double>() : 0.0;
        double gx = item.contains("gx") ? item["gx"].cast<double>() : 0.0;
        double gy = item.contains("gy") ? item["gy"].cast<double>() : 0.0;
        double gz = item.contains("gz") ? item["gz"].cast<double>() : 0.0;
        int64_t ts = item.contains("timestamp") ? item["timestamp"].cast<int64_t>() : 0;
        samples.push_back(SensorSample{ax, ay, az, gx, gy, gz, ts});
    }

    if (samples.empty()) {
        samples = g_sliding_buffer.get_samples();
    }

    FallDetectionResult res = g_fall_detector.evaluate_window(samples);

    py::dict out;
    out["is_fall"] = res.is_fall;
    out["is_fall_detected"] = res.is_fall;
    out["stage"] = res.state_name;
    out["detected_stage"] = res.state_name;
    out["free_fall"] = res.free_fall;
    out["impact"] = res.impact;
    out["rotation"] = res.rotation;
    out["stillness"] = res.stillness;
    out["recovered"] = res.recovered;
    out["confidence_boost"] = res.confidence_boost;
    out["confidence_delta"] = res.confidence_boost;
    out["details"] = res.details;
    out["explanation"] = res.details;
    return out;
}

py::dict calculate_confidence(
    bool accelerometer = false,
    bool gyroscope = false,
    bool stillness = false,
    bool gps = false,
    double chatbot = 0.0,
    bool user_response = false,
    bool qr_confirmation = false,
    const std::map<std::string, double>& weights_override = {}
) {
    ConfidenceRequestInput input{
        accelerometer,
        gyroscope,
        stillness,
        gps,
        chatbot,
        user_response,
        qr_confirmation,
        true
    };

    ConfidenceResult res = ConfidenceEngine::calculate_score(input, weights_override);

    py::dict out;
    out["confidence_score"] = res.confidence_score;
    out["severity"] = res.severity;
    out["fall_detected"] = res.fall_detected;
    out["recommended_action"] = res.recommended_action;
    out["recommended_status"] = res.recommended_status;
    out["weight_breakdown"] = res.weight_breakdown;
    out["scoring_explanation"] = res.scoring_explanation;
    out["reason"] = res.reason;
    return out;
}

void add_emergency(int emergency_id, double confidence_score, double eta_minutes = 0.0, int64_t timestamp = 0, std::string details = "") {
    g_emergency_queue.add_emergency(emergency_id, confidence_score, eta_minutes, timestamp, details);
}

py::dict get_next_emergency() {
    EmergencyItem item = g_emergency_queue.get_next_emergency();
    py::dict out;
    out["emergency_id"] = item.emergency_id;
    out["confidence_score"] = item.confidence_score;
    out["eta_minutes"] = item.eta_minutes;
    out["timestamp"] = item.timestamp;
    out["severity"] = item.severity;
    out["details"] = item.details;
    return out;
}

std::vector<py::dict> dijkstra_routing(double user_lat, double user_lon, const std::vector<py::dict>& py_hospitals) {
    std::vector<HospitalData> hospitals;
    for (const auto& h : py_hospitals) {
        hospitals.push_back(HospitalData{
            h.contains("id") ? h["id"].cast<int>() : 0,
            h.contains("name") ? h["name"].cast<std::string>() : "Hospital",
            h.contains("latitude") ? h["latitude"].cast<double>() : (h.contains("lat") ? h["lat"].cast<double>() : 0.0),
            h.contains("longitude") ? h["longitude"].cast<double>() : (h.contains("lon") ? h["lon"].cast<double>() : 0.0),
            h.contains("phone") ? h["phone"].cast<std::string>() : "",
            h.contains("address") ? h["address"].cast<std::string>() : "",
            h.contains("available_beds") ? h["available_beds"].cast<int>() : 10,
            h.contains("specialities") ? h["specialities"].cast<std::string>() : "Emergency"
        });
    }

    auto routes = g_routing_engine.dijkstra_routing(user_lat, user_lon, hospitals);

    std::vector<py::dict> py_routes;
    for (const auto& r : routes) {
        py::dict route;
        route["hospital_id"] = r.hospital_id;
        route["hospital_name"] = r.hospital_name;
        route["phone"] = r.phone;
        route["address"] = r.address;
        route["available_beds"] = r.available_beds;
        route["specialities"] = r.specialities;
        route["distance_km"] = r.distance_km;
        route["eta_minutes"] = r.eta_minutes;
        route["algorithm"] = r.algorithm;
        route["traffic_factor"] = r.traffic_factor;

        std::vector<py::list> pts;
        for (const auto& pt : r.route_points) {
            py::list pair;
            pair.append(pt.lat);
            pair.append(pt.lon);
            pts.push_back(pair);
        }
        route["route_points"] = pts;
        py_routes.push_back(route);
    }

    return py_routes;
}

py::dict a_star_routing(double user_lat, double user_lon, const py::dict& h) {
    HospitalData target_hospital{
        h.contains("id") ? h["id"].cast<int>() : 0,
        h.contains("name") ? h["name"].cast<std::string>() : "Hospital",
        h.contains("latitude") ? h["latitude"].cast<double>() : (h.contains("lat") ? h["lat"].cast<double>() : 0.0),
        h.contains("longitude") ? h["longitude"].cast<double>() : (h.contains("lon") ? h["lon"].cast<double>() : 0.0),
        h.contains("phone") ? h["phone"].cast<std::string>() : "",
        h.contains("address") ? h["address"].cast<std::string>() : "",
        h.contains("available_beds") ? h["available_beds"].cast<int>() : 10,
        h.contains("specialities") ? h["specialities"].cast<std::string>() : "Emergency"
    };

    RouteResult r = g_routing_engine.a_star_routing(user_lat, user_lon, target_hospital);

    py::dict route;
    route["hospital_id"] = r.hospital_id;
    route["hospital_name"] = r.hospital_name;
    route["distance_km"] = r.distance_km;
    route["eta_minutes"] = r.eta_minutes;
    route["algorithm"] = r.algorithm;
    route["g_cost_km"] = r.g_cost_km;
    route["h_cost_km"] = r.h_cost_km;
    route["f_cost_km"] = r.f_cost_km;

    std::vector<py::list> pts;
    for (const auto& pt : r.route_points) {
        py::list pair;
        pair.append(pt.lat);
        pair.append(pt.lon);
        pts.push_back(pair);
    }
    route["route_points"] = pts;
    return route;
}

py::dict find_nearest_hospital(double user_lat, double user_lon, const std::vector<py::dict>& py_hospitals) {
    auto routes = dijkstra_routing(user_lat, user_lon, py_hospitals);
    if (routes.empty()) {
        return py::dict();
    }
    return routes[0];
}

py::dict find_nearest_ambulance(double user_lat, double user_lon, const std::vector<py::dict>& py_ambulances) {
    std::vector<AmbulanceData> ambulances;
    for (const auto& a : py_ambulances) {
        ambulances.push_back(AmbulanceData{
            a.contains("id") ? a["id"].cast<int>() : 0,
            a.contains("hospital_id") ? a["hospital_id"].cast<int>() : 0,
            a.contains("vehicle_number") ? a["vehicle_number"].cast<std::string>() : "AMB-01",
            a.contains("driver_name") ? a["driver_name"].cast<std::string>() : "Driver",
            a.contains("driver_phone") ? a["driver_phone"].cast<std::string>() : "+1-555",
            a.contains("latitude") ? a["latitude"].cast<double>() : (a.contains("lat") ? a["lat"].cast<double>() : 0.0),
            a.contains("longitude") ? a["longitude"].cast<double>() : (a.contains("lon") ? a["lon"].cast<double>() : 0.0),
            a.contains("status") ? a["status"].cast<std::string>() : "Available"
        });
    }

    AmbulanceAllocationResult res = g_routing_engine.find_nearest_ambulance(user_lat, user_lon, ambulances);

    py::dict out;
    out["ambulance_id"] = res.ambulance_id;
    out["vehicle_number"] = res.vehicle_number;
    out["driver_name"] = res.driver_name;
    out["driver_phone"] = res.driver_phone;
    out["distance_km"] = res.distance_km;
    out["eta_minutes"] = res.eta_minutes;
    out["status"] = res.status;
    return out;
}

PYBIND11_MODULE(resqnet_cpp, m) {
    m.doc() = "ResQNet C++ Algorithm Engine Pybind11 Binding Module";

    py::enum_<FallState>(m, "FallState")
        .value("NORMAL", FallState::NORMAL)
        .value("FREE_FALL", FallState::FREE_FALL)
        .value("IMPACT", FallState::IMPACT)
        .value("ROTATION_CHANGE", FallState::ROTATION_CHANGE)
        .value("STILLNESS", FallState::STILLNESS)
        .value("VERIFY", FallState::VERIFY)
        .value("FALL_CONFIRMED", FallState::FALL_CONFIRMED)
        .value("RESOLVED", FallState::RESOLVED)
        .export_values();

    py::class_<SensorSample>(m, "SensorSample")
        .def(py::init<double, double, double, double, double, double, int64_t>(),
             py::arg("ax") = 0.0, py::arg("ay") = 0.0, py::arg("az") = 0.0,
             py::arg("gx") = 0.0, py::arg("gy") = 0.0, py::arg("gz") = 0.0, py::arg("timestamp") = 0)
        .def_readwrite("ax", &SensorSample::ax)
        .def_readwrite("ay", &SensorSample::ay)
        .def_readwrite("az", &SensorSample::az)
        .def_readwrite("gx", &SensorSample::gx)
        .def_readwrite("gy", &SensorSample::gy)
        .def_readwrite("gz", &SensorSample::gz)
        .def_readwrite("timestamp", &SensorSample::timestamp)
        .def("get_accel_magnitude", &SensorSample::get_accel_magnitude)
        .def("get_gyro_magnitude", &SensorSample::get_gyro_magnitude);

    py::class_<SlidingWindowBuffer>(m, "SlidingWindowBuffer")
        .def(py::init<size_t>(), py::arg("capacity") = 100)
        .def("push", &SlidingWindowBuffer::push)
        .def("clear", &SlidingWindowBuffer::clear)
        .def("size", &SlidingWindowBuffer::size)
        .def("get_capacity", &SlidingWindowBuffer::get_capacity)
        .def("get_mean_accel", &SlidingWindowBuffer::get_mean_accel)
        .def("get_accel_variance", &SlidingWindowBuffer::get_accel_variance)
        .def("get_max_accel", &SlidingWindowBuffer::get_max_accel)
        .def("get_min_accel", &SlidingWindowBuffer::get_min_accel)
        .def("get_max_gyro", &SlidingWindowBuffer::get_max_gyro)
        .def("get_samples", &SlidingWindowBuffer::get_samples);

    py::class_<FallDetector>(m, "FallDetector")
        .def(py::init<>())
        .def("evaluate_window", &FallDetector::evaluate_window)
        .def("reset", &FallDetector::reset)
        .def("get_current_state", &FallDetector::get_current_state);

    py::class_<EmergencyPriorityQueue>(m, "EmergencyPriorityQueue")
        .def(py::init<>())
        .def("add_emergency", &EmergencyPriorityQueue::add_emergency,
             py::arg("emergency_id"), py::arg("confidence_score"), py::arg("eta_minutes") = 0.0, py::arg("timestamp") = 0, py::arg("details") = "")
        .def("get_next_emergency", &EmergencyPriorityQueue::get_next_emergency)
        .def("empty", &EmergencyPriorityQueue::empty)
        .def("size", &EmergencyPriorityQueue::size)
        .def("clear", &EmergencyPriorityQueue::clear);

    py::class_<RoutingEngine>(m, "RoutingEngine")
        .def(py::init<>())
        .def_static("wgs84_geodesic_distance", &RoutingEngine::wgs84_geodesic_distance)
        .def_static("calculate_eta", &RoutingEngine::calculate_eta)
        .def("dijkstra_routing", &RoutingEngine::dijkstra_routing)
        .def("a_star_routing", &RoutingEngine::a_star_routing)
        .def("find_nearest_hospital", &RoutingEngine::find_nearest_hospital)
        .def("find_nearest_ambulance", &RoutingEngine::find_nearest_ambulance);

    // High level procedural module API calls required by prompt
    m.def("process_sensor_frame", &process_sensor_frame, py::arg("ax"), py::arg("ay"), py::arg("az"), py::arg("gx"), py::arg("gy"), py::arg("gz"), py::arg("timestamp") = 0);
    m.def("detect_fall", &detect_fall, py::arg("samples") = std::vector<py::dict>());
    m.def("calculate_confidence", &calculate_confidence,
          py::arg("accelerometer") = false,
          py::arg("gyroscope") = false,
          py::arg("stillness") = false,
          py::arg("gps") = false,
          py::arg("chatbot") = 0.0,
          py::arg("user_response") = false,
          py::arg("qr_confirmation") = false,
          py::arg("weights_override") = std::map<std::string, double>());
    m.def("add_emergency", &add_emergency, py::arg("emergency_id"), py::arg("confidence_score"), py::arg("eta_minutes") = 0.0, py::arg("timestamp") = 0, py::arg("details") = "");
    m.def("get_next_emergency", &get_next_emergency);
    m.def("find_nearest_hospital", &find_nearest_hospital, py::arg("user_lat"), py::arg("user_lon"), py::arg("hospitals"));
    m.def("dijkstra_routing", &dijkstra_routing, py::arg("user_lat"), py::arg("user_lon"), py::arg("hospitals"));
    m.def("a_star_routing", &a_star_routing, py::arg("user_lat"), py::arg("user_lon"), py::arg("hospital"));
    m.def("find_nearest_ambulance", &find_nearest_ambulance, py::arg("user_lat"), py::arg("user_lon"), py::arg("ambulances"));
}
