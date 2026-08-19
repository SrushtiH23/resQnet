from fastapi.testclient import TestClient
from database import Base, engine, SessionLocal
from main import app
from models import User, EvaluationTestResult
from auth import create_access_token, get_password_hash

client = TestClient(app)

def setup_module():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Create admin user
    admin = db.query(User).filter(User.email == "eval_admin_cumulative@resqnet.com").first()
    if not admin:
        admin = User(
            full_name="Cumulative Eval Admin",
            email="eval_admin_cumulative@resqnet.com",
            hashed_password=get_password_hash("password123"),
            phone="+919999900099",
            role="admin"
        )
        db.add(admin)
        db.commit()

    # Clear previous evaluation test results for clean verification
    db.query(EvaluationTestResult).delete()
    db.commit()
    db.close()

def get_fall_frames():
    # Frames that satisfy: free_fall (<7.0), impact (>14.0), rotation (>45.0), stillness (tail variance <3.5)
    return [
        {"ax": 0.2, "ay": 9.8, "az": 0.5, "gx": 1.0, "gy": 1.0, "gz": 0.5},
        {"ax": 0.5, "ay": 1.2, "az": 0.8, "gx": 12.0, "gy": 15.0, "gz": 8.0}, # Free fall
        {"ax": 12.5, "ay": 18.2, "az": 8.4, "gx": 85.0, "gy": 120.0, "gz": 45.0}, # Impact + Rotation
        {"ax": 0.1, "ay": 9.8, "az": 0.2, "gx": 0.5, "gy": 0.4, "gz": 0.2}, # Tail Stillness
        {"ax": 0.1, "ay": 9.8, "az": 0.2, "gx": 0.5, "gy": 0.4, "gz": 0.2},
        {"ax": 0.1, "ay": 9.8, "az": 0.2, "gx": 0.5, "gy": 0.4, "gz": 0.2},
        {"ax": 0.1, "ay": 9.8, "az": 0.2, "gx": 0.5, "gy": 0.4, "gz": 0.2},
        {"ax": 0.1, "ay": 9.8, "az": 0.2, "gx": 0.5, "gy": 0.4, "gz": 0.2},
        {"ax": 0.1, "ay": 9.8, "az": 0.2, "gx": 0.5, "gy": 0.4, "gz": 0.2},
        {"ax": 0.1, "ay": 9.8, "az": 0.2, "gx": 0.5, "gy": 0.4, "gz": 0.2}
    ]

def get_normal_frames():
    # Normal activity static/gentle motion
    return [{"ax": 0.2, "ay": 9.8, "az": 0.5, "gx": 1.0, "gy": 1.0, "gz": 0.5}]

def test_cumulative_evaluation_metrics_sequence():
    db = SessionLocal()
    admin = db.query(User).filter(User.email == "eval_admin_cumulative@resqnet.com").first()
    db.close()

    admin_token = create_access_token(data={"sub": admin.email, "role": "admin"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Step 1: Insert 5 intentionally different ground-truth / prediction test outcomes:
    # 0 TP, 2 TN, 1 FP, 2 FN

    # Test 1: Ground Truth Normal, Predicted Normal -> TN
    r1 = client.post("/api/admin/evaluation/run-test", json={
        "test_type": "Normal Activity",
        "frames": get_normal_frames(),
        "activity_notes": "Normal walk test 1"
    }, headers=headers)
    assert r1.status_code == 200
    assert r1.json()["final_classification"] == "TN"

    # Test 2: Ground Truth Normal, Predicted Normal -> TN
    r2 = client.post("/api/admin/evaluation/run-test", json={
        "test_type": "Normal Activity",
        "frames": get_normal_frames(),
        "activity_notes": "Normal walk test 2"
    }, headers=headers)
    assert r2.status_code == 200
    assert r2.json()["final_classification"] == "TN"

    # Test 3: Ground Truth Normal, Predicted Fall -> FP
    r3 = client.post("/api/admin/evaluation/run-test", json={
        "test_type": "Normal Activity",
        "frames": get_fall_frames(),
        "activity_notes": "False Positive motion test"
    }, headers=headers)
    assert r3.status_code == 200
    assert r3.json()["final_classification"] == "FP"

    # Test 4: Ground Truth Fall, Predicted Normal -> FN
    r4 = client.post("/api/admin/evaluation/run-test", json={
        "test_type": "Fall",
        "frames": get_normal_frames(),
        "activity_notes": "False Negative fall motion 1"
    }, headers=headers)
    assert r4.status_code == 200
    assert r4.json()["final_classification"] == "FN"

    # Test 5: Ground Truth Fall, Predicted Normal -> FN
    r5 = client.post("/api/admin/evaluation/run-test", json={
        "test_type": "Fall",
        "frames": get_normal_frames(),
        "activity_notes": "False Negative fall motion 2"
    }, headers=headers)
    assert r5.status_code == 200
    assert r5.json()["final_classification"] == "FN"

    # Verify Metrics after 5 tests:
    # TP=0, TN=2, FP=1, FN=2 -> Total = 5, Correct = 2, Accuracy = 2/5 = 0.40 (40%)
    m1 = client.get("/api/admin/evaluation/metrics", headers=headers).json()
    assert m1["total_tests"] == 5
    assert m1["tp"] == 0
    assert m1["tn"] == 2
    assert m1["fp"] == 1
    assert m1["fn"] == 2
    assert m1["total_tests"] == m1["tp"] + m1["tn"] + m1["fp"] + m1["fn"]
    assert m1["accuracy"] == 0.40

    # Step 2: Add 6th test correctly classified as Normal -> TN
    r6 = client.post("/api/admin/evaluation/run-test", json={
        "test_type": "Normal Activity",
        "frames": get_normal_frames(),
        "activity_notes": "Normal walk test 3"
    }, headers=headers)
    assert r6.status_code == 200
    assert r6.json()["final_classification"] == "TN"

    # Verify Metrics after 6th test:
    # TN becomes 3, Total = 6 -> Accuracy = 3/6 = 0.50 (50.0%)
    # ACCURACY MUST NOT BECOME 100%!
    m2 = client.get("/api/admin/evaluation/metrics", headers=headers).json()
    assert m2["total_tests"] == 6
    assert m2["tp"] == 0
    assert m2["tn"] == 3
    assert m2["fp"] == 1
    assert m2["fn"] == 2
    assert m2["total_tests"] == m2["tp"] + m2["tn"] + m2["fp"] + m2["fn"]
    assert m2["accuracy"] == 0.50, f"Expected 0.50 (50%), got {m2['accuracy']}"
    assert m2["accuracy"] != 1.0, "Accuracy incorrectly jumped to 100%!"

    print("\n[CUMULATIVE EVALUATION METRICS TEST PASSED]")
    print(f"Total Tests: {m2['total_tests']} (TP={m2['tp']}, TN={m2['tn']}, FP={m2['fp']}, FN={m2['fn']})")
    print(f"Cumulative Accuracy: {m2['accuracy'] * 100}%")

if __name__ == "__main__":
    setup_module()
    test_cumulative_evaluation_metrics_sequence()
