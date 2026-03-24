import sys
from pathlib import Path
from unittest.mock import patch

sys.path.append(str(Path(__file__).resolve().parents[1] / "app" / "backend"))
import app as backend_app


def test_today_plan_explanation_contract():
    client = backend_app.app.test_client()

    auth_user = {"user_id": "1"}

    checkins = [{
        "id": "c1",
        "user_id": "1",
        "date": "2026-03-23",
        "created_at": "2026-03-23T08:00:00+00:00"
    }]

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

    strength_ctx = {
        "template_id": "strength_basic",
        "plan_entries": [{"exercise_id": "squat"}],
        "plan_variant": "default",
        "reason": "styrke prioriteres",
    }

    with patch.object(backend_app, "require_auth_user", return_value=(auth_user, None)), \
         patch.object(backend_app, "list_user_items", return_value=checkins), \
         patch.object(backend_app, "get_storage_last_error", return_value=None), \
         patch.object(backend_app, "list_workouts_for_user", return_value=[]), \
         patch.object(backend_app, "build_today_plan_context", return_value=today_ctx), \
         patch.object(backend_app, "build_today_plan_fatigue_context", return_value=fatigue_ctx), \
         patch.object(backend_app, "build_today_plan_timing_state", return_value="on_time"), \
         patch.object(backend_app, "build_strength_plan", return_value=strength_ctx):

        response = client.get("/api/today-plan")

    assert response.status_code == 200
    item = response.get_json()["item"]

    trace = item.get("decision_trace")
    assert isinstance(trace, dict), item

    required_keys = [
        "readiness_bucket",
        "fatigue_bucket",
        "timing",
        "rule_applied",
        "override",
    ]

    for key in required_keys:
        assert key in trace, f"Missing key: {key}"

    assert trace["readiness_bucket"] in ("low", "high")
    assert trace["fatigue_bucket"] in ("low", "elevated", "moderate", "high", "completed_today")
    assert isinstance(trace["timing"], str)
    assert isinstance(trace["rule_applied"], str)
