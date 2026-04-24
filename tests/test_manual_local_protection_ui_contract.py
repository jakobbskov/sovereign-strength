from pathlib import Path
import json


ROOT = Path(__file__).resolve().parents[1]

REGIONS = [
    "ankle_calf",
    "knee",
    "hip",
    "low_back",
    "shoulder",
    "elbow",
    "wrist",
]


def test_manual_local_protection_controls_exist_once():
    html = (ROOT / "app/frontend/index.html").read_text()

    assert "profile.local_protection_holds_title" in html
    assert "profile.local_protection_holds_help" in html

    for region in REGIONS:
        assert html.count(f'id="local_hold_{region}"') == 1
        assert html.count(f'name="local_hold_{region}"') == 1

    assert "name=local_hold_" not in html
    assert "lo\ncal_protection" not in html


def test_manual_local_protection_settings_payload_contract():
    js = (ROOT / "app/frontend/app.js").read_text()

    assert "LOCAL_PROTECTION_HOLD_REGIONS" in js
    assert "function readLocalProtectionHoldsFromForm()" in js
    assert "function populateLocalProtectionHolds(settings)" in js
    assert "local_protection_holds: readLocalProtectionHoldsFromForm()" in js
    assert "populateLocalProtectionHolds(settings);" in js


def test_manual_local_protection_i18n_keys_exist():
    required_keys = {
        "profile.local_protection_holds_title",
        "profile.local_protection_holds_help",
        "local_protection.hold.none",
        "local_protection.hold.caution",
        "local_protection.hold.protect",
        "local_protection.region.ankle_calf",
        "local_protection.region.knee",
        "local_protection.region.hip",
        "local_protection.region.low_back",
        "local_protection.region.shoulder",
        "local_protection.region.elbow",
        "local_protection.region.wrist",
    }

    for lang in ("da", "en"):
        data = json.loads((ROOT / f"app/frontend/i18n/{lang}.json").read_text())
        missing = sorted(required_keys - set(data))
        assert not missing, (lang, missing)
