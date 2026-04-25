import json
from pathlib import Path
from collections import defaultdict


ROOT = Path(__file__).resolve().parents[1]
EXERCISES = ROOT / "app/data/seed/exercises.json"
PROGRAMS = ROOT / "app/data/seed/programs.json"

CANONICAL_PUSH_FAMILY = [
    "incline_push_ups",
    "push_ups",
    "diamond_push_ups",
]

NON_CANONICAL_PUSH_DUPLICATES = {
    "incline_push_up",
    "pushups",
    "push_up_wide",
    "incline_push_up_medium",
    "incline_push_up_wide",
    "incline_push_up_close_grip",
    "push_ups_close_triceps_position",
}


def _exercise_map():
    items = json.loads(EXERCISES.read_text())
    return {
        str(item.get("id", "")).strip(): item
        for item in items
        if isinstance(item, dict) and str(item.get("id", "")).strip()
    }


def _program_refs():
    programs = json.loads(PROGRAMS.read_text())
    refs = defaultdict(int)

    for program in programs:
        days = program.get("days", [])
        if not isinstance(days, list):
            continue

        for day in days:
            entries = day.get("exercises", []) if isinstance(day, dict) else []
            if not isinstance(entries, list):
                continue

            for entry in entries:
                exercise_id = str(entry.get("exercise_id", "")).strip()
                if exercise_id:
                    refs[exercise_id] += 1

    return refs


def test_canonical_pushup_family_exists_and_is_ladder_backed():
    exercises = _exercise_map()

    for exercise_id in CANONICAL_PUSH_FAMILY:
        assert exercise_id in exercises, exercise_id

    ladder = exercises["push_ups"].get("progression_ladder", [])
    for exercise_id in CANONICAL_PUSH_FAMILY:
        assert exercise_id in ladder, exercise_id


def test_canonical_pushup_family_has_viewer_guidance():
    exercises = _exercise_map()

    for exercise_id in CANONICAL_PUSH_FAMILY:
        item = exercises[exercise_id]
        assert len(str(item.get("notes", "")).strip()) >= 50, exercise_id
        assert len(str(item.get("notes_en", "")).strip()) >= 50, exercise_id

        cues = item.get("form_cues")
        cues_en = item.get("form_cues_en")
        assert isinstance(cues, list) and len(cues) >= 3, exercise_id
        assert isinstance(cues_en, list) and len(cues_en) >= 3, exercise_id


def test_non_canonical_pushup_duplicates_are_not_program_referenced():
    refs = _program_refs()

    for exercise_id in NON_CANONICAL_PUSH_DUPLICATES:
        assert refs.get(exercise_id, 0) == 0, (exercise_id, refs.get(exercise_id, 0))


if __name__ == "__main__":
    test_canonical_pushup_family_exists_and_is_ladder_backed()
    test_canonical_pushup_family_has_viewer_guidance()
    test_non_canonical_pushup_duplicates_are_not_program_referenced()
    print("Bodyweight deduplication contract tests passed")
