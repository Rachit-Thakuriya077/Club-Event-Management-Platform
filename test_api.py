import sys
from fastapi.testclient import TestClient
from main import app
from seed_data import seed_demo_data

def run_tests():
    # Fresh seed for test
    seed_demo_data(force=True)
    client = TestClient(app)
    
    print("========================================")
    print("RUNNING BACKEND TEST SUITE")
    print("========================================")
    
    # 1. Test event list
    resp = client.get("/api/events")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    events = resp.json()["items"]
    assert len(events) >= 8, f"Expected at least 8 events, got {len(events)}"
    print("[PASS 1/10] Event listing and pagination OK")
    
    # 2. Test categories
    resp = client.get("/api/categories")
    assert resp.status_code == 200
    cats = resp.json()
    assert len(cats) >= 4
    print(f"[PASS 2/10] Event categories OK: {[c['category'] for c in cats]}")
    
    # Find specific event IDs from list
    web3_event = next(e for e in events if "Web3" in e["title"])
    quantum_event = next(e for e in events if "Quantum" in e["title"])
    first_event = events[0]
    gaming_event = next(e for e in events if "Esports" in e["title"])

    # 3. Test Student Login
    login_resp = client.post("/api/auth/login", json={"email": "student@srmist.edu.in", "password": "student123"})
    assert login_resp.status_code == 200
    student_token = login_resp.json()["access_token"]
    student_headers = {"Authorization": f"Bearer {student_token}"}
    print("[PASS 3/10] Student login OK")
    
    # 4. Test Admin Login
    admin_login_resp = client.post("/api/auth/login", json={"email": "admin@acm.srmist.edu.in", "password": "admin123"})
    assert admin_login_resp.status_code == 200
    admin_token = admin_login_resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("[PASS 4/10] Admin login OK")
    
    # 5. Test Register for Event (Web3 Bootcamp)
    reg_resp = client.post(f"/api/events/{web3_event['id']}/register", headers=student_headers)
    assert reg_resp.status_code == 201, f"Reg failed: {reg_resp.text}"
    ticket_id = reg_resp.json()["registration"]["ticket_id"]
    reg_id = reg_resp.json()["registration"]["id"]
    print(f"[PASS 5/10] Event registration successful! Ticket ID: {ticket_id}")
    
    # 6. Test Duplicate Registration (Expect 409 Conflict)
    dup_resp = client.post(f"/api/events/{web3_event['id']}/register", headers=student_headers)
    assert dup_resp.status_code == 409, f"Expected 409 for duplicate registration, got {dup_resp.status_code}"
    print(f"[PASS 6/10] Duplicate registration prevented: {dup_resp.json()['detail']}")
    
    # 7. Test Capacity Limit (Quantum event has max_capacity 2 and already 2 registrations)
    new_user_resp = client.post("/api/auth/register", json={
        "name": "Test Student",
        "email": "teststudent@srmist.edu.in",
        "password": "password123",
        "role": "student"
    })
    assert new_user_resp.status_code == 201
    new_student_token = new_user_resp.json()["access_token"]
    new_student_headers = {"Authorization": f"Bearer {new_student_token}"}
    
    full_attempt = client.post(f"/api/events/{quantum_event['id']}/register", headers=new_student_headers)
    assert full_attempt.status_code == 400, f"Expected 400 for full event, got {full_attempt.status_code} with {full_attempt.text}"
    assert "capacity" in full_attempt.json()["detail"].lower() or "full" in full_attempt.json()["detail"].lower()
    print(f"[PASS 7/10] Full event capacity enforcement OK: {full_attempt.json()['detail']}")
    
    # 8. Test Cancellation (restores slot)
    cancel_resp = client.post(f"/api/registrations/{reg_id}/cancel", headers=student_headers)
    assert cancel_resp.status_code == 200
    print("[PASS 8/10] Registration cancellation OK")
    
    # 9. Test Admin Overview & Participants
    overview_resp = client.get("/api/admin/overview", headers=admin_headers)
    assert overview_resp.status_code == 200
    print("[PASS 9/10] Admin overview metrics OK")
    
    participants_resp = client.get(f"/api/admin/events/{first_event['id']}/participants", headers=admin_headers)
    assert participants_resp.status_code == 200
    
    # 10. Test Check-In Desk
    checkin_resp = client.post("/api/admin/check-in", json={"ticket_id": ticket_id}, headers=admin_headers)
    # Since we cancelled reg_id, ticket is cancelled
    assert checkin_resp.status_code == 400
    
    # Register again for Gaming event and check in
    reg_gaming = client.post(f"/api/events/{gaming_event['id']}/register", headers=student_headers)
    assert reg_gaming.status_code == 201
    ticket_gaming = reg_gaming.json()["registration"]["ticket_id"]
    
    checkin_ok = client.post("/api/admin/check-in", json={"ticket_id": ticket_gaming}, headers=admin_headers)
    assert checkin_ok.status_code == 200
    assert checkin_ok.json()["success"] is True
    print(f"[PASS 10/10] Admin check-in desk OK: {checkin_ok.json()['message']}")

    print("\n========================================")
    print("ALL 10 BACKEND INTEGRATION TESTS PASSED PERFECTLY!")
    print("========================================")

if __name__ == "__main__":
    run_tests()
