#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

DEFAULT_DATA_PATH = Path("app/data/seed/programs.json")

REQUIRED_PROGRAM_FIELDS = {
    "id",
    "name",
    "name_en",
    "kind",
    "recommended_levels",
    "supported_goals",
    "supported_weekly_sessions",
    "equipment_profiles",
    "days",
}

REQUIRED_STRENGTH_METADATA_FIELDS = {
    "training_style",
    "session_duration_min",
    "session_duration_max",
    "fatigue_profile",
    "complexity",
    "good_for_reentry",
    "good_for_concurrent_running",
    "program_family",
    "progression_model",
    "tags",
}

OPTIONAL_COMMON_FIELDS = set()

ALLOWED_TRAINING_STYLES = {
    "full_body_foundation",
    "full_body_base",
    "reentry_full_body",
    "upper_lower_split",
}

ALLOWED_FATIGUE_PROFILES = {
    "low",
    "low_to_moderate",
    "moderate",
    "moderate_to_high",
    "high",
}

ALLOWED_COMPLEXITY = {
    "low",
    "moderate",
    "high",
}


def fail(msg: str) -> None:
    print(f"ERROR: {msg}")
    sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate program JSON against the SovereignStrength program model contract.")
    parser.add_argument("--input", default=str(DEFAULT_DATA_PATH), help="Path to programs JSON file")
    args = parser.parse_args()

    data_path = Path(args.input)
    if not data_path.exists():
        fail(f"Missing file: {data_path}")

    try:
        items = json.loads(data_path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"Could not parse JSON: {exc}")

    if not isinstance(items, list):
        fail("Program data must be a top-level list")

    seen_ids: set[str] = set()

    for idx, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            fail(f"Entry #{idx} is not an object")

        item_id = str(item.get("id", "")).strip() or f"<missing-id-#{idx}>"
        missing = sorted(field for field in REQUIRED_PROGRAM_FIELDS if field not in item)
        if missing:
            fail(f"{item_id}: missing required fields: {', '.join(missing)}")

        if item_id in seen_ids:
            fail(f"{item_id}: duplicate id")
        seen_ids.add(item_id)

        if not isinstance(item["recommended_levels"], list) or not item["recommended_levels"]:
            fail(f"{item_id}: recommended_levels must be a non-empty list")
        if not isinstance(item["supported_goals"], list) or not item["supported_goals"]:
            fail(f"{item_id}: supported_goals must be a non-empty list")
        if not isinstance(item["supported_weekly_sessions"], list) or not item["supported_weekly_sessions"]:
            fail(f"{item_id}: supported_weekly_sessions must be a non-empty list")
        if not isinstance(item["equipment_profiles"], list) or not item["equipment_profiles"]:
            fail(f"{item_id}: equipment_profiles must be a non-empty list")
        if not isinstance(item["days"], list) or not item["days"]:
            fail(f"{item_id}: days must be a non-empty list")

        kind = str(item.get("kind", "")).strip().lower()
        if kind == "strength":
            missing_strength = sorted(field for field in REQUIRED_STRENGTH_METADATA_FIELDS if field not in item)
            if missing_strength:
                fail(f"{item_id}: missing required strength metadata fields: {', '.join(missing_strength)}")

            if item["training_style"] not in ALLOWED_TRAINING_STYLES:
                fail(f"{item_id}: invalid training_style: {item['training_style']}")
            if item["fatigue_profile"] not in ALLOWED_FATIGUE_PROFILES:
                fail(f"{item_id}: invalid fatigue_profile: {item['fatigue_profile']}")
            if item["complexity"] not in ALLOWED_COMPLEXITY:
                fail(f"{item_id}: invalid complexity: {item['complexity']}")
            if not isinstance(item["session_duration_min"], int) or not isinstance(item["session_duration_max"], int):
                fail(f"{item_id}: session_duration_min/max must be integers")
            if item["session_duration_min"] <= 0 or item["session_duration_max"] < item["session_duration_min"]:
                fail(f"{item_id}: invalid session duration range")
            if not isinstance(item["good_for_reentry"], bool):
                fail(f"{item_id}: good_for_reentry must be boolean")
            if not isinstance(item["good_for_concurrent_running"], bool):
                fail(f"{item_id}: good_for_concurrent_running must be boolean")
            if not isinstance(item["program_family"], str) or not item["program_family"].strip():
                fail(f"{item_id}: program_family must be a non-empty string")
            if not isinstance(item["progression_model"], str) or not item["progression_model"].strip():
                fail(f"{item_id}: progression_model must be a non-empty string")
            if not isinstance(item["tags"], list) or not item["tags"] or not all(isinstance(x, str) and x.strip() for x in item["tags"]):
                fail(f"{item_id}: tags must be a non-empty list of strings")

    print(f"OK: validated {len(items)} program entries against the program model contract")
    print(f"Source: {data_path}")


if __name__ == "__main__":
    main()
