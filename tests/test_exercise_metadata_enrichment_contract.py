import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXERCISES = ROOT / "app/data/seed/exercises.json"

TARGETS = {
    "bench_press",
    "barbell_row",
    "overhead_press",
    "romanian_deadlift",
}


def _exercise_map():
    items = json.loads(EXERCISES.read_text())
    return {
        str(item.get("id", "")).strip(): item
        for item in items
        if isinstance(item, dict) and str(item.get("id", "")).strip()
    }


def test_core_barbell_exercises_have_app_friendly_notes():
    exercises = _exercise_map()

    for exercise_id in TARGETS:
        item = exercises[exercise_id]
        notes = str(item.get("notes", "")).strip()
        notes_en = str(item.get("notes_en", "")).strip()

        assert len(notes) >= 50, (exercise_id, notes)
        assert len(notes_en) >= 50, (exercise_id, notes_en)
        assert len(notes) <= 180, (exercise_id, notes)
        assert len(notes_en) <= 180, (exercise_id, notes_en)


def test_core_barbell_exercises_have_short_form_cues_in_both_languages():
    exercises = _exercise_map()

    for exercise_id in TARGETS:
        item = exercises[exercise_id]
        cues = item.get("form_cues")
        cues_en = item.get("form_cues_en")

        assert isinstance(cues, list), exercise_id
        assert isinstance(cues_en, list), exercise_id
        assert 3 <= len(cues) <= 5, (exercise_id, cues)
        assert 3 <= len(cues_en) <= 5, (exercise_id, cues_en)

        for cue in cues + cues_en:
            text = str(cue).strip()
            assert text, exercise_id
            assert len(text) <= 95, (exercise_id, text)


def test_core_barbell_enrichment_preserves_planning_metadata():
    exercises = _exercise_map()

    expected = {
        "bench_press": ("horizontal_push", "load_reps", ["shoulder", "elbow", "wrist"]),
        "barbell_row": ("horizontal_pull", "load_reps", ["shoulder", "elbow", "low_back"]),
        "overhead_press": ("vertical_push", "load_reps", ["shoulder", "elbow", "wrist"]),
        "romanian_deadlift": ("hinge", "load_reps", ["hip", "low_back"]),
    }

    for exercise_id, (movement_pattern, input_kind, local_targets) in expected.items():
        item = exercises[exercise_id]
        assert item.get("movement_pattern") == movement_pattern, exercise_id
        assert item.get("input_kind") == input_kind, exercise_id
        assert item.get("local_load_targets") == local_targets, exercise_id


if __name__ == "__main__":
    test_core_barbell_exercises_have_app_friendly_notes()
    test_core_barbell_exercises_have_short_form_cues_in_both_languages()
    test_core_barbell_enrichment_preserves_planning_metadata()
    print("Exercise metadata enrichment contract tests passed")
