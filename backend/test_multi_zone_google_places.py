from fastapi.testclient import TestClient
from database import Base, engine, SessionLocal
from main import app
from models import Hospital
from services.google_places_service import sync_bengaluru_hospital_registry, BENGALURU_SEARCH_ZONES

client = TestClient(app)

def test_multi_zone_discovery_execution():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Trigger multi-zone discovery sync
    metrics = sync_bengaluru_hospital_registry(db)

    assert metrics["status"] == "success"
    assert metrics["label"] == "Google Places Hospitals — Bengaluru Coverage"
    assert metrics["search_zones_used"] == len(BENGALURU_SEARCH_ZONES)
    assert metrics["search_zones_used"] == 12
    assert "unique_hospitals_discovered" in metrics
    assert "duplicates_removed" in metrics
    assert "api_requests_made" in metrics
    assert metrics["unique_hospitals_discovered"] >= 8

    # Verify deduplication in database
    place_ids = [h.google_place_id for h in db.query(Hospital).all() if h.google_place_id]
    assert len(place_ids) == len(set(place_ids)), "Duplicate Google Place IDs found in database!"

    # Verify discovered Google Places hospitals remain UNREGISTERED by default
    unregistered_hospitals = db.query(Hospital).filter(Hospital.verification_status == "UNREGISTERED").all()
    for h in unregistered_hospitals:
        assert h.is_registered_resqnet is False

    print(f"\n[MULTI-ZONE TEST PASSED]")
    print(f"Unique Hospitals Discovered: {metrics['unique_hospitals_discovered']}")
    print(f"Search Zones Used: {metrics['search_zones_used']}")
    print(f"API Requests Made: {metrics['api_requests_made']}")
    print(f"Duplicates Removed: {metrics['duplicates_removed']}")

    db.close()

if __name__ == "__main__":
    test_multi_zone_discovery_execution()
