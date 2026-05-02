import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app" / "frontend" / "app.js"
DA_JSON = ROOT / "app" / "frontend" / "i18n" / "da.json"
EN_JSON = ROOT / "app" / "frontend" / "i18n" / "en.json"


def test_running_alias_is_localized_as_run_session_type():
    js = APP_JS.read_text(encoding="utf-8")

    assert 'if (x === "løb" || x === "run" || x === "running") return tr("session_type.run");' in js


def test_cardio_restitution_has_display_name_mapping():
    js = APP_JS.read_text(encoding="utf-8")
    da = json.loads(DA_JSON.read_text(encoding="utf-8"))
    en = json.loads(EN_JSON.read_text(encoding="utf-8"))

    assert 'cardio_restitution: tr("exercise.cardio_restitution")' in js
    assert da["exercise.cardio_restitution"] == "Cardio-restitution"
    assert en["exercise.cardio_restitution"] == "Cardio recovery"


def test_cardio_entries_have_review_meta_fallback():
    js = APP_JS.read_text(encoding="utf-8")

    assert "function getCardioExerciseMetaFallback(exerciseId)" in js
    assert 'id.startsWith("cardio_")' in js
    assert 'input_kind: "cardio_time"' in js
    assert "getExerciseMeta(exerciseId) || getCardioExerciseMetaFallback(exerciseId) || {}" in js
