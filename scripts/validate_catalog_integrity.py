#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

DEFAULT_PROGRAMS_PATH = Path("app/data/seed/programs.json")
DEFAULT_EXERCISES_PATH = Path("app/data/seed/exercises.json")

# Program entries may reference non-strength/cardio pseudo-exercises used as
# session primitives. Keep this list small and explicit.
ALLOWED_SYNTHETIC_EXERCISE_IDS = {
    "run_easy",
    "run_walk",
    "easy_run",
    "base_run",
    "tempo_run",
    "interval_run",
    "long_run",
    "walk",
    "walking",
    "mobility_flow",
    "mobility",
    "restitution_easy",
    "restitution_walk",
}

REQUIRED_PROGRAM_SELECTOR_FIELDS = {
    "id",
    "kind",
    "recommended_levels",
    "supported_goals",
    "supported_weekly_sessions",
    "equipment_profiles",
    "days",
}

EXPECTED_SELECTOR_PROGRAM_IDS = {
    "starter_strength_2x",
    "starter_strength_gym_2x",
    "strength_full_body_3x_beginner",
    "starter_strength_gym_3x",
    "base_strength_a",
    "base_strength_gym_3x",
    "base_strength_gym_4x",
    "starter_run_2x",
    "starter_run_3x_beginner",
    "base_run_3x",
    "base_run_4x",
    "reentry_run_2x",
    "hybrid_run_strength_2x_beginner",
    "hybrid_run_strength_3x_beginner",
    "mobility_basic",
}


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"{path}: could not parse JSON: {exc}")


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    sys.exit(1)


def collect_ids(items, label: str) -> set[str]:
    if not isinstance(items, list):
        fail(f"{label}: top-level JSON value must be a list")

    seen: set[str] = set()
    duplicates: list[str] = []

    for idx, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            fail(f"{label}: entry #{idx} is not an object")

        item_id = str(item.get("id", "")).strip()
        if not item_id:
            fail(f"{label}: entry #{idx} is missing id")

        if item_id in seen:
            duplicates.append(item_id)
        seen.add(item_id)

    if duplicates:
        fail(f"{label}: duplicate ids: {', '.join(sorted(set(duplicates)))}")

    return seen


def iter_program_exercise_refs(program: dict):
    program_id = str(program.get("id", "")).strip() or "<missing-program-id>"
    days = program.get("days", [])

    if not isinstance(days, list):
        fail(f"{program_id}: days must be a list")

    for day_idx, day in enumerate(days):
        if not isinstance(day, dict):
            fail(f"{program_id}: day #{day_idx + 1} is not an object")

        exercises = day.get("exercises", [])
        if not isinstance(exercises, list):
            fail(f"{program_id}: day #{day_idx + 1} exercises must be a list")

        for ex_idx, entry in enumerate(exercises):
            if not isinstance(entry, dict):
                fail(f"{program_id}: day #{day_idx + 1} exercise #{ex_idx + 1} is not an object")

            exercise_id = str(entry.get("exercise_id", "")).strip()
            if not exercise_id:
                fail(f"{program_id}: day #{day_idx + 1} exercise #{ex_idx + 1} missing exercise_id")

            yield program_id, day_idx + 1, ex_idx + 1, exercise_id


def validate_program_selector_metadata(programs: list[dict]) -> None:
    for program in programs:
        program_id = str(program.get("id", "")).strip() or "<missing-program-id>"
        missing = sorted(field for field in REQUIRED_PROGRAM_SELECTOR_FIELDS if field not in program)
        if missing:
            fail(f"{program_id}: missing selector fields: {', '.join(missing)}")

        for field in ("recommended_levels", "supported_goals", "supported_weekly_sessions", "equipment_profiles"):
            value = program.get(field)
            if not isinstance(value, list) or not value:
                fail(f"{program_id}: {field} must be a non-empty list")

        kind = str(program.get("kind", "")).strip().lower()
        if not kind:
            fail(f"{program_id}: kind must be non-empty")

        if kind in {"mixed", "hybrid"}:
            program_family = str(program.get("program_family", "")).strip().lower()
            training_style = str(program.get("training_style", "")).strip().lower()
            tags = program.get("tags", []) if isinstance(program.get("tags", []), list) else []
            normalized_tags = {str(tag or "").strip().lower() for tag in tags}

            run_relevant = bool(
                program.get("hybrid_enabled") is True
                or "run" in program_family
                or "run" in training_style
                or "run_first" in normalized_tags
                or "hybrid" in normalized_tags
            )

            if "run" in program_id and not run_relevant:
                fail(f"{program_id}: run-like mixed/hybrid program lacks run-relevant metadata")


def validate_catalog_integrity(programs_path: Path, exercises_path: Path) -> None:
    programs = load_json(programs_path)
    exercises = load_json(exercises_path)

    program_ids = collect_ids(programs, "programs")
    exercise_ids = collect_ids(exercises, "exercises")

    validate_program_selector_metadata(programs)

    missing_selector_ids = sorted(pid for pid in EXPECTED_SELECTOR_PROGRAM_IDS if pid not in program_ids)
    if missing_selector_ids:
        fail(f"missing expected selector program ids: {', '.join(missing_selector_ids)}")

    missing_refs: list[str] = []
    for program in programs:
        for program_id, day_idx, ex_idx, exercise_id in iter_program_exercise_refs(program):
            if exercise_id in exercise_ids or exercise_id in ALLOWED_SYNTHETIC_EXERCISE_IDS:
                continue

            missing_refs.append(
                f"{program_id} day {day_idx} exercise {ex_idx}: {exercise_id}"
            )

    if missing_refs:
        fail("missing exercise references:\n" + "\n".join(f"- {x}" for x in missing_refs))

    print("OK: catalog integrity validated")
    print(f"Programs: {len(programs)} from {programs_path}")
    print(f"Exercises: {len(exercises)} from {exercises_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Validate cross-catalog integrity for SovereignStrength seed data."
    )
    parser.add_argument("--programs", default=str(DEFAULT_PROGRAMS_PATH), help="Path to programs JSON")
    parser.add_argument("--exercises", default=str(DEFAULT_EXERCISES_PATH), help="Path to exercises JSON")
    args = parser.parse_args()

    validate_catalog_integrity(
        programs_path=Path(args.programs),
        exercises_path=Path(args.exercises),
    )


if __name__ == "__main__":
    main()
