import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "app" / "backend"

if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app import build_session_summary


def test_time_based_strength_numeric_achieved_reps_count_as_seconds():
    session = {
        "session_type": "styrke",
        "results": [
            {
                "exercise_id": "plank",
                "target_reps": "20 sec",
                "achieved_reps": "20",
                "completed": True,
                "sets": [],
            }
        ],
    }

    summary = build_session_summary(session)

    assert summary["total_reps"] == 0
    assert summary["total_time_under_tension_sec"] == 20


def test_rep_based_strength_numeric_achieved_reps_still_count_as_reps():
    session = {
        "session_type": "styrke",
        "results": [
            {
                "exercise_id": "squat",
                "target_reps": "8-10",
                "achieved_reps": "8",
                "completed": True,
                "sets": [],
            }
        ],
    }

    summary = build_session_summary(session)

    assert summary["total_reps"] == 8
    assert summary["total_time_under_tension_sec"] == 0
