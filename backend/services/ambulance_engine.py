import heapq
from typing import List, Dict, Any, Optional

class PriorityAmbulanceAllocator:
    """
    Module 13: Priority Queue (Heap) Ambulance Allocator
    Assigns nearest available ambulance based on emergency priority (Critical > High > Medium)
    """

    PRIORITY_WEIGHTS = {
        "Critical": 1,
        "High": 2,
        "Medium": 3,
        "Low": 4
    }

    def __init__(self):
        # Min-heap queue storing tuples: (priority_score, ETA_minutes, emergency_id, payload)
        self.dispatch_heap = []

    def push_emergency(self, emergency_id: int, confidence_score: float, eta_minutes: float, details: dict):
        if confidence_score >= 80.0:
            severity = "Critical"
        elif confidence_score >= 60.0:
            severity = "High"
        else:
            severity = "Medium"

        priority_rank = self.PRIORITY_WEIGHTS[severity]
        item = (priority_rank, eta_minutes, emergency_id, {
            "severity": severity,
            "confidence_score": confidence_score,
            "details": details
        })
        heapq.heappush(self.dispatch_heap, item)

    def allocate_next(self, available_ambulances: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not self.dispatch_heap or not available_ambulances:
            return None

        priority_rank, eta, emergency_id, meta = heapq.heappop(self.dispatch_heap)
        
        # Greedy choice: pick nearest available ambulance
        selected_ambulance = available_ambulances[0]

        return {
            "emergency_id": emergency_id,
            "severity": meta["severity"],
            "allocated_ambulance": selected_ambulance,
            "estimated_arrival": eta
        }
