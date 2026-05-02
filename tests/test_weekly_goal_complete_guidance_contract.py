import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app" / "frontend" / "app.js"
DA_JSON = ROOT / "app" / "frontend" / "i18n" / "da.json"
EN_JSON = ROOT / "app" / "frontend" / "i18n" / "en.json"


def test_weekly_goal_complete_guidance_i18n_keys_exist():
    da = json.loads(DA_JSON.read_text(encoding="utf-8"))
    en = json.loads(EN_JSON.read_text(encoding="utf-8"))

    assert da["weekplan.weekly_goal_complete_guidance"] == (
        "Ugemålet er nået. Restituer frem til næste planlagte træningsdag."
    )
    assert en["weekplan.weekly_goal_complete_guidance"] == (
        "Weekly goal reached. Recover until your next planned training day."
    )


def test_frontend_has_weekly_goal_complete_guard_before_next_session_lookup():
    js = APP_JS.read_text(encoding="utf-8")

    assert "function isWeeklyGoalComplete(planItem)" in js
    assert "completed >= target" in js
    assert "function getWeeklyGoalCompleteGuidanceText(planItem)" in js

    overview_start = js.index("function getNextPlannedSessionOverviewText(planItem)")
    overview_block = js[overview_start: overview_start + 500]
    assert "getWeeklyGoalCompleteGuidanceText(planItem)" in overview_block
    assert "if (weeklyGoalCompleteText) return weeklyGoalCompleteText;" in overview_block
    assert overview_block.index("getWeeklyGoalCompleteGuidanceText(planItem)") < overview_block.index("getNextPlannedSessionInfo(planItem)")


def test_after_session_html_uses_weekly_goal_complete_guidance():
    js = APP_JS.read_text(encoding="utf-8")

    html_start = js.index("function buildNextPlannedSessionHtml(planItem)")
    html_block = js[html_start: html_start + 900]
    assert "getWeeklyGoalCompleteGuidanceText(planItem)" in html_block
    assert "weeklyGoalCompleteText" in html_block
    assert "review.saved_next_label" in html_block
    assert html_block.index("getWeeklyGoalCompleteGuidanceText(planItem)") < html_block.index("getNextPlannedSessionInfo(planItem)")


def test_weekly_rhythm_card_uses_goal_complete_guidance_before_next_training():
    js = APP_JS.read_text(encoding="utf-8")

    render_start = js.index("function renderWeeklyRhythmCard(sessionResults, planItem)")
    render_block = js[render_start: render_start + 1800]

    assert "weeklyGoalComplete" in render_block
    assert "summary.completedCount" in render_block
    assert "summary.weeklyTargetSessions" in render_block
    assert 'tr("weekplan.weekly_goal_complete_guidance")' in render_block
    assert render_block.index("weeklyGoalComplete") < render_block.index("summary.nextTraining")


def test_backend_completed_today_uses_weekly_goal_complete_guidance():
    backend = (ROOT / "app" / "backend" / "app.py").read_text(encoding="utf-8")

    assert "def is_weekly_goal_complete_from_item(item):" in backend
    assert "def build_weekly_goal_complete_guidance():" in backend
    assert '"kind": "weekly_goal_complete"' in backend
    assert '"message": "Ugemålet er nået. Restituer frem til næste planlagte træningsdag."' in backend

    completed_start = backend.index("if completed_today:")
    completed_block = backend[completed_start: completed_start + 500]
    assert "is_weekly_goal_complete_from_item(item)" in completed_block
    assert "return build_weekly_goal_complete_guidance()" in completed_block
    assert completed_block.index("is_weekly_goal_complete_from_item(item)") < completed_block.index("if next_date:")
