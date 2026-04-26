from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app/frontend/app.js"


def test_finish_workout_early_button_is_hidden_on_last_exercise():
    js = APP_JS.read_text()

    assert 'id="nextWorkoutEntryBtn"' in js
    assert 'id="finishWorkoutEarlyBtn"' in js
    assert '${!isLast ? `<button type="button" id="finishWorkoutEarlyBtn"' in js


def test_finish_workout_primary_label_still_exists_for_last_exercise():
    js = APP_JS.read_text()

    assert 'return tr(isLast ? "button.finish_workout" : "button.next_exercise");' in js
    assert 'advanceActiveWorkoutAfterCompletedSet(item, idx, currentSetIndex, hasMoreSetsRemaining && !isCardioEntry);' in js
