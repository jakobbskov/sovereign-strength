from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app/frontend/app.js"
DA = ROOT / "app/frontend/i18n/da.json"
EN = ROOT / "app/frontend/i18n/en.json"


def test_today_plan_entry_cards_explain_local_adjustment_scope():
    js = APP_JS.read_text()

    assert 'tr("today_plan.local_adjustment_scope_help")' in js
    assert 'data-plan-entry-easier' in js
    assert 'data-plan-entry-harder' in js


def test_local_adjustment_scope_help_is_translated():
    da = DA.read_text()
    en = EN.read_text()

    assert '"today_plan.local_adjustment_scope_help"' in da
    assert '"today_plan.local_adjustment_scope_help"' in en
    assert "Justerer kun denne øvelse i dag" in da
    assert "Adjusts only this exercise today" in en


if __name__ == "__main__":
    test_today_plan_entry_cards_explain_local_adjustment_scope()
    test_local_adjustment_scope_help_is_translated()
    print("Local adjustment scope help contract tests passed")
