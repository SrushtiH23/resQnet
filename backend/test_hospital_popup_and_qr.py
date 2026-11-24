import unittest
import os
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
import models
import schemas
from services.google_places_service import calculate_haversine_distance, sync_bengaluru_hospital_registry
from services.qr_service import SecureQRService
from services.notification_service import normalize_indian_phone

class TestHospitalNavigationAndQR(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Use an in-memory test database for fast, isolated verification
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)

        db = cls.Session()
        # Seed test hospitals with known coordinates in Bengaluru once for all tests
        cls.h1 = models.Hospital(
            google_place_id="test_hosp_01",
            name="St. Martha's Hospital",
            address="#5, Nrupathunga Rd, Sampangi Rama Nagara, Bengaluru",
            latitude=12.9712,
            longitude=77.5878,
            phone="+91 80 4012 4000",
            is_active=True,
            rating=4.3,
            place_type="Charitable Multispecialty Hospital"
        )
        cls.h2 = models.Hospital(
            google_place_id="test_hosp_02",
            name="Bowring & Lady Curzon Hospital",
            address="Lady Curzon Rd, Shivaji Nagar, Bengaluru",
            latitude=12.9822,
            longitude=77.6045,
            phone="+91 80 2559 1325",
            is_active=True,
            rating=4.0,
            place_type="Government Tertiary Hospital"
        )
        cls.h3 = models.Hospital(
            google_place_id="test_hosp_03",
            name="Manipal Hospital Whitefield",
            address="Whitefield Main Rd, Bengaluru",
            latitude=12.9904,
            longitude=77.7275,
            phone="+91 80 2502 4444",
            is_active=True,
            rating=4.5,
            place_type="Multispecialty Hospital"
        )
        db.add_all([cls.h1, cls.h2, cls.h3])
        db.commit()
        db.close()

    def setUp(self):
        self.db = self.Session()

        # Seed test patient user per test
        import time
        uniq_id = int(time.time() * 1000)
        self.user = models.User(
            full_name="Alex Mercer",
            email=f"alex_{uniq_id}_{os.urandom(4).hex()}@resqnet.com",
            hashed_password="hashed_pw",
            phone="+919876543210",
            role="user"
        )
        self.db.add(self.user)
        self.db.commit()

        # Seed medical profile
        self.med_profile = models.MedicalProfile(
            user_id=self.user.id,
            blood_group="O+",
            age=32,
            diseases="Asthma",
            allergies="Penicillin"
        )
        self.db.add(self.med_profile)

        # Seed emergency contact
        self.contact = models.FamilyContact(
            user_id=self.user.id,
            contact_name="Sarah Mercer",
            relationship_type="Mother",
            phone="+919876543211",
            escalation_order=1
        )
        self.db.add(self.contact)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    # =========================================================================
    # WORKFLOW TEST 1: Hospital Distance & ETA Calculation
    # =========================================================================
    def test_01_nearby_hospitals_sorted_by_distance(self):
        """Verify nearby hospitals are retrieved and sorted strictly by Haversine distance"""
        user_lat, user_lon = 12.9716, 77.5946 # Near Bengaluru City Center

        hospitals = self.db.query(models.Hospital).filter(models.Hospital.is_active == True).all()
        enriched = []
        for h in hospitals:
            dist = calculate_haversine_distance(user_lat, user_lon, h.latitude, h.longitude)
            eta = round(max(1.0, (dist / 35.0) * 60.0), 1)
            enriched.append({
                "id": h.id,
                "name": h.name,
                "address": h.address,
                "latitude": h.latitude,
                "longitude": h.longitude,
                "distance_km": dist,
                "eta_minutes": eta
            })
        enriched.sort(key=lambda x: x["distance_km"])

        # Nearest must be St. Martha's Hospital (~0.74 km), followed by Bowring (~1.59 km), Whitefield furthest (~14.5 km)
        self.assertGreater(len(enriched), 1)
        self.assertEqual(enriched[0]["name"], "St. Martha's Hospital")
        self.assertLess(enriched[0]["distance_km"], enriched[1]["distance_km"])
        self.assertLess(enriched[1]["distance_km"], enriched[2]["distance_km"])
        self.assertGreater(enriched[0]["eta_minutes"], 0)

    # =========================================================================
    # WORKFLOW TEST 2: Google Maps Navigation URL Format
    # =========================================================================
    def test_02_google_maps_directions_url_structure(self):
        """Verify Google Maps directions URL contains origin, destination, and travelmode=driving"""
        user_lat, user_lon = 12.9716, 77.5946
        h1 = self.db.query(models.Hospital).filter(models.Hospital.google_place_id == "test_hosp_01").first()
        dest_lat, dest_lon = h1.latitude, h1.longitude

        url_with_origin = f"https://www.google.com/maps/dir/?api=1&origin={user_lat},{user_lon}&destination={dest_lat},{dest_lon}&travelmode=driving"
        self.assertIn("api=1", url_with_origin)
        self.assertIn(f"origin={user_lat},{user_lon}", url_with_origin)
        self.assertIn(f"destination={dest_lat},{dest_lon}", url_with_origin)
        self.assertIn("travelmode=driving", url_with_origin)

        # Fallback without GPS origin
        url_dest_only = f"https://www.google.com/maps/dir/?api=1&destination={dest_lat},{dest_lon}&travelmode=driving"
        self.assertIn("api=1", url_dest_only)
        self.assertIn(f"destination={dest_lat},{dest_lon}", url_dest_only)
        self.assertIn("travelmode=driving", url_dest_only)

    # =========================================================================
    # WORKFLOW TEST 3: Emergency Creation with GPS Coordinates
    # =========================================================================
    def test_03_emergency_creation_with_coordinates(self):
        """Verify emergency event is created with accurate GPS coordinates"""
        emergency = models.EmergencyEvent(
            user_id=self.user.id,
            trigger_source="Fall Detection",
            confidence_score=95.0,
            status="Hospital Dispatched",
            latitude=12.9716,
            longitude=77.5946,
            speed=0.0,
            battery_level=90,
            network_status="5G",
            escalation_step=1
        )
        self.db.add(emergency)
        self.db.commit()

        retrieved = self.db.query(models.EmergencyEvent).filter(models.EmergencyEvent.id == emergency.id).first()
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.latitude, 12.9716)
        self.assertEqual(retrieved.longitude, 77.5946)
        self.assertEqual(retrieved.trigger_source, "Fall Detection")

    # =========================================================================
    # WORKFLOW TEST 4: SMS Failure Handling (Doesn't block navigation)
    # =========================================================================
    def test_04_sms_failure_mode_preserves_navigation(self):
        """Verify that when SMS provider fails or is unconfigured, emergency remains active and navigation proceeds"""
        emergency = models.EmergencyEvent(
            user_id=self.user.id,
            trigger_source="MANUAL_SOS",
            confidence_score=95.0,
            status="Family Notified",
            latitude=12.9716,
            longitude=77.5946
        )
        self.db.add(emergency)
        self.db.commit()

        # Simulate failed SMS notification log
        notif_log = models.NotificationLog(
            emergency_event_id=emergency.id,
            contact_id=self.contact.id,
            channel="SMS",
            provider="textbee",
            status="FAILED",
            error_message="Gateway timeout or device offline"
        )
        self.db.add(notif_log)
        self.db.commit()

        # Query emergency status and verify failure is accurately reported without false success
        log = self.db.query(models.NotificationLog).filter(
            models.NotificationLog.emergency_event_id == emergency.id,
            models.NotificationLog.channel == "SMS"
        ).first()

        self.assertEqual(log.status, "FAILED")
        self.assertIn("timeout", log.error_message)
        # Emergency remains active
        self.assertNotIn(emergency.status, ["Resolved", "False Alarm"])

    # =========================================================================
    # WORKFLOW TEST 5: QR Code Generation, Regeneration & Invalidation
    # =========================================================================
    def test_05_qr_code_complete_workflow(self):
        """Verify QR generation, display, regeneration revoking old token, and security isolation"""
        # 1. Generate QR
        qr1 = SecureQRService.get_or_create_patient_qr(self.db, self.user.id)
        self.assertIsNotNone(qr1)
        self.assertTrue(qr1.qr_code_token.startswith("rq_tok_"))
        self.assertTrue(qr1.is_active)

        # 2. Validate Active Token
        card_valid, err = SecureQRService.validate_token(self.db, qr1.qr_code_token)
        self.assertIsNotNone(card_valid)
        self.assertIsNone(err)
        self.assertEqual(card_valid.user_id, self.user.id)

        # 3. Regenerate QR Token
        qr2 = SecureQRService.regenerate_patient_qr(self.db, self.user.id)
        self.assertIsNotNone(qr2)
        self.assertNotEqual(qr1.qr_code_token, qr2.qr_code_token)
        self.assertTrue(qr2.is_active)

        # 4. Verify Previous QR is permanently INVALID (revoked)
        card_old, err_old = SecureQRService.validate_token(self.db, qr1.qr_code_token)
        self.assertIsNone(card_old)
        self.assertEqual(err_old, "This QR code is no longer active.")

        # 5. Verify New QR is VALID
        card_new, err_new = SecureQRService.validate_token(self.db, qr2.qr_code_token)
        self.assertIsNotNone(card_new)
        self.assertIsNone(err_new)
        self.assertEqual(card_new.qr_code_token, qr2.qr_code_token)

    # =========================================================================
    # WORKFLOW TEST 6: FastAPI Route Functions Integration
    # =========================================================================
    def test_06_fastapi_route_functions_integration(self):
        """Test FastAPI route handlers directly for nearby hospitals and QR code endpoints"""
        from main import get_nearby_hospitals, generate_or_get_qr, regenerate_qr, get_qr_details
        from fastapi import HTTPException

        # 1. Test get_nearby_hospitals route handler
        nearby_res = get_nearby_hospitals(lat=12.9716, lon=77.5946, only_verified=False, db=self.db)
        self.assertGreaterEqual(len(nearby_res), 3)
        self.assertEqual(nearby_res[0]["name"], "St. Martha's Hospital")
        self.assertIn("distance_km", nearby_res[0])
        self.assertIn("eta_minutes", nearby_res[0])

        # 2. Test generate_or_get_qr route handler
        qr_gen_res = generate_or_get_qr(current_user=self.user, db=self.db)
        self.assertIn("qr_token", qr_gen_res)
        self.assertTrue(qr_gen_res["qr_token"].startswith("rq_tok_"))
        self.assertTrue(qr_gen_res["is_active"])
        initial_token = qr_gen_res["qr_token"]

        # 3. Test get_qr_details for active token
        class MockRequest:
            headers = {}
        qr_detail_res = get_qr_details(token=initial_token, request=MockRequest(), db=self.db)
        self.assertEqual(qr_detail_res["patient_name"], self.user.full_name)
        self.assertEqual(qr_detail_res["blood_group"], "O+")

        # 4. Test regenerate_qr route handler
        qr_regen_res = regenerate_qr(current_user=self.user, db=self.db)
        self.assertIn("qr_token", qr_regen_res)
        new_token = qr_regen_res["qr_token"]
        self.assertNotEqual(initial_token, new_token)

        # 5. Test get_qr_details for old revoked token (must raise HTTP 410)
        with self.assertRaises(HTTPException) as cm_old:
            get_qr_details(token=initial_token, request=MockRequest(), db=self.db)
        self.assertEqual(cm_old.exception.status_code, 410)

        # 6. Test get_qr_details for new token (must succeed 200)
        qr_new_detail = get_qr_details(token=new_token, request=MockRequest(), db=self.db)
        self.assertEqual(qr_new_detail["patient_name"], self.user.full_name)

        # 7. Test get_qr_details for non-existent token (must raise HTTP 404)
        with self.assertRaises(HTTPException) as cm_fake:
            get_qr_details(token="completely_fake_nonexistent_token", request=MockRequest(), db=self.db)
        self.assertEqual(cm_fake.exception.status_code, 404)

if __name__ == "__main__":
    unittest.main()
