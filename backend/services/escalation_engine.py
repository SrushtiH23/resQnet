from collections import deque
from typing import List, Dict, Any

class EscalationQueueManager:
    """
    Module 10: Escalation Engine Queue
    Sequentially progresses contact alerts (Mother -> 2m -> Father -> 2m -> Brother -> Hospital)
    """

    @staticmethod
    def get_escalation_queue(contacts: List[Dict[str, Any]]) -> deque:
        # Sort contacts by escalation order
        sorted_contacts = sorted(contacts, key=lambda c: c.get("escalation_order", 1))
        queue = deque(sorted_contacts)
        # Add hospital dispatch step at end of escalation
        queue.append({
            "contact_name": "Emergency Hospital Dispatch",
            "relationship_type": "Hospital Network",
            "phone": "911 / 108",
            "escalation_order": 999
        })
        return queue

    @staticmethod
    def advance_escalation(queue: deque, current_step: int) -> Dict[str, Any]:
        """
        Advances to the target contact step in queue.
        """
        queue_list = list(queue)
        if current_step < len(queue_list):
            next_target = queue_list[current_step]
            is_hospital_stage = (next_target["relationship_type"] == "Hospital Network")
            return {
                "step": current_step + 1,
                "total_steps": len(queue_list),
                "target_contact": next_target,
                "is_hospital_stage": is_hospital_stage,
                "status": "Escalating" if not is_hospital_stage else "Hospital Escalated"
            }
        else:
            return {
                "step": len(queue_list),
                "total_steps": len(queue_list),
                "target_contact": queue_list[-1],
                "is_hospital_stage": True,
                "status": "Fully Escalated"
            }
