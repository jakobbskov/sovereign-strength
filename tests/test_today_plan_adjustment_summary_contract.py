from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app/frontend/app.js"


def test_weekplan_adjustment_summary_is_suppressed_when_labels_match():
    js = APP_JS.read_text(encoding="utf-8")

    match = re.search(
        r"function deriveTodayPlanDisplayState\(item\)\{(?P<body>.*?)\nfunction ",
        js,
        re.S,
    )
    assert match, "Could not find deriveTodayPlanDisplayState body"

    body = match.group("body")

    assert 'tr("plan.weekplan_adjusted_to_today"' in body
    assert "plannedLabel !== actualLabel" in body
    assert 'tr("plan.weekplan_planned_label", { value: plannedLabel || actualLabel })' in body

    adjustment_index = body.index('tr("plan.weekplan_adjusted_to_today"')
    label_compare_index = body.index("plannedLabel !== actualLabel")

    assert label_compare_index < adjustment_index
