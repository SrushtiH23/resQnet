from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Any, Dict
from datetime import datetime
import re

def validate_and_normalize_indian_phone(v: Optional[str]) -> Optional[str]:
    if v is None or v == "":
        return None
    v_str = str(v).strip()
    if v_str.startswith("+91"):
        v_str = v_str[3:].strip()
    elif v_str.startswith("91") and len(v_str) > 10:
        v_str = v_str[2:].strip()
    digits = re.sub(r"\D", "", v_str)

    if not re.match(r"^[6-9][0-9]{9}$", digits):
        raise ValueError("Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.")

    return f"+91{digits}"

# --- Auth Schemas ---
class UserRegister(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    role: str = "user" # user, family, doctor, hospital, admin

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, v):
        return validate_and_normalize_indian_phone(v)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role: str
    full_name: str

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    phone: Optional[str] = None
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- Medical Profile Schemas ---
class MedicalProfileSchema(BaseModel):
    blood_group: Optional[str] = None
    age: Optional[int] = None
    weight: Optional[float] = None
    diseases: Optional[str] = None
    medications: Optional[str] = None
    allergies: Optional[str] = None
    insurance_details: Optional[str] = None
    doctor_name: Optional[str] = None
    doctor_phone: Optional[str] = None
    emergency_notes: Optional[str] = None

    @field_validator("doctor_phone", mode="before")
    @classmethod
    def validate_doctor_phone(cls, v):
        return validate_and_normalize_indian_phone(v)

class MedicalProfileResponse(MedicalProfileSchema):
    id: int
    user_id: int
    updated_at: datetime

    class Config:
        from_attributes = True

# --- Role Specific Onboarding Schemas ---
class DoctorProfileSchema(BaseModel):
    registration_number: str
    specialization: str
    qualification: str
    experience_years: int
    hospital_name: str
    department: str
    city: str
    address: str
    working_hours: Optional[str] = "24/7 ER"

class HospitalProfileSchema(BaseModel):
    hospital_name: str
    registration_number: str
    phone: str
    email: Optional[str] = None
    address: str
    city: str
    emergency_dept_available: bool = True
    ambulance_available: bool = True
    departments: str
    bed_capacity: int = 10

class FamilyProfileSchema(BaseModel):
    contact_name: str
    phone: str
    relationship_type: str
    email: Optional[str] = None
    notification_preference: str = "SMS + Call"

# --- Family Contact Schemas ---
class FamilyContactCreate(BaseModel):
    contact_name: str
    relationship_type: str
    phone: str
    email: Optional[str] = None
    escalation_order: int = 1

    @field_validator("phone", mode="before")
    @classmethod
    def validate_contact_phone(cls, v):
        return validate_and_normalize_indian_phone(v)

class FamilyContactUpdate(BaseModel):
    contact_name: Optional[str] = None
    relationship_type: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    escalation_order: Optional[int] = None

    @field_validator("phone", mode="before")
    @classmethod
    def validate_contact_phone(cls, v):
        if v is None or v == "":
            return None
        return validate_and_normalize_indian_phone(v)

class FamilyContactResponse(FamilyContactCreate):
    id: int
    user_id: int

    class Config:
        from_attributes = True

# --- Sensor & Fall Detection Schemas ---
class SensorFrame(BaseModel):
    ax: float
    ay: float
    az: float
    gx: float
    gy: float
    gz: float

class FallSimulationRequest(BaseModel):
    frames: List[SensorFrame]
    user_id: int
    latitude: float
    longitude: float

class FallDetectionResult(BaseModel):
    is_fall_detected: bool
    status_label: Optional[str] = "NORMAL"
    detected_stage: str
    free_fall: bool
    impact: bool
    rotation: bool
    stillness: bool
    confidence_delta: float
    explanation: str

# --- Confidence Scoring Request ---
class ConfidenceRequest(BaseModel):
    accelerometer: bool = False
    gyroscope: bool = False
    stillness: bool = False
    gps: bool = False
    chatbot: float = 0.0
    user_response: bool = False
    qr_confirmation: bool = False
    fall_detected: bool = False
    strong_impact: bool = False
    rotation_change: bool = False
    loss_of_consciousness: bool = False
    chest_pain: bool = False
    breathing_difficulty: bool = False
    severe_bleeding: bool = False

class ConfidenceResponse(BaseModel):
    confidence_score: float
    severity: str
    emergency_required: bool = False
    reasons: List[str] = []
    recommended_action: str
    recommended_status: str
    weight_breakdown: dict
    scoring_explanation: str

# --- Emergency Event Schemas ---
class EmergencyCreate(BaseModel):
    trigger_source: str # Fall Detection, SOS Button, Voice, QR Scan, Bystander
    latitude: float
    longitude: float
    speed: Optional[float] = 0.0
    battery_level: Optional[int] = 100
    network_status: Optional[str] = "4G"

class LocationUpdateRequest(BaseModel):
    emergency_id: int
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    timestamp: Optional[str] = None

