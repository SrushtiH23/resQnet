from datetime import datetime
from sqlalchemy.orm import Session
from models import Notification, EmergencyLog, AuditLog

class NotificationAndAuditService:
    """
    Module 14: Notification Service (SMS, Email, Push)
    Module 18: Emergency Timeline Log Service
    """

    @staticmethod
    def send_emergency_notification(
        db: Session,
        emergency_id: int,
        recipient_type: str,
        recipient_contact: str,
        channel: str,
        confidence_score: float,
        reason: str,
        lat: float,
        lon: float,
        medical_id: int
    ) -> Notification:
        map_link = f"https://maps.google.com/?q={lat},{lon}"
        message_body = (
            f"[ResQNet ALERT] Emergency detected ({reason}) for Patient #{medical_id}. "
            f"Confidence: {confidence_score}%. Location: {lat:.4f}, {lon:.4f}. Map: {map_link}"
        )

        notif = Notification(
            emergency_event_id=emergency_id,
            recipient_type=recipient_type,
            recipient_contact=recipient_contact,
            channel=channel,
            message=message_body,
            sent_at=datetime.utcnow(),
            status="Delivered"
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)
        return notif

    @staticmethod
    def log_timeline_event(
        db: Session,
        emergency_id: int,
        stage_name: str,
        description: str
    ) -> EmergencyLog:
        log_entry = EmergencyLog(
            emergency_event_id=emergency_id,
            stage_name=stage_name,
            description=description,
            timestamp=datetime.utcnow()
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        return log_entry

    @staticmethod
    def record_audit(
        db: Session,
        user_id: int,
        action: str,
        details: str
    ) -> AuditLog:
        audit = AuditLog(
            user_id=user_id,
            action=action,
            details=details,
            timestamp=datetime.utcnow()
        )
        db.add(audit)
        db.commit()
        db.refresh(audit)
        return audit
