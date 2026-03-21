#!/usr/bin/env python3
from pathlib import Path
import shutil
import sys

REPO_ROOT = Path(__file__).resolve().parents[1]
SEED_DIR = REPO_ROOT / "app" / "data" / "seed"
LIVE_DIR = Path("/var/www/sovereign-strength/data")

FILES = {
    "exercises": ("exercises.json", "catalog"),
    "programs": ("programs.json", "catalog"),
}

def main() -> int:
    missing = []
    for key, (filename, _) in FILES.items():
        seed = SEED_DIR / filename
        if not seed.exists():
            missing.append(str(seed))
    if missing:
        print("Missing seed files:")
        for item in missing:
            print(f" - {item}")
        return 1

    LIVE_DIR.mkdir(parents=True, exist_ok=True)

    for key, (filename, kind) in FILES.items():
        seed = SEED_DIR / filename
        live = LIVE_DIR / filename
        backup = LIVE_DIR / f"{filename}.bak.seedinit"

        if live.exists():
            shutil.copy2(live, backup)
            print(f"Backup: {live} -> {backup}")

        shutil.copy2(seed, live)
        print(f"Init {kind}: {seed} -> {live}")

    print("Done. Catalog data initialized from seed.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