class EmergencyValidationRequest(BaseModel):
    emergency_id: int
    action: str # "confirm" or "false_alarm"
    validator_role: str # "user", "family", "volunteer"

class EmergencyResponse(BaseModel):
    id: int
    user_id: int
    trigger_source: str
    confidence_score: float
    status: str
    latitude: float
    longitude: float
    speed: float
    battery_level: int
    network_status: str
    assigned_hospital_id: Optional[int] = None
    assigned_ambulance_id: Optional[int] = None
    escalation_step: int
    created_at: datetime
    resolved_at: Optional[datetime] = None
    sms_status: Optional[str] = None
    sms_error: Optional[str] = None
    sms_provider: Optional[str] = None
    location_url: Optional[str] = None
    is_demo: Optional[bool] = False

    class Config:
        from_attributes = True

class NotificationLogResponse(BaseModel):
    id: int
    emergency_event_id: int
    contact_id: Optional[int] = None
    channel: str
    provider: str
    provider_message_id: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    delivered_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class EmergencyAcknowledgementRequest(BaseModel):
    emergency_id: int
    contact_id: Optional[int] = None
    response: str

class EmergencyAcknowledgementResponse(BaseModel):
    id: int
    emergency_event_id: int
    contact_id: Optional[int] = None
    response: str
    timestamp: datetime

    class Config:
        from_attributes = True

# --- Triage Chatbot Schemas ---
class ChatbotTriageRequest(BaseModel):
    emergency_id: Optional[int] = None
    text_input: Optional[str] = None
    is_conscious: bool = True
    fell_or_fainted: bool = False
    has_chest_pain: bool = False
    has_breathing_difficulty: bool = False
    is_bleeding: bool = False
    can_stand_or_walk: bool = True
    sudden_dizziness: bool = False
    has_headache: bool = False
    severe_headache: bool = False
    speech_difficulty: bool = False
    weakness_numbness: bool = False
    vision_problems: bool = False
    is_alone: bool = True

class ChatbotTriageResponse(BaseModel):
    confidence_score: float
    rule_based_score_label: Optional[str] = "Rule-Based Risk Score: 0 points"
    severity: str
    priority_level: Optional[str] = "LOW PRIORITY"
    emergency_required: bool
    reasons: List[str]
    scoring_reasons: Optional[List[str]] = []
    guidance_message: str
    score_added: float
    detected_symptoms: Optional[List[str]] = []
    contributing_factors: Optional[List[Dict[str, Any]]] = []
    recommended_action: Optional[str] = ""
    mapped_flags: Optional[Dict[str, bool]] = None


# --- QR Card Schemas ---
class QRGenerateResponse(BaseModel):
    qr_token: str
    qr_url: str
    is_active: bool
    created_at: str
    privacy_notice: str

class QRScanRequest(BaseModel):
    qr_token: str

class BystanderQRResponse(BaseModel):
    access_level: str = "bystander"
    token: str
    is_active: bool
    patient_name: str
    blood_group: Optional[str] = "Not Specified"
    critical_allergies: Optional[str] = "None Reported"
    critical_medical_conditions: Optional[str] = "None Reported"
    has_active_emergency: bool = False
    active_emergency: Optional[dict] = None

class DoctorQRResponse(BaseModel):
    access_level: str = "doctor"
    token: str
    is_active: bool
    patient_name: str
    age: Optional[int] = None
    blood_group: Optional[str] = None
    allergies: Optional[str] = None
    medical_conditions: Optional[str] = None
    current_medications: Optional[str] = None
    primary_doctor: Optional[dict] = None
    emergency_contacts: List[dict] = []
    emergency_history_count: int = 0
    has_active_emergency: bool = False
    active_emergency: Optional[dict] = None

class HospitalQRResponse(BaseModel):
    access_level: str = "hospital"
    token: str
    is_active: bool
    patient_name: str
    age: Optional[int] = None
    blood_group: Optional[str] = None
    allergies: Optional[str] = None
    medical_conditions: Optional[str] = None
    current_medications: Optional[str] = None
    has_active_emergency: bool = False
    active_emergency: Optional[dict] = None

# --- Hospital & Routing Schemas ---
class HospitalCreate(BaseModel):
    name: str
    latitude: float
    longitude: float
    address: str
    phone: str
    available_beds: int = 10
    specialities: str = "Emergency, Trauma, ICU"

class HospitalResponse(HospitalCreate):
    id: int
    is_active: bool

    class Config:
        from_attributes = True

class RouteCalculationResponse(BaseModel):
    hospital_id: int
    hospital_name: str
    distance_km: float
    eta_minutes: float
    algorithm: str
    route_points: List[List[float]]

# --- Ambulance Schemas ---
class AmbulanceResponse(BaseModel):
    id: int
    hospital_id: int
    vehicle_number: str
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    latitude: float
    longitude: float
    status: str

    class Config:
        from_attributes = True

class NearestAmbulanceResponse(BaseModel):
    ambulance_id: int
    vehicle_number: str
    driver_name: str
    driver_phone: str
    latitude: float
    longitude: float
    status: str
    distance_km: float
    eta_minutes: float
