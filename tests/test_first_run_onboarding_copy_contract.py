from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app" / "frontend" / "app.js"
DA_JSON = ROOT / "app" / "frontend" / "i18n" / "da.json"
EN_JSON = ROOT / "app" / "frontend" / "i18n" / "en.json"


def test_first_run_danish_copy_is_short_actionable_and_not_ideological():
    da = json.loads(DA_JSON.read_text(encoding="utf-8"))

    assert da["onboarding.first_run.soft_landing"] == "Kom godt i gang"
    assert da["onboarding.first_run.setup_reason"] == (
        "Udfyld din profil, vælg træningstyper og angiv det udstyr, "
        "du har adgang til. Så kan appen lave en første plan, der passer til dig."
    )

    combined = "\n".join(str(value) for value in da.values() if isinstance(value, str))
    assert "manipulerende produktgreb" not in combined
    assert "Meta-login" not in combined


def test_first_run_buttons_use_natural_profile_and_save_labels():
    da = json.loads(DA_JSON.read_text(encoding="utf-8"))
    en = json.loads(EN_JSON.read_text(encoding="utf-8"))

    assert da["button.edit_profile_equipment"] == "Redigér profil"
    assert da["onboarding.first_run.save_progress"] == "Gem opsætning"
    assert da["onboarding.first_run.save_setup"] == "Gem opsætning"

    assert en["button.edit_profile_equipment"] == "Edit profile"
    assert en["onboarding.first_run.save_progress"] == "Save setup"
    assert en["onboarding.first_run.save_setup"] == "Save setup"


def test_first_run_setup_ctas_open_profile_setup_not_overview_scroll_detour():
    js = APP_JS.read_text(encoding="utf-8")

    assert 'const openSetupBtn = document.getElementById("openInitialSetupBtn");' in js
    assert 'showWizardStep("profile");' in js
    assert 'setEquipmentEditorOpen(true);' in js

    forecast_block_start = js.index('btn.textContent = tr("onboarding.first_run.open_setup");')
    forecast_block = js[forecast_block_start:forecast_block_start + 500]
    assert 'showWizardStep("profile");' in forecast_block
    assert 'showWizardStep("overview");' not in forecast_block
    assert "scrollIntoView" not in forecast_block

    onboarding_block_start = js.index("openSetupBtn.onclick = (ev) =>")
    onboarding_block = js[onboarding_block_start:onboarding_block_start + 700]
    assert 'showWizardStep("profile");' in onboarding_block
    assert 'showWizardStep("overview");' not in onboarding_block
    assert "scrollIntoView" not in onboarding_block
