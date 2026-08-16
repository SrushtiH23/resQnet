import os
import uuid
import json
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from models import NotificationLog, EmergencyAcknowledgement, EmergencyLog, AuditLog, User, EmergencyEvent, FamilyContact, MedicalProfile

def get_location_url(lat: Optional[float], lon: Optional[float]) -> str:
    if lat is None or lon is None or (lat == 0.0 and lon == 0.0):
        return "Unavailable (GPS coordinates not available)"
    return f"https://www.google.com/maps?q={lat:.6f},{lon:.6f}"

def calculate_risk_level(confidence_score: float) -> str:
    if confidence_score >= 80.0:
        return "Critical"
    elif confidence_score >= 50.0:
        return "High"
    else:
        return "Medium"

def normalize_indian_phone(phone: str) -> str:
    if not phone:
        return ""
    clean = phone.strip().replace(" ", "").replace("-", "")
    if clean.startswith("+"):
        return clean
    if clean.startswith("91") and len(clean) == 12:
        return "+" + clean
    if len(clean) == 10 and clean.isdigit():
        return "+91" + clean
    return clean

class EmergencyNotificationService:
    """
    Production Emergency Notification Service using official TextBee / Twilio APIs.
    Supports real SMS and Voice Calls, Google Maps location URLs,
    and granular provider status logging.
    """

    @staticmethod
    def send_emergency_sms(
        db: Session,
        contact: FamilyContact,
        emergency: EmergencyEvent,
        user_name: str,
        force_send: bool = False
    ) -> NotificationLog:
        # Check duplicate notification log unless force_send is True
        if not force_send:
            existing_log = db.query(NotificationLog).filter(
                NotificationLog.emergency_event_id == emergency.id,
                NotificationLog.contact_id == contact.id,
                NotificationLog.channel == "SMS",
                NotificationLog.status.in_(["SENT", "DELIVERED", "ACKNOWLEDGED"])
            ).first()

            if existing_log:
                return existing_log

        provider_mode = os.getenv("SMS_PROVIDER", "textbee").lower()
        textbee_api_key = os.getenv("TEXTBEE_API_KEY", "").strip()
        textbee_device_id = os.getenv("TEXTBEE_DEVICE_ID", "").strip()
        account_sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
        auth_token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
        phone_number = os.getenv("TWILIO_PHONE_NUMBER", "").strip()

        dest_phone = normalize_indian_phone(contact.phone)
        loc_url = get_location_url(emergency.latitude, emergency.longitude)
        time_str = emergency.created_at.strftime("%Y-%m-%d %H:%M:%S UTC") if emergency.created_at else datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

        # Retrieve Medical Profile for user to include stored medical info in SMS
        med_prof = db.query(MedicalProfile).filter(MedicalProfile.user_id == emergency.user_id).first()
        med_parts = []
        if med_prof:
            if med_prof.blood_group:
                med_parts.append(f"Blood Group: {med_prof.blood_group}")
            if med_prof.allergies:
                med_parts.append(f"Allergies: {med_prof.allergies}")
            if med_prof.diseases:
                med_parts.append(f"Conditions: {med_prof.diseases}")
            if med_prof.medications:
                med_parts.append(f"Medications: {med_prof.medications}")
            if med_prof.emergency_notes:
                med_parts.append(f"Notes: {med_prof.emergency_notes}")

        med_info_str = "\n".join(med_parts) if med_parts else "None specified"
        display_name = user_name if user_name else "User"
        trigger_display = "Manual SOS" if emergency.trigger_source in ["MANUAL_SOS", "SOS Button"] else emergency.trigger_source

        message_body = (
            f"🚨 RESQNET EMERGENCY ALERT\n\n"
            f"[{display_name}] may need immediate assistance.\n\n"
            f"Trigger: {trigger_display}\n"
            f"Confidence: {emergency.confidence_score:.0f}%\n\n"
            f"Current location:\n"
            f"{loc_url}\n\n"
            f"Medical information:\n"
            f"{med_info_str}\n\n"
            f"Time:\n"
            f"{time_str}\n\n"
            f"Please check on them immediately.\n\n"
            f"This is an automated emergency notification from ResQNet."
        )

        provider_name = "textbee" if (provider_mode == "textbee" or textbee_api_key) else ("twilio" if provider_mode == "twilio" else "none")

        notif_log = NotificationLog(
            emergency_event_id=emergency.id,
            contact_id=contact.id,
            channel="SMS",
            provider=provider_name,
            status="PENDING",
            created_at=datetime.utcnow()
        )
        db.add(notif_log)
        db.commit()

        print("==================================================")
        print(f"SOS received")
        print(f"Emergency ID: {emergency.id}")
        print(f"Contact retrieved: {contact.contact_name} ({contact.relationship_type})")
        print(f"Contact phone: {dest_phone}")

        if provider_mode == "textbee" or (textbee_api_key and textbee_device_id):
            if not textbee_api_key or not textbee_device_id:
                print("TextBee provider not configured. Missing TEXTBEE_API_KEY or TEXTBEE_DEVICE_ID in backend/.env")
                notif_log.status = "PROVIDER_NOT_CONFIGURED"
                notif_log.error_message = "SMS provider is not configured."
            else:
                print("Attempting TextBee SMS Gateway dispatch...")
                print(f"Device ID: {textbee_device_id[:6]}... (configured)")
                print(f"API Key: configured")
                try:
                    import requests
                    url = f"https://api.textbee.dev/api/v1/gateway/devices/{textbee_device_id}/send-sms"
                    headers = {
                        "x-api-key": textbee_api_key,
                        "Content-Type": "application/json"
                    }
                    payload = {
                        "recipients": [dest_phone],
                        "message": message_body
                    }
                    resp = requests.post(url, json=payload, headers=headers, timeout=10)
                    if resp.status_code in [200, 201]:
                        res_data = resp.json()
                        data_obj = res_data.get("data", {}) if isinstance(res_data, dict) else {}
                        msg_id = data_obj.get("smsBatchId") or data_obj.get("_id") or res_data.get("id") or f"TXB_{uuid.uuid4().hex[:8]}"
                        print(f"TextBee SMS request sent successfully. Message ID / Batch ID: {msg_id}")
                        notif_log.provider_message_id = msg_id
                        notif_log.status = "SENT"
                        notif_log.delivered_at = datetime.utcnow()
                    else:
                        err_msg = f"TextBee API Error ({resp.status_code}): {resp.text}"
                        print(err_msg)
                        notif_log.status = "FAILED"
                        notif_log.error_message = err_msg
                except Exception as err:
                    print(f"TextBee SMS Exception: {err}")
                    notif_log.status = "FAILED"
                    notif_log.error_message = str(err)
        elif provider_mode == "twilio" and account_sid and auth_token and phone_number:
            print("Attempting Twilio SMS...")
            try:
                from twilio.rest import Client
                client = Client(account_sid, auth_token)
                msg = client.messages.create(
                    body=message_body,
                    from_=phone_number,
                    to=dest_phone
                )
                print(f"Twilio request sent")
                print(f"Twilio Message SID: {msg.sid}")
                print(f"Twilio status: {msg.status}")

                notif_log.provider_message_id = msg.sid
                notif_log.status = "SENT" if msg.status in ["sent", "queued", "delivered"] else msg.status.upper()
                notif_log.delivered_at = datetime.utcnow()
            except Exception as err:
                print(f"Twilio SMS Exception: {err}")
                notif_log.status = "FAILED"
                notif_log.error_message = str(err)
        else:
            print("TextBee provider not configured. Missing credentials in backend/.env")
            notif_log.status = "PROVIDER_NOT_CONFIGURED"
            notif_log.error_message = "SMS provider is not configured."

        print("==================================================")

        print("==================================================")

        db.commit()
        db.refresh(notif_log)
        return notif_log

    @staticmethod
    def initiate_emergency_call(
        db: Session,
        contact: FamilyContact,
        emergency: EmergencyEvent,
        user_name: str
    ) -> NotificationLog:
        existing_log = db.query(NotificationLog).filter(
            NotificationLog.emergency_event_id == emergency.id,
            NotificationLog.contact_id == contact.id,
            NotificationLog.channel == "VOICE_CALL",
            NotificationLog.status.in_(["INITIATED", "SENT", "DELIVERED", "ACKNOWLEDGED"])
        ).first()

        if existing_log:
            return existing_log

        provider_mode = os.getenv("SMS_PROVIDER", "twilio").lower()
        account_sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
        auth_token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
        phone_number = os.getenv("TWILIO_PHONE_NUMBER", "").strip()
        dest_phone = normalize_indian_phone(contact.phone)

        # Format TwiML Voice Call message based on trigger type
        if emergency.trigger_source in ["MANUAL_SOS", "SOS Button"]:
            call_speech = (
                f"This is an automated ResQNet emergency alert. "
                f"{user_name} has triggered an emergency SOS. "
                f"The person's current location has been sent by SMS. "
                f"Please respond immediately."
            )
        else:
            call_speech = (
                f"This is an automated ResQNet emergency alert. "
                f"{user_name} may require immediate assistance. "
                f"The emergency location has been sent by SMS. "
                f"Please respond immediately."
            )
        twiml = f"<Response><Say voice=\"alice\">{call_speech}</Say></Response>"

        use_twilio = (provider_mode == "twilio")
        provider_name = "twilio" if use_twilio else "none"

        notif_log = NotificationLog(
            emergency_event_id=emergency.id,
            contact_id=contact.id,
            channel="VOICE_CALL",
            provider=provider_name,
            status="PENDING",
            created_at=datetime.utcnow()
        )
        db.add(notif_log)
        db.commit()

        if use_twilio and account_sid and auth_token and phone_number:
            print(f"Attempting Twilio Voice Call to {dest_phone}...")
            try:
                from twilio.rest import Client
                client = Client(account_sid, auth_token)
                call = client.calls.create(
                    twiml=twiml,
                    from_=phone_number,
                    to=dest_phone
                )
                print(f"Twilio call request sent. Call SID: {call.sid}, Status: {call.status}")
                notif_log.provider_message_id = call.sid
                notif_log.status = "INITIATED"
                notif_log.delivered_at = datetime.utcnow()
            except Exception as err:
                print(f"Twilio Voice Call Exception: {err}")
                notif_log.status = "FAILED"
                notif_log.error_message = str(err)
        else:
            print("Twilio Voice provider is not configured. Missing credentials in backend/.env")
            notif_log.status = "FAILED"
            notif_log.error_message = "Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER) not set in environment."

        db.commit()
        db.refresh(notif_log)
        return notif_log

class NotificationAndAuditService:
    """
    Service for logging timeline events and recording system security/user audit logs.
    """

    @staticmethod
    def record_audit(db: Session, user_id: Optional[int], action: str, details: str) -> AuditLog:
        log = AuditLog(
            user_id=user_id,
            action=action,
            details=details,
            timestamp=datetime.utcnow()
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def log_timeline_event(db: Session, emergency_event_id: int, stage_name: str, description: str) -> EmergencyLog:
        log = EmergencyLog(
            emergency_event_id=emergency_event_id,
            stage_name=stage_name,
            description=description,
            timestamp=datetime.utcnow()
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

