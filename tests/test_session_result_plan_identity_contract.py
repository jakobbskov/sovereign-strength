from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app/frontend/app.js"
BACKEND_APP = ROOT / "app/backend/app.py"


def test_session_result_submit_sends_today_plan_identity():
    js = APP_JS.read_text(encoding="utf-8")

    assert "function getProgramDayLabelFromPlanTemplate(templateId)" in js
    assert "function getSessionResultProgramIdForPlan(plan)" in js
    assert "program_id: getSessionResultProgramIdForPlan(plan)," in js
    assert 'program_day_label: String(plan.program_day_label || "").trim() || getProgramDayLabelFromPlanTemplate(planTemplateId),' in js
    assert "template_id: planTemplateId," in js
    assert 'plan_variant: String(plan.plan_variant || "").trim(),' in js
    assert 'selected_strength_program_id: String(plan.selected_strength_program_id || "").trim(),' in js
    assert 'selected_endurance_program_id: String(plan.selected_endurance_program_id || "").trim(),' in js


def test_backend_persists_session_result_plan_identity():
    py = BACKEND_APP.read_text(encoding="utf-8")

    for field in [
        '"program_id": program_id or None',
        '"program_day_label": program_day_label or None',
        '"template_id": template_id or None',
        '"plan_variant": plan_variant or None',
        '"selected_strength_program_id": selected_strength_program_id or None',
        '"selected_endurance_program_id": selected_endurance_program_id or None',
    ]:
        assert py.count(field) >= 2
