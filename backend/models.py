from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    role = Column(String(20), default="user", nullable=False)  # user, family, doctor, hospital, admin
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    medical_profile = relationship("MedicalProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    family_contacts = relationship("FamilyContact", back_populates="user", cascade="all, delete-orphan")
    emergency_events = relationship("EmergencyEvent", back_populates="user")
    qr_card = relationship("QRCard", back_populates="user", uselist=False, cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")

class MedicalProfile(Base):
    __tablename__ = "medical_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    blood_group = Column(String(10), nullable=True)
    age = Column(Integer, nullable=True)
    weight = Column(Float, nullable=True)
    diseases = Column(Text, nullable=True)     # Comma separated or text
    medications = Column(Text, nullable=True)  # Comma separated or text
    allergies = Column(Text, nullable=True)    # Comma separated or text
    insurance_details = Column(String(255), nullable=True)
    doctor_name = Column(String(100), nullable=True)
    doctor_phone = Column(String(20), nullable=True)
    emergency_notes = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="medical_profile")

class QRCard(Base):
    __tablename__ = "qr_cards"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    qr_code_token = Column(String(255), unique=True, nullable=False) # Random secure token / URL
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="qr_card")

class FamilyContact(Base):
    __tablename__ = "family_contacts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    contact_name = Column(String(100), nullable=False)
    relationship_type = Column(String(50), nullable=False) # Mother, Father, Brother, Friend, etc.
    phone = Column(String(20), nullable=False)
    email = Column(String(150), nullable=True)
    escalation_order = Column(Integer, default=1)          # 1, 2, 3...

    user = relationship("User", back_populates="family_contacts")

class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(Integer, primary_key=True, index=True)
    google_place_id = Column(String(255), unique=True, index=True, nullable=True)
    name = Column(String(150), nullable=False)
    address = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    phone = Column(String(50), nullable=True)
    website = Column(String(255), nullable=True)
    maps_url = Column(String(255), nullable=True)
    rating = Column(Float, nullable=True)
    place_type = Column(String(100), default="Hospital")
    available_beds = Column(Integer, default=10)
    specialities = Column(Text, default="Emergency, Trauma, ICU") # Comma separated
    is_active = Column(Boolean, default=True)
    is_registered_resqnet = Column(Boolean, default=False)
    verification_status = Column(String(30), default="UNREGISTERED") # UNREGISTERED, PENDING, VERIFIED, REJECTED
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    ambulances = relationship("Ambulance", back_populates="hospital")

class Ambulance(Base):
    __tablename__ = "ambulances"

    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False)
    vehicle_number = Column(String(50), nullable=False)
    driver_name = Column(String(100), nullable=True)
    driver_phone = Column(String(20), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    status = Column(String(20), default="Available") # Available, Dispatched, In-Transit, Busy

    hospital = relationship("Hospital", back_populates="ambulances")

class EmergencyEvent(Base):
    __tablename__ = "emergency_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    trigger_source = Column(String(50), nullable=False) # Fall Detection, SOS Button, Voice, QR Scan, Bystander
    confidence_score = Column(Float, default=0.0)
    status = Column(String(30), default="Pending")      # Pending, Asking User, Family Notified, Hospital Dispatched, False Alarm, Resolved
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    speed = Column(Float, default=0.0)
    battery_level = Column(Integer, default=100)
    network_status = Column(String(20), default="4G")
    assigned_hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=True)
    assigned_ambulance_id = Column(Integer, ForeignKey("ambulances.id"), nullable=True)
    escalation_step = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    is_demo = Column(Boolean, default=False, nullable=True)

    user = relationship("User", back_populates="emergency_events")
    logs = relationship("EmergencyLog", back_populates="emergency_event", cascade="all, delete-orphan")
    chatbot_sessions = relationship("ChatbotSession", back_populates="emergency_event", cascade="all, delete-orphan")

class EmergencyLog(Base):
    __tablename__ = "emergency_logs"

    id = Column(Integer, primary_key=True, index=True)
    emergency_event_id = Column(Integer, ForeignKey("emergency_events.id"), nullable=False)
    stage_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    emergency_event = relationship("EmergencyEvent", back_populates="logs")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    emergency_event_id = Column(Integer, ForeignKey("emergency_events.id"), nullable=False)
    recipient_type = Column(String(20), nullable=False) # Family, Hospital, Doctor, Volunteer
    recipient_contact = Column(String(150), nullable=False)
    channel = Column(String(20), default="SMS")         # SMS, Email, Push
    message = Column(Text, nullable=False)
    sent_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default="Delivered")

