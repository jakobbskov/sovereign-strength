from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app/frontend/app.js"


def test_finish_active_workout_marks_unsaved_review_handoff():
    js = APP_JS.read_text()

    assert "function markUnsavedWorkoutReviewHandoff(item)" in js
    assert "markUnsavedWorkoutReviewHandoff(item);" in js
    assert "function hasUnsavedWorkoutReviewHandoff(item)" in js


def test_session_review_does_not_close_day_for_unsaved_workout_handoff():
    js = APP_JS.read_text()

    assert "const hasUnsavedReviewHandoff = hasUnsavedWorkoutReviewHandoff(item);" in js
    assert "const completedTodayItem = !STATE.editingSessionResultId && !hasUnsavedReviewHandoff" in js
    assert "const acknowledgedRestDayItem = !STATE.editingSessionResultId && !hasUnsavedReviewHandoff" in js


def test_successful_session_save_clears_unsaved_review_handoff():
    js = APP_JS.read_text()

    assert "clearUnsavedWorkoutReviewHandoff(plan);" in js


if __name__ == "__main__":
    test_finish_active_workout_marks_unsaved_review_handoff()
    test_session_review_does_not_close_day_for_unsaved_workout_handoff()
    test_successful_session_save_clears_unsaved_review_handoff()
    print("Manual workout review identity contract tests passed")
