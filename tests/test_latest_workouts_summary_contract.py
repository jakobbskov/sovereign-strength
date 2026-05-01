from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app" / "frontend" / "app.js"
DA_JSON = ROOT / "app" / "frontend" / "i18n" / "da.json"
EN_JSON = ROOT / "app" / "frontend" / "i18n" / "en.json"


def test_latest_workouts_uses_compact_summary_helper():
    js = APP_JS.read_text(encoding="utf-8")

    assert "function buildLatestWorkoutSummary(item){" in js
    assert "const compactSummary = buildLatestWorkoutSummary(item);" in js
    assert "${esc(compactSummary || (isCardio ? cardioMeta : \"\"))}" in js


def test_latest_workouts_summary_uses_session_result_summary_fields():
    js = APP_JS.read_text(encoding="utf-8")

    assert "summary.completed_exercises" in js
    assert "summary.total_sets" in js
    assert "summary.total_reps" in js
    assert "summary.total_time_under_tension_sec" in js
    assert "summary.estimated_volume" in js


def test_latest_workouts_compact_i18n_keys_exist():
    da = DA_JSON.read_text(encoding="utf-8")
    en = EN_JSON.read_text(encoding="utf-8")

    assert '"history.exercise_count_compact": "{count} øvelse(r)"' in da
    assert '"history.exercise_count_compact": "{count} exercise(s)"' in en