class SensorEvent(Base):
    __tablename__ = "sensor_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ax = Column(Float, nullable=False)
    ay = Column(Float, nullable=False)
    az = Column(Float, nullable=False)
    gx = Column(Float, nullable=False)
    gy = Column(Float, nullable=False)
    gz = Column(Float, nullable=False)
    total_accel = Column(Float, nullable=False)
    total_gyro = Column(Float, nullable=False)
    detected_stage = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

class HospitalRoute(Base):
    __tablename__ = "hospital_routes"

    id = Column(Integer, primary_key=True, index=True)
    emergency_event_id = Column(Integer, ForeignKey("emergency_events.id"), nullable=False)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False)
    distance_km = Column(Float, nullable=False)
    eta_minutes = Column(Float, nullable=False)
    algorithm_used = Column(String(20), default="Dijkstra") # Dijkstra, A*
    path_nodes = Column(JSON, nullable=True)                # List of coordinate pairs [[lat, lon], ...]
    created_at = Column(DateTime, default=datetime.utcnow)

class ChatbotSession(Base):
    __tablename__ = "chatbot_sessions"

    id = Column(Integer, primary_key=True, index=True)
    emergency_event_id = Column(Integer, ForeignKey("emergency_events.id"), nullable=False)
    can_move = Column(Boolean, nullable=True)
    is_bleeding = Column(Boolean, nullable=True)
    has_chest_pain = Column(Boolean, nullable=True)
    has_breathing_difficulty = Column(Boolean, nullable=True)
    is_conscious = Column(Boolean, nullable=True)
    score_contribution = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    emergency_event = relationship("EmergencyEvent", back_populates="chatbot_sessions")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    details = Column(Text, nullable=True)
    ip_address = Column(String(45), default="127.0.0.1")
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")

class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True)
    emergency_event_id = Column(Integer, ForeignKey("emergency_events.id"), nullable=False)
    contact_id = Column(Integer, ForeignKey("family_contacts.id"), nullable=True)
    channel = Column(String(20), default="SMS")            # SMS, VOICE_CALL
    provider = Column(String(50), default="twilio")        # twilio, mock
    provider_message_id = Column(String(100), nullable=True)
    status = Column(String(30), default="PENDING")         # PENDING, SENT, DELIVERED, FAILED, ACKNOWLEDGED
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    delivered_at = Column(DateTime, nullable=True)

class EmergencyAcknowledgement(Base):
    __tablename__ = "emergency_acknowledgements"

    id = Column(Integer, primary_key=True, index=True)
    emergency_event_id = Column(Integer, ForeignKey("emergency_events.id"), nullable=False)
    contact_id = Column(Integer, ForeignKey("family_contacts.id"), nullable=True)
    response = Column(String(50), nullable=False)          # "I am responding", "I cannot respond"
    timestamp = Column(DateTime, default=datetime.utcnow)

class EvaluationTestResult(Base):
    __tablename__ = "evaluation_test_results"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    test_type = Column(String(30), nullable=False)           # "Normal Activity" or "Fall"
    detection_result = Column(String(30), nullable=False)     # "NORMAL", "POSSIBLE FALL", "FALL CONFIRMED"
    is_fall_detected = Column(Boolean, default=False)
    max_acceleration = Column(Float, nullable=False)          # m/s²
    min_acceleration = Column(Float, nullable=False)          # m/s²
    free_fall = Column(Boolean, default=False)                # Yes/No
    impact = Column(Boolean, default=False)                   # Yes/No
    inactivity = Column(Boolean, default=False)               # Yes/No
    orientation_change = Column(Boolean, default=False)       # Yes/No
    detection_latency_ms = Column(Float, default=0.0)         # Latency in ms
    final_classification = Column(String(10), nullable=False) # TP, TN, FP, FN
    is_correct = Column(Boolean, nullable=False)              # True if TP or TN
    activity_notes = Column(String(255), nullable=True)


