import json
import sys
from pathlib import Path

from db import init_db, DB_PATH
from storage import SQLiteStorage


def read_json(path):
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def resolve_source_dir():
    if len(sys.argv) > 1:
        return Path(sys.argv[1]).resolve()

    candidates = [
        Path("/var/www/sovereign-strength/data"),
        Path(__file__).resolve().parents[1] / "frontend" / "data",
        Path(__file__).resolve().parents[1] / "data-samples",
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    raise SystemExit("No source data directory found. Pass one explicitly.")


def ensure_user(conn, user_id):
    if user_id in (None, ""):
        return
    conn.execute(
        "INSERT OR IGNORE INTO users (user_id, created_at) VALUES (?, datetime('now'))",
        (str(user_id),)
    )


def migrate_user_settings(storage, source_dir):
    raw = read_json(source_dir / "user_settings.json")
    count = 0

    if not isinstance(raw, dict):
        return count

    users_map = raw.get("users")

    if isinstance(users_map, dict):
        for key, value in users_map.items():
            if not isinstance(value, dict):
                continue
            user_id = value.get("user_id", key)
            storage.save_user_settings_for(user_id, value)
            count += 1
        return count

    if isinstance(users_map, list):
        for value in users_map:
            if not isinstance(value, dict):
                continue
            user_id = value.get("user_id")
            if user_id in (None, ""):
                continue
            storage.save_user_settings_for(user_id, value)
            count += 1
        return count

    if "equipment_increments" in raw or "available_equipment" in raw:
        user_id = raw.get("user_id", 1)
        storage.save_user_settings_for(user_id, raw)
        count += 1

    return count


def migrate_list(storage, source_dir, file_key):
    raw = read_json(source_dir / f"{file_key}.json")
    if not isinstance(raw, list):
        return 0

    count = 0
    for item in raw:
        if not isinstance(item, dict):
            continue
        if item.get("user_id") in (None, ""):
            item["user_id"] = 1
        storage.append_item(file_key, item)
        count += 1
    return count


def main():
    source_dir = resolve_source_dir()
    init_db()
    storage = SQLiteStorage(DB_PATH)

    counts = {}
    counts["workouts"] = migrate_list(storage, source_dir, "workouts")
    counts["checkins"] = migrate_list(storage, source_dir, "checkins")
    counts["session_results"] = migrate_list(storage, source_dir, "session_results")
    counts["user_settings"] = migrate_user_settings(storage, source_dir)

    print(f"Source: {source_dir}")
    print(f"Target: {DB_PATH}")
    for key in ("workouts", "checkins", "session_results", "user_settings"):
        print(f"Imported {key}: {counts.get(key, 0)}")


if __name__ == "__main__":
    main()
