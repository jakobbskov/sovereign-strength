import sys
from pathlib import Path
from unittest.mock import patch

sys.path.append(str(Path(__file__).resolve().parents[1] / "app" / "backend"))

import app as backend_app


def test_today_plan_contract_shape():
    client = backend_app.app.test_client()

    auth_user = {"user_id": "1"}

    today_ctx = {
        "readiness_score": 5,
        "checkin_date": "2026-03-23",
        "time_budget_min": 45,
        "user_settings": {},
        "training_day_ctx": {},
        "weekly_target_sessions": 3,
        "weekly_status": {},
    }

    fatigue_ctx = {
        "latest_strength": None,
        "days_since_last_strength": None,
        "session_results": [],
        "previous_recommendation": None,
        "latest_strength_session": None,
        "latest_strength_failed": False,
        "latest_strength_load_drop_count": 0,
        "latest_strength_completed": None,
        "fatigue_score": 0,
        "recovery_state": {},
        "fatigue_session_override": None,
    }

    with patch.object(backend_app, "require_auth_user", return_value=(auth_user, None)), \
         patch.object(backend_app, "list_user_items", return_value=[{"id": "c1", "date": "2026-03-23"}]), \
         patch.object(backend_app, "list_workouts_for_user", return_value=[]), \
         patch.object(backend_app, "build_today_plan_context", return_value=today_ctx), \
         patch.object(backend_app, "build_today_plan_fatigue_context", return_value=fatigue_ctx), \
         patch.object(backend_app, "build_today_plan_timing_state", return_value="on_time"):

        response = client.get("/api/today-plan")

    assert response.status_code == 200

    payload = response.get_json()
    item = payload.get("item")

    # Required keys
    required_keys = [
        "date",
        "session_type",
        "template_id",
        "plan_variant",
        "readiness_score",
        "time_budget_min",
        "entries",
        "reason",
    ]

    for key in required_keys:
        assert key in item, f"Missing key: {key}"

    # Type checks (simple but brutal)
    assert isinstance(item["entries"], list)
    assert isinstance(item["session_type"], str)
    assert isinstance(item["template_id"], str)
    assert isinstance(item["plan_variant"], str)


if __name__ == "__main__":
    test_today_plan_contract_shape()
    print("Today-plan contract test passed")
