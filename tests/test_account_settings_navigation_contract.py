from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app/frontend/app.js"
INDEX_HTML = ROOT / "app/frontend/index.html"


def test_account_settings_buttons_use_shared_action():
    html = INDEX_HTML.read_text()

    assert html.count('data-action="open-account-settings"') >= 3
    assert 'id="openAccountSettingsBtnProfile"' not in html


def test_account_settings_buttons_are_bound_by_shared_selector():
    js = APP_JS.read_text()

    assert 'document.querySelectorAll(\'[data-action="open-account-settings"]\')' in js
    assert "accountButtons.forEach" in js
    assert "boundAccountSettings" in js
    assert "location.href = authHref;" in js
