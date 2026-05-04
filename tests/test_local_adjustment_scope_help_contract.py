from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app/frontend/app.js"
DA = ROOT / "app/frontend/i18n/da.json"
EN = ROOT / "app/frontend/i18n/en.json"


def test_today_plan_entry_cards_explain_local_adjustment_scope():
    js = APP_JS.read_text()

    assert 'tr("today_plan.local_adjustment_scope_help")' in js
    assert 'tr("today_plan.equipment_load_step_help")' in js
    assert 'entry.equipment_constraint' in js
    assert 'data-plan-entry-easier' in js
    assert 'data-plan-entry-harder' in js


def test_local_adjustment_scope_help_is_translated():
    da = DA.read_text()
    en = EN.read_text()

    assert '"today_plan.local_adjustment_scope_help"' in da
    assert '"today_plan.local_adjustment_scope_help"' in en
    assert '"today_plan.equipment_load_step_help"' in da
    assert '"today_plan.equipment_load_step_help"' in en
    assert "Ændringen gælder kun denne øvelse i dagens pas." in da
    assert "Næste mulige vægttrin er højere end anbefalet" in da
    assert "This change applies only to this exercise" in en
    assert "The next available load jump is higher than recommended" in en
    assert "loaded alternatives" not in en
    assert "loaded alternativer" not in da


if __name__ == "__main__":
    test_today_plan_entry_cards_explain_local_adjustment_scope()
    test_local_adjustment_scope_help_is_translated()
    print("Local adjustment scope help contract tests passed")
