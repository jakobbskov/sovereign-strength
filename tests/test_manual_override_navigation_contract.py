from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app/frontend/app.js"


def test_manual_override_submit_preserves_manual_navigation_after_save():
    js = APP_JS.read_text(encoding="utf-8")

    assert "const wasManualOverride = STATE.manualWorkoutActsAsTodayOverride === true;" in js
    assert 'showWizardStep(wasManualOverride ? "manual" : "plan");' in js


def test_manual_override_submit_no_longer_uses_checkin_advance_after_save():
    js = APP_JS.read_text(encoding="utf-8")
    submit_start = js.index("async function handleWorkoutSubmit")
    submit_end = js.index("function updateCheckinEditMenstruationVisibility", submit_start)
    submit_block = js[submit_start:submit_end]

    assert "advanceWizardAfterCheckin();" not in submit_block
