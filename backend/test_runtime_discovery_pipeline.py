import os
from fastapi.testclient import TestClient
from database import Base, engine, SessionLocal
from main import app
from models import Hospital, User
from services.google_places_service import sync_bengaluru_hospital_registry, BENGALURU_SEARCH_ZONES, GOOGLE_MAPS_API_KEY
from auth import create_access_token, get_password_hash

client = TestClient(app)

def test_runtime_discovery_pipeline():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Clear hospitals table to test exact refresh count consistency
    db.query(Hospital).delete()
    db.commit()

    # Step 1: Ensure admin user exists for authenticating Admin Console endpoints
    admin = db.query(User).filter(User.email == "admin_pipeline_test@resqnet.com").first()
    if not admin:
        admin = User(
            full_name="Pipeline Test Admin",
            email="admin_pipeline_test@resqnet.com",
            hashed_password=get_password_hash("password123"),
            phone="+919876543210",
            role="admin"
        )
        db.add(admin)
        db.commit()

    admin_token = create_access_token(data={"sub": admin.email, "role": "admin"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    print("\n==================================================")
    print("RUNTIME DISCOVERY PIPELINE AUDIT")
    print("==================================================")
    print(f"1. Google Maps API Key Status: {'CONFIGURED (' + GOOGLE_MAPS_API_KEY[:8] + '...)' if GOOGLE_MAPS_API_KEY else 'NOT CONFIGURED (Using Attributed Seed Directory)'}")
    print(f"2. Total Search Zones Configured: {len(BENGALURU_SEARCH_ZONES)}")

    # Step 2: Execute actual refresh endpoint /api/hospitals/discover-bengaluru
    refresh_resp = client.post("/api/hospitals/discover-bengaluru")
    assert refresh_resp.status_code == 200
    sync_res = refresh_resp.json()

    print("\n--------------------------------------------------")
    print("ZONE-BY-ZONE EXECUTION BREAKDOWN (16 REGIONS):")
    print("--------------------------------------------------")

    region_diags = sync_res.get("region_diagnostics", [])
    assert len(region_diags) == 16, f"Expected 16 region diagnostics, got {len(region_diags)}"

    for idx, reg in enumerate(region_diags, 1):
        r_name = reg["region_name"]
        reqs = reg["search_requests"]
        pages = reg["pages_retrieved"]
        raw = reg["raw_results"]
        unique = reg["unique_hospitals"]
        print(f"Zone {idx:02d}: {r_name:<35} | Req: {reqs:2d} | Pages: {pages:2d} | Raw: {raw:3d} | Unique: {unique:3d}")

    # Step 3: Verify Backend Admin Endpoint /api/admin/hospitals/registry
    registry_resp = client.get("/api/admin/hospitals/registry", headers=headers)
    assert registry_resp.status_code == 200
    registry_data = registry_resp.json()

    # Step 4: Verify Database Count
    db_count = db.query(Hospital).count()
    backend_response_count = len(registry_data.get("hospitals", []))
    discovered_count_stat = registry_data.get("discovered_count", 0)

    print("\n--------------------------------------------------")
    print("CONSISTENCY VERIFICATION (REQUIREMENT #13):")
    print("--------------------------------------------------")
    print(f"Total Raw Results:              {sync_res['raw_results_received']}")
    print(f"Total Duplicates Removed:       {sync_res['duplicates_removed']}")
    print(f"Total Unique Hospitals Stored:  {sync_res['unique_hospitals_discovered']}")
    print(f"Database Count:                 {db_count}")
    print(f"Backend Response Count:         {backend_response_count}")
    print(f"UI Displayed Dataset Count:     {discovered_count_stat}")
    print("--------------------------------------------------")

    # Assert 3-way consistency: Database count == Backend response count == UI displayed dataset count
    assert db_count == backend_response_count == discovered_count_stat, \
        f"Mismatched counts! DB={db_count}, Backend={backend_response_count}, UI Stat={discovered_count_stat}"

    assert db_count == sync_res['unique_hospitals_discovered'], \
        f"Database count ({db_count}) does not match stored sync unique count ({sync_res['unique_hospitals_discovered']})"

    print("\n[THREE-WAY CONSISTENCY PASSED CLEANLY!]\n")
    db.close()

if __name__ == "__main__":
    test_runtime_discovery_pipeline()
