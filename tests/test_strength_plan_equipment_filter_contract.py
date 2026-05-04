import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "app/backend"))

import app


def test_strength_plan_does_not_allow_loaded_exercises_when_equipment_is_missing():
    programs = [
        {
            "id": "test_minimal_home_strength",
            "kind": "strength",
            "days": [
                {
                    "label": "Dag A",
                    "exercises": [
                        {"exercise_id": "squat", "sets": 3, "reps": "6-8"},
                        {"exercise_id": "incline_push_ups", "sets": 3, "reps": "6-10"},
                        {"exercise_id": "dumbbell_row", "sets": 3, "reps": "8-12"},
                    ],
                }
            ],
        }
    ]

    exercises = [
        {
            "id": "squat",
            "equipment_type": "barbell",
            "supports_bodyweight": False,
            "input_kind": "load_reps",
            "default_unit": "kg",
            "start_weight": 50,
            "movement_pattern": "squat",
        },
        {
            "id": "incline_push_ups",
            "equipment_type": "bodyweight",
            "supports_bodyweight": True,
            "input_kind": "bodyweight_reps",
            "default_unit": "reps",
            "start_weight": 0,
            "movement_pattern": "push",
        },
        {
            "id": "dumbbell_row",
            "equipment_type": "dumbbell",
            "supports_bodyweight": False,
            "input_kind": "load_reps",
            "default_unit": "kg",
            "start_weight": 10,
            "movement_pattern": "pull",
        },
    ]

    user_settings = {
        "available_equipment": {},
        "preferences": {
            "training_types": {
                "bodyweight": True,
                "strength_weights": False,
                "running": False,
                "mobility": False,
            }
        },
    }

    result = app.build_strength_plan(
        programs=programs,
        exercises=exercises,
        latest_strength={},
        time_budget_min=30,
        fatigue_score=0,
        user_settings=user_settings,
        user_id=None,
        selected_program_id="test_minimal_home_strength",
    )

    entries = result["plan_entries"]
    assert [entry["exercise_id"] for entry in entries] == ["incline_push_ups"], result

    bodyweight_entry = entries[0]
    assert bodyweight_entry["target_load"] is None, bodyweight_entry
    assert bodyweight_entry["recommended_next_load"] is None, bodyweight_entry
    assert bodyweight_entry["actual_possible_next_load"] is None, bodyweight_entry
    assert bodyweight_entry["equipment_constraint"] is False, bodyweight_entry

    excluded_types = {
        item["equipment_type"]
        for item in result["excluded_due_to_equipment"]
    }
    assert excluded_types == {"barbell", "dumbbell"}, result


def test_bodyweight_equipment_is_allowed_even_without_equipment_map():
    assert app.is_plan_equipment_available("bodyweight", {}) is True
    assert app.is_plan_equipment_available("", {}) is True
    assert app.is_plan_equipment_available("barbell", {}) is False
    assert app.is_plan_equipment_available("dumbbell", {"dumbbell": True}) is True
