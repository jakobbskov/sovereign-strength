from pathlib import Path

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
