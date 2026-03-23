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
    item = payload.get("item")

    required_keys = [
        "date",
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

    assert isinstance(item["entries"], list)
    assert isinstance(item["session_type"], str)
    assert isinstance(item["template_id"], str)
    assert isinstance(item["plan_variant"], str)


if __name__ == "__main__":
    test_today_plan_contract_shape()
    print("Today-plan contract test passed")
