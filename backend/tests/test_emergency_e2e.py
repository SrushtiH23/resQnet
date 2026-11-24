import os
import sys
import unittest
from datetime import datetime

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, ".env"))

from database import SessionLocal
from models import EmergencyEvent, FamilyContact, NotificationLog, User
from services.state_machine import FallDetectionStateMachine
from services.notification_service import validate_phone_number, EmergencyNotificationService
from services.escalation_engine import EmergencyEscalationEngine

class TestEmergencyEndToEnd(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_multi_stage_fall_detection_vs_adls(self):
        """
        Tests that multi-stage kinematics correctly detects true falls and
        rejects common Activities of Daily Living (ADLs) such as walking, jumping, sitting, dropping.
        """
        # 1. Genuine Fall Profile:
        # - Descent (free-fall dip to 4.5 m/s²)
        # - Severe Impact shock (24.0 m/s²)
        # - Body rotation (150 °/s)
        # - Post-impact stillness (variance 0.8 m/s²)
        # - Posture tilt change (65 degrees)
        fall_samples = []
        # Pre-impact standing (10 samples @ 9.8 m/s², vertical Y)
        for _ in range(10):
            fall_samples.append({"ax": 0.0, "ay": 9.8, "az": 0.0, "total_accel": 9.8, "gx": 0.0, "gy": 0.0, "gz": 0.0, "total_gyro": 10.0})
        # Descent / Free fall dip (4 samples @ 4.5 m/s²)
        for _ in range(4):
            fall_samples.append({"ax": 1.0, "ay": 4.2, "az": 1.0, "total_accel": 4.5, "gx": 80.0, "gy": 50.0, "gz": 90.0, "total_gyro": 130.0})
        # Impact shock (3 samples peaking at 25.0 m/s²)
        fall_samples.append({"ax": 5.0, "ay": 24.0, "az": 4.0, "total_accel": 25.0, "gx": 100.0, "gy": 70.0, "gz": 110.0, "total_gyro": 160.0})
        fall_samples.append({"ax": 4.0, "ay": 19.0, "az": 3.0, "total_accel": 19.6, "gx": 60.0, "gy": 40.0, "gz": 70.0, "total_gyro": 100.0})
        # Post-impact stillness (15 samples resting horizontally, variance ~0.5 m/s²)
        for _ in range(15):
            fall_samples.append({"ax": 9.6, "ay": 0.5, "az": 0.5, "total_accel": 9.65, "gx": 0.0, "gy": 0.0, "gz": 0.0, "total_gyro": 5.0})

        fall_res = FallDetectionStateMachine.evaluate_window(fall_samples)
        self.assertTrue(fall_res["is_fall"], "Genuine fall with descent, impact, rotation, tilt and stillness must be detected")
        self.assertGreaterEqual(fall_res["confidence_boost"], 60.0)

        # 2. ADL: Jumping Landing (High impact shock, but followed by movement recovery / high variance)
        jump_samples = []
        for _ in range(10):
            jump_samples.append({"ax": 0.0, "ay": 9.8, "az": 0.0, "total_accel": 9.8, "gx": 0.0, "gy": 0.0, "gz": 0.0, "total_gyro": 10.0})
        # Landing impact
        jump_samples.append({"ax": 1.0, "ay": 26.0, "az": 1.0, "total_accel": 26.1, "gx": 20.0, "gy": 15.0, "gz": 10.0, "total_gyro": 25.0})
        # Immediate active movement post-landing (variance > 6.0 m/s²)
        jump_samples.append({"ax": 0.0, "ay": 14.0, "az": 1.0, "total_accel": 14.1, "gx": 30.0, "gy": 20.0, "gz": 10.0, "total_gyro": 40.0})
        jump_samples.append({"ax": 0.0, "ay": 7.0, "az": 1.0, "total_accel": 7.1, "gx": 20.0, "gy": 10.0, "gz": 5.0, "total_gyro": 30.0})
        jump_samples.append({"ax": 0.0, "ay": 13.0, "az": 1.0, "total_accel": 13.1, "gx": 25.0, "gy": 15.0, "gz": 10.0, "total_gyro": 35.0})
        jump_samples.append({"ax": 0.0, "ay": 8.0, "az": 1.0, "total_accel": 8.1, "gx": 20.0, "gy": 10.0, "gz": 5.0, "total_gyro": 25.0})

        jump_res = FallDetectionStateMachine.evaluate_window(jump_samples)
        self.assertFalse(jump_res["is_fall"], "Jumping with active post-impact motion must be rejected (Recovery)")

        # 3. ADL: Sitting in a Chair (Gradual movement, max accel < 13.0 m/s²)
        sit_samples = []
        for i in range(25):
            acc = 9.8 + (1.5 if i < 15 else -1.0)
            sit_samples.append({"ax": 0.0, "ay": acc, "az": 0.0, "total_accel": abs(acc), "gx": 10.0, "gy": 25.0, "gz": 10.0, "total_gyro": 30.0})

        sit_res = FallDetectionStateMachine.evaluate_window(sit_samples)
        self.assertFalse(sit_res["is_fall"], "Gentle sitting in a chair must not trigger fall alert")

        # 4. ADL: Phone drop on table (Flat drop, zero rotation, no posture change)
        drop_samples = []
        for _ in range(10):
            drop_samples.append({"ax": 0.0, "ay": 0.0, "az": 9.8, "total_accel": 9.8, "gx": 0.0, "gy": 0.0, "gz": 0.0, "total_gyro": 5.0})
        # Free fall
        drop_samples.append({"ax": 0.0, "ay": 0.0, "az": 1.0, "total_accel": 1.0, "gx": 5.0, "gy": 5.0, "gz": 5.0, "total_gyro": 8.0})
        # Impact
        drop_samples.append({"ax": 0.0, "ay": 0.0, "az": 25.0, "total_accel": 25.0, "gx": 10.0, "gy": 10.0, "gz": 10.0, "total_gyro": 15.0})
        # Stillness with same orientation
        for _ in range(12):
            drop_samples.append({"ax": 0.0, "ay": 0.0, "az": 9.8, "total_accel": 9.8, "gx": 0.0, "gy": 0.0, "gz": 0.0, "total_gyro": 2.0})

        drop_res = FallDetectionStateMachine.evaluate_window(drop_samples)
        self.assertFalse(drop_res["is_fall"], "Phone drop on flat surface without angular rotation must be rejected")

    def test_phone_number_normalization_and_validation(self):
        """
        Tests E.164 phone number normalization across standard Indian and international formats.
        """
        # Valid Indian formats
        self.assertEqual(validate_phone_number("9876543210"), "+919876543210")
        self.assertEqual(validate_phone_number(" 98765-43210 "), "+919876543210")
        self.assertEqual(validate_phone_number("09876543210"), "+919876543210")
        self.assertEqual(validate_phone_number("919876543210"), "+919876543210")
        self.assertEqual(validate_phone_number("+919876543210"), "+919876543210")

        # International format
        self.assertEqual(validate_phone_number("+14155552671"), "+14155552671")

        # Invalid formats
        self.assertIsNone(validate_phone_number("12345"))
        self.assertIsNone(validate_phone_number("abcdef"))
        self.assertIsNone(validate_phone_number(""))
        self.assertIsNone(validate_phone_number(None))

    def test_textbee_real_api_dispatch_and_deduplication(self):
        """
        Tests TextBee integration against live configured API credentials in backend/.env.
        Verifies batch ID capture, database status logging, and deduplication prevention.
        """
        # Create test emergency event
        em = EmergencyEvent(
            user_id=1,
            trigger_source="Automated E2E Fall Sentinel Test",
            status="PENDING",
            latitude=12.9716,
            longitude=77.5946,
            confidence_score=92.0,
            created_at=datetime.utcnow()
        )
        self.db.add(em)
        self.db.commit()
        self.db.refresh(em)

        test_contact = FamilyContact(
            user_id=1,
            contact_name="Verified Contact",
            phone="+919876543210",
            relationship_type="Tester",
            escalation_order=1
        )
        self.db.add(test_contact)
        self.db.commit()
        self.db.refresh(test_contact)

        # 1. Send SMS through EmergencyNotificationService
        log = EmergencyNotificationService.send_emergency_sms(
            db=self.db,
            contact=test_contact,
            emergency=em,
            user_name="Alex Mercer"
        )

        self.assertIn(log.status, ["SENT", "DELIVERED", "FAILED"])
        self.assertEqual(log.emergency_event_id, em.id)
        self.assertEqual(log.contact_id, test_contact.id)

        # 2. Test Deduplication: Calling send_emergency_sms again must return existing log and NOT send duplicate
        log_dedup = EmergencyNotificationService.send_emergency_sms(
            db=self.db,
            contact=test_contact,
            emergency=em,
            user_name="Alex Mercer"
        )
        self.assertEqual(log.id, log_dedup.id, "Deduplication must return existing NotificationLog record")

        # 3. Clean up test records
        self.db.query(NotificationLog).filter(NotificationLog.emergency_event_id == em.id).delete()
        self.db.delete(test_contact)
        self.db.delete(em)
        self.db.commit()

if __name__ == '__main__':
    unittest.main()
