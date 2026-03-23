import json
import os
import sqlite3
import fcntl
import logging
from pathlib import Path
from db import init_db

logger = logging.getLogger(__name__)


class JSONStorage:
    def __init__(self, data_dir):
        self.data_dir = Path(data_dir)
        self._last_error = None

    def _path(self, file_key):
        return self.data_dir / f"{file_key}.json"

    def _lock_path(self, file_key):
        return self.data_dir / f"{file_key}.json.lock"

    def _acquire_lock(self, file_key):
        lock_path = self._lock_path(file_key)
        lock_path.parent.mkdir(parents=True, exist_ok=True)
        lock_file = open(lock_path, "a+", encoding="utf-8")
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        return lock_file

    def _release_lock(self, lock_file):
        try:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
        finally:
            lock_file.close()

    def _set_last_error(self, file_key, operation, message):
        self._last_error = {
            "file_key": file_key,
            "operation": operation,
            "message": message,
        }

    def _clear_last_error(self):
        self._last_error = None

    def get_last_error(self):
        return dict(self._last_error) if isinstance(self._last_error, dict) else None

    def _read_list(self, file_key):
        path = self._path(file_key)
        if not path.exists():
            self._clear_last_error()
            return []
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, list):
                self._clear_last_error()
                return data
            logger.error("JSONStorage expected list in %s but got %s", path, type(data).__name__)
            self._set_last_error(file_key, "read_list", f"expected list but got {type(data).__name__}")
            return []
        except Exception:
            logger.exception("JSONStorage failed to read list from %s", path)
            self._set_last_error(file_key, "read_list", "exception while reading list")
            return []

    def _write_list(self, file_key, data):
        path = self._path(file_key)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def _read_object(self, file_key):
        path = self._path(file_key)
        if not path.exists():
            self._clear_last_error()
            return {}
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                self._clear_last_error()
                return data
            logger.error("JSONStorage expected dict in %s but got %s", path, type(data).__name__)
            self._set_last_error(file_key, "read_object", f"expected dict but got {type(data).__name__}")
            return {}
        except Exception:
            logger.exception("JSONStorage failed to read object from %s", path)
            self._set_last_error(file_key, "read_object", "exception while reading object")
            return {}

    def _write_object(self, file_key, data):
        path = self._path(file_key)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def _sort_desc(self, items, *keys):
        def _key(x):
            if not isinstance(x, dict):
                return ""
            for k in keys:
                v = x.get(k)
                if v not in (None, ""):
                    return str(v)
            return ""
        return sorted(items or [], key=_key, reverse=True)

    def list_user_items(self, file_key, user_id, sort_keys=("created_at", "date")):
        items = self._read_list(file_key)
        items = [x for x in items if isinstance(x, dict) and x.get("user_id", 1) == user_id]
        return self._sort_desc(items, *sort_keys)

    def append_item(self, file_key, item):
        lock_file = self._acquire_lock(file_key)
        try:
            items = self._read_list(file_key)
            items.append(item)
            self._write_list(file_key, items)
            return item, len(items)
        finally:
            self._release_lock(lock_file)

    def get_latest_user_item(self, file_key, user_id, sort_keys=("created_at", "date")):
        items = self.list_user_items(file_key, user_id, sort_keys=sort_keys)
        return items[0] if items else None

    def delete_user_item(self, file_key, user_id, item_id):
        lock_file = self._acquire_lock(file_key)
        try:
            items = self._read_list(file_key)
            out = []
            deleted = None

            for item in items:
                if not isinstance(item, dict):
                    out.append(item)
                    continue

                same_user = str(item.get("user_id")) == str(user_id)
                same_id = str(item.get("id", "")).strip() == str(item_id).strip()

                if same_user and same_id and deleted is None:
                    deleted = item
                    continue

                out.append(item)

            if deleted is not None:
                self._write_list(file_key, out)

            return deleted
        finally:
            self._release_lock(lock_file)

    
    def consume_manual_override_workout(self, user_id, date):
        lock_file = self._acquire_lock("workouts")
        try:
            items = self._read_list("workouts")
            changed = False

            for item in items:
                if not isinstance(item, dict):
                    continue
                if str(item.get("user_id")) != str(user_id):
                    continue
                if str(item.get("date", "")).strip() != str(date).strip():
                    continue
                if not bool(item.get("is_manual_override", False)):
                    continue
                if bool(item.get("is_consumed", False)):
                    continue

                item["is_consumed"] = True
                changed = True

            if changed:
                self._write_list("workouts", items)

            return changed
        finally:
            self._release_lock(lock_file)

    def get_user_settings_for(self, user_id):
        raw = self._read_object("user_settings")
        if not isinstance(raw, dict):
            return {}

        top_user_id = raw.get("user_id")
        if top_user_id == user_id:
            return raw

        users_map = raw.get("users")
        if isinstance(users_map, dict):
            candidate = users_map.get(str(user_id)) or users_map.get(user_id)
            if isinstance(candidate, dict):
                merged = dict(candidate)
                merged.setdefault("user_id", user_id)
                return merged

        if isinstance(users_map, list):
            for item in users_map:
                if isinstance(item, dict) and item.get("user_id") == user_id:
                    return item

        if "equipment_increments" in raw or "available_equipment" in raw or "profile" in raw or "preferences" in raw:
            merged = dict(raw)
            merged.setdefault("user_id", user_id)
            return merged

        return {}

    def save_user_settings_for(self, user_id, settings):
        lock_file = self._acquire_lock("user_settings")
        try:
            raw = self._read_object("user_settings")
            if not isinstance(raw, dict):
                raw = {}

            if "users" not in raw or not isinstance(raw.get("users"), dict):
                legacy = {}
                if raw and ("equipment_increments" in raw or "available_equipment" in raw or "profile" in raw or "preferences" in raw):
                    legacy_user_id = raw.get("user_id", 1)
                    legacy[str(legacy_user_id)] = dict(raw)
                raw = {"users": legacy}

            clean = dict(settings or {})
            clean["user_id"] = user_id
            if not isinstance(clean.get("profile"), dict):
                clean["profile"] = {}
            if not isinstance(clean.get("preferences"), dict):
                clean["preferences"] = {}
            raw["users"][str(user_id)] = clean
            self._write_object("user_settings", raw)
            return clean
        finally:
            self._release_lock(lock_file)


