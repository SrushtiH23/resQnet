#include "graph_router.hpp"
#include <algorithm>
#include <cmath>

constexpr double PI_VAL = 3.14159265358979323846;
constexpr double EARTH_RADIUS_KM = 6371.0088;
constexpr double AVERAGE_AMBULANCE_SPEED_KMH = 45.0;

double GraphRouter::haversine_distance(double lat1, double lon1, double lat2, double lon2) {
    double phi1 = lat1 * PI_VAL / 180.0;
    double phi2 = lat2 * PI_VAL / 180.0;
    double delta_phi = (lat2 - lat1) * PI_VAL / 180.0;
    double delta_lambda = (lon2 - lon1) * PI_VAL / 180.0;

    double a = std::sin(delta_phi / 2.0) * std::sin(delta_phi / 2.0) +
               std::cos(phi1) * std::cos(phi2) * std::sin(delta_lambda / 2.0) * std::sin(delta_lambda / 2.0);
    double c = 2.0 * std::atan2(std::sqrt(a), std::sqrt(1.0 - a));
    return EARTH_RADIUS_KM * c;
}

void GraphRouter::add_node(int id, const std::string& name, double lat, double lon, bool is_hospital, int available_beds) {
    nodes[id] = {id, name, lat, lon, is_hospital, available_beds};
}

void GraphRouter::add_edge(int from_node, int to_node, double distance_km, double traffic_multiplier) {
    adj_list[from_node].push_back({to_node, distance_km, traffic_multiplier});
    adj_list[to_node].push_back({from_node, distance_km, traffic_multiplier}); // Undirected graph
}

RouteResult GraphRouter::dijkstra_shortest_path(int start_node, int target_hospital_id) {
    std::unordered_map<int, double> dist;
    std::unordered_map<int, int> parent;
    
    for (const auto& pair : nodes) {
        dist[pair.first] = std::numeric_limits<double>::infinity();
    }

    // Min-heap priority queue storing pair<distance, node_id>
    using PQItem = std::pair<double, int>;
    std::priority_queue<PQItem, std::vector<PQItem>, std::greater<PQItem>> pq;

    dist[start_node] = 0.0;
    pq.push({0.0, start_node});

    while (!pq.empty()) {
        auto [current_dist, u] = pq.top();
        pq.pop();

        if (current_dist > dist[u]) continue;
        if (u == target_hospital_id) break;

        if (adj_list.find(u) != adj_list.end()) {
            for (const auto& edge : adj_list.at(u)) {
                int v = edge.target_node;
                double weight = edge.get_weight();
                if (dist[u] + weight < dist[v]) {
                    dist[v] = dist[u] + weight;
                    parent[v] = u;
                    pq.push({dist[v], v});
                }
            }
        }
    }

    // Reconstruct path
    std::vector<int> path;
    int curr = target_hospital_id;
    while (parent.find(curr) != parent.end() || curr == start_node) {
        path.push_back(curr);
        if (curr == start_node) break;
        curr = parent[curr];
    }
    std::reverse(path.begin(), path.end());

    double dist_km = dist[target_hospital_id];
    double eta = (dist_km / AVERAGE_AMBULANCE_SPEED_KMH) * 60.0;

    return {
        target_hospital_id,
        nodes[target_hospital_id].name,
        dist_km,
        eta,
        "Dijkstra",
        path
    };
}

RouteResult GraphRouter::a_star_shortest_path(int start_node, int target_hospital_id) {
    std::unordered_map<int, double> g_score;
    std::unordered_map<int, double> f_score;
    std::unordered_map<int, int> parent;

    for (const auto& pair : nodes) {
        g_score[pair.first] = std::numeric_limits<double>::infinity();
        f_score[pair.first] = std::numeric_limits<double>::infinity();
    }

    using PQItem = std::pair<double, int>;
    std::priority_queue<PQItem, std::vector<PQItem>, std::greater<PQItem>> pq;

    double target_lat = nodes[target_hospital_id].lat;
    double target_lon = nodes[target_hospital_id].lon;

    g_score[start_node] = 0.0;
    f_score[start_node] = haversine_distance(nodes[start_node].lat, nodes[start_node].lon, target_lat, target_lon);

    pq.push({f_score[start_node], start_node});

    while (!pq.empty()) {
        auto [current_f, u] = pq.top();
        pq.pop();

        if (u == target_hospital_id) break;

        if (adj_list.find(u) != adj_list.end()) {
            for (const auto& edge : adj_list.at(u)) {
                int v = edge.target_node;
                double tentative_g = g_score[u] + edge.get_weight();

                if (tentative_g < g_score[v]) {
                    parent[v] = u;
                    g_score[v] = tentative_g;
                    double h_v = haversine_distance(nodes[v].lat, nodes[v].lon, target_lat, target_lon);
                    f_score[v] = g_score[v] + h_v;
                    pq.push({f_score[v], v});
                }
            }
        }
    }

    std::vector<int> path;
    int curr = target_hospital_id;
    while (parent.find(curr) != parent.end() || curr == start_node) {
        path.push_back(curr);
        if (curr == start_node) break;
        curr = parent[curr];
    }
    std::reverse(path.begin(), path.end());

    double dist_km = g_score[target_hospital_id];
    double eta = (dist_km / AVERAGE_AMBULANCE_SPEED_KMH) * 60.0;

    return {
        target_hospital_id,
        nodes[target_hospital_id].name,
        dist_km,
        eta,
        "A*",
        path
    };
}

std::vector<RouteResult> GraphRouter::rank_all_hospitals_dijkstra(int start_node) {
    std::vector<RouteResult> results;
    for (const auto& pair : nodes) {
        if (pair.second.is_hospital) {
            results.push_back(dijkstra_shortest_path(start_node, pair.first));
        }
    }
    std::sort(results.begin(), results.end(), [](const RouteResult& a, const RouteResult& b) {
        return a.eta_minutes < b.eta_minutes;
    });
    return results;
}
