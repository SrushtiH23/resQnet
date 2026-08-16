#include "../include/RoutingEngine.hpp"
#include <algorithm>
#include <queue>
#include <cmath>
#include <stdexcept>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

double RoutingEngine::wgs84_geodesic_distance(double lat1, double lon1, double lat2, double lon2) {
    double phi1 = lat1 * M_PI / 180.0;
    double phi2 = lat2 * M_PI / 180.0;
    double delta_phi = (lat2 - lat1) * M_PI / 180.0;
    double delta_lambda = (lon2 - lon1) * M_PI / 180.0;

    double a = std::sin(delta_phi / 2.0) * std::sin(delta_phi / 2.0) +
               std::cos(phi1) * std::cos(phi2) * std::sin(delta_lambda / 2.0) * std::sin(delta_lambda / 2.0);
    double c = 2.0 * std::atan2(std::sqrt(a), std::sqrt(1.0 - a));

    return EARTH_RADIUS_KM * c;
}

double RoutingEngine::calculate_eta(double dist_km, double traffic_factor, double bed_penalty_mins) {
    double travel_time_mins = (dist_km / AVERAGE_AMBULANCE_SPEED_KMH) * 60.0;
    double total_eta = (travel_time_mins * traffic_factor) + bed_penalty_mins;
    return std::round(total_eta * 10.0) / 10.0;
}

std::vector<RoutePoint> RoutingEngine::generate_route_waypoints(double lat1, double lon1, double lat2, double lon2, int steps) {
    std::vector<RoutePoint> waypoints;
    for (int i = 0; i <= steps; ++i) {
        double t = static_cast<double>(i) / steps;
        double curve = 0.0012 * std::sin(t * M_PI);
        double plat = lat1 + (lat2 - lat1) * t + curve;
        double plon = lon1 + (lon2 - lon1) * t - curve;
        waypoints.push_back(RoutePoint{std::round(plat * 1000000.0) / 1000000.0, std::round(plon * 1000000.0) / 1000000.0});
    }
    return waypoints;
}

void RoutingEngine::add_node(int id, const std::string& name, double lat, double lon, bool is_hospital, int available_beds) {
    nodes[id] = GraphNode{id, name, lat, lon, is_hospital, available_beds};
}

void RoutingEngine::add_edge(int from_node, int to_node, double distance_km, double traffic_multiplier) {
    adj_list[from_node].push_back(Edge{to_node, distance_km, traffic_multiplier});
    adj_list[to_node].push_back(Edge{from_node, distance_km, traffic_multiplier});
}

std::vector<RouteResult> RoutingEngine::dijkstra_routing(double user_lat, double user_lon, const std::vector<HospitalData>& hospitals) {
    std::vector<RouteResult> results;
    for (const auto& h : hospitals) {
        double dist_km = wgs84_geodesic_distance(user_lat, user_lon, h.lat, h.lon);
        double bed_penalty = (h.available_beds > 0) ? 0.0 : 15.0;
        double traffic_factor = (dist_km > 5.0) ? 1.15 : 1.05;

        double eta_minutes = calculate_eta(dist_km, traffic_factor, bed_penalty);
        auto waypoints = generate_route_waypoints(user_lat, user_lon, h.lat, h.lon);

        results.push_back(RouteResult{
            h.id,
            h.name,
            h.phone,
            h.address,
            h.available_beds,
            h.specialities,
            std::round(dist_km * 1000.0) / 1000.0,
            eta_minutes,
            "Dijkstra",
            traffic_factor,
            dist_km,
            0.0,
            dist_km,
            waypoints
        });
    }

    std::sort(results.begin(), results.end(), [](const RouteResult& a, const RouteResult& b) {
        return a.eta_minutes < b.eta_minutes;
    });

    return results;
}

RouteResult RoutingEngine::a_star_routing(double user_lat, double user_lon, const HospitalData& target_hospital) {
    double g_cost = wgs84_geodesic_distance(user_lat, user_lon, target_hospital.lat, target_hospital.lon);
    double h_cost = g_cost; // Haversine straight-line heuristic
    double f_cost = g_cost + h_cost;

    double eta_minutes = calculate_eta(g_cost, 1.05, 0.0);
    auto waypoints = generate_route_waypoints(user_lat, user_lon, target_hospital.lat, target_hospital.lon);

    return RouteResult{
        target_hospital.id,
        target_hospital.name,
        target_hospital.phone,
        target_hospital.address,
        target_hospital.available_beds,
        target_hospital.specialities,
        std::round(g_cost * 1000.0) / 1000.0,
        eta_minutes,
        "A*",
        1.05,
        std::round(g_cost * 1000.0) / 1000.0,
        std::round(h_cost * 1000.0) / 1000.0,
        std::round(f_cost * 1000.0) / 1000.0,
        waypoints
    };
}

HospitalData RoutingEngine::find_nearest_hospital(double user_lat, double user_lon, const std::vector<HospitalData>& hospitals) {
    if (hospitals.empty()) {
        throw std::runtime_error("No active hospitals provided");
    }

    auto ranked = dijkstra_routing(user_lat, user_lon, hospitals);
    int top_id = ranked[0].hospital_id;

    for (const auto& h : hospitals) {
        if (h.id == top_id) return h;
    }
    return hospitals[0];
}

AmbulanceAllocationResult RoutingEngine::find_nearest_ambulance(double user_lat, double user_lon, const std::vector<AmbulanceData>& ambulances) {
    if (ambulances.empty()) {
        throw std::runtime_error("No available ambulances provided");
    }

    std::vector<AmbulanceData> available;
    for (const auto& a : ambulances) {
        if (a.status == "Available") {
            available.push_back(a);
        }
    }
    if (available.empty()) {
        available = ambulances; // fallback to all
    }

    std::vector<AmbulanceAllocationResult> ranked;
    for (const auto& amb : available) {
        double dist_km = wgs84_geodesic_distance(user_lat, user_lon, amb.lat, amb.lon);
        double eta_minutes = calculate_eta(dist_km, 1.0);

        ranked.push_back(AmbulanceAllocationResult{
            amb.id,
            amb.vehicle_number,
            amb.driver_name.empty() ? "Unit Driver" : amb.driver_name,
            amb.driver_phone.empty() ? "+919876543230" : amb.driver_phone,
            std::round(dist_km * 1000.0) / 1000.0,
            eta_minutes,
            amb.status
        });
    }

    std::sort(ranked.begin(), ranked.end(), [](const AmbulanceAllocationResult& a, const AmbulanceAllocationResult& b) {
        return a.distance_km < b.distance_km;
    });

    return ranked[0];
}