class SQLiteStorage:
    def __init__(self, db_path):
        self.db_path = Path(db_path)
        init_db()

    def _conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_user_row(self, user_id):
        if user_id in (None, ""):
            return
        with self._conn() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO users (user_id, created_at) VALUES (?, datetime('now'))",
                (str(user_id),)
            )
            conn.commit()

    def _normalize_row(self, file_key, row):
        d = dict(row)
        if file_key == "workouts":
            d["entries"] = json.loads(d.get("entries") or "[]")
        elif file_key == "session_results":
            d["results"] = json.loads(d.get("results") or "[]")
            d["completed"] = bool(d.get("completed", 0))
        return d

    def list_user_items(self, file_key, user_id, sort_keys=("created_at", "date")):
        table_map = {
            "workouts": "workouts",
            "checkins": "checkins",
            "session_results": "session_results",
        }
        table = table_map[file_key]
        with self._conn() as conn:
            rows = conn.execute(
                f"SELECT * FROM {table} WHERE user_id = ? ORDER BY created_at DESC, date DESC",
                (str(user_id),)
            ).fetchall()
        return [self._normalize_row(file_key, row) for row in rows]

    def append_item(self, file_key, item):
        user_id = item.get("user_id")
        self._ensure_user_row(user_id)

        with self._conn() as conn:
            if file_key == "workouts":
                conn.execute(
                    """
                    INSERT OR REPLACE INTO workouts
                    (id, user_id, date, session_type, duration_min, notes, program_id, program_day_label, entries, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        item.get("id"),
                        str(user_id),
                        item.get("date"),
                        item.get("session_type"),
                        item.get("duration_min"),
                        item.get("notes"),
                        item.get("program_id"),
                        item.get("program_day_label"),
                        json.dumps(item.get("entries", []), ensure_ascii=False),
                        item.get("created_at"),
                    )
                )
                table = "workouts"

            elif file_key == "checkins":
                conn.execute(
                    """
                    INSERT OR REPLACE INTO checkins
                    (id, user_id, date, sleep_score, energy_score, soreness_score, time_budget_min, readiness_score, notes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        item.get("id"),
                        str(user_id),
                        item.get("date"),
                        item.get("sleep_score"),
                        item.get("energy_score"),
                        item.get("soreness_score"),
                        item.get("time_budget_min"),
                        item.get("readiness_score"),
                        item.get("notes"),
                        item.get("created_at"),
                    )
                )
                table = "checkins"

            elif file_key == "session_results":
                conn.execute(
                    """
                    INSERT OR REPLACE INTO session_results
                    (id, user_id, date, session_type, timing_state, readiness_score, completed, notes, results, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        item.get("id"),
                        str(user_id),
                        item.get("date"),
                        item.get("session_type"),
                        item.get("timing_state"),
                        item.get("readiness_score"),
                        1 if item.get("completed") else 0,
                        item.get("notes"),
                        json.dumps(item.get("results", []), ensure_ascii=False),
                        item.get("created_at"),
                    )
                )
                table = "session_results"
            else:
                raise ValueError(f"Unsupported file_key for SQLite append_item: {file_key}")

            count = conn.execute(f"SELECT COUNT(*) AS c FROM {table}").fetchone()["c"]
            conn.commit()

        return item, count

    def get_latest_user_item(self, file_key, user_id, sort_keys=("created_at", "date")):
        items = self.list_user_items(file_key, user_id, sort_keys=sort_keys)
        return items[0] if items else None

    def delete_user_item(self, file_key, user_id, item_id):
        table_map = {
            "workouts": "workouts",
            "checkins": "checkins",
            "session_results": "session_results",
        }
        table = table_map[file_key]

        with self._conn() as conn:
            row = conn.execute(
                f"SELECT * FROM {table} WHERE user_id = ? AND id = ?",
                (str(user_id), str(item_id))
            ).fetchone()

            if not row:
                return None

            deleted = self._normalize_row(file_key, row)
            conn.execute(
                f"DELETE FROM {table} WHERE user_id = ? AND id = ?",
                (str(user_id), str(item_id))
            )
            conn.commit()

        return deleted

    

    
    def consume_manual_override_workout(self, user_id, date):
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM workouts WHERE user_id = ? AND date = ? AND is_manual_override = 1 AND is_consumed = 0 LIMIT 1",
                (str(user_id), str(date).strip())
            ).fetchone()

            if not row:
                return False

            conn.execute(
                "UPDATE workouts SET is_consumed = 1 WHERE user_id = ? AND date = ? AND is_manual_override = 1 AND is_consumed = 0",
                (str(user_id), str(date).strip())
            )
            conn.commit()

        return True

    def get_user_settings_for(self, user_id):
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM user_settings WHERE user_id = ?",
                (str(user_id),)
            ).fetchone()

        if not row:
            return {}

        return {
            "user_id": row["user_id"],
            "equipment_increments": json.loads(row["equipment_increments"] or "{}"),
            "available_equipment": json.loads(row["available_equipment"] or "{}"),
            "profile": json.loads(row["profile"] or "{}") if "profile" in row.keys() else {},
            "preferences": json.loads(row["preferences"] or "{}") if "preferences" in row.keys() else {},
        }

    def save_user_settings_for(self, user_id, settings):
        self._ensure_user_row(user_id)

        equipment_increments = settings.get("equipment_increments", {})
        available_equipment = settings.get("available_equipment", {})
        profile = settings.get("profile", {})
        preferences = settings.get("preferences", {})

        clean = {
            "user_id": user_id,
            "equipment_increments": equipment_increments if isinstance(equipment_increments, dict) else {},
            "available_equipment": available_equipment if isinstance(available_equipment, dict) else {},
            "profile": profile if isinstance(profile, dict) else {},
            "preferences": preferences if isinstance(preferences, dict) else {},
        }

        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO user_settings (user_id, equipment_increments, available_equipment, updated_at)
                VALUES (?, ?, ?, datetime('now'))
                ON CONFLICT(user_id) DO UPDATE SET
                    equipment_increments = excluded.equipment_increments,
                    available_equipment = excluded.available_equipment,
                    updated_at = datetime('now')
                """,
                (
                    str(user_id),
                    json.dumps(clean["equipment_increments"], ensure_ascii=False),
                    json.dumps(clean["available_equipment"], ensure_ascii=False),
                )
            )
            conn.commit()

        return clean


def get_storage_backend(data_dir, db_path, mode=None):
    mode = (mode or os.getenv("SOVEREIGN_STRENGTH_STORAGE", "json")).strip().lower()
    if mode == "sqlite":
        return SQLiteStorage(db_path)
    return JSONStorage(data_dir)
