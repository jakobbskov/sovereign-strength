from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app/frontend/app.js"
DA_JSON = ROOT / "app/frontend/i18n/da.json"
EN_JSON = ROOT / "app/frontend/i18n/en.json"


def test_cardio_tempo_has_frontend_display_mapping():
    js = APP_JS.read_text(encoding="utf-8")

    assert 'cardio_tempo: tr("exercise.cardio_tempo")' in js


def test_cardio_tempo_has_danish_and_english_labels():
    da = DA_JSON.read_text(encoding="utf-8")
    en = EN_JSON.read_text(encoding="utf-8")

    assert '"exercise.cardio_tempo": "Tempoløb"' in da
    assert '"exercise.cardio_tempo": "Tempo run"' in en
