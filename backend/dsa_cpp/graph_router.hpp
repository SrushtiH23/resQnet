#ifndef GRAPH_ROUTER_HPP
#define GRAPH_ROUTER_HPP

#include <vector>
#include <string>
#include <queue>
#include <unordered_map>
#include <cmath>
#include <limits>

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

struct RouteResult {
    int hospital_id;
    std::string hospital_name;
    double distance_km;
    double eta_minutes;
    std::string algorithm;
    std::vector<int> node_path;
};

class GraphRouter {
private:
    std::unordered_map<int, GraphNode> nodes;
    std::unordered_map<int, std::vector<Edge>> adj_list;

public:
    GraphRouter() = default;

    void add_node(int id, const std::string& name, double lat, double lon, bool is_hospital = false, int available_beds = 10);
    void add_edge(int from_node, int to_node, double distance_km, double traffic_multiplier = 1.0);

    static double haversine_distance(double lat1, double lon1, double lat2, double lon2);

    RouteResult dijkstra_shortest_path(int start_node, int target_hospital_id);
    RouteResult a_star_shortest_path(int start_node, int target_hospital_id);

    std::vector<RouteResult> rank_all_hospitals_dijkstra(int start_node);
};

#endif // GRAPH_ROUTER_HPP
