from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app" / "frontend" / "app.js"


CARDIO_ALIAS_CHECK = (
    'sessionTypeKey === "løb" || sessionTypeKey === "cardio" || '
    'sessionTypeKey === "run" || sessionTypeKey === "running"'
)


def test_running_alias_uses_cardio_summary_in_stored_session_summary():
    js = APP_JS.read_text(encoding="utf-8")

    start = js.index("function buildSessionResultSummaryFromStoredItem(item)")
    block = js[start:start + 1400]

    assert CARDIO_ALIAS_CHECK in block
    assert "distance_km" in block
    assert "duration_total_sec" in block
    assert "pace_sec_per_km" in block
    assert "total_sets" not in block.split(CARDIO_ALIAS_CHECK, 1)[1].split("return {", 2)[1]


def test_running_alias_uses_cardio_summary_in_review_renderer():
    js = APP_JS.read_text(encoding="utf-8")

    start = js.index("function renderSessionResultSummary(summary, fallbackResults = null)")
    block = js[start:start + 3800]

    assert CARDIO_ALIAS_CHECK in block
    assert 'tr("cardio.review.distance_label")' in block
    assert 'tr("cardio.review.duration_label")' in block
    assert 'tr("cardio.review.actual_pace_label")' in block

    cardio_branch = block.split(CARDIO_ALIAS_CHECK, 1)[1].split("return;", 1)[0]
    assert "review.summary_sets_label" not in cardio_branch
    assert "review.summary_reps_label" not in cardio_branch
    assert "review.summary_volume_label" not in cardio_branch
