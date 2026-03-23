import sys
from pathlib import Path
from unittest.mock import patch

sys.path.append(str(Path(__file__).resolve().parents[1] / "app" / "backend"))

import app as backend_app
from helpers import make_test_client, mock_auth, mock_today_plan_context, mock_fatigue_context


def test_today_plan_contract_shape():
    client = make_test_client()

    with mock_auth(), \
         mock_today_plan_context(), \
         mock_fatigue_context(), \
         patch.object(backend_app, "list_user_items", return_value=[{"id": "c1", "date": "2026-03-23"}]), \
         patch.object(backend_app, "list_workouts_for_user", return_value=[]), \
         patch.object(backend_app, "build_today_plan_timing_state", return_value="on_time"):

        response = client.get("/api/today-plan")

    assert response.status_code == 200, response.data
    payload = response.get_json()

    assert isinstance(payload, dict), payload
    assert payload.get("ok") is True, payload

    item = payload.get("item")
    assert isinstance(item, dict), item

    required_keys = [
        "date",
        "recommended_for",
        "session_type",
        "template_id",
        "plan_variant",
        "readiness_score",
        "time_budget_min",
        "entries",
        "reason",
    ]

    for key in required_keys:
        assert key in item, f"Missing key: {key}"

    assert isinstance(item["date"], str), item
    assert isinstance(item["recommended_for"], str), item
    assert isinstance(item["session_type"], str), item
    assert isinstance(item["template_id"], str), item
    assert isinstance(item["plan_variant"], str), item
    assert isinstance(item["readiness_score"], int), item
    assert isinstance(item["time_budget_min"], int), item
    assert isinstance(item["entries"], list), item
    assert isinstance(item["reason"], str), item

    assert item["session_type"] in ("styrke", "løb", "cardio", "restitution"), item
    assert item["template_id"].strip() != "", item
    assert item["reason"].strip() != "", item

    for entry in item["entries"]:
        assert isinstance(entry, dict), entry


if __name__ == "__main__":
    test_today_plan_contract_shape()
    print("Today-plan contract test passed")
