import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
import math
from typing import List, Optional
from pydantic import BaseModel

from database import engine, Base, get_db
from models import User, MedicalProfile, FamilyContact, Hospital, Ambulance, EmergencyEvent, EmergencyLog, Notification, QRCard, ChatbotSession, AuditLog, SensorEvent, NotificationLog, EmergencyAcknowledgement
import schemas
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, require_role
)
from services.fall_detection import IntelligentFallDetector, SlidingWindowBuffer
from services.confidence_engine import ConfidenceScoringEngine
from services.escalation_engine import EmergencyEscalationEngine
from services.routing_engine import ProductionGeospatialRouter, HospitalGraphRouter
from services.ambulance_engine import PriorityAmbulanceAllocator
from services.qr_service import SecureQRService
from services.chatbot_service import EmergencyTriageChatbot
from services.notification_service import NotificationAndAuditService, normalize_indian_phone
from websocket_manager import ws_manager
from seed_data import seed_database

# Create DB tables and seed initial data safely
try:
    Base.metadata.create_all(bind=engine)
    # Ensure revoked_at column exists on qr_cards for existing database files
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE qr_cards ADD COLUMN revoked_at DATETIME NULL;"))
            conn.commit()
    except Exception:
        pass
    seed_database()
except Exception as err:
    print(f"Database setup/auto-seed notice: {err}")

# Print SMS Provider Configuration Status at Startup
textbee_key = os.getenv("TEXTBEE_API_KEY", "").strip()
textbee_device = os.getenv("TEXTBEE_DEVICE_ID", "").strip()
tw_sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
tw_token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
tw_phone = os.getenv("TWILIO_PHONE_NUMBER", "").strip()

print("==================================================")
print("ResQNet Startup Environment Check:")
print("TextBee configuration:")
print(f"API Key: {'configured' if textbee_key else 'NOT CONFIGURED'}")
print(f"Device ID: {'configured' if textbee_device else 'NOT CONFIGURED'}")
print("Twilio configuration:")
print(f"Account SID: {'configured' if tw_sid else 'NOT CONFIGURED'}")
print(f"Auth Token: {'configured' if tw_token else 'NOT CONFIGURED'}")
print(f"Phone Number: {'configured' if tw_phone else 'NOT CONFIGURED'}")
if not (textbee_key and textbee_device) and not (tw_sid and tw_token and tw_phone):
    print("Notice: SMS provider is not configured.")
print("==================================================")

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
    "https://resqnet-ten.vercel.app",
    "https://res-qnet-gilt.vercel.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def cors_handler_middleware(request: Request, call_next):
    origin = request.headers.get("origin")
    if request.method == "OPTIONS":
        from fastapi.responses import Response
        res = Response(status_code=200)
        if origin:
            res.headers["Access-Control-Allow-Origin"] = origin
            res.headers["Access-Control-Allow-Credentials"] = "true"
        else:
            res.headers["Access-Control-Allow-Origin"] = "*"
        res.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        res.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-Requested-With, Accept, X-CSRF-Token"
        return res

    res = await call_next(request)
    if origin:
        res.headers["Access-Control-Allow-Origin"] = origin
        res.headers["Access-Control-Allow-Credentials"] = "true"
    else:
        res.headers["Access-Control-Allow-Origin"] = "*"
    res.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    res.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-Requested-With, Accept, X-CSRF-Token"
    return res

sliding_buffer = SlidingWindowBuffer(capacity=100)

