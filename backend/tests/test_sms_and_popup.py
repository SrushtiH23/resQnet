import os
import sys
import unittest

# Ensure backend root is on sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from services.notification_service import validate_phone_number, EmergencyNotificationService
from database import SessionLocal
from models import EmergencyEvent, FamilyContact, NotificationLog, User
from datetime import datetime

class TestSmsAndNotificationLogic(unittest.TestCase):
    def test_phone_number_validation(self):
        # Valid standard E.164
        self.assertEqual(validate_phone_number("+919876543210"), "+919876543210")
        # 10-digit Indian numbers
        self.assertEqual(validate_phone_number("9876543210"), "+919876543210")
        # With spaces and dashes
        self.assertEqual(validate_phone_number("  98765-43210 "), "+919876543210")
        # Leading zero
        self.assertEqual(validate_phone_number("09876543210"), "+919876543210")
        # US/International E.164
        self.assertEqual(validate_phone_number("+14155552671"), "+14155552671")
        
        # Invalid numbers
        self.assertIsNone(validate_phone_number(""))
        self.assertIsNone(validate_phone_number("12345"))
        self.assertIsNone(validate_phone_number("abcdefg"))
        self.assertIsNone(validate_phone_number(None))

    def test_sms_dedup_and_status_tracking(self):
        db = SessionLocal()
        try:
            # Create a test emergency event
            test_em = EmergencyEvent(
                user_id=1,
                trigger_source="TEST_AUTOMATED",
                status="PENDING",
                latitude=12.9716,
                longitude=77.5946,
                confidence_score=95.0,
                created_at=datetime.utcnow()
            )
            db.add(test_em)
            db.commit()
            db.refresh(test_em)

            # Test contact with invalid phone
            invalid_contact = FamilyContact(
                user_id=1,
                contact_name="Invalid Contact",
                phone="12345",  # invalid phone
                relationship_type="Tester",
                escalation_order=1
            )
            db.add(invalid_contact)
            db.commit()
            db.refresh(invalid_contact)

            # Attempt sending SMS - should fail phone validation and record FAILED
            log1 = EmergencyNotificationService.send_emergency_sms(
                db=db,
                contact=invalid_contact,
                emergency=test_em,
                user_name="Test Patient"
            )
            self.assertEqual(log1.status, "FAILED")
            self.assertIn("Invalid recipient phone number format", log1.error_message)

            # Dedup test: Calling again on an already SENT/PENDING log returns existing log
            log1.status = "SENT"
            db.commit()

            log2 = EmergencyNotificationService.send_emergency_sms(
                db=db,
                contact=invalid_contact,
                emergency=test_em,
                user_name="Test Patient"
            )
            self.assertEqual(log1.id, log2.id)

            # Clean up test records
            db.query(NotificationLog).filter(NotificationLog.emergency_event_id == test_em.id).delete()
            db.delete(invalid_contact)
            db.delete(test_em)
            db.commit()
            print("SMS dedup and validation test passed!")
        finally:
            db.close()

if __name__ == '__main__':
    unittest.main()
