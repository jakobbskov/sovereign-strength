#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

DEFAULT_DATA_PATH = Path("app/data/seed/exercises.json")

REQUIRED_FIELDS = {
    "id",
    "name",
    "name_en",
    "category",
    "category_en",
    "default_unit",
    "difficulty_tier",
    "equipment_type",
    "input_kind",
    "load_increment",
    "load_optional",
    "local_load_targets",
    "movement_pattern",
    "notes",
    "notes_en",
    "progression_mode",
    "progression_step",
    "progression_style",
    "recommended_step",
    "set_options",
    "start_weight",
    "supports_bodyweight",
    "supports_load",
}

OPTIONAL_FIELDS = {
    "rep_options",
    "time_options",
    "load_options",
    "workout_rep_choices",
    "image_folder",
    "external_images",
    "progression_channels",
    "progression_ladder",
    "rep_display_hint",
    "form_cues",
    "form_cues_en",
}

ALLOWED_FIELDS = REQUIRED_FIELDS | OPTIONAL_FIELDS

INPUT_KIND_TIME = {"time", "cardio_time"}
INPUT_KIND_BODYWEIGHT = {"bodyweight_reps"}


def fail(msg: str) -> None:
    print(f"ERROR: {msg}")
    sys.exit(1)


def warn(msg: str) -> None:
    print(f"WARN: {msg}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate exercise JSON against the SovereignStrength exercise model contract.")
    parser.add_argument("--input", default=str(DEFAULT_DATA_PATH), help="Path to exercise JSON file")
    args = parser.parse_args()

    data_path = Path(args.input)

    if not data_path.exists():
        fail(f"Missing file: {data_path}")

    try:
        items = json.loads(data_path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"Could not parse JSON: {exc}")

    if not isinstance(items, list):
        fail("Exercise data must be a top-level list")

    seen_ids: set[str] = set()

    for idx, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            fail(f"Entry #{idx} is not an object")

        item_id = str(item.get("id", "")).strip() or f"<missing-id-#{idx}>"

        missing = sorted(field for field in REQUIRED_FIELDS if field not in item)
        if missing:
            fail(f"{item_id}: missing required fields: {', '.join(missing)}")

        unknown = sorted(field for field in item.keys() if field not in ALLOWED_FIELDS)
        if unknown:
            fail(f"{item_id}: unknown fields: {', '.join(unknown)}")

        if item_id in seen_ids:
            fail(f"{item_id}: duplicate id")
        seen_ids.add(item_id)

        if not isinstance(item["local_load_targets"], list) or not item["local_load_targets"]:
            fail(f"{item_id}: local_load_targets must be a non-empty list")

        if not isinstance(item["set_options"], list) or not item["set_options"]:
            fail(f"{item_id}: set_options must be a non-empty list")

        input_kind = str(item.get("input_kind", "")).strip()

        if input_kind in INPUT_KIND_TIME:
            if "time_options" not in item:
                warn(f"{item_id}: time-based input_kind without time_options")
            if "rep_options" in item:
                warn(f"{item_id}: time-based input_kind still includes rep_options")

        if input_kind in INPUT_KIND_BODYWEIGHT:
            if not bool(item.get("supports_bodyweight", False)):
                fail(f"{item_id}: bodyweight_reps requires supports_bodyweight=true")

        supports_load = bool(item.get("supports_load", False))
        if not supports_load and "load_options" in item:
            warn(f"{item_id}: supports_load=false but load_options is present")

        if "external_images" in item and not isinstance(item["external_images"], list):
            fail(f"{item_id}: external_images must be a list when present")

        if "rep_options" in item and not isinstance(item["rep_options"], list):
            fail(f"{item_id}: rep_options must be a list when present")

        if "time_options" in item and not isinstance(item["time_options"], list):
            fail(f"{item_id}: time_options must be a list when present")

        if "load_options" in item and not isinstance(item["load_options"], list):
            fail(f"{item_id}: load_options must be a list when present")

        if "workout_rep_choices" in item and not isinstance(item["workout_rep_choices"], list):
            fail(f"{item_id}: workout_rep_choices must be a list when present")

        if "progression_channels" in item and not isinstance(item["progression_channels"], list):
            fail(f"{item_id}: progression_channels must be a list when present")

        if "progression_ladder" in item and not isinstance(item["progression_ladder"], list):
            fail(f"{item_id}: progression_ladder must be a list when present")

        if "form_cues" in item and not isinstance(item["form_cues"], list):
            fail(f"{item_id}: form_cues must be a list when present")

        if "form_cues_en" in item and not isinstance(item["form_cues_en"], list):
            fail(f"{item_id}: form_cues_en must be a list when present")

    print(f"OK: validated {len(items)} exercise entries against the exercise model contract")
    print(f"Source: {data_path}")


if __name__ == "__main__":
    main()
