from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app" / "frontend" / "app.js"
DA_JSON = ROOT / "app" / "frontend" / "i18n" / "da.json"


def test_session_history_formats_saved_next_step_hint():
    js = APP_JS.read_text(encoding="utf-8")

    assert (
        'const nextStepHint = formatSavedSummaryNextStep(String(summary.progression_summary || summary.next_step_hint || "").trim());'
        in js
    )
    assert 'const nextStepHint = String(summary.next_step_hint || "").trim();' not in js


def test_danish_saved_summary_progression_text_exists():
    da = DA_JSON.read_text(encoding="utf-8")

    assert '"review.saved_summary.progress_next_time": "Du kan sandsynligvis progrediere næste gang."' in da
    assert '"review.saved_summary.light_load_recorded": "Lav samlet belastning registreret."' in da
    assert '"review.saved_summary.session_saved": "Dagens session er gemt."' in da
