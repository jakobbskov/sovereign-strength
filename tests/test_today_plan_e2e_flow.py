import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "app" / "backend"))

import app as backend_app


def test_today_plan_flow_basic():
    client = backend_app.app.test_client()

    # Mock auth (simpel version)
    backend_app.require_auth_user = lambda: ({"user_id": "1"}, None)

    # 1. Create checkin
    response = client.post("/api/checkin", json={
        "date": "2026-03-23",
        "sleep_score": 5,
        "energy_score": 5,
        "soreness_score": 1,
        "time_budget_min": 45,
    })
    assert response.status_code == 201, response.data

    # 2. Get today plan
    response = client.get("/api/today-plan")
    assert response.status_code == 200, response.data

    plan = response.get_json()["item"]
    assert isinstance(plan, dict)

    # 3. Log session result (minimal)
    response = client.post("/api/session-result", json={
        "date": "2026-03-23",
        "session_type": plan["session_type"],
        "completed": True,
        "results": [],
    })

    # Må gerne fejle for styrke uden data – vi tester flow, ikke perfeksion
    assert response.status_code in (200, 201, 400), response.data

    # 4. Get today plan again (should not crash)
    response = client.get("/api/today-plan")
    assert response.status_code == 200, response.data

    print("E2E flow test passed")


if __name__ == "__main__":
    test_today_plan_flow_basic()
