from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
import math
from typing import List, Optional

from database import engine, Base, get_db
from models import User, MedicalProfile, FamilyContact, Hospital, Ambulance, EmergencyEvent, EmergencyLog, Notification, QRCard, ChatbotSession, AuditLog, SensorEvent
import schemas
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, require_role
)
from services.fall_detection import IntelligentFallDetector, SlidingWindowBuffer
from services.confidence_engine import ConfidenceScoringEngine
from services.escalation_engine import EscalationQueueManager
from services.routing_engine import ProductionGeospatialRouter, HospitalGraphRouter
from services.ambulance_engine import PriorityAmbulanceAllocator
from services.qr_service import EncryptedQRService
from services.chatbot_service import EmergencyTriageChatbot
from services.notification_service import NotificationAndAuditService
from websocket_manager import ws_manager
from seed_data import seed_database

# Create DB tables and seed initial data
Base.metadata.create_all(bind=engine)
try:
    seed_database()
except Exception as err:
    print(f"Database auto-seed notice: {err}")

app = FastAPI(
    title="ResQNet Emergency Intelligence API",
    description="Multi-stage intelligent emergency response platform with 4-layer architecture.",
    version="1.0.0"
)

# Enable CORS for frontend development
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sliding_buffer = SlidingWindowBuffer(capacity=100)

@app.get("/")
def root():
    return {
        "platform": "ResQNet Intelligence Platform",
        "status": "Operational",
        "timestamp": datetime.utcnow().isoformat()
    }

# ==========================================
# MODULE 1: Auth & User Management APIs
# ==========================================
@app.post("/api/auth/register", response_model=schemas.UserResponse)
def register_user(user_in: schemas.UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        full_name=user_in.full_name,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        phone=user_in.phone,
        role=user_in.role.lower()
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Initialize empty medical profile and QR card if role is 'user'
    if user.role == "user":
        med = MedicalProfile(user_id=user.id)
        db.add(med)
        qr_token = EncryptedQRService.generate_medical_qr_token(user.id)
        qr = QRCard(user_id=user.id, qr_code_token=qr_token)
        db.add(qr)
        db.commit()

    NotificationAndAuditService.record_audit(db, user.id, "USER_REGISTERED", f"User registered with role {user.role}")
    return user

@app.post("/api/auth/login", response_model=schemas.Token)
def login(login_in: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_in.email).first()
    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token(data={"sub": user.email, "role": user.role, "user_id": user.id})
    NotificationAndAuditService.record_audit(db, user.id, "USER_LOGIN", f"User logged in from client")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "role": user.role,
        "full_name": user.full_name
    }

