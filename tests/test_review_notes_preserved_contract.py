import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app" / "frontend" / "app.js"
DA_JSON = ROOT / "app" / "frontend" / "i18n" / "da.json"
EN_JSON = ROOT / "app" / "frontend" / "i18n" / "en.json"


def test_single_review_entry_note_falls_back_to_session_notes():
    js = APP_JS.read_text(encoding="utf-8")

    assert "const reviewEntryNotes = Array.isArray(plan.entries)" in js
    assert '.map((entry, idx) => form[`review_notes_${idx}`]?.value?.trim() || "")' in js
    assert 'const sessionNotes = form.session_notes.value.trim() || (reviewEntryNotes.length === 1 ? reviewEntryNotes[0] : "");' in js
    assert "notes: sessionNotes," in js


def test_cardio_note_label_is_distinct_from_general_session_note():
    js = APP_JS.read_text(encoding="utf-8")
    da = json.loads(DA_JSON.read_text(encoding="utf-8"))
    en = json.loads(EN_JSON.read_text(encoding="utf-8"))

    assert 'tr("after_training.cardio_note_label")' in js
    assert da["after_training.cardio_note_label"] == "Note til cardio-passet"
    assert en["after_training.cardio_note_label"] == "Cardio session note"
