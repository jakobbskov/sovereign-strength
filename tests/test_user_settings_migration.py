import json
import sqlite3
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "app" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from storage import JSONStorage, SQLiteStorage, normalize_user_settings_shape


def test_normalize_user_settings_shape_moves_legacy_fields_into_nested_structure():
    raw = {
        "user_id": "u1",
        "bodyweight_kg": 92,
        "training_types": {"running": True, "strength_weights": False},
        "training_days": {"mon": True, "wed": True},
        "weekly_target_sessions": 3,
        "planning_mode": "autoplan",
        "equipment_increments": {"barbell": 2.5},
        "available_equipment": {"barbell": True},
    }

    normalized = normalize_user_settings_shape("u1", raw)

    assert normalized["user_id"] == "u1"
    assert normalized["profile"]["bodyweight_kg"] == 92
    assert normalized["preferences"]["training_types"] == {"running": True, "strength_weights": False}
    assert normalized["preferences"]["training_days"] == {"mon": True, "wed": True}
    assert normalized["preferences"]["weekly_target_sessions"] == 3
    assert normalized["preferences"]["planning_mode"] == "autoplan"
    assert normalized["equipment_increments"] == {"barbell": 2.5}
    assert normalized["available_equipment"] == {"barbell": True}

    assert "bodyweight_kg" not in normalized
    assert "training_types" not in normalized
    assert "training_days" not in normalized
    assert "weekly_target_sessions" not in normalized
    assert "planning_mode" not in normalized


def test_normalize_user_settings_shape_is_idempotent():
    raw = {
        "user_id": "u1",
        "profile": {"bodyweight_kg": 85},
        "preferences": {
            "training_types": {"running": False, "strength_weights": True},
            "weekly_target_sessions": 4,
        },
        "available_equipment": {"dumbbell": True},
    }

    once = normalize_user_settings_shape("u1", raw)
    twice = normalize_user_settings_shape("u1", once)

    assert twice == once


def test_json_storage_get_user_settings_migrates_flat_legacy_root_object():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        storage = JSONStorage(tmp_path)

        legacy = {
            "user_id": "u1",
            "bodyweight_kg": 90,
            "training_types": {"running": True, "strength_weights": True},
            "training_days": {"tue": True, "thu": True},
            "weekly_target_sessions": 2,
            "planning_mode": "fixed",
            "available_equipment": {"dumbbell": True},
        }
        (tmp_path / "user_settings.json").write_text(
            json.dumps(legacy, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        result = storage.get_user_settings_for("u1")

        assert result["user_id"] == "u1"
        assert result["profile"]["bodyweight_kg"] == 90
        assert result["preferences"]["training_types"]["running"] is True
        assert result["preferences"]["training_days"] == {"tue": True, "thu": True}
        assert result["preferences"]["weekly_target_sessions"] == 2
        assert result["preferences"]["planning_mode"] == "fixed"
        assert "bodyweight_kg" not in result
        assert "training_types" not in result


def test_json_storage_save_user_settings_normalizes_and_persists_under_users_map():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        storage = JSONStorage(tmp_path)

        legacy_input = {
            "bodyweight_kg": 88,
            "training_types": {"running": False, "strength_weights": True, "bodyweight": True},
            "weekly_target_sessions": 4,
            "planning_mode": "autoplan",
            "profile": {"height_cm": 182},
        }

        saved = storage.save_user_settings_for("u7", legacy_input)

        assert saved["user_id"] == "u7"
        assert saved["profile"]["bodyweight_kg"] == 88
        assert saved["profile"]["height_cm"] == 182
        assert saved["preferences"]["weekly_target_sessions"] == 4
        assert saved["preferences"]["planning_mode"] == "autoplan"
        assert saved["preferences"]["training_types"]["bodyweight"] is True
        assert "bodyweight_kg" not in saved
        assert "weekly_target_sessions" not in saved

        persisted_raw = json.loads((tmp_path / "user_settings.json").read_text(encoding="utf-8"))
        assert "users" in persisted_raw
        assert "u7" in persisted_raw["users"]

        persisted_user = persisted_raw["users"]["u7"]
        assert persisted_user["profile"]["bodyweight_kg"] == 88
        assert persisted_user["preferences"]["weekly_target_sessions"] == 4
        assert "bodyweight_kg" not in persisted_user
        assert "weekly_target_sessions" not in persisted_user


def test_json_storage_save_user_settings_migrates_existing_top_level_legacy_blob_into_users_map():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        storage = JSONStorage(tmp_path)

        existing_legacy = {
            "user_id": "legacy-user",
            "bodyweight_kg": 101,
            "training_days": {"mon": True},
            "weekly_target_sessions": 2,
        }
        (tmp_path / "user_settings.json").write_text(
            json.dumps(existing_legacy, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        storage.save_user_settings_for(
            "new-user",
            {
                "bodyweight_kg": 77,
                "training_types": {"running": True},
            },
        )

        persisted_raw = json.loads((tmp_path / "user_settings.json").read_text(encoding="utf-8"))
        assert "users" in persisted_raw

        legacy_user = persisted_raw["users"]["legacy-user"]
        assert legacy_user["profile"]["bodyweight_kg"] == 101
        assert legacy_user["preferences"]["training_days"] == {"mon": True}
        assert legacy_user["preferences"]["weekly_target_sessions"] == 2

        new_user = persisted_raw["users"]["new-user"]
        assert new_user["profile"]["bodyweight_kg"] == 77
        assert new_user["preferences"]["training_types"] == {"running": True}


def test_sqlite_storage_save_and_get_user_settings_normalize_legacy_fields():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        db_path = tmp_path / "test_storage.db"

        conn = sqlite3.connect(db_path)
        conn.execute(
            """
            CREATE TABLE users (
                user_id TEXT PRIMARY KEY,
                created_at TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE user_settings (
                user_id TEXT PRIMARY KEY,
                equipment_increments TEXT,
                available_equipment TEXT,
                profile TEXT,
                preferences TEXT,
                updated_at TEXT
            )
            """
        )
        conn.commit()
        conn.close()

        storage = SQLiteStorage.__new__(SQLiteStorage)
        storage.db_path = db_path

        saved = storage.save_user_settings_for(
            "u9",
            {
                "bodyweight_kg": 83,
                "training_days": {"fri": True},
                "weekly_target_sessions": 3,
                "available_equipment": {"barbell": True},
            },
        )

        assert saved["profile"]["bodyweight_kg"] == 83
        assert saved["preferences"]["training_days"] == {"fri": True}
        assert saved["preferences"]["weekly_target_sessions"] == 3
        assert "bodyweight_kg" not in saved
        assert "training_days" not in saved

        loaded = storage.get_user_settings_for("u9")
        assert loaded["profile"]["bodyweight_kg"] == 83
        assert loaded["preferences"]["training_days"] == {"fri": True}
        assert loaded["preferences"]["weekly_target_sessions"] == 3
        assert loaded["available_equipment"] == {"barbell": True}
