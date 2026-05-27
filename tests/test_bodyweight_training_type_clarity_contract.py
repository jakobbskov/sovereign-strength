from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app/frontend/app.js"
DA = ROOT / "app/frontend/i18n/da.json"
EN = ROOT / "app/frontend/i18n/en.json"


def test_first_run_checklist_requires_primary_training_type_not_mobility_only():
    js = APP_JS.read_text(encoding="utf-8")

    assert "const hasPrimaryTrainingType = Boolean(" in js
    assert "trainingTypes.running" in js
    assert "trainingTypes.strength_weights" in js
    assert "trainingTypes.bodyweight" in js
    assert "const hasTrainingType = hasPrimaryTrainingType;" in js
    assert "Object.values(trainingTypes).some(Boolean)" not in js


def test_bodyweight_training_type_copy_is_distinct_from_equipment_copy_da():
    da = DA.read_text(encoding="utf-8")

    assert '"training_type.bodyweight": "Kropsvægt som styrketræning"' in da
    assert '"profile.bodyweight_available": "Kropsvægtøvelser mulige uden udstyr"' in da
    assert "Mobilitet kan tilføjes, men tæller ikke alene som første træningsplan." in da
    assert "Kropsvægt her betyder styrketræning uden vægte." in da


def test_bodyweight_training_type_copy_is_distinct_from_equipment_copy_en():
    en = EN.read_text(encoding="utf-8")

    assert '"training_type.bodyweight": "Bodyweight strength training"' in en
    assert '"profile.bodyweight_available": "Bodyweight exercises possible without equipment"' in en
    assert "Mobility can be added, but does not count alone as the first training plan." in en
    assert "Bodyweight here means strength training without weights." in en
