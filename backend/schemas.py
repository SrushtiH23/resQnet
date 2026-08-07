from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
from datetime import datetime

# --- Auth Schemas ---
class UserRegister(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    role: str = "user" # user, family, doctor, hospital, admin

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

class MedicalProfileResponse(MedicalProfileSchema):
    id: int
    user_id: int
    updated_at: datetime

    class Config:
        from_attributes = True

# --- Family Contact Schemas ---
class FamilyContactCreate(BaseModel):
    contact_name: str
    relationship_type: str
    phone: str
    email: Optional[str] = None
    escalation_order: int = 1

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

class ConfidenceResponse(BaseModel):
    confidence_score: float
    severity: str
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

    class Config:
        from_attributes = True

# --- Triage Chatbot Schemas ---
class ChatbotTriageRequest(BaseModel):
    emergency_id: int
    can_move: bool
    is_bleeding: bool
    has_chest_pain: bool
    has_breathing_difficulty: bool
    is_conscious: bool

class ChatbotTriageResponse(BaseModel):
    emergency_id: int
    score_added: float
    new_confidence_score: float
    recommended_action: str

# --- QR Card Schemas ---
class QRGenerateResponse(BaseModel):
    qr_token: str
    privacy_notice: str

class QRScanRequest(BaseModel):
    qr_token: str

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
