from fastapi.testclient import TestClient
from database import Base, engine, SessionLocal
from main import app
from models import Hospital
from services.google_places_service import sync_bengaluru_hospital_registry, BENGALURU_SEARCH_ZONES

client = TestClient(app)

def test_full_bengaluru_places_discovery():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Trigger multi-zone discovery sync
    metrics = sync_bengaluru_hospital_registry(db)

    assert metrics["status"] == "success"
    assert metrics["label"] == "Real Google Places hospital directory — Bengaluru coverage"
    assert metrics["search_zones_used"] == len(BENGALURU_SEARCH_ZONES)
    assert metrics["search_zones_used"] == 12
    assert "unique_hospitals_discovered" in metrics
    assert "duplicates_removed" in metrics
    assert "api_requests_made" in metrics
    assert "verified_resqnet_hospitals" in metrics
    assert "unregistered_hospitals" in metrics

    # Verify deduplication in database
    place_ids = [h.google_place_id for h in db.query(Hospital).all() if h.google_place_id]
    assert len(place_ids) == len(set(place_ids)), "Duplicate Google Place IDs found in database!"

    # Verify discovered Google Places hospitals remain UNREGISTERED by default
    unregistered_hospitals = db.query(Hospital).filter(Hospital.verification_status == "UNREGISTERED").all()
    for h in unregistered_hospitals:
        assert h.is_registered_resqnet is False

    print("\n==================================================")
    print("BENGALURU GOOGLE PLACES DISCOVERY METRICS REPORT:")
    print("==================================================")
    print(f"Total Unique Hospitals Discovered: {metrics['unique_hospitals_discovered']}")
    print(f"Number of Geographic Areas Searched: {metrics['search_zones_used']}")
    print(f"Number of Duplicates Removed: {metrics['duplicates_removed']}")
    print(f"Number of API Requests Made: {metrics['api_requests_made']}")
    print(f"Number of Verified ResQNet Hospitals: {metrics['verified_resqnet_hospitals']}")
    print(f"Number of Unregistered Hospitals: {metrics['unregistered_hospitals']}")
    print("==================================================\n")

    db.close()

if __name__ == "__main__":
    test_full_bengaluru_places_discovery()
