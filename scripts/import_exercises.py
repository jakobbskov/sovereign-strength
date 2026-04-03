#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = REPO_ROOT / "tmp" / "imported_exercises.json"

REQUIRED_OUTPUT_FIELDS = {
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

def fail(message: str) -> None:
    print(f"ERROR: {message}")
    sys.exit(1)

def slugify(value: str) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text or "unknown_exercise"

def as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]

def map_record(raw: dict[str, Any]) -> dict[str, Any]:
    name = str(raw.get("name") or raw.get("title") or "").strip()
    name_en = str(raw.get("name_en") or raw.get("english_name") or name).strip()
    category = str(raw.get("category") or "general").strip()
    category_en = str(raw.get("category_en") or category).strip()
    equipment_type = str(raw.get("equipment_type") or raw.get("equipment") or "bodyweight").strip()
    movement_pattern = str(raw.get("movement_pattern") or raw.get("movement") or "general").strip()

    input_kind = str(raw.get("input_kind") or "reps").strip()
    default_unit = str(raw.get("default_unit") or ("sec" if input_kind in ("time", "cardio_time") else "reps")).strip()

    supports_load = bool(raw.get("supports_load", equipment_type not in ("bodyweight", "none")))
    supports_bodyweight = bool(raw.get("supports_bodyweight", equipment_type == "bodyweight"))
    load_optional = bool(raw.get("load_optional", supports_bodyweight))

    item = {
        "id": slugify(str(raw.get("id") or name or name_en)),
        "name": name or name_en or "Unknown exercise",
        "name_en": name_en or name or "Unknown exercise",
        "category": category or "general",
        "category_en": category_en or category or "general",
        "default_unit": default_unit,
        "difficulty_tier": int(raw.get("difficulty_tier", 1) or 1),
        "equipment_type": equipment_type or "bodyweight",
        "input_kind": input_kind,
        "load_increment": float(raw.get("load_increment", 0) or 0),
        "load_optional": load_optional,
        "local_load_targets": as_list(raw.get("local_load_targets") or ["general"]),
        "movement_pattern": movement_pattern or "general",
        "notes": str(raw.get("notes") or "").strip(),
        "notes_en": str(raw.get("notes_en") or raw.get("notes") or "").strip(),
        "progression_mode": str(raw.get("progression_mode") or "reps_only").strip(),
        "progression_step": float(raw.get("progression_step", 0) or 0),
        "progression_style": str(raw.get("progression_style") or "standard").strip(),
        "recommended_step": float(raw.get("recommended_step", 0) or 0),
        "set_options": as_list(raw.get("set_options") or [1, 2, 3]),
        "start_weight": float(raw.get("start_weight", 0) or 0),
        "supports_bodyweight": supports_bodyweight,
        "supports_load": supports_load,
    }
    raw_images = raw.get("external_images")
    if raw_images in (None, "", []):
        raw_images = raw.get("images")

    raw_image_folder = raw.get("image_folder")
    if raw_image_folder in (None, "") and isinstance(raw_images, list) and raw_images:
        first_image = str(raw_images[0] or "").strip()
        if "/" in first_image:
            raw_image_folder = first_image.split("/", 1)[0]

    optional_map = {
        "rep_options": raw.get("rep_options"),
        "time_options": raw.get("time_options"),
        "load_options": raw.get("load_options"),
        "image_folder": raw_image_folder,
        "external_images": raw_images,
        "progression_channels": raw.get("progression_channels"),
        "progression_ladder": raw.get("progression_ladder"),
        "rep_display_hint": raw.get("rep_display_hint"),
    }


    for key, value in optional_map.items():
        if value not in (None, "", []):
            item[key] = value

    missing = sorted(field for field in REQUIRED_OUTPUT_FIELDS if field not in item)
    if missing:
        fail(f"{item['id']}: mapped record missing required output fields: {', '.join(missing)}")

    return item

def main() -> int:
    parser = argparse.ArgumentParser(description="Transform external exercise JSON into SovereignStrength contract format.")
    parser.add_argument("--input", required=True, help="Path to external JSON input")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Path to write transformed JSON")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        fail(f"Input file not found: {input_path}")

    try:
        raw = json.loads(input_path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"Could not parse input JSON: {exc}")

    if not isinstance(raw, list):
        fail("Input JSON must be a top-level list of exercise objects")

    mapped: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for idx, entry in enumerate(raw, start=1):
        if not isinstance(entry, dict):
            fail(f"Input entry #{idx} is not an object")

        item = map_record(entry)

        if item["id"] in seen_ids:
            fail(f"Duplicate mapped id: {item['id']}")
        seen_ids.add(item["id"])
        mapped.append(item)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(mapped, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"OK: transformed {len(mapped)} exercises")
    print(f"Output: {output_path}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
