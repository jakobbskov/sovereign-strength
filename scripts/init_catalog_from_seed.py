#!/usr/bin/env python3
from pathlib import Path
import json
import shutil
import sys
from datetime import datetime

REPO_ROOT = Path(__file__).resolve().parents[1]
SEED_DIR = REPO_ROOT / "app" / "data" / "seed"
LIVE_DIR = Path("/var/www/sovereign-strength/data")

FILES = {
    "exercises": ("exercises.json", "catalog"),
    "programs": ("programs.json", "catalog"),
}


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def verify_program_catalog_shape(path: Path) -> tuple[bool, str]:
    try:
        data = load_json(path)
    except Exception as exc:
        return False, f"Could not parse JSON: {exc}"

    if not isinstance(data, list) or not data:
        return False, "Program catalog is empty or not a list"

    strength_programs = [
        item for item in data
        if isinstance(item, dict) and str(item.get("kind", "")).strip().lower() == "strength"
    ]
    if not strength_programs:
        return False, "No strength programs found in runtime catalog"

    required_keys = {"supported_weekly_sessions", "equipment_profiles"}
    for item in strength_programs:
        missing = [key for key in required_keys if key not in item]
        if missing:
            pid = str(item.get("id", "")).strip() or "<unknown>"
            return False, f"Strength program {pid} missing required keys: {', '.join(missing)}"

    return True, f"Verified {len(strength_programs)} strength programs with required metadata"


def main() -> int:
    missing = []
    for _, (filename, _) in FILES.items():
        seed = SEED_DIR / filename
        if not seed.exists():
            missing.append(str(seed))
    if missing:
        print("Missing seed files:")
        for item in missing:
            print(f" - {item}")
        return 1

    LIVE_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

    for key, (filename, kind) in FILES.items():
        seed = SEED_DIR / filename
        live = LIVE_DIR / filename
        backup = LIVE_DIR / f"{filename}.bak.{timestamp}"

        if live.exists():
            shutil.copy2(live, backup)
            print(f"Backup: {live} -> {backup}")

        shutil.copy2(seed, live)
        print(f"Sync {kind}: {seed} -> {live}")

    ok, message = verify_program_catalog_shape(LIVE_DIR / "programs.json")
    if not ok:
        print(f"Verification failed: {message}")
        return 1

    print(message)
    print("Done. Runtime catalog data refreshed from seed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
