import sys
from pathlib import Path
from unittest.mock import patch

sys.path.append(str(Path(__file__).resolve().parents[1] / "app" / "backend"))

import app as backend_app


def run_today_plan_scenario(*, readiness_score, timing_state, fatigue_score, recovery_state=None):
    if recovery_state is None:
        recovery_state = {}

    client = backend_app.app.test_client()

    auth_user = {"user_id": "1", "username": "jakob", "role": "admin"}
    checkins = [{"id": "c1", "user_id": "1", "date": "2026-03-23", "created_at": "2026-03-23T08:00:00+00:00"}]

    today_ctx = {
        "readiness_score": readiness_score,
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
        "fatigue_score": fatigue_score,
        "recovery_state": recovery_state,
        "fatigue_session_override": None,
    }

    with patch.object(backend_app, "require_auth_user", return_value=(auth_user, None)), \
         patch.object(backend_app, "list_user_items", return_value=checkins), \
         patch.object(backend_app, "get_storage_last_error", return_value=None), \
         patch.object(backend_app, "list_workouts_for_user", return_value=[]), \
         patch.object(backend_app, "read_json_file", return_value=[]), \
         patch.object(backend_app, "build_today_plan_context", return_value=today_ctx), \
         patch.object(backend_app, "build_today_plan_fatigue_context", return_value=fatigue_ctx), \
         patch.object(backend_app, "build_today_plan_timing_state", return_value=timing_state):

        response = client.get("/api/today-plan")

    assert response.status_code == 200, response.data.decode("utf-8")
    payload = response.get_json()
    assert payload and payload.get("ok") is True, payload
    assert isinstance(payload.get("item"), dict), payload
    return payload["item"]


def test_low_readiness():
    item = run_today_plan_scenario(
        readiness_score=2,
        timing_state="on_time",
        fatigue_score=0,
    )
    assert item["session_type"] == "restitution", item
    assert item["template_id"] == "restitution_easy", item


def test_early_timing():
    item = run_today_plan_scenario(
        readiness_score=5,
        timing_state="early",
        fatigue_score=0,
    )
    assert item["session_type"] == "cardio", item
    assert item["template_id"] == "cardio_easy", item


def test_high_fatigue():
    item = run_today_plan_scenario(
        readiness_score=5,
        timing_state="on_time",
        fatigue_score=6,
    )
    assert item["session_type"] == "restitution", item
    assert item["template_id"] == "restitution_easy", item


if __name__ == "__main__":
    test_low_readiness()
    test_early_timing()
    test_high_fatigue()
    print("All today-plan scenario tests passed")