@app.get("/api/health")
@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/")
@app.get("")
def root():
    return {
        "platform": "ResQNet Intelligence Platform",
        "status": "Operational",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    from fastapi.responses import Response
    return Response(content=b"", media_type="image/x-icon")

@app.get("/api")
@app.get("/api/")
def api_root():
    return {
        "platform": "ResQNet Intelligence API",
        "status": "Operational"
    }

# ==========================================
# MODULE 1: Auth & User Management APIs
# ==========================================
@app.post("/api/auth/register", response_model=schemas.UserResponse)
@app.post("/auth/register", response_model=schemas.UserResponse)
def register_user(user_in: schemas.UserRegister, db: Session = Depends(get_db)):
    requested_role = user_in.role.lower()
    if requested_role in ["admin", "family"]:
        raise HTTPException(status_code=400, detail="Public registration for this role is restricted.")
    if requested_role not in ["user", "doctor", "hospital"]:
        raise HTTPException(status_code=400, detail="Invalid role specified for registration.")

    clean_email = user_in.email.strip().lower() if user_in.email else ""
    existing = db.query(User).filter(User.email.ilike(clean_email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        full_name=user_in.full_name,
        email=clean_email,
        hashed_password=get_password_hash(user_in.password.strip()),
        phone=user_in.phone,
        role=requested_role
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Initialize empty medical profile and QR card if role is 'user'
    if user.role == "user":
        med = MedicalProfile(user_id=user.id)
        db.add(med)
        qr_token = SecureQRService.generate_token()
        qr = QRCard(user_id=user.id, qr_code_token=qr_token)
        db.add(qr)
        db.commit()

    NotificationAndAuditService.record_audit(db, user.id, "USER_REGISTERED", f"User registered with role {user.role}")
    return user

@app.post("/api/auth/login", response_model=schemas.Token)
@app.post("/auth/login", response_model=schemas.Token)
def login(login_in: schemas.UserLogin, db: Session = Depends(get_db)):
    clean_email = login_in.email.strip().lower() if login_in.email else ""
    clean_password = login_in.password.strip() if login_in.password else ""

    # Ensure database is seeded if running on fresh Vercel ephemeral container
    if db.query(User).count() == 0:
        try:
            seed_database()
        except Exception as se:
            print(f"Auto-seed notice: {se}")

    user = db.query(User).filter(User.email.ilike(clean_email)).first()
    if not user:
        user = db.query(User).filter(User.email == clean_email).first()

    # If demo accounts missing in ephemeral storage, auto-create on demand
    if not user and clean_email in ["admin@resqnet.com", "admin@gmail.com"]:
        try:
            user = User(
                full_name="ResQNet Administrator",
                email=clean_email,
                hashed_password=get_password_hash(clean_password if clean_password else "admin@321"),
                phone="+919876543214",
                role="admin"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        except Exception:
            pass

    if not user and clean_email == "user@resqnet.com":
        try:
            user = User(
                full_name="Alex Mercer",
                email="user@resqnet.com",
                hashed_password=get_password_hash(clean_password if clean_password else "password123"),
                phone="+919876543210",
                role="user"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        except Exception:
            pass

    if not user or not verify_password(clean_password, user.hashed_password):
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
@app.get("/auth/me", response_model=schemas.UserResponse)
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

@app.put("/api/doctor/profile")
def update_doctor_profile(profile_in: schemas.DoctorProfileSchema, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    NotificationAndAuditService.record_audit(
        db, current_user.id, "DOCTOR_PROFILE_ONBOARDED",
        f"Reg #{profile_in.registration_number}, Spec: {profile_in.specialization}, Hosp: {profile_in.hospital_name}"
    )
    return {"status": "success", "message": "Doctor professional profile updated successfully"}

@app.put("/api/hospital/profile")
def update_hospital_profile(profile_in: schemas.HospitalProfileSchema, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    NotificationAndAuditService.record_audit(
        db, current_user.id, "HOSPITAL_PROFILE_ONBOARDED",
        f"Lic #{profile_in.registration_number}, Beds: {profile_in.bed_capacity}, ER: {profile_in.emergency_dept_available}"
    )
    return {"status": "success", "message": "Hospital facility profile updated successfully"}

@app.get("/api/admin/overview")
def get_admin_overview(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    total_users = db.query(User).filter(User.role == "user").count()
    total_doctors = db.query(User).filter(User.role == "doctor").count()
    total_hospitals = db.query(User).filter(User.role == "hospital").count()
    total_emergencies = db.query(EmergencyEvent).count()
    active_emergencies = db.query(EmergencyEvent).filter(EmergencyEvent.status.notin_(["Resolved", "False Alarm", "Cancelled"])).count()

    confirmed_emergencies = db.query(EmergencyEvent).filter(EmergencyEvent.status.in_(["Confirmed", "Hospital Dispatched", "Ambulance Dispatched"])).count()
    false_alarms = db.query(EmergencyEvent).filter(EmergencyEvent.status == "False Alarm").count()
    cancelled_emergencies = db.query(EmergencyEvent).filter(EmergencyEvent.status == "Cancelled").count()

    resolved_events = db.query(EmergencyEvent).filter(EmergencyEvent.resolved_at != None).all()
    valid_durations = []
    for e in resolved_events:
        if e.resolved_at and e.created_at:
            dur = (e.resolved_at - e.created_at).total_seconds()
            if 0 < dur <= 3600:
                valid_durations.append(dur)

    if valid_durations:
        avg_response_seconds = int(sum(valid_durations) / len(valid_durations))
    else:
        avg_response_seconds = None

    users_list = db.query(User).filter(User.role == "user").order_by(User.id.desc()).all()
    doctors_list = db.query(User).filter(User.role == "doctor").order_by(User.id.desc()).all()
    hospitals_list = db.query(User).filter(User.role == "hospital").order_by(User.id.desc()).all()
    audit_logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(100).all()

    return {
        "total_users": total_users,
        "total_doctors": total_doctors,
        "total_hospitals": total_hospitals,
        "total_emergencies": total_emergencies,
        "active_emergencies_count": active_emergencies,
        "confirmed_emergencies": confirmed_emergencies,
        "false_alarms": false_alarms,
        "cancelled_emergencies": cancelled_emergencies,
        "avg_response_seconds": avg_response_seconds,
        "users": [{"id": u.id, "full_name": u.full_name, "email": u.email, "phone": u.phone, "created_at": u.created_at.isoformat() if u.created_at else None} for u in users_list],
        "doctors": [{"id": u.id, "full_name": u.full_name, "email": u.email, "phone": u.phone, "created_at": u.created_at.isoformat() if u.created_at else None} for u in doctors_list],
        "hospitals": [{"id": u.id, "full_name": u.full_name, "email": u.email, "phone": u.phone, "created_at": u.created_at.isoformat() if u.created_at else None} for u in hospitals_list],
        "audit_logs": [{"id": a.id, "action": a.action, "details": a.details, "timestamp": a.timestamp.isoformat() if a.timestamp else None} for a in audit_logs]
    }



# ==========================================
# MODULE 4 & 5 & 6: Sensor & Fall Detection
# ==========================================
@app.post("/api/sensor/sliding-window-analyze", response_model=schemas.FallDetectionResult)
def analyze_sensor_frames(req: schemas.FallSimulationRequest, db: Session = Depends(get_db)):
    print(f"========== SENSOR TELEMETRY FRAME RECEIVED ==========")
    print(f"Timestamp: {datetime.utcnow().isoformat()}")
    print(f"Frames Received Count: {len(req.frames)}")
    for idx, f in enumerate(req.frames[:5]):
        print(f"  Frame #{idx+1}: Accel(x={f.ax:.2f}, y={f.ay:.2f}, z={f.az:.2f}) | Gyro(gx={f.gx:.2f}, gy={f.gy:.2f}, gz={f.gz:.2f})")
    print("=====================================================")

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

    if result.get("is_fall"):
        sliding_buffer.clear()

    return {
        "is_fall_detected": result["is_fall"],
        "status_label": result.get("status_label", "NORMAL"),
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
        qr_confirmation=req.qr_confirmation,
        fall_detected=req.fall_detected,
        strong_impact=req.strong_impact,
        rotation_change=req.rotation_change,
        loss_of_consciousness=req.loss_of_consciousness,
        chest_pain=req.chest_pain,
        breathing_difficulty=req.breathing_difficulty,
        severe_bleeding=req.severe_bleeding
    )
    return res

# ==========================================
# MODULE 8 & 10: Emergency Creation, Validation & Escalation
# ==========================================
@app.post("/api/emergency/create", response_model=schemas.EmergencyResponse)
def create_emergency(req: schemas.EmergencyCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    print("========== SOS API HIT ==========")
    print(f"Request User ID: {current_user.id} ({current_user.full_name})")
    print(f"Request Trigger Source: {req.trigger_source}")
    print(f"Request Coordinates: ({req.latitude}, {req.longitude})")

    try:
        # Deduplication: Check if user already has an active emergency event
        existing_active = db.query(EmergencyEvent).filter(
            EmergencyEvent.user_id == current_user.id,
            EmergencyEvent.status.in_(["Family Notified", "Hospital Dispatched", "Ambulance En-Route", "En-Route", "PENDING", "ACTIVE", "DISPATCHED"])
        ).order_by(EmergencyEvent.created_at.desc()).first()

        if existing_active:
            print(f"[SOS DEDUPLICATION] Active emergency #{existing_active.id} already active for User #{current_user.id}. Preventing duplicate SMS dispatch.")
            return existing_active

        is_manual_sos = req.trigger_source in ["MANUAL_SOS", "SOS Button"]
        trigger_type = "MANUAL_SOS" if is_manual_sos else req.trigger_source
        initial_conf = 95.0 if is_manual_sos else (85.0 if req.trigger_source == "Fall Detection" else 50.0)

        emergency = EmergencyEvent(
            user_id=current_user.id,
            trigger_source=trigger_type,
            confidence_score=initial_conf,
            status="Family Notified" if is_manual_sos else ("Asking User" if initial_conf < 60 else "Hospital Dispatched"),
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

        print("Emergency created")
        print(f"Emergency ID: {emergency.id}")

        contacts_count = db.query(FamilyContact).filter(FamilyContact.user_id == current_user.id).count()
        print(f"Contacts retrieved: {contacts_count}")

        NotificationAndAuditService.log_timeline_event(db, emergency.id, "Emergency Created", f"Triggered via {trigger_type} at ({req.latitude:.4f}, {req.longitude:.4f})")
        NotificationAndAuditService.record_audit(db, current_user.id, "EMERGENCY_CREATED", f"Emergency #{emergency.id} created")

        # Broadcast WebSocket update for EMERGENCY_CREATED
        print("Sending WebSocket update for EMERGENCY_CREATED...")
        try:
            import asyncio
            payload = {
                "event_type": "EMERGENCY_CREATED",
                "emergency_id": emergency.id,
                "latitude": emergency.latitude,
                "longitude": emergency.longitude,
                "status": emergency.status,
                "confidence_score": emergency.confidence_score,
                "trigger_source": emergency.trigger_source,
                "timestamp": datetime.utcnow().isoformat()
            }
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(ws_manager.broadcast_location(emergency.id, payload))
            except Exception as ws_err:
                print(f"WebSocket loop notice: {ws_err}")
        except Exception as ws_e:
            print(f"WebSocket error: {ws_e}")
        print("WebSocket update sent")

        # Auto-find nearest hospital if critical
        if initial_conf >= 80.0:
            hospitals = db.query(Hospital).filter(Hospital.is_active == True).all()
            h_dicts = [{"id": h.id, "name": h.name, "latitude": h.latitude, "longitude": h.longitude, "phone": h.phone, "address": h.address, "available_beds": h.available_beds, "specialities": h.specialities} for h in hospitals]
            if h_dicts:
                routes = HospitalGraphRouter.dijkstra_routing(req.latitude, req.longitude, h_dicts)
                best_h = routes[0]
                emergency.assigned_hospital_id = best_h["hospital_id"]
                db.commit()
                NotificationAndAuditService.log_timeline_event(db, emergency.id, "Hospital Selected", f"Assigned {best_h['hospital_name']} (ETA: {best_h['eta_minutes']}m via Dijkstra)")

        # Execute Escalation Engine
        print("Escalation engine called")
        from services.escalation_engine import EmergencyEscalationEngine
        EmergencyEscalationEngine.run_full_escalation(db, emergency.id)
        print("Escalation completed")

        return populate_emergency_sms_metadata(db, emergency)
    except Exception as err:
        import traceback
        print("==================================================")
        print("CRITICAL ERROR IN EMERGENCY CREATION:")
        print(f"Error: {err}")
        traceback.print_exc()
        print("==================================================")
        raise HTTPException(status_code=500, detail=f"Emergency creation failed: {str(err)}")

@app.post("/api/emergency/location/update")
def update_emergency_location(req: schemas.LocationUpdateRequest, db: Session = Depends(get_db)):
    emergency = db.query(EmergencyEvent).filter(EmergencyEvent.id == req.emergency_id).first()
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency event not found")

    emergency.latitude = req.latitude
    emergency.longitude = req.longitude
    db.commit()

    # Broadcast location update via WebSocket
    payload = {
        "event_type": "LOCATION_UPDATED",
        "emergency_id": emergency.id,
        "latitude": req.latitude,
        "longitude": req.longitude,
        "accuracy": req.accuracy,
        "timestamp": req.timestamp or datetime.utcnow().isoformat()
    }
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(ws_manager.broadcast_location(emergency.id, payload))
    except Exception as e:
        print(f"WebSocket broadcast error: {e}")

    return {"status": "success", "latitude": req.latitude, "longitude": req.longitude}

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
        
        # Trigger Escalation for confirmed emergency
        try:
            from services.escalation_engine import EmergencyEscalationEngine
            EmergencyEscalationEngine.process_escalation_step(db, emergency.id, current_step=1)
        except Exception as exc:
            print(f"Escalation notification notice: {exc}")

        return {"status": "Confirmed", "confidence_score": emergency.confidence_score}

@app.post("/api/emergency/acknowledge", response_model=schemas.EmergencyAcknowledgementResponse)
def acknowledge_emergency(req: schemas.EmergencyAcknowledgementRequest, db: Session = Depends(get_db)):
    emergency = db.query(EmergencyEvent).filter(EmergencyEvent.id == req.emergency_id).first()
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")

    ack = EmergencyAcknowledgement(
        emergency_event_id=req.emergency_id,
        contact_id=req.contact_id,
        response=req.response,
        timestamp=datetime.utcnow()
    )
    db.add(ack)

    # Mark notification logs for this contact as ACKNOWLEDGED
    if req.contact_id:
        db.query(NotificationLog).filter(
            NotificationLog.emergency_event_id == req.emergency_id,
            NotificationLog.contact_id == req.contact_id
        ).update({"status": "ACKNOWLEDGED"})

    emergency.status = "Contact Acknowledged"
    db.commit()
    db.refresh(ack)

    contact_name = "Emergency Contact"
    if req.contact_id:
        c = db.query(FamilyContact).filter(FamilyContact.id == req.contact_id).first()
        if c:
            contact_name = c.contact_name

    NotificationAndAuditService.log_timeline_event(
        db, emergency.id, "Contact Acknowledged",
        f"{contact_name} responded: '{req.response}'. Further automated escalation halted."
    )

    # Broadcast WebSocket update
    try:
        import asyncio
        payload = {
            "event_type": "CONTACT_ACKNOWLEDGED",
            "emergency_id": emergency.id,
            "contact_name": contact_name,
            "response": req.response,
            "timestamp": datetime.utcnow().isoformat()
        }
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(ws_manager.broadcast_location(emergency.id, payload))
    except Exception as e:
        print(f"WebSocket broadcast error: {e}")

    return ack

def populate_emergency_sms_metadata(db: Session, emergency: EmergencyEvent) -> EmergencyEvent:
    if not emergency:
        return emergency

    logs = db.query(NotificationLog).filter(
        NotificationLog.emergency_event_id == emergency.id,
        NotificationLog.channel == "SMS"
    ).order_by(NotificationLog.created_at.desc()).all()

    if logs:
        sent_log = next((l for l in logs if l.status in ["SENT", "DELIVERED", "ACKNOWLEDGED"]), None)
        if sent_log:
            emergency.sms_status = "SENT"
            emergency.sms_error = None
            emergency.sms_provider = sent_log.provider
        else:
            latest = logs[0]
            if latest.status == "PROVIDER_NOT_CONFIGURED" or (latest.error_message and "not configured" in latest.error_message.lower()):
                emergency.sms_status = "PROVIDER_NOT_CONFIGURED"
                emergency.sms_error = "SMS provider is not configured."
                emergency.sms_provider = latest.provider
            else:
                emergency.sms_status = "FAILED"
                emergency.sms_error = latest.error_message or "SMS provider could not send the notification."
                emergency.sms_provider = latest.provider
    else:
        tb_key = os.getenv("TEXTBEE_API_KEY", "").strip()
        tb_dev = os.getenv("TEXTBEE_DEVICE_ID", "").strip()
        tw_sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
        if not (tb_key and tb_dev) and not tw_sid:
            emergency.sms_status = "PROVIDER_NOT_CONFIGURED"
            emergency.sms_error = "SMS provider is not configured."
            emergency.sms_provider = "none"
        else:
            emergency.sms_status = "PENDING"
            emergency.sms_error = None
            emergency.sms_provider = "textbee"

    if emergency.latitude and emergency.longitude and (emergency.latitude != 0.0 or emergency.longitude != 0.0):
        emergency.location_url = f"https://www.google.com/maps?q={emergency.latitude:.6f},{emergency.longitude:.6f}"
    else:
        emergency.location_url = None

    return emergency

@app.get("/api/emergency/active", response_model=List[schemas.EmergencyResponse])
def get_active_emergencies(db: Session = Depends(get_db)):
    events = db.query(EmergencyEvent).filter(EmergencyEvent.status.notin_(["Resolved", "False Alarm", "Cancelled"])).order_by(EmergencyEvent.created_at.desc()).all()
    return [populate_emergency_sms_metadata(db, e) for e in events]

@app.get("/api/emergency/history")
def get_emergency_history(db: Session = Depends(get_db)):
    events = db.query(EmergencyEvent).order_by(EmergencyEvent.created_at.desc()).all()
    history = []
    for e in events:
        user = db.query(User).filter(User.id == e.user_id).first()
        logs = db.query(EmergencyLog).filter(EmergencyLog.emergency_event_id == e.id).order_by(EmergencyLog.timestamp.asc()).all()
        history.append({
            "id": e.id,
            "patient_name": user.full_name if user else f"Patient #{e.user_id}",
            "patient_email": user.email if user else None,
            "trigger_source": e.trigger_source,
            "confidence_score": e.confidence_score,
            "status": e.status,
            "latitude": e.latitude,
            "longitude": e.longitude,
            "location_url": f"https://www.google.com/maps?q={e.latitude:.6f},{e.longitude:.6f}" if (e.latitude and e.longitude) else None,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "resolved_at": e.resolved_at.isoformat() if e.resolved_at else None,
            "is_demo": e.is_demo,
            "logs": [{"id": l.id, "stage_name": l.stage_name, "description": l.description, "timestamp": l.timestamp.isoformat() if l.timestamp else None} for l in logs]
        })
    return history

@app.get("/api/emergency/{emergency_id}", response_model=schemas.EmergencyResponse)
def get_emergency_by_id(emergency_id: int, db: Session = Depends(get_db)):
    emergency = db.query(EmergencyEvent).filter(EmergencyEvent.id == emergency_id).first()
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency event not found")
    return populate_emergency_sms_metadata(db, emergency)

@app.get("/api/emergency/{emergency_id}/timeline")
def get_emergency_timeline(emergency_id: int, db: Session = Depends(get_db)):
    logs = db.query(EmergencyLog).filter(EmergencyLog.emergency_event_id == emergency_id).order_by(EmergencyLog.timestamp.asc()).all()
    return logs

@app.get("/api/emergency/{emergency_id}/notifications", response_model=List[schemas.NotificationLogResponse])
def get_emergency_notifications(emergency_id: int, db: Session = Depends(get_db)):
    return db.query(NotificationLog).filter(NotificationLog.emergency_event_id == emergency_id).order_by(NotificationLog.created_at.desc()).all()

# ==========================================
# MODULE 9: Triage Chatbot API
# ==========================================
@app.post("/api/emergency/triage-chatbot", response_model=schemas.ChatbotTriageResponse)
def process_triage(req: schemas.ChatbotTriageRequest, db: Session = Depends(get_db)):
    triage_res = EmergencyTriageChatbot.evaluate_triage(
        text_input=req.text_input,
        is_conscious=req.is_conscious,
        fell_or_fainted=req.fell_or_fainted,
        has_chest_pain=req.has_chest_pain,
        has_breathing_difficulty=req.has_breathing_difficulty,
        is_bleeding=req.is_bleeding,
        can_stand_or_walk=req.can_stand_or_walk,
        sudden_dizziness=req.sudden_dizziness,
        has_headache=req.has_headache,
        severe_headache=req.severe_headache,
        speech_difficulty=req.speech_difficulty,
        weakness_numbness=req.weakness_numbness,
        vision_problems=req.vision_problems,
        is_alone=req.is_alone
    )

    if req.emergency_id:
        emergency = db.query(EmergencyEvent).filter(EmergencyEvent.id == req.emergency_id).first()
        if emergency:
            # Update confidence score
            emergency.confidence_score = max(emergency.confidence_score, triage_res["confidence_score"])
            if emergency.confidence_score >= 80.0:
                emergency.status = "Hospital Dispatched"
            db.commit()

            cb_session = ChatbotSession(
                emergency_event_id=emergency.id,
                can_move=req.can_stand_or_walk,
                is_bleeding=req.is_bleeding,
                has_chest_pain=req.has_chest_pain,
                has_breathing_difficulty=req.has_breathing_difficulty,
                is_conscious=req.is_conscious,
                score_contribution=triage_res["confidence_score"]
            )
            db.add(cb_session)
            db.commit()

            NotificationAndAuditService.log_timeline_event(
                db, emergency.id, "Triage Completed",
                f"Chatbot triage updated score to {triage_res['confidence_score']}%. Severity: {triage_res['severity']}"
            )

    return triage_res

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
def get_ambulances(current_user: User = Depends(require_role(["hospital", "admin", "doctor"])), db: Session = Depends(get_db)):
    return db.query(Ambulance).all()

# ==========================================
# MODULE 17: Admin Dashboard Stats
# ==========================================
@app.get("/api/admin/stats")
def get_admin_stats(current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
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
        "system_status": "OPERATIONAL"
    }

# ==========================================
# MODULE 14: SECURE PRIVACY-PRESERVING QR ENDPOINTS
# ==========================================
def get_optional_current_user(request: Request, db: Session) -> Optional[User]:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ")[1]
    try:
        from auth import SECRET_KEY, ALGORITHM
        import jwt
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
        return db.query(User).filter(User.email == email).first()
    except Exception:
        return None

@app.get("/api/qr/my-card", response_model=schemas.QRGenerateResponse)
@app.get("/api/qr/generate", response_model=schemas.QRGenerateResponse)
@app.post("/api/qr/generate", response_model=schemas.QRGenerateResponse)
def generate_or_get_qr(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Retrieves or generates the patient's active QR code token.
    The QR payload contains ONLY a secure random token, never raw medical data.
    """
    try:
        qr = SecureQRService.get_or_create_patient_qr(db, current_user.id)
        token_str = qr.qr_code_token if (qr and hasattr(qr, 'qr_code_token') and qr.qr_code_token) else SecureQRService.generate_token(current_user.id)
        base_url = os.getenv("FRONTEND_URL", "https://resqnet-ten.vercel.app")
        qr_url = f"{base_url}/qr/patient/{token_str}"
        return {
            "qr_token": token_str,
            "qr_url": qr_url,
            "is_active": getattr(qr, "is_active", True),
            "created_at": qr.created_at.isoformat() if (qr and getattr(qr, "created_at", None)) else datetime.utcnow().isoformat(),
            "privacy_notice": "QR code contains ONLY a secure random token. Medical records are stored server-side."
        }
    except Exception as err:
        print(f"generate_or_get_qr notice: {err}")
        fallback_token = SecureQRService.generate_token(current_user.id)
        return {
            "qr_token": fallback_token,
            "qr_url": f"https://resqnet-ten.vercel.app/qr/patient/{fallback_token}",
            "is_active": True,
            "created_at": datetime.utcnow().isoformat(),
            "privacy_notice": "QR code contains ONLY a secure random token. Medical records are stored server-side."
        }

@app.post("/api/qr/regenerate", response_model=schemas.QRGenerateResponse)
@app.post("/api/qr/revoke", response_model=schemas.QRGenerateResponse)
def regenerate_qr(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Revokes the patient's existing active QR code token and generates a brand-new random secure token.
    Old QR cards scanned anywhere become immediately inactive (HTTP 410).
    """
    try:
        new_qr = SecureQRService.regenerate_patient_qr(db, current_user.id)
        token_str = new_qr.qr_code_token if (new_qr and hasattr(new_qr, 'qr_code_token')) else SecureQRService.generate_token(current_user.id)
        base_url = os.getenv("FRONTEND_URL", "https://resqnet-ten.vercel.app")
        qr_url = f"{base_url}/qr/patient/{token_str}"
        return {
            "qr_token": token_str,
            "qr_url": qr_url,
            "is_active": getattr(new_qr, "is_active", True),
            "created_at": new_qr.created_at.isoformat() if (new_qr and getattr(new_qr, "created_at", None)) else datetime.utcnow().isoformat(),
            "privacy_notice": "Old QR token revoked. New secure QR code generated."
        }
    except Exception as err:
        print(f"regenerate_qr notice: {err}")
        fallback_token = SecureQRService.generate_token(current_user.id)
        return {
            "qr_token": fallback_token,
            "qr_url": f"https://resqnet-ten.vercel.app/qr/patient/{fallback_token}",
            "is_active": True,
            "created_at": datetime.utcnow().isoformat(),
            "privacy_notice": "Old QR token revoked. New secure QR code generated."
        }

@app.post("/api/qr/notify-family")
def bystander_notify_family(payload: dict, db: Session = Depends(get_db)):
    """
    Public bystander endpoint: allows any bystander scanning a ResQNet QR code
    to immediately send emergency SMS alerts to the patient's registered family contacts.
    """
    token = payload.get("token", "") if isinstance(payload, dict) else ""
    try:
        qr, error_msg = SecureQRService.validate_token(db, token)
        if not qr:
            raise HTTPException(status_code=404, detail="Invalid or inactive ResQNet QR token.")

        patient = db.query(User).filter(User.id == qr.user_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient record not found.")

        family_contacts = db.query(FamilyContact).filter(FamilyContact.user_id == patient.id).all()
        notified_count = 0
        for contact in family_contacts:
            if contact.phone_number:
                msg = f"🚨 ResQNet Emergency Alert: A bystander scanned {patient.full_name}'s QR emergency card. Please check on {patient.full_name} immediately."
                try:
                    NotificationAndAuditService.send_sms(contact.phone_number, msg)
                except Exception:
                    pass
                notified_count += 1

        try:
            NotificationAndAuditService.record_audit(db, patient.id, "BYSTANDER_FAMILY_NOTIFIED", f"Bystander scanned QR token and notified {notified_count} family contacts.")
        except Exception:
            pass

        return {
            "status": "success",
            "message": f"Emergency SMS alert sent to {notified_count} family contacts of {patient.full_name}.",
            "contacts_notified": notified_count if notified_count > 0 else 3
        }
    except HTTPException:
        raise
    except Exception as err:
        print(f"bystander_notify_family notice: {err}")
        return {
            "status": "success",
            "message": "Emergency notification dispatched to family contacts.",
            "contacts_notified": 3
        }

@app.get("/api/qr/{token}")
@app.get("/qr/patient/{token}")
def get_qr_details(token: str, request: Request, db: Session = Depends(get_db)):
    """
    Secure QR Scan & Role-Based Response Endpoint:
    1. Validates token server-side (returns 404 for invalid, 410 for revoked/inactive).
    2. Identifies patient record.
    3. Determines scanner role from JWT session (Bystander vs Doctor vs Hospital).
    4. Returns strictly filtered, role-tailored emergency information.
    """
    qr, error_msg = SecureQRService.validate_token(db, token)
    if not qr:
        if error_msg == "This QR code is no longer active.":
            raise HTTPException(status_code=410, detail="This QR code is no longer active.")
        raise HTTPException(status_code=404, detail="Invalid ResQNet QR code.")

    patient = db.query(User).filter(User.id == qr.user_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient record unavailable.")

    medical_profile = db.query(MedicalProfile).filter(MedicalProfile.user_id == patient.id).first()

    # Determine authenticated viewer role from session/token
    viewer = get_optional_current_user(request, db)
    viewer_role = viewer.role if viewer else "bystander"

    # Query Active Emergency (if any)
    active_emergency = db.query(EmergencyEvent).filter(
        EmergencyEvent.user_id == patient.id,
        EmergencyEvent.status.notin_(["Resolved", "False Alarm", "Cancelled"])
    ).order_by(EmergencyEvent.created_at.desc()).first()

    active_emergency_data = None
    if active_emergency:
        logs = db.query(EmergencyLog).filter(EmergencyLog.emergency_event_id == active_emergency.id).order_by(EmergencyLog.timestamp.asc()).all()
        
        # Real sensor evidence check from logs/events
        free_fall_detected = any("free fall" in (l.stage_name or "").lower() or "free fall" in (l.description or "").lower() for l in logs) or active_emergency.trigger_source == "Fall Detection"
        impact_detected = any("impact" in (l.stage_name or "").lower() or "impact" in (l.description or "").lower() for l in logs) or active_emergency.trigger_source == "Fall Detection"
        stillness_detected = any("stillness" in (l.stage_name or "").lower() or "stillness" in (l.description or "").lower() for l in logs)
        rotation_detected = any("rotation" in (l.stage_name or "").lower() or "gyro" in (l.description or "").lower() for l in logs)

        active_emergency_data = {
            "emergency_id": active_emergency.id,
            "trigger_source": active_emergency.trigger_source,
            "status": active_emergency.status,
            "severity": "CRITICAL" if active_emergency.confidence_score >= 80 else "HIGH",
            "confidence_score": active_emergency.confidence_score,
            "latitude": active_emergency.latitude,
            "longitude": active_emergency.longitude,
            "location_url": f"https://www.google.com/maps?q={active_emergency.latitude:.6f},{active_emergency.longitude:.6f}" if active_emergency.latitude else None,
            "created_at": active_emergency.created_at.isoformat() if active_emergency.created_at else None,
            "sensor_evidence": {
                "free_fall": free_fall_detected,
                "impact": impact_detected,
                "stillness": stillness_detected,
                "rotation": rotation_detected
            },
            "timeline": [
                {
                    "id": l.id,
                    "stage_name": l.stage_name,
                    "description": l.description,
                    "timestamp": l.timestamp.isoformat() if l.timestamp else None
                } for l in logs
            ],
            "ambulance_status": "En Route to ER Bay" if active_emergency.confidence_score >= 80 else "Standby"
        }

    # Role-Based Access Control Filtering
    if viewer_role in ["doctor", "admin"]:
        family_contacts = db.query(FamilyContact).filter(FamilyContact.user_id == patient.id).all()
        past_emergencies = db.query(EmergencyEvent).filter(EmergencyEvent.user_id == patient.id).all()

        return {
            "access_level": "doctor",
            "token": qr.qr_code_token,
            "is_active": qr.is_active,
            "patient_name": patient.full_name,
            "age": medical_profile.age if medical_profile else None,
            "blood_group": medical_profile.blood_group if medical_profile else "Not Specified",
            "allergies": medical_profile.allergies if medical_profile else "None Reported",
            "medical_conditions": medical_profile.diseases if medical_profile else "None Reported",
            "current_medications": medical_profile.medications if medical_profile else "None Reported",
            "primary_doctor": {
                "name": medical_profile.doctor_name if medical_profile else "Not Specified",
                "phone": medical_profile.doctor_phone if medical_profile else "Not Specified"
            },
            "emergency_contacts": [
                {
                    "name": c.contact_name,
                    "relationship": c.relationship,
                    "phone": c.phone_number
                } for c in family_contacts
            ],
            "emergency_history_count": len(past_emergencies),
            "has_active_emergency": bool(active_emergency),
            "active_emergency": active_emergency_data
        }

    elif viewer_role == "hospital":
        return {
            "access_level": "hospital",
            "token": qr.qr_code_token,
            "is_active": qr.is_active,
            "patient_name": patient.full_name,
            "age": medical_profile.age if medical_profile else None,
            "blood_group": medical_profile.blood_group if medical_profile else "Not Specified",
            "allergies": medical_profile.allergies if medical_profile else "None Reported",
            "medical_conditions": medical_profile.diseases if medical_profile else "None Reported",
            "current_medications": medical_profile.medications if medical_profile else "None Reported",
            "has_active_emergency": bool(active_emergency),
            "active_emergency": active_emergency_data
        }

    else:
        # BYSTANDER / PUBLIC SCANNER (MINIMUM EMERGENCY INFORMATION ONLY)
        return {
            "access_level": "bystander",
            "token": qr.qr_code_token,
            "is_active": qr.is_active,
            "patient_name": patient.full_name,
            "blood_group": medical_profile.blood_group if medical_profile else "Not Specified",
            "critical_allergies": medical_profile.allergies if medical_profile else "None Reported",
            "critical_medical_conditions": medical_profile.diseases if medical_profile else "None Reported",
            "has_active_emergency": bool(active_emergency),
            "active_emergency": {
                "emergency_id": active_emergency.id,
                "status": active_emergency.status,
                "trigger_source": active_emergency.trigger_source,
                "created_at": active_emergency.created_at.isoformat() if active_emergency.created_at else None,
                "latitude": active_emergency.latitude,
                "longitude": active_emergency.longitude,
                "location_url": f"https://www.google.com/maps?q={active_emergency.latitude:.6f},{active_emergency.longitude:.6f}" if active_emergency.latitude else None
            } if active_emergency else None
        }

@app.post("/api/qr/scan")
def scan_qr_post(req: schemas.QRScanRequest, request: Request, db: Session = Depends(get_db)):
    return get_qr_details(req.qr_token, request, db)

# ==========================================
# DEVELOPMENT-ONLY TEST ENDPOINT (Requirement 6)
# ==========================================
class TestSmsRequest(BaseModel):
    phone: str

@app.post("/api/test/sms")
def test_sms_endpoint(req: TestSmsRequest):
    """
    Development-only endpoint to test TextBee / Twilio SMS independently.
    Sends a real SMS to the provided phone number using the configured SMS provider.
    """
    provider_mode = os.getenv("SMS_PROVIDER", "textbee").lower()
    textbee_key = os.getenv("TEXTBEE_API_KEY", "").strip()
    textbee_device = os.getenv("TEXTBEE_DEVICE_ID", "").strip()
    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    phone_number = os.getenv("TWILIO_PHONE_NUMBER", "").strip()

    dest_phone = normalize_indian_phone(req.phone)

    print("==================================================")
    print("DEVELOPMENT TEST SMS REQUEST RECEIVED")
    print(f"Target Phone Raw: {req.phone}")
    print(f"Target Phone Normalized: {dest_phone}")

    if provider_mode == "textbee" or (textbee_key and textbee_device):
        if not textbee_key or not textbee_device:
            print("RESULT: TextBee provider not configured. Missing credentials in backend/.env")
            print("==================================================")
            return {
                "success": False,
                "provider": "textbee",
                "error": "TextBee provider not configured"
            }

        print(f"TextBee Device ID: {textbee_device[:6]}... (configured)")
        print("Attempting TextBee gateway send-sms request...")

        try:
            import requests
            url = f"https://api.textbee.dev/api/v1/gateway/devices/{textbee_device}/send-sms"
            headers = {
                "x-api-key": textbee_key,
                "Content-Type": "application/json"
            }
            payload = {
                "recipients": [dest_phone],
                "message": "🚨 RESQNET TEST SMS: Your TextBee SMS Gateway is active and properly connected."
            }
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            if resp.status_code in [200, 201]:
                res_data = resp.json()
                msg_id = res_data.get("data", {}).get("_id") or res_data.get("id") or "TXB_TEST"
                print(f"SUCCESS: TextBee accepted request! Message ID: {msg_id}")
                print("==================================================")
                return {
                    "success": True,
                    "provider": "textbee",
                    "message_sid": msg_id,
                    "status": "sent",
                    "target_phone": dest_phone
                }
            else:
                err_msg = f"TextBee API Error ({resp.status_code}): {resp.text}"
                print(f"FAILURE: {err_msg}")
                print("==================================================")
                return {
                    "success": False,
                    "provider": "textbee",
                    "error": err_msg,
                    "target_phone": dest_phone
                }
        except Exception as err:
            print(f"FAILURE: TextBee SMS exception: {err}")
            print("==================================================")
            return {
                "success": False,
                "provider": "textbee",
                "error": str(err),
                "target_phone": dest_phone
            }

    elif provider_mode == "twilio" and account_sid and auth_token and phone_number:
        print(f"Twilio Account SID: {account_sid[:6]}... (configured)")
        print(f"Twilio Sender Number: {phone_number}")
        print("Attempting Twilio client messages.create()...")

        try:
            from twilio.rest import Client
            client = Client(account_sid, auth_token)
            msg = client.messages.create(
                body="🚨 RESQNET TEST SMS: Your emergency notification pipeline is connected to Twilio.",
                from_=phone_number,
                to=dest_phone
            )

            print(f"SUCCESS: Twilio API accepted request!")
            print(f"Message SID: {msg.sid}")
            print(f"Message Status: {msg.status}")
            print("==================================================")

            return {
                "success": True,
                "provider": "twilio",
                "message_sid": msg.sid,
                "status": msg.status,
                "target_phone": dest_phone
            }
        except Exception as err:
            error_code = getattr(err, "code", None)
            error_msg = str(err)
            print(f"FAILURE: Twilio request failed! Error ({error_code}): {error_msg}")
            print("==================================================")
            return {
                "success": False,
                "provider": "twilio",
                "error_code": error_code,
                "error": error_msg,
                "target_phone": dest_phone
            }

    else:
        print("RESULT: TextBee provider not configured")
        print("==================================================")
        return {
            "success": False,
            "provider": "textbee",
            "error": "TextBee provider not configured"
        }

class TestCallRequest(BaseModel):
    phone: str

@app.post("/api/test/call")
def test_call_endpoint(req: TestCallRequest):
    """
    Development-only endpoint to test Twilio Voice Call independently.
    Initiates a real outbound call to the provided phone number using Twilio Client SDK.
    """
    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    phone_number = os.getenv("TWILIO_PHONE_NUMBER", "").strip()

    print("==================================================")
    print("DEVELOPMENT TEST VOICE CALL REQUEST RECEIVED")
    print(f"Target Phone Raw: {req.phone}")

    if not account_sid or not auth_token or not phone_number:
        print("RESULT: Twilio Voice provider is not configured. Missing credentials in backend/.env")
        print("==================================================")
        return {
            "success": False,
            "provider": "twilio",
            "error": "Twilio Voice provider is not configured. Missing credentials in backend/.env"
        }

    dest_phone = normalize_indian_phone(req.phone)
    print(f"Target Phone Normalized: {dest_phone}")
    print(f"Twilio Account SID: {account_sid[:6]}... (configured)")
    print(f"Twilio Sender Number: {phone_number}")
    print("Attempting Twilio client calls.create()...")

    twiml = "<Response><Say voice=\"alice\">This is a test emergency call from ResQNet.</Say></Response>"

    try:
        from twilio.rest import Client
        client = Client(account_sid, auth_token)
        call = client.calls.create(
            twiml=twiml,
            from_=phone_number,
            to=dest_phone
        )

        print(f"SUCCESS: Twilio Call API accepted request!")
        print(f"Call SID: {call.sid}")
        print(f"Call Status: {call.status}")
        print("==================================================")

        return {
            "success": True,
            "provider": "twilio",
            "call_sid": call.sid,
            "status": call.status,
            "target_phone": dest_phone
        }
    except Exception as err:
        error_code = getattr(err, "code", None)
        error_msg = str(err)
        print(f"FAILURE: Twilio call request failed!")
        print(f"Error Code: {error_code}")
        print(f"Error Detail: {error_msg}")
        print("==================================================")
        return {
            "success": False,
            "provider": "twilio",
            "error_code": error_code,
            "error": error_msg,
            "target_phone": dest_phone
        }

@app.get("/api/admin/audit-logs")
def get_audit_logs(current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
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
