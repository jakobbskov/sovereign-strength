from unittest.mock import patch
import app as backend_app


def make_test_client():
    return backend_app.app.test_client()


def mock_auth():
    return patch.object(
        backend_app,
        "require_auth_user",
        return_value=({"user_id": "1"}, None),
    )


def mock_today_plan_context(readiness=5):
    return patch.object(
        backend_app,
        "build_today_plan_context",
        return_value={
            "readiness_score": readiness,
            "checkin_date": "2026-03-23",
            "time_budget_min": 45,
            "user_settings": {},
            "training_day_ctx": {},
            "weekly_target_sessions": 3,
            "weekly_status": {},
        },
    )


def mock_fatigue_context(fatigue=0):
    return patch.object(
        backend_app,
        "build_today_plan_fatigue_context",
        return_value={
            "latest_strength": None,
            "days_since_last_strength": None,
            "session_results": [],
            "previous_recommendation": None,
            "latest_strength_session": None,
            "latest_strength_failed": False,
            "latest_strength_load_drop_count": 0,
            "latest_strength_completed": None,
            "fatigue_score": fatigue,
            "recovery_state": {},
            "fatigue_session_override": None,
        },
    )
