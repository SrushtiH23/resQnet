from sqlalchemy.orm import Session
from database import engine, SessionLocal, Base
from models import User, MedicalProfile, FamilyContact, Hospital, Ambulance, EmergencyEvent, EmergencyLog, AuditLog, QRCard
from auth import get_password_hash
from services.qr_service import EncryptedQRService
from datetime import datetime, timedelta

def seed_database():
    try:
        Base.metadata.create_all(bind=engine)
        db: Session = SessionLocal()

        # Check if already seeded
        if db.query(User).filter(User.email == "user@resqnet.com").first():
            print("Database already seeded.")
            db.close()
            return

        print("Seeding ResQNet Database...")

        # 1. Create Default Users for Roles
        # Patient / User
        patient = User(
            full_name="Alex Mercer",
            email="user@resqnet.com",
            hashed_password=get_password_hash("password123"),
            phone="+919876543210",
            role="user"
        )
        # Doctor
        doctor_user = User(
            full_name="Dr. Robert Chen",
            email="doctor@resqnet.com",
            hashed_password=get_password_hash("password123"),
            phone="+919876543212",
            role="doctor"
        )
        # Hospital Admin
        hospital_user = User(
            full_name="Metro City Trauma Center",
            email="hospital@resqnet.com",
            hashed_password=get_password_hash("password123"),
            phone="+919876543213",
            role="hospital"
        )
        # System Admin
        admin_user = User(
            full_name="ResQNet Administrator",
            email="admin@gmail.com",
            hashed_password=get_password_hash("admin@321"),
            phone="+919876543214",
            role="admin"
        )

        db.add_all([patient, doctor_user, hospital_user, admin_user])
        db.commit()

        # Refresh to get IDs
        db.refresh(patient)
        db.refresh(doctor_user)
        db.refresh(hospital_user)

        # 2. Medical Profile for Alex Mercer
        med_profile = MedicalProfile(
            user_id=patient.id,
            blood_group="O Positive (O+)",
            age=29,
            weight=72.5,
            diseases="Type 1 Diabetes, Asthma",
            medications="Insulin Glargine 10U, Ventolin Inhaler",
            allergies="Penicillin, Peanuts",
            insurance_details="BlueShield Premium #BS-994821",
            doctor_name="Dr. Robert Chen",
            doctor_phone="+919876543212",
            emergency_notes="Requires immediate blood glucose check if unconscious."
        )
        db.add(med_profile)

        # 3. Encrypted QR Card
        qr_token = EncryptedQRService.generate_medical_qr_token(patient.id)
        qr_card = QRCard(
            user_id=patient.id,
            qr_code_token=qr_token
        )
        db.add(qr_card)

        # 4. Family Contacts (Escalation Order)
        f1 = FamilyContact(user_id=patient.id, contact_name="Sarah Mercer", relationship_type="Mother", phone="+919876543211", email="family@resqnet.com", escalation_order=1)
        f2 = FamilyContact(user_id=patient.id, contact_name="David Mercer", relationship_type="Father", phone="+918123456789", email="david@resqnet.com", escalation_order=2)
        f3 = FamilyContact(user_id=patient.id, contact_name="Chris Mercer", relationship_type="Brother", phone="+917012345678", email="chris@resqnet.com", escalation_order=3)
        db.add_all([f1, f2, f3])

        # 5. Hospitals
        h1 = Hospital(
            name="City Central Emergency Hospital",
            latitude=37.7749,
            longitude=-122.4194,
            address="100 Hospital Way, Sector 4",
            phone="+919876543220",
            available_beds=14,
            specialities="Trauma, Cardiology, ICU, Neurology"
        )
        h2 = Hospital(
            name="St. Jude Memorial Hospital",
            latitude=37.7833,
            longitude=-122.4167,
            address="550 Medical Plaza Drive",
            phone="+919876543221",
            available_beds=8,
            specialities="Pediatrics, Emergency Triage, Orthopedics"
        )
        h3 = Hospital(
            name="Apex General & Burn Care Center",
            latitude=37.7650,
            longitude=-122.4300,
            address="88 Metro Boulevard",
            phone="+919876543222",
            available_beds=3,
            specialities="Burn ICU, Critical Care, Trauma"
        )
        db.add_all([h1, h2, h3])
        db.commit()
        db.refresh(h1)
        db.refresh(h2)

        # 6. Ambulances
        a1 = Ambulance(hospital_id=h1.id, vehicle_number="AMB-101", driver_name="John Miller", driver_phone="+919876543230", latitude=37.7750, longitude=-122.4200, status="Available")
        a2 = Ambulance(hospital_id=h1.id, vehicle_number="AMB-102", driver_name="Mark Vance", driver_phone="+919876543231", latitude=37.7760, longitude=-122.4180, status="Available")
        a3 = Ambulance(hospital_id=h2.id, vehicle_number="AMB-201", driver_name="Sarah Connor", driver_phone="+919876543232", latitude=37.7840, longitude=-122.4160, status="Available")
        db.add_all([a1, a2, a3])

        # 7. Initial Past Emergency Event (Resolved)
        emergency = EmergencyEvent(
            user_id=patient.id,
            trigger_source="Fall Detection",
            confidence_score=85.0,
            status="Resolved",
            latitude=37.7755,
            longitude=-122.4210,
            speed=0.0,
            battery_level=88,
            network_status="5G",
            assigned_hospital_id=h1.id,
            assigned_ambulance_id=a1.id,
            escalation_step=4,
            created_at=datetime.utcnow() - timedelta(minutes=15),
            resolved_at=datetime.utcnow() - timedelta(minutes=10),
            is_demo=True
        )
        db.add(emergency)
        db.commit()
        db.refresh(emergency)

        # 8. Timeline Logs
        log1 = EmergencyLog(emergency_event_id=emergency.id, stage_name="Fall Detected", description="Free fall (2.1 m/s²) and impact (26.4 m/s²) detected by phone sensors.", timestamp=datetime.utcnow() - timedelta(minutes=10))
        log2 = EmergencyLog(emergency_event_id=emergency.id, stage_name="Confidence Calculated", description="Confidence score computed: 85.0% (Free fall + Impact + Stillness + Rotation).", timestamp=datetime.utcnow() - timedelta(minutes=9, seconds=50))
        log3 = EmergencyLog(emergency_event_id=emergency.id, stage_name="Verification Countdown", description="30s User prompt elapsed without cancellation response.", timestamp=datetime.utcnow() - timedelta(minutes=9, seconds=20))
        log4 = EmergencyLog(emergency_event_id=emergency.id, stage_name="Family Alerted", description="Mother (Sarah Mercer) notified via SMS and WebSocket broadcast.", timestamp=datetime.utcnow() - timedelta(minutes=8))
        log5 = EmergencyLog(emergency_event_id=emergency.id, stage_name="Hospital & Ambulance Dispatched", description="City Central Emergency Hospital dispatched Ambulance AMB-101 via Dijkstra route.", timestamp=datetime.utcnow() - timedelta(minutes=6))
        db.add_all([log1, log2, log3, log4, log5])

        # Audit Log
        audit = AuditLog(user_id=patient.id, action="FALL_EMERGENCY_TRIGGERED", details="Automated 6-stage sensor detection triggered emergency #1", timestamp=datetime.utcnow() - timedelta(minutes=10))
        db.add(audit)

        db.commit()
        print("ResQNet Database successfully seeded!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
