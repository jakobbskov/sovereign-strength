import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "app" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app as backend_app


def test_calibrate_starter_capacity_profile_promotes_after_two_too_easy_early_sessions():
    sessions = [
        {
            "completed": True,
            "session_type": "løb",
            "avg_rpe": 4,
            "results": [],
        },
        {
            "completed": True,
            "session_type": "løb",
            "avg_rpe": 4,
            "results": [],
        },
    ]

    assert backend_app.calibrate_starter_capacity_profile("general_beginner", sessions, limit=3) == "loaded_beginner"


def test_calibrate_starter_capacity_profile_downgrades_after_too_hard_early_session():
    sessions = [
        {
            "completed": True,
            "session_type": "styrke",
            "results": [
                {"exercise_id": "squat", "hit_failure": True},
            ],
        },
    ]

    assert backend_app.calibrate_starter_capacity_profile("general_beginner", sessions, limit=3) == "low_capacity"


def test_calibrate_starter_capacity_profile_stays_stable_for_appropriate_early_sessions():
    sessions = [
        {
            "completed": True,
            "session_type": "løb",
            "avg_rpe": 5,
            "results": [],
        },
        {
            "completed": True,
            "session_type": "restitution",
            "results": [],
        },
    ]

    assert backend_app.calibrate_starter_capacity_profile("general_beginner", sessions, limit=3) == "general_beginner"


def test_calibrate_starter_capacity_profile_only_uses_first_three_completed_sessions():
    sessions = [
        {
            "completed": True,
            "session_type": "løb",
            "avg_rpe": 5,
            "results": [],
        },
        {
            "completed": True,
            "session_type": "løb",
            "avg_rpe": 5,
            "results": [],
        },
        {
            "completed": True,
            "session_type": "løb",
            "avg_rpe": 5,
            "results": [],
        },
        {
            "completed": True,
            "session_type": "løb",
            "avg_rpe": 4,
            "results": [],
        },
        {
            "completed": True,
            "session_type": "løb",
            "avg_rpe": 4,
            "results": [],
        },
    ]

    assert backend_app.calibrate_starter_capacity_profile("general_beginner", sessions, limit=3) == "general_beginner"
