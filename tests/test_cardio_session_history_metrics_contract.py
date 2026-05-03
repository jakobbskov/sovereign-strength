from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app" / "frontend" / "app.js"

CARDIO_ALIAS_ARRAY = '["løb", "cardio", "run", "running"].includes(String(item?.session_type || "").trim().toLowerCase())'
CARDIO_FORECAST_CHECK = 'sessionType === "løb" || sessionType === "cardio" || sessionType === "run" || sessionType === "running"'


def test_session_history_uses_cardio_meta_for_running_aliases():
    js = APP_JS.read_text(encoding="utf-8")

    history_start = js.index("function renderSessionHistory(items)")
    history_block = js[history_start:history_start + 2600]

    assert CARDIO_ALIAS_ARRAY in history_block
    assert "buildCardioHistoryMeta(item)" in history_block
    assert "history.session_totals" in history_block
    assert history_block.index("buildCardioHistoryMeta(item)") < history_block.index("history.session_totals")


def test_workout_history_summary_uses_cardio_meta_for_running_aliases():
    js = APP_JS.read_text(encoding="utf-8")

    workouts_start = js.index("function renderWorkouts(items)")
    workouts_block = js[workouts_start:workouts_start + 1800]

    assert CARDIO_ALIAS_ARRAY in workouts_block
    assert "buildCardioHistoryMeta(item)" in workouts_block


def test_latest_summary_and_forecast_include_running_alias():
    js = APP_JS.read_text(encoding="utf-8")

    latest_start = js.index("function buildLatestWorkoutSummary(item)")
    latest_block = js[latest_start:latest_start + 900]
    assert CARDIO_FORECAST_CHECK in latest_block

    lead_start = js.index("function buildForecastLeadText(planItem)")
    lead_block = js[lead_start:lead_start + 1200]
    assert CARDIO_FORECAST_CHECK in lead_block

    type_start = js.index("function getForecastTypeLabel(planItem)")
    type_block = js[type_start:type_start + 900]
    assert CARDIO_FORECAST_CHECK in type_block
