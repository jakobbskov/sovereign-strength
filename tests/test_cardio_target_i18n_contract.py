from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app/frontend/app.js"
DA = ROOT / "app/frontend/i18n/da.json"
EN = ROOT / "app/frontend/i18n/en.json"


def test_format_target_translates_backend_cardio_targets():
    js = APP_JS.read_text(encoding="utf-8")

    assert "10 min warm-up + 2 x 8 min controlled hard tempo + 2 min easy between + 5 min cool-down" in js
    assert 'tr("cardio.target.tempo_2x8")' in js
    assert "easyRunEnglishMatch" in js
    assert "intervalRunEnglishMatch" in js
    assert 'tr("cardio.target.intervals_1min_blocks", { blocks: intervalRunEnglishMatch[1] })' in js


def test_cardio_target_i18n_keys_exist_in_da_and_en():
    da = DA.read_text(encoding="utf-8")
    en = EN.read_text(encoding="utf-8")

    assert '"cardio.target.tempo_2x8"' in da
    assert '"cardio.target.tempo_2x8"' in en
    assert '"cardio.target.intervals_1min_blocks"' in da
    assert '"cardio.target.intervals_1min_blocks"' in en
    assert "kontrolleret hårdt tempo" in da
    assert "controlled hard tempo" in en
    assert "{blocks} x (1 min hurtigt / 1 min roligt)" in da
    assert "{blocks} x (1 min fast / 1 min easy)" in en
