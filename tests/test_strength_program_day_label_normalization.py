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


def test_strength_plan_accepts_day_labels_from_seed_programs():
    programs = [load_seed_program("starter_strength_2x")]
    exercises = load_seed_exercises()

    user_settings = {
        "available_equipment": {
            "bodyweight": True,
            "dumbbell": True,
            "barbell": True,
            "bench": True,
            "pullup_bar": True,
            "machine": True,
            "cable": True,
            "kettlebell": True,
            "band": True,
        }
    }

    latest_strength = {
        "user_id": "1",
        "program_day_label": "Day B",
        "readiness_score": 5,
    }

    with patch.object(backend_app, "get_live_adaptation_state_for", return_value={"local_state": {}}):
        result = backend_app.build_strength_plan(
            programs=programs,
            exercises=exercises,
            latest_strength=latest_strength,
            time_budget_min=45,
            fatigue_score=0,
            user_settings=user_settings,
            user_id="1",
        )

    assert isinstance(result, dict), result
    assert result.get("reason") != "missing_program_day", result
    assert result.get("template_id") == "strength_day_a", result
    assert isinstance(result.get("plan_entries"), list), result
    assert len(result.get("plan_entries")) > 0, result


if __name__ == "__main__":
    test_strength_plan_accepts_day_labels_from_seed_programs()
    print("Strength program day-label normalization test passed")
