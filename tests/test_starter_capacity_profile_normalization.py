import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "app" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app as app_module


def _make_client(monkeypatch):
    monkeypatch.setattr(
        app_module,
        "require_auth_user",
        lambda: ({"user_id": "u1"}, None),
    )

    saved_items = []

    def fake_get_user_settings_for(user_id):
        return {
            "user_id": user_id,
            "profile": {},
            "preferences": {},
            "available_equipment": {},
            "equipment_increments": {},
            "local_protection_holds": {},
        }

    def fake_save_user_settings_for(user_id, item):
        saved = {
            **item,
            "user_id": user_id,
        }
        saved_items.append(saved)
        return saved

    monkeypatch.setattr(app_module, "get_user_settings_for", fake_get_user_settings_for)
    monkeypatch.setattr(app_module, "save_user_settings_for", fake_save_user_settings_for)

    return app_module.app.test_client(), saved_items


def test_starter_capacity_profile_defaults_when_missing(monkeypatch):
    client, saved_items = _make_client(monkeypatch)

    response = client.post(
        "/api/user-settings",
        json={
            "preferences": {},
        },
    )

    assert response.status_code == 200
    assert saved_items
    assert saved_items[-1]["preferences"]["starter_capacity_profile"] == "general_beginner"


def test_starter_capacity_profile_preserves_valid_value(monkeypatch):
    client, saved_items = _make_client(monkeypatch)

    response = client.post(
        "/api/user-settings",
        json={
            "preferences": {
                "starter_capacity_profile": "low_capacity",
            },
        },
    )

    assert response.status_code == 200
    assert saved_items
    assert saved_items[-1]["preferences"]["starter_capacity_profile"] == "low_capacity"


def test_starter_capacity_profile_falls_back_for_invalid_value(monkeypatch):
    client, saved_items = _make_client(monkeypatch)

    response = client.post(
        "/api/user-settings",
        json={
            "preferences": {
                "starter_capacity_profile": "banana_mode",
            },
        },
    )

    assert response.status_code == 200
    assert saved_items
    assert saved_items[-1]["preferences"]["starter_capacity_profile"] == "general_beginner"
