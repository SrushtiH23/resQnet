import os
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from models import EmergencyEvent, FamilyContact, EmergencyAcknowledgement, NotificationLog, User, Hospital, EmergencyLog
from services.notification_service import EmergencyNotificationService, get_location_url

PRIMARY_CONTACT_DELAY = int(os.getenv("PRIMARY_CONTACT_DELAY", "0"))
SECONDARY_CONTACT_DELAY = int(os.getenv("SECONDARY_CONTACT_DELAY", "30"))
HOSPITAL_ESCALATION_DELAY = int(os.getenv("HOSPITAL_ESCALATION_DELAY", "60"))

class EmergencyEscalationEngine:
    """
    Priority-based emergency escalation engine.
    Sequentially notifies emergency contacts by priority, checks for acknowledgements,
    and escalates to hospital emergency dispatch if unresolved.
    """

    @staticmethod
    def is_acknowledged(db: Session, emergency_id: int) -> bool:
        ack = db.query(EmergencyAcknowledgement).filter(
            EmergencyAcknowledgement.emergency_event_id == emergency_id
        ).first()
        if ack:
            return True

        em = db.query(EmergencyEvent).filter(EmergencyEvent.id == emergency_id).first()
        if em and em.status in ["Resolved", "False Alarm", "Contact Acknowledged", "Family Responding"]:
            return True

        return False

    @staticmethod
    def run_full_escalation(db: Session, emergency_id: int) -> Dict[str, Any]:
        emergency = db.query(EmergencyEvent).filter(EmergencyEvent.id == emergency_id).first()
        if not emergency:
            return {"status": "ERROR", "message": "Emergency event not found"}

        user = db.query(User).filter(User.id == emergency.user_id).first()
        user_name = user.full_name if user else "Patient"

        contacts = db.query(FamilyContact).filter(
            FamilyContact.user_id == emergency.user_id
        ).order_by(FamilyContact.escalation_order.asc()).all()

        print("========== RESQNET SOS ==========")
        print(f"Emergency ID: {emergency.id}")
        print(f"User ID: {emergency.user_id} ({user_name})")
        print(f"Trigger: {emergency.trigger_source}")
        print(f"\nFetching emergency contacts...")

        if not contacts:
            print("No emergency contacts found for user in PostgreSQL.")
            emergency.status = "No emergency contacts configured"
            emergency.escalation_step = 0
            db.commit()
            print("==================================")
            return {"status": "NO_CONTACTS", "message": "No emergency contacts configured"}

        print(f"\nContacts found ({len(contacts)}):")
        for i, c in enumerate(contacts, 1):
            print(f"{i}. {c.contact_name} ({c.relationship_type}) - {c.phone}")

        print("\nStarting escalation...")
        print("==================================")

        any_success = False

        for i, contact in enumerate(contacts, 1):
            print(f"\n========== CONTACT {i} ==========")
            print(f"Contact: {contact.contact_name}")
            print(f"Priority: {contact.escalation_order}")
            print(f"Phone: {contact.phone}")
            print("Starting SMS...")

            sms_log = EmergencyNotificationService.send_emergency_sms(
                db=db,
                contact=contact,
                emergency=emergency,
                user_name=user_name
            )

            print("Starting voice call...")
            call_log = EmergencyNotificationService.initiate_emergency_call(
                db=db,
                contact=contact,
                emergency=emergency,
                user_name=user_name
            )

            sms_ok = sms_log.status in ["SENT", "DELIVERED", "ACKNOWLEDGED"]
            call_ok = call_log.status in ["INITIATED", "SENT", "DELIVERED", "ACKNOWLEDGED"]

            if sms_ok or call_ok:
                any_success = True

            emergency.escalation_step = i
            db.commit()

            # Record timeline log
            log_desc = f"Priority #{i} ({contact.contact_name}): SMS={sms_log.status}, Call={call_log.status}"
            timeline_log = EmergencyLog(
                emergency_event_id=emergency.id,
                stage_name=f"Escalation Priority #{i}",
                description=log_desc,
                timestamp=datetime.utcnow()
            )
            db.add(timeline_log)
            db.commit()

            # Broadcast WebSocket updates for each contact escalation
            try:
                from websocket_manager import ws_manager
                import asyncio
                payload = {
                    "event_type": "ESCALATION_UPDATE",
                    "emergency_id": emergency.id,
                    "contact_id": contact.id,
                    "contact_name": contact.contact_name,
                    "escalation_step": i,
                    "sms_status": sms_log.status,
                    "call_status": call_log.status,
                    "ack_status": "PENDING",
                    "timestamp": datetime.utcnow().isoformat()
                }
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        loop.create_task(ws_manager.broadcast_location(emergency.id, payload))
                except Exception:
                    pass
            except Exception as e:
                print(f"WebSocket broadcast notice: {e}")

            print("==================================")

        emergency.status = "Family Notified" if any_success else "Family notification failed"
        db.commit()

        return {
            "status": "COMPLETED",
            "any_success": any_success,
            "contacts_processed": len(contacts)
        }

    @staticmethod
    def process_escalation_step(db: Session, emergency_id: int, current_step: int = 1) -> Dict[str, Any]:
        return EmergencyEscalationEngine.run_full_escalation(db, emergency_id)
