#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path


DEFAULT_SEED_PATH = Path("app/data/seed/exercises.json")


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    sys.exit(1)


def load_list(path: Path, label: str) -> list[dict]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"{label}: could not parse JSON: {exc}")

    if not isinstance(data, list):
        fail(f"{label}: top-level JSON value must be a list")

    bad = [idx for idx, item in enumerate(data, start=1) if not isinstance(item, dict)]
    if bad:
        fail(f"{label}: non-object entries at positions: {bad[:10]}")

    return data


def item_id(item: dict) -> str:
    return str(item.get("id", "")).strip()


def has_external_images(item: dict) -> bool:
    return isinstance(item.get("external_images"), list) and bool(item.get("external_images"))


def has_image_folder(item: dict) -> bool:
    return bool(str(item.get("image_folder", "")).strip())


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Audit an exercise import candidate before merging into seed data."
    )
    parser.add_argument("--seed", default=str(DEFAULT_SEED_PATH), help="Existing seed exercises JSON")
    parser.add_argument("--candidate", required=True, help="Candidate exercises JSON")
    parser.add_argument(
        "--fail-on-weak-new",
        action="store_true",
        help="Fail if any new candidate entries use weak default metadata",
    )
    args = parser.parse_args()

    seed_path = Path(args.seed)
    candidate_path = Path(args.candidate)

    seed = load_list(seed_path, "seed")
    candidate = load_list(candidate_path, "candidate")

    seed_ids = {item_id(x) for x in seed if item_id(x)}
    candidate_ids = [item_id(x) for x in candidate if item_id(x)]

    duplicates = sorted(k for k, v in Counter(candidate_ids).items() if v > 1)
    if duplicates:
        fail("candidate duplicate ids: " + ", ".join(duplicates))

    overlap = sorted(seed_ids & set(candidate_ids))
    new_items = [x for x in candidate if item_id(x) and item_id(x) not in seed_ids]

    weak_items: list[tuple[str, list[str]]] = []
    for item in new_items:
        weak: list[str] = []
        if str(item.get("movement_pattern", "")).strip() in {"", "general"}:
            weak.append("movement_pattern")
        if item.get("local_load_targets") == ["general"]:
            weak.append("local_load_targets")
        if not str(item.get("notes", "")).strip():
            weak.append("notes")
        if not str(item.get("notes_en", "")).strip():
            weak.append("notes_en")
        if weak:
            weak_items.append((item_id(item), weak))

    print("OK: import candidate audited")
    print(f"Seed: {len(seed)} from {seed_path}")
    print(f"Candidate: {len(candidate)} from {candidate_path}")
    print(f"Overlap: {len(overlap)}")
    print(f"New: {len(new_items)}")
    print(f"Candidate image_folder coverage: {sum(1 for x in candidate if has_image_folder(x))}/{len(candidate)}")
    print(f"Candidate external_images coverage: {sum(1 for x in candidate if has_external_images(x))}/{len(candidate)}")
    print(f"Weak new metadata: {len(weak_items)}/{len(new_items)}")

    if overlap:
        print("\nOverlap ids:")
        for ex_id in overlap:
            print(f"- {ex_id}")

    if weak_items:
        print("\nWeak new metadata:")
        for ex_id, weak in weak_items:
            print(f"- {ex_id}: {', '.join(weak)}")

    if args.fail_on_weak_new and weak_items:
        fail("new candidate entries contain weak/default metadata")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