@app.get("/api/auth/me", response_model=schemas.UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ==========================================
# MODULE 2: Medical Profile & Contacts APIs
# ==========================================
@app.get("/api/user/medical-profile", response_model=schemas.MedicalProfileResponse)
def get_medical_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(MedicalProfile).filter(MedicalProfile.user_id == current_user.id).first()
    if not profile:
        profile = MedicalProfile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

@app.put("/api/user/medical-profile", response_model=schemas.MedicalProfileResponse)
def update_medical_profile(profile_in: schemas.MedicalProfileSchema, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(MedicalProfile).filter(MedicalProfile.user_id == current_user.id).first()
    if not profile:
        profile = MedicalProfile(user_id=current_user.id)
        db.add(profile)

    for field, val in profile_in.model_dump(exclude_unset=True).items():
        setattr(profile, field, val)

    db.commit()
    db.refresh(profile)
    NotificationAndAuditService.record_audit(db, current_user.id, "MEDICAL_PROFILE_UPDATED", "Medical record updated")
    return profile

@app.get("/api/user/family-contacts", response_model=List[schemas.FamilyContactResponse])
def get_family_contacts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(FamilyContact).filter(FamilyContact.user_id == current_user.id).order_by(FamilyContact.escalation_order).all()

@app.post("/api/user/family-contacts", response_model=schemas.FamilyContactResponse)
def add_family_contact(contact_in: schemas.FamilyContactCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    contact = FamilyContact(
        user_id=current_user.id,
        contact_name=contact_in.contact_name,
        relationship_type=contact_in.relationship_type,
        phone=contact_in.phone,
        email=contact_in.email,
        escalation_order=contact_in.escalation_order
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact

# ==========================================
# MODULE 3: Privacy QR Card APIs
# ==========================================
@app.get("/api/qr/generate", response_model=schemas.QRGenerateResponse)
def generate_qr(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    qr_card = db.query(QRCard).filter(QRCard.user_id == current_user.id).first()
    if not qr_card:
        qr_token = EncryptedQRService.generate_medical_qr_token(current_user.id)
        qr_card = QRCard(user_id=current_user.id, qr_code_token=qr_token)
        db.add(qr_card)
        db.commit()
        db.refresh(qr_card)

    return {
        "qr_token": qr_card.qr_code_token,
        "privacy_notice": "Contains ONLY encrypted payload token. No raw personal, medical, or phone details exposed."
    }

@app.post("/api/qr/scan")
def scan_qr(scan_in: schemas.QRScanRequest, current_user: User = Depends(require_role(["doctor", "hospital", "admin"])), db: Session = Depends(get_db)):
    patient_id = EncryptedQRService.verify_and_decode_qr(scan_in.qr_token)
    if not patient_id:
        raise HTTPException(status_code=400, detail="Invalid or expired QR token")

    patient = db.query(User).filter(User.id == patient_id).first()
    profile = db.query(MedicalProfile).filter(MedicalProfile.user_id == patient_id).first()

    NotificationAndAuditService.record_audit(db, current_user.id, "QR_MEDICAL_ACCESS", f"Doctor/Hospital accessed profile for Patient ID {patient_id}")

    return {
        "patient_name": patient.full_name if patient else "Unknown Patient",
        "phone": patient.phone if patient else None,
        "medical_profile": profile,
        "decrypted_by": current_user.full_name,
        "timestamp": datetime.utcnow()
    }

# ==========================================
# MODULE 4 & 5 & 6: Sensor & Fall Detection
# ==========================================
@app.post("/api/sensor/sliding-window-analyze", response_model=schemas.FallDetectionResult)
def analyze_sensor_frames(req: schemas.FallSimulationRequest, db: Session = Depends(get_db)):
    for f in req.frames:
        sample = sliding_buffer.push(f.ax, f.ay, f.az, f.gx, f.gy, f.gz)
        # Store summarized event sample
        se = SensorEvent(
            user_id=req.user_id,
            ax=f.ax, ay=f.ay, az=f.az,
            gx=f.gx, gy=f.gy, gz=f.gz,
            total_accel=sample["total_accel"],
            total_gyro=sample["total_gyro"]
        )
        db.add(se)
    db.commit()

    samples = sliding_buffer.get_samples()
    result = IntelligentFallDetector.analyze_window(samples)

    return {
        "is_fall_detected": result["is_fall"],
        "detected_stage": result["stage"],
        "free_fall": result["free_fall"],
        "impact": result["impact"],
        "rotation": result["rotation"],
        "stillness": result["stillness"],
        "confidence_delta": result["confidence_boost"],
        "explanation": result["details"]
    }

@app.post("/api/sensor/telemetry")
def record_sensor_telemetry(req: schemas.SensorFrame, user_id: int = Query(...), detected_stage: Optional[str] = None, db: Session = Depends(get_db)):
    total_accel = math.sqrt(req.ax**2 + req.ay**2 + req.az**2)
    total_gyro = math.sqrt(req.gx**2 + req.gy**2 + req.gz**2)
    se = SensorEvent(
        user_id=user_id,
        ax=req.ax, ay=req.ay, az=req.az,
        gx=req.gx, gy=req.gy, gz=req.gz,
        total_accel=total_accel,
        total_gyro=total_gyro,
        detected_stage=detected_stage
    )
    db.add(se)
    db.commit()
    return {"status": "success", "recorded_id": se.id}

# ==========================================
# MODULE 7: Confidence Scoring Engine
# ==========================================
@app.post("/api/decision/confidence-score", response_model=schemas.ConfidenceResponse)
def compute_confidence(req: schemas.ConfidenceRequest):
    res = ConfidenceScoringEngine.calculate_score(
        accelerometer=req.accelerometer,
        gyroscope=req.gyroscope,
        stillness=req.stillness,
        gps=req.gps,
        chatbot=req.chatbot,
        user_response=req.user_response,
        qr_confirmation=req.qr_confirmation
    )
    return {
        "confidence_score": res["confidence_score"],
        "severity": res["severity"],
        "recommended_action": res["recommended_action"],
        "recommended_status": res["recommended_status"],
        "weight_breakdown": res["weight_breakdown"],
        "scoring_explanation": res["scoring_explanation"]
    }

# ==========================================
# MODULE 8 & 10: Emergency Creation, Validation & Escalation
# ==========================================
@app.post("/api/emergency/create", response_model=schemas.EmergencyResponse)
def create_emergency(req: schemas.EmergencyCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Default confidence depending on source
    initial_conf = 40.0 if req.trigger_source == "SOS Button" else 85.0

    emergency = EmergencyEvent(
        user_id=current_user.id,
        trigger_source=req.trigger_source,
        confidence_score=initial_conf,
        status="Asking User" if initial_conf < 80 else "Hospital Dispatched",
        latitude=req.latitude,
        longitude=req.longitude,
        speed=req.speed or 0.0,
        battery_level=req.battery_level or 95,
        network_status=req.network_status or "4G",
        escalation_step=1
    )
    db.add(emergency)
    db.commit()
    db.refresh(emergency)

    NotificationAndAuditService.log_timeline_event(db, emergency.id, "Emergency Triggered", f"Triggered via {req.trigger_source} at ({req.latitude:.4f}, {req.longitude:.4f})")
    NotificationAndAuditService.record_audit(db, current_user.id, "EMERGENCY_TRIGGERED", f"Emergency #{emergency.id} created")

    # If confidence >= 80, auto-find nearest hospital
    if initial_conf >= 80.0:
        hospitals = db.query(Hospital).filter(Hospital.is_active == True).all()
        h_dicts = [{"id": h.id, "name": h.name, "latitude": h.latitude, "longitude": h.longitude, "phone": h.phone, "address": h.address, "available_beds": h.available_beds, "specialities": h.specialities} for h in hospitals]
        if h_dicts:
            routes = HospitalGraphRouter.dijkstra_routing(req.latitude, req.longitude, h_dicts)
            best_h = routes[0]
            emergency.assigned_hospital_id = best_h["hospital_id"]
            db.commit()
            NotificationAndAuditService.log_timeline_event(db, emergency.id, "Hospital Selected", f"Assigned {best_h['hospital_name']} (ETA: {best_h['eta_minutes']}m via Dijkstra)")

    return emergency

@app.post("/api/emergency/validate")
def validate_emergency(req: schemas.EmergencyValidationRequest, db: Session = Depends(get_db)):
    emergency = db.query(EmergencyEvent).filter(EmergencyEvent.id == req.emergency_id).first()
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")

    if req.action == "false_alarm":
        emergency.status = "False Alarm"
        emergency.resolved_at = datetime.utcnow()
        db.commit()
        NotificationAndAuditService.log_timeline_event(db, emergency.id, "Cancelled", f"Emergency marked as False Alarm by {req.validator_role}.")
        return {"status": "Cancelled", "message": "Emergency successfully resolved as false alarm."}
    else:
        # Confirmed emergency
        emergency.confidence_score = min(emergency.confidence_score + 25.0, 100.0)
        emergency.status = "Hospital Dispatched" if emergency.confidence_score >= 80 else "Family Notified"
        db.commit()
        NotificationAndAuditService.log_timeline_event(db, emergency.id, "Human Validation", f"Emergency confirmed by {req.validator_role}. Score increased to {emergency.confidence_score}%.")
        return {"status": "Confirmed", "confidence_score": emergency.confidence_score}

@app.get("/api/emergency/active", response_model=List[schemas.EmergencyResponse])
def get_active_emergencies(db: Session = Depends(get_db)):
    return db.query(EmergencyEvent).filter(EmergencyEvent.status.notin_(["Resolved", "False Alarm"])).order_by(EmergencyEvent.created_at.desc()).all()

@app.get("/api/emergency/{emergency_id}", response_model=schemas.EmergencyResponse)
def get_emergency_by_id(emergency_id: int, db: Session = Depends(get_db)):
    emergency = db.query(EmergencyEvent).filter(EmergencyEvent.id == emergency_id).first()
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency event not found")
    return emergency

@app.get("/api/emergency/{emergency_id}/timeline")
def get_emergency_timeline(emergency_id: int, db: Session = Depends(get_db)):
    logs = db.query(EmergencyLog).filter(EmergencyLog.emergency_event_id == emergency_id).order_by(EmergencyLog.timestamp.asc()).all()
    return logs

# ==========================================
# MODULE 9: Triage Chatbot API
# ==========================================
@app.post("/api/emergency/triage-chatbot", response_model=schemas.ChatbotTriageResponse)
def process_triage(req: schemas.ChatbotTriageRequest, db: Session = Depends(get_db)):
    emergency = db.query(EmergencyEvent).filter(EmergencyEvent.id == req.emergency_id).first()
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency event not found")

    triage_res = EmergencyTriageChatbot.evaluate_triage(
        can_move=req.can_move,
        is_bleeding=req.is_bleeding,
        has_chest_pain=req.has_chest_pain,
        has_breathing_difficulty=req.has_breathing_difficulty,
        is_conscious=req.is_conscious
    )

    # Record chatbot session
    cb_session = ChatbotSession(
        emergency_event_id=req.emergency_id,
        can_move=req.can_move,
        is_bleeding=req.is_bleeding,
        has_chest_pain=req.has_chest_pain,
        has_breathing_difficulty=req.has_breathing_difficulty,
        is_conscious=req.is_conscious,
        score_contribution=triage_res["score_added"]
    )
    db.add(cb_session)

    # Boost confidence
    emergency.confidence_score = min(100.0, emergency.confidence_score + triage_res["score_added"])
    if emergency.confidence_score >= 80.0:
        emergency.status = "Hospital Dispatched"
    db.commit()

    NotificationAndAuditService.log_timeline_event(
        db, req.emergency_id, "Triage Completed",
        f"Chatbot triage added +{triage_res['score_added']}% confidence. Symptoms: {', '.join(triage_res['symptoms_identified'])}"
    )

    return {
        "emergency_id": req.emergency_id,
        "score_added": triage_res["score_added"],
        "new_confidence_score": emergency.confidence_score,
        "recommended_action": triage_res["guidance_message"]
    }

# ==========================================
# MODULE 12 & 13: Hospital Routing & Ambulance Dispatch
# ==========================================
@app.get("/api/hospital/routing", response_model=List[schemas.RouteCalculationResponse])
def get_hospital_routes(lat: float, lon: float, db: Session = Depends(get_db)):
    hospitals = db.query(Hospital).filter(Hospital.is_active == True).all()
    h_dicts = [{"id": h.id, "name": h.name, "latitude": h.latitude, "longitude": h.longitude, "phone": h.phone, "address": h.address, "available_beds": h.available_beds, "specialities": h.specialities} for h in hospitals]
    if not h_dicts:
        return []
    return ProductionGeospatialRouter.dijkstra_routing(lat, lon, h_dicts)

@app.get("/api/hospital/nearest-hospital")
def get_nearest_hospital(lat: float, lon: float, db: Session = Depends(get_db)):
    hospitals = db.query(Hospital).filter(Hospital.is_active == True).all()
    h_dicts = [{"id": h.id, "name": h.name, "latitude": h.latitude, "longitude": h.longitude, "phone": h.phone, "address": h.address, "available_beds": h.available_beds, "specialities": h.specialities} for h in hospitals]
    if not h_dicts:
        raise HTTPException(status_code=404, detail="No active hospitals found")
    nearest = ProductionGeospatialRouter.find_nearest_hospital(lat, lon, h_dicts)
    return nearest

@app.get("/api/hospital/nearest-ambulance", response_model=schemas.NearestAmbulanceResponse)
def get_nearest_ambulance(lat: float, lon: float, db: Session = Depends(get_db)):
    ambulances = db.query(Ambulance).all()
    a_dicts = [{"id": a.id, "vehicle_number": a.vehicle_number, "driver_name": a.driver_name, "driver_phone": a.driver_phone, "latitude": a.latitude, "longitude": a.longitude, "status": a.status} for a in ambulances]
    if not a_dicts:
        raise HTTPException(status_code=404, detail="No registered ambulances found")
    nearest = ProductionGeospatialRouter.find_nearest_ambulance(lat, lon, a_dicts)
    if not nearest:
        raise HTTPException(status_code=404, detail="No available ambulances found")
    return nearest

@app.get("/api/hospital/ambulances", response_model=List[schemas.AmbulanceResponse])
def get_ambulances(db: Session = Depends(get_db)):
    return db.query(Ambulance).all()

# ==========================================
# MODULE 17: Admin Dashboard Stats
# ==========================================
@app.get("/api/admin/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    total_users = db.query(User).count()
    total_hospitals = db.query(Hospital).count()
    total_emergencies = db.query(EmergencyEvent).count()
    false_alarms = db.query(EmergencyEvent).filter(EmergencyEvent.status == "False Alarm").count()
    resolved_cases = db.query(EmergencyEvent).filter(EmergencyEvent.status == "Resolved").count()

    false_alarm_rate = round((false_alarms / total_emergencies * 100), 1) if total_emergencies > 0 else 0.0

    return {
        "total_users": total_users,
        "total_hospitals": total_hospitals,
        "total_emergencies": total_emergencies,
        "false_alarms": false_alarms,
        "false_alarm_rate_percent": false_alarm_rate,
        "resolved_cases": resolved_cases,
        "avg_response_time_minutes": 4.2
    }

@app.get("/api/admin/audit-logs")
def get_audit_logs(db: Session = Depends(get_db)):
    return db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(50).all()

# ==========================================
# MODULE 11: WebSocket Live Tracking Endpoint
# ==========================================
@app.websocket("/ws/live-tracking/{emergency_id}")
async def websocket_live_tracking(websocket: WebSocket, emergency_id: int):
    await ws_manager.connect(websocket, emergency_id)
    try:
        while True:
            # Client sends telemetry updates
            data = await websocket.receive_json()
            # Broadcast update to family & hospital listeners
            await ws_manager.broadcast_location(emergency_id, data)
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, emergency_id)
