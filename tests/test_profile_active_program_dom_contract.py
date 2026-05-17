from pathlib import Path
import re
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
INDEX_HTML = ROOT / "app/frontend/index.html"
APP_JS = ROOT / "app/frontend/app.js"


def test_profile_section_ids_are_unique():
    html = INDEX_HTML.read_text(encoding="utf-8")
    ids = re.findall(r'id="([^"]+)"', html)
    duplicates = {key: count for key, count in Counter(ids).items() if count > 1}

    profile_duplicates = {
        key: count
        for key, count in duplicates.items()
        if key.startswith("profile") or key.startswith("applyRecommendedStrengthProgramBtn") or key.startswith("saveProfileProgramsBtn")
    }

    assert profile_duplicates == {}


def test_profile_active_program_controls_have_matching_event_bindings():
    html = INDEX_HTML.read_text(encoding="utf-8")
    js = APP_JS.read_text(encoding="utf-8")

    assert html.count('id="profileSection"') == 1
    assert 'id="saveProfileProgramsBtnProfile"' in html
    assert 'id="applyRecommendedStrengthProgramBtnProfile"' in html
    assert 'id="profileStrengthProgramSelectProfile"' in html
    assert 'id="profileRunProgramSelectProfile"' in html

    assert "bindSaveActiveProgramsButton(saveProfileProgramsBtnProfile, strengthProgramSelectProfileEl, runProgramSelectProfileEl)" in js
    assert "bindApplyRecommendedStrengthButton(" in js
    assert "applyRecommendedStrengthProgramBtnProfile" in js
    assert "profileProgramActionStatusProfile" in js
