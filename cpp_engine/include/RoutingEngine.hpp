#ifndef ROUTING_ENGINE_HPP
#define ROUTING_ENGINE_HPP

#include <vector>
#include <string>
#include <unordered_map>
#include <cmath>
#include <limits>

struct HospitalData {
    int id;
    std::string name;
    double lat;
    double lon;
    std::string phone;
    std::string address;
    int available_beds;
    std::string specialities;
};

struct AmbulanceData {
    int id;
    int hospital_id;
    std::string vehicle_number;
    std::string driver_name;
    std::string driver_phone;
    double lat;
    double lon;
    std::string status;
};

struct Edge {
    int target_node;
    double distance_km;
    double traffic_multiplier;

    double get_weight() const {
        return distance_km * traffic_multiplier;
    }
};

struct GraphNode {
    int id;
    std::string name;
    double lat;
    double lon;
    bool is_hospital;
    int available_beds;
};

struct RoutePoint {
    double lat;
    double lon;
};

struct RouteResult {
    int hospital_id;
    std::string hospital_name;
    std::string phone;
    std::string address;
    int available_beds;
    std::string specialities;
    double distance_km;
    double eta_minutes;
    std::string algorithm;
    double traffic_factor;
    double g_cost_km;
    double h_cost_km;
    double f_cost_km;
    std::vector<RoutePoint> route_points;
};

struct AmbulanceAllocationResult {
    int ambulance_id;
    std::string vehicle_number;
    std::string driver_name;
    std::string driver_phone;
    double distance_km;
    double eta_minutes;
    std::string status;
};

class RoutingEngine {
private:
    std::unordered_map<int, GraphNode> nodes;
    std::unordered_map<int, std::vector<Edge>> adj_list;

    static constexpr double EARTH_RADIUS_KM = 6371.0088;
    static constexpr double AVERAGE_AMBULANCE_SPEED_KMH = 45.0;

public:
    RoutingEngine() = default;

    static double wgs84_geodesic_distance(double lat1, double lon1, double lat2, double lon2);
    static double calculate_eta(double dist_km, double traffic_factor = 1.0, double bed_penalty_mins = 0.0);
    static std::vector<RoutePoint> generate_route_waypoints(double lat1, double lon1, double lat2, double lon2, int steps = 6);

    void add_node(int id, const std::string& name, double lat, double lon, bool is_hospital = false, int available_beds = 10);
    void add_edge(int from_node, int to_node, double distance_km, double traffic_multiplier = 1.0);

    std::vector<RouteResult> dijkstra_routing(double user_lat, double user_lon, const std::vector<HospitalData>& hospitals);
    RouteResult a_star_routing(double user_lat, double user_lon, const HospitalData& target_hospital);

    HospitalData find_nearest_hospital(double user_lat, double user_lon, const std::vector<HospitalData>& hospitals);
    AmbulanceAllocationResult find_nearest_ambulance(double user_lat, double user_lon, const std::vector<AmbulanceData>& ambulances);
};

#endif // ROUTING_ENGINE_HPP
