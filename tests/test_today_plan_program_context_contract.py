from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app/frontend/app.js"
DA_JSON = ROOT / "app/frontend/i18n/da.json"
EN_JSON = ROOT / "app/frontend/i18n/en.json"


def test_today_plan_can_display_selected_program_context():
    js = APP_JS.read_text(encoding="utf-8")

    assert "function getProgramDisplayNameById(programId)" in js
    assert "selected_strength_program_id" in js
    assert "selected_endurance_program_id" in js
    assert "selectedPlanProgramSummary" in js
    assert "selectedPlanProgramSummary," in js


def test_today_plan_program_context_has_danish_and_english_labels():
    da = DA_JSON.read_text(encoding="utf-8")
    en = EN_JSON.read_text(encoding="utf-8")

    assert '"today_plan.selected_strength_program": "Styrkeprogram: {value}"' in da
    assert '"today_plan.selected_run_program": "Løbeprogram: {value}"' in da
    assert '"today_plan.selected_strength_program": "Strength program: {value}"' in en
    assert '"today_plan.selected_run_program": "Run program: {value}"' in en
