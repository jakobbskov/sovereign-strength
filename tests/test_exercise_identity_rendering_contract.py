from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app/frontend/app.js"
BACKEND_APP = ROOT / "app/backend/app.py"


def test_exercise_name_fallback_does_not_use_planned_session():
    js = APP_JS.read_text()

    assert 'return exerciseMap.get(exerciseId) || tr("exercise.planned_session");' not in js
    assert "function formatUnknownExerciseName" in js


def test_frontend_variant_swap_filters_missing_ladder_ids():
    js = APP_JS.read_text()

    assert "function getExerciseVariantSwap(exerciseId, direction)" in js
    assert "const existingIds = new Set(allExercises.map" in js
    assert "existingIds.has(candidateId.toLowerCase())" in js


def test_backend_variant_swap_filters_missing_ladder_ids():
    py = BACKEND_APP.read_text()

    assert "def get_progression_ladder_for_exercise(exercise_id, exercise_map):" in py
    assert "if item_id and item_id in exercise_map" in py


if __name__ == "__main__":
    test_exercise_name_fallback_does_not_use_planned_session()
    test_frontend_variant_swap_filters_missing_ladder_ids()
    test_backend_variant_swap_filters_missing_ladder_ids()
    print("Exercise identity rendering contract tests passed")
