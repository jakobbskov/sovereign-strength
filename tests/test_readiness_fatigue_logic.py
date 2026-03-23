import sys
from pathlib import Path
from unittest.mock import patch

sys.path.append(str(Path(__file__).resolve().parents[1] / "app" / "backend"))

import app as backend_app


def test_create_checkin_high_readiness():
    payload = {
        "date": "2026-03-23",
        "sleep_score": 5,
        "energy_score": 5,
        "soreness_score": 1,
        "time_budget_min": 45,
        "notes": "",
    }

    with patch.object(backend_app, "append_user_item", side_effect=lambda file_key, item: (item, 1)):
        item, err, status = backend_app.create_checkin("1", payload)

    assert err is None, err
    assert status == 1, status
    assert item["readiness_score"] == 5, item


def test_create_checkin_low_readiness():
    payload = {
        "date": "2026-03-23",
        "sleep_score": 1,
        "energy_score": 1,
        "soreness_score": 5,
        "time_budget_min": 45,
        "notes": "",
    }

    with patch.object(backend_app, "append_user_item", side_effect=lambda file_key, item: (item, 1)):
        item, err, status = backend_app.create_checkin("1", payload)

    assert err is None, err
    assert status == 1, status
    assert item["readiness_score"] == 1, item


def test_compute_fatigue_score_from_latest_strength_combined_flags():
    session_results = [
        {
            "id": "sr1",
            "user_id": "1",
            "date": "2026-03-23",
            "session_type": "styrke",
            "completed": False,
            "results": [
                {
                    "exercise_id": "squat",
                    "hit_failure": True,
                    "sets": [
                        {"load": "100kg"},
                        {"load": "90kg"},
                    ],
                }
            ],
        }
    ]

    workouts = [
        {
            "id": "w1",
            "user_id": "1",
            "date": "2026-03-22",
            "session_type": "styrke",
        }
    ]

    with patch.object(backend_app, "build_recovery_state", return_value={"recovery_state": "caution"}):
        ctx = backend_app.compute_fatigue_score_from_latest_strength(
            session_results=session_results,
            workouts=workouts,
            user_id="1",
            latest_checkin=None,
        )

    assert ctx["latest_strength_failed"] is True, ctx
    assert ctx["latest_strength_load_drop_count"] == 1, ctx
    assert ctx["latest_strength_completed"] is False, ctx
    assert ctx["days_since_last_strength_for_fatigue"] == 1, ctx
    assert ctx["fatigue_score"] == 7, ctx


if __name__ == "__main__":
    test_create_checkin_high_readiness()
    test_create_checkin_low_readiness()
    test_compute_fatigue_score_from_latest_strength_combined_flags()
    print("All readiness/fatigue tests passed")
