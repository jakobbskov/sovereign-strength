import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_PATH = ROOT / "app" / "backend"
APP_PATH = BACKEND_PATH / "app.py"


def load_app():
    sys.path.insert(0, str(BACKEND_PATH))
    spec = importlib.util.spec_from_file_location("backend_app", APP_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_update_session_result_accepts_duration_min_sec_for_running_alias():
    app = load_app()

    payload = {
        "date": "2026-05-03",
        "session_type": "running",
        "completed": True,
        "distance_km": "1",
        "duration_min": "20",
        "duration_sec": "0",
        "cardio_kind": "restitution",
        "avg_rpe": "3",
        "results": [
            {
                "exercise_id": "cardio_session",
                "completed": True,
                "sets": [],
            }
        ],
    }

    item, err, status = app.build_session_result_item("5", payload)

    assert err is None
    assert status is None
    assert item["duration_total_sec"] == 1200
    assert item["distance_km"] == 1.0
    assert item["pace_sec_per_km"] == 1200.0
    assert item["counts_toward_weekly_goal"] is True


def test_update_session_result_clamps_duration_seconds():
    app = load_app()

    payload = {
        "date": "2026-05-03",
        "session_type": "running",
        "completed": True,
        "distance_km": "1",
        "duration_min": "19",
        "duration_sec": "99",
        "results": [{"exercise_id": "cardio_session", "completed": True, "sets": []}],
    }

    item, err, status = app.build_session_result_item("5", payload)

    assert err is None
    assert status is None
    assert item["duration_total_sec"] == 1199
