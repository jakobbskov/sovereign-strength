from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app/frontend/app.js"


def test_mixed_strength_summary_has_separate_rendering_path():
    js = APP_JS.read_text()

    assert "const hasMixedRepAndTimedWork = totalReps > 0 && totalTimedSeconds > 0;" in js
    assert "const hasTimedOnlyWork = totalTimedSeconds > 0 && totalReps === 0;" in js
    assert "hasMixedRepAndTimedWork" in js


def test_mixed_strength_summary_keeps_rep_and_hold_metrics():
    js = APP_JS.read_text()

    assert "const mixedPerformanceBlock" in js
    assert 'tr("review.summary_reps_label")' in js
    assert 'tr("review.summary_volume_label")' in js
    assert 'tr("review.summary_total_hold_time_label")' in js


def test_timed_summary_can_use_backend_total_time_under_tension():
    js = APP_JS.read_text()

    assert "const summaryTotalTimedSeconds = Number(summary.total_time_under_tension_sec || 0);" in js
    assert "summaryTotalTimedSeconds > 0 ? summaryTotalTimedSeconds : timedSetSeconds.reduce" in js


if __name__ == "__main__":
    test_mixed_strength_summary_has_separate_rendering_path()
    test_mixed_strength_summary_keeps_rep_and_hold_metrics()
    test_timed_summary_can_use_backend_total_time_under_tension()
    print("Mixed session summary contract tests passed")
