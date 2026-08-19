from fastapi.testclient import TestClient
from database import Base, engine, SessionLocal
from main import app
from models import User, Hospital, EmergencyEvent
from auth import create_access_token, get_password_hash
from services.google_places_service import sync_bengaluru_hospital_registry, calculate_haversine_distance

client = TestClient(app)

def setup_module():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Sync Bengaluru hospitals
    sync_bengaluru_hospital_registry(db)

    # Ensure admin user exists
    admin = db.query(User).filter(User.email == "admin_test_places@resqnet.com").first()
    if not admin:
        admin = User(
            full_name="Admin Test Places",
            email="admin_test_places@resqnet.com",
            hashed_password=get_password_hash("password123"),
            phone="+919999900001",
            role="admin"
        )
        db.add(admin)

    # Ensure regular user exists
    user = db.query(User).filter(User.email == "user_test_places@resqnet.com").first()
    if not user:
        user = User(
            full_name="User Test Places",
            email="user_test_places@resqnet.com",
            hashed_password=get_password_hash("password123"),
            phone="+919999900002",
            role="user"
        )
        db.add(user)

    db.commit()
    db.close()

def test_haversine_distance_calculation():
    # Distance between MG Road Bengaluru (12.9756, 77.6068) and Manipal Hospital HAL Road (12.9582, 77.6485) ~4.9 km
    dist = calculate_haversine_distance(12.9756, 77.6068, 12.9582, 77.6485)
    assert 4.0 <= dist <= 6.0

def test_get_nearby_hospitals_sorted():
    # Query nearby hospitals from MG Road Bengaluru
    response = client.get("/api/hospitals/nearby?lat=12.9756&lon=77.6068")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3

    # Verify distance sorting
    distances = [h["distance_km"] for h in data]
    assert distances == sorted(distances)

def test_hospital_claim_registration_and_admin_verification():
    db = SessionLocal()
    admin_user = db.query(User).filter(User.email == "admin_test_places@resqnet.com").first()
    regular_user = db.query(User).filter(User.email == "user_test_places@resqnet.com").first()
    db.close()

    user_token = create_access_token(data={"sub": regular_user.email, "role": "user"})
    admin_token = create_access_token(data={"sub": admin_user.email, "role": "admin"})

    # 1. Submit claim for Fortis Hospital Bannerghatta Road (Place ID: ChIJs8k-7M4UrjsR4c0E1z0y-Xk)
    claim_payload = {
        "google_place_id": "ChIJs8k-7M4UrjsR4c0E1z0y-Xk",
        "hospital_name": "Fortis Hospital Bannerghatta Road",
        "registration_number": "KA-MED-9948",
        "contact_person": "Dr. Ramesh",
        "phone": "+918066214444",
        "email": "contact@fortis.com",
        "address": "154/9, Bannerghatta Main Rd, Bengaluru"
    }

    claim_res = client.post(
        "/api/hospitals/register-claim",
        json=claim_payload,
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert claim_res.status_code == 200
    claim_data = claim_res.json()
    assert claim_data["verification_status"] == "PENDING"
    h_id = claim_data["hospital_id"]

    # 2. Get Admin Registry overview
    reg_res = client.get(
        "/api/admin/hospitals/registry",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert reg_data["pending_count"] >= 1

    # 3. Approve claim as Admin
    verify_res = client.post(
        "/api/admin/hospitals/verify",
        json={"hospital_id": h_id, "action": "approve"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["verification_status"] == "VERIFIED"
    assert verify_data["is_registered_resqnet"] is True

def test_emergency_routing_filters_verified_hospitals():
    db = SessionLocal()
    user = db.query(User).filter(User.email == "user_test_places@resqnet.com").first()
    db.close()

    user_token = create_access_token(data={"sub": user.email, "role": "user"})

    # Trigger Emergency in Bengaluru
    em_res = client.post(
        "/api/emergency/create",
        json={
            "trigger_source": "MANUAL_SOS",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "speed": 0.0,
            "battery_level": 90,
            "network_status": "5G"
        },
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert em_res.status_code == 200
    em_data = em_res.json()
    assert em_data["assigned_hospital_id"] is not None

    # Verify assigned hospital is verified ResQNet hospital
    db = SessionLocal()
    assigned_h = db.query(Hospital).filter(Hospital.id == em_data["assigned_hospital_id"]).first()
    assert assigned_h is not None
    assert assigned_h.is_registered_resqnet is True
    assert assigned_h.verification_status == "VERIFIED"
    db.close()

if __name__ == "__main__":
    setup_module()
    test_haversine_distance_calculation()
    test_get_nearby_hospitals_sorted()
    test_hospital_claim_registration_and_admin_verification()
    test_emergency_routing_filters_verified_hospitals()
    print("ALL GOOGLE PLACES & HOSPITAL REGISTRY TESTS PASSED!")
