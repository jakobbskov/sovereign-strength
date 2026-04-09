import json
import sys
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "app" / "backend"))

import app as backend_app


def load_seed_program(program_id):
    path = ROOT / "app" / "data" / "seed" / "programs.json"
    programs = json.loads(path.read_text(encoding="utf-8"))
    for program in programs:
        if program.get("id") == program_id:
            return program
    raise AssertionError(f"Program not found: {program_id}")


def load_seed_exercises():
    path = ROOT / "app" / "data" / "seed" / "exercises.json"
    return json.loads(path.read_text(encoding="utf-8"))


def test_strength_plan_investigation_hip_protect_case():
    programs = [load_seed_program("starter_strength_2x")]
    exercises = load_seed_exercises()

    user_settings = {
        "available_equipment": {
            "bodyweight": True,
            "dumbbell": False,
            "barbell": False,
            "bench": False,
            "pullup_bar": False,
            "machine": False,
            "cable": False,
            "kettlebell": False,
            "band": False,
        }
    }

    latest_strength = {
        "user_id": "1",
        "program_day_label": "Dag B",
        "readiness_score": 5,
    }

    fake_state = {
        "local_state": {
            "hip": {"state": "protect"},
            "knee": {"state": "caution"},
            "ankle_calf": {"state": "caution"},
        }
    }

    with patch.object(backend_app, "get_live_adaptation_state_for", return_value=fake_state):
        result = backend_app.build_strength_plan(
            programs=programs,
            exercises=exercises,
            latest_strength=latest_strength,
            time_budget_min=30,
            fatigue_score=2,
            user_settings=user_settings,
            user_id="1",
        )

    assert isinstance(result, dict), result

    print("template_id:", result.get("template_id"))
    print("plan_variant:", result.get("plan_variant"))
    print("reason:", result.get("reason"))
    print("plan_entries_count:", len(result.get("plan_entries", []) or []))
    print("excluded_due_to_equipment:", result.get("excluded_due_to_equipment"))
    print("substitutions_used:", result.get("substitutions_used"))

    assert "plan_entries" in result, result
    assert "reason" in result, result


if __name__ == "__main__":
    test_strength_plan_investigation_hip_protect_case()
    print("Strength plan investigation test passed")
