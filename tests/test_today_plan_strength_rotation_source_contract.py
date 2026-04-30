from pathlib import Path
import importlib.util
import sys

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app/backend/app.py"


def test_today_plan_uses_completed_session_results_for_latest_strength_rotation():
    py = APP.read_text(encoding="utf-8")

    assert "def find_latest_completed_strength_session_result(session_results):" in py
    assert "latest_strength_session = find_latest_completed_strength_session_result(session_results)" in py
    assert "latest_strength = latest_strength_session or find_latest_strength_workout(workouts)" in py


def test_today_plan_no_longer_sets_latest_strength_from_workouts_before_session_results():
    py = APP.read_text(encoding="utf-8")
    start = py.index("def build_today_plan_fatigue_context")
    end = py.index("def log_today_plan_decision", start)
    block = py[start:end]

    assert "latest_strength = find_latest_strength_workout(workouts)\\n    days_since_last_strength" not in block


def test_latest_completed_strength_session_result_sorts_by_date_not_list_order():
    backend_dir = ROOT / "app/backend"
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    spec = importlib.util.spec_from_file_location("sovereign_app", APP)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    sessions = [
        {
            "id": "newer",
            "date": "2026-04-29",
            "session_type": "styrke",
            "completed": True,
            "program_day_label": "Day A",
        },
        {
            "id": "older",
            "date": "2026-04-20",
            "session_type": "styrke",
            "completed": True,
            "program_day_label": "Old Day",
        },
    ]

    latest = module.find_latest_completed_strength_session_result(sessions)

    assert latest["id"] == "newer"
    assert latest["program_day_label"] == "Day A"
