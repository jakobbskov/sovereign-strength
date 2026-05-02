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
