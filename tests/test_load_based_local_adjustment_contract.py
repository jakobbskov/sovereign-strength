from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app/frontend/app.js"


def test_load_first_exercises_are_declared():
    js = APP_JS.read_text()

    assert "function isLoadFirstProgressionExercise(entry)" in js

    for exercise_id in [
        "squat",
        "bench_press",
        "overhead_press",
        "barbell_row",
        "romanian_deadlift",
        "dumbbell_row",
    ]:
        assert f'"{exercise_id}"' in js


def test_load_first_load_bounds_do_not_use_load_options_as_hard_max():
    js = APP_JS.read_text()

    assert "if (isLoadFirstProgressionExercise(entry))" in js
    assert "max: fallback.max" in js


def test_load_step_for_load_first_lifts_does_not_reset_harder_to_min_sets():
    js = APP_JS.read_text()

    assert 'manual_adjustment_reason = dir === "harder" ? "load_step_up_and_reset" : "load_step_down_and_reset"' not in js
    assert "getLoadFirstSetsAfterLoadStep" in js
    assert "load_step_up_and_modest_reset" in js


if __name__ == "__main__":
    test_load_first_exercises_are_declared()
    test_load_first_load_bounds_do_not_use_load_options_as_hard_max()
    test_load_step_for_load_first_lifts_does_not_reset_harder_to_min_sets()
    print("Load-based local adjustment contract tests passed")
