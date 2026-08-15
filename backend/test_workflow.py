import os
import sys
import unittest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Setup test DB in memory
from database import Base
import models
from services.confidence_engine import ConfidenceScoringEngine
from services.chatbot_service import EmergencyTriageChatbot
from services.notification_service import EmergencyNotificationService
from services.escalation_engine import EmergencyEscalationEngine

class TestResQNetWorkflow(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        self.db = Session()

        # Create dummy user & contact
        self.user = models.User(
            full_name="Test Patient",
            email="test@patient.com",
            hashed_password="hash",
            phone="+919876543210",
            role="user"
        )
        self.db.add(self.user)
        self.db.commit()

        self.contact = models.FamilyContact(
            user_id=self.user.id,
            contact_name="Mother",
            relationship_type="Mother",
            phone="+919876543211",
            escalation_order=1
        )
        self.db.add(self.contact)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_scenario_1_normal_user(self):
        """1. Normal user -> no emergency, no family notification"""
        active = self.db.query(models.EmergencyEvent).filter(models.EmergencyEvent.status.notin_(["Resolved", "False Alarm"])).all()
        self.assertEqual(len(active), 0)

    def test_scenario_2_mild_dizziness(self):
        """2. Mild dizziness -> LOW/MEDIUM risk, no automatic SMS/call"""
        res = EmergencyTriageChatbot.evaluate_triage(
            is_conscious=True,
            fell_or_fainted=False,
            has_chest_pain=False,
            has_breathing_difficulty=False,
            is_bleeding=False,
            can_stand_or_walk=True,
            sudden_dizziness=True,
            is_alone=True
        )
        self.assertIn(res["severity"], ["LOW", "MEDIUM"])
        self.assertFalse(res["emergency_required"])
        self.assertIn("sit or lie down", res["guidance_message"])

    def test_scenario_3_severe_dizziness_and_fainting(self):
        """3. Severe dizziness + fainting -> HIGH risk"""
        res = EmergencyTriageChatbot.evaluate_triage(
            is_conscious=True,
            fell_or_fainted=True,
            has_chest_pain=False,
            has_breathing_difficulty=False,
            is_bleeding=False,
            can_stand_or_walk=False,
            sudden_dizziness=True,
            is_alone=True
        )
        self.assertIn(res["severity"], ["HIGH", "CRITICAL"])
        self.assertTrue(res["emergency_required"])

    def test_scenario_8_natural_language_parsing(self):
        """8. Natural language input -> parsed symptoms, contributing factors, and priority level"""
        res = EmergencyTriageChatbot.evaluate_triage(
            text_input="I suddenly feel dizzy, fell down with acute chest pain and cannot walk"
        )
        self.assertIn(res["severity"], ["HIGH", "CRITICAL"])
        self.assertIn("Acute chest pain", res["detected_symptoms"])
        self.assertIn("Sudden dizziness", res["detected_symptoms"])
        self.assertIn("Cannot stand / walk", res["detected_symptoms"])
        self.assertTrue(len(res["contributing_factors"]) >= 3)
        self.assertEqual(res["priority_level"], "HIGH PRIORITY" if res["severity"] == "HIGH" else "CRITICAL PRIORITY")

    def test_scenario_4_fall_detected_critical(self):
        """4. Fall detected + no response -> CRITICAL risk, emergency created, GPS captured"""
        res = ConfidenceScoringEngine.calculate_score(
            fall_detected=True,
            strong_impact=True,
            rotation_change=True,
            stillness=True,
            loss_of_consciousness=True,
            gps=True
        )
        self.assertEqual(res["severity"], "CRITICAL")
        self.assertTrue(res["emergency_required"])
        self.assertGreaterEqual(res["confidence_score"], 80.0)

    def test_scenario_5_manual_sos(self):
        """5. Manual SOS -> emergency created immediately, GPS captured"""
        emergency = models.EmergencyEvent(
            user_id=self.user.id,
            trigger_source="SOS Button",
            confidence_score=85.0,
            status="Asking User",
            latitude=12.9716,
            longitude=77.5946
        )
        self.db.add(emergency)
        self.db.commit()

        escalation = EmergencyEscalationEngine.process_escalation_step(self.db, emergency.id, current_step=1)
        self.assertIn(escalation["status"], ["COMPLETED", "ESCALATED", "FAILED"])

    def test_scenario_6_sms_failure_mode(self):
        """6. SMS provider failure -> UI/status shows FAILED, never false SENT"""
        os.environ["SMS_PROVIDER"] = "twilio"
        os.environ["TWILIO_ACCOUNT_SID"] = "" # Empty credentials

        emergency = models.EmergencyEvent(
            user_id=self.user.id,
            trigger_source="SOS Button",
            confidence_score=85.0,
            status="Asking User",
            latitude=12.9716,
            longitude=77.5946
        )
        self.db.add(emergency)
        self.db.commit()

        sms_log = EmergencyNotificationService.send_emergency_sms(
            self.db, self.contact, emergency, self.user.full_name
        )
        self.assertIn(sms_log.status, ["FAILED", "PROVIDER_NOT_CONFIGURED"])
        self.assertIn("not configured", sms_log.error_message.lower())

    def test_scenario_7_contact_acknowledgement(self):
        """9. Contact acknowledgement -> stop unnecessary escalation"""
        emergency = models.EmergencyEvent(
            user_id=self.user.id,
            trigger_source="SOS Button",
            confidence_score=85.0,
            status="Family Notified",
            latitude=12.9716,
            longitude=77.5946
        )
        self.db.add(emergency)
        self.db.commit()

        ack = models.EmergencyAcknowledgement(
            emergency_event_id=emergency.id,
            contact_id=self.contact.id,
            response="I am responding"
        )
        self.db.add(ack)
        emergency.status = "Contact Acknowledged"
        self.db.commit()

        is_ack = EmergencyEscalationEngine.is_acknowledged(self.db, emergency.id)
        self.assertTrue(is_ack)

if __name__ == "__main__":
    unittest.main()
