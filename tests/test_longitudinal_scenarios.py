import sys
from pathlib import Path
from unittest.mock import patch

sys.path.append(str(Path(__file__).resolve().parents[1] / "app" / "backend"))

import app as backend_app


def run_longitudinal_day(*, day_index, readiness_score, fatigue_score, timing_state="on_time", recovery_state=None, training_day_ctx=None, weekly_status=None):
    if recovery_state is None:
        recovery_state = {}
    if training_day_ctx is None:
        training_day_ctx = {}
    if weekly_status is None:
        weekly_status = {}

    client = backend_app.app.test_client()

    auth_user = {"user_id": "1", "username": "jakob", "role": "admin"}
    date_str = f"2026-04-{day_index + 1:02d}"

    checkins = [{
        "id": f"c{day_index + 1}",
        "user_id": "1",
        "date": date_str,
        "created_at": f"{date_str}T08:00:00+00:00"
    }]

    today_ctx = {
        "readiness_score": readiness_score,
        "checkin_date": date_str,
        "time_budget_min": 45,
        "user_settings": {},
        "training_day_ctx": training_day_ctx,
        "weekly_target_sessions": 3,
        "weekly_status": weekly_status,
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


def run_scenario(days):
    outputs = []
    for idx, day in enumerate(days):
        item = run_longitudinal_day(
            day_index=idx,
            readiness_score=day["readiness_score"],
            fatigue_score=day["fatigue_score"],
            timing_state=day.get("timing_state", "on_time"),
            recovery_state=day.get("recovery_state", {}),
            training_day_ctx=day.get("training_day_ctx", {}),
            weekly_status=day.get("weekly_status", {}),
        )
        outputs.append(item)
    return outputs


def test_running_focused_user_14_days():
    days = []
    for idx in range(14):
        days.append({
            "readiness_score": 5 if idx % 4 else 4,
            "fatigue_score": 4 if idx in (2, 5, 9, 12) else 2,
            "timing_state": "early" if idx in (1, 4, 8, 11) else "on_time",
            "training_day_ctx": {"is_training_day": idx % 2 == 0},
            "weekly_status": {"completed_sessions": idx % 3},
        })

    outputs = run_scenario(days)
    session_types = [item["session_type"] for item in outputs]

    assert len(outputs) == 14
    assert all(s in ("styrke", "cardio", "restitution", "løb") for s in session_types), session_types
    assert any(s == "cardio" for s in session_types), session_types
    assert any(s != "restitution" for s in session_types), session_types


def test_mixed_user_14_days_has_variation():
    days = []
    for idx in range(14):
        days.append({
            "readiness_score": 6 if idx % 3 else 4,
            "fatigue_score": 1 if idx % 5 else 5,
            "timing_state": "on_time",
            "training_day_ctx": {"is_training_day": idx in (0, 2, 4, 7, 9, 11)},
            "weekly_status": {"completed_sessions": idx % 4},
        })

    outputs = run_scenario(days)
    session_types = [item["session_type"] for item in outputs]
    unique_types = set(session_types)

    assert len(outputs) == 14
    assert len(unique_types) >= 2, session_types
    assert "styrke" in unique_types or "løb" in unique_types or "cardio" in unique_types, session_types


def test_recurring_hip_irritation_user_14_days_stays_conservative():
    days = []
    for idx in range(14):
        days.append({
            "readiness_score": 5,
            "fatigue_score": 2 if idx % 2 == 0 else 4,
            "timing_state": "on_time",
            "training_day_ctx": {"is_training_day": True},
            "weekly_status": {"completed_sessions": idx % 3},
            "recovery_state": {
                "local_state": {
                    "hip": {"state": "protect" if idx in (1, 2, 6, 7, 11) else "caution"}
                }
            }
        })

    outputs = run_scenario(days)
    session_types = [item["session_type"] for item in outputs]

    assert len(outputs) == 14
    assert any(s in ("cardio", "restitution") for s in session_types), session_types
    assert not all(s == "styrke" for s in session_types), session_types


if __name__ == "__main__":
    test_running_focused_user_14_days()
    test_mixed_user_14_days_has_variation()
    test_recurring_hip_irritation_user_14_days_stays_conservative()
    print("All longitudinal scenario tests passed")
