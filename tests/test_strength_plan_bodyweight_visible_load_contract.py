import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "app/backend"))

import app


def test_bodyweight_substitute_hides_visible_load_progression_from_loaded_history(monkeypatch):
    programs = [
        {
            "id": "test_substitution_strength",
            "kind": "strength",
            "days": [
                {
                    "label": "Dag A",
                    "exercises": [
                        {"exercise_id": "squat", "sets": 3, "reps": "6-8"},
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
            "id": "split_squat",
            "equipment_type": "bodyweight",
            "supports_bodyweight": True,
            "input_kind": "bodyweight_reps",
            "default_unit": "reps",
            "start_weight": 0,
            "movement_pattern": "squat",
        },
    ]

    def fake_substitutes(*args, **kwargs):
        return {"candidate_ids": ["split_squat"]}

    def fake_progression(*args, **kwargs):
        return {
            "next_load": 60,
            "progression_decision": "increase",
            "progression_reason": "loaded history",
            "equipment_constraint": True,
            "recommended_next_load": 52.5,
            "actual_possible_next_load": 60.0,
            "next_target_reps": None,
            "secondary_constraints": ["equipment_constraint"],
        }

    monkeypatch.setattr(app, "get_local_substitute_candidates", fake_substitutes)
    monkeypatch.setattr(app, "compute_progression_for_exercise", fake_progression)

    result = app.build_strength_plan(
        programs=programs,
        exercises=exercises,
        latest_strength={},
        time_budget_min=30,
        fatigue_score=0,
        user_settings={"available_equipment": {}},
        user_id=None,
        selected_program_id="test_substitution_strength",
    )

    entries = result["plan_entries"]
    assert len(entries) == 1, result

    entry = entries[0]
    assert entry["exercise_id"] == "split_squat", entry
    assert entry["substituted_from"] == "squat", entry
    assert entry["target_load"] is None, entry
    assert entry["recommended_next_load"] is None, entry
    assert entry["actual_possible_next_load"] is None, entry
    assert entry["equipment_constraint"] is False, entry
    assert "equipment_constraint" not in entry["secondary_constraints"], entry


def test_visible_load_progression_hidden_for_bodyweight_like_metadata():
    assert app.should_hide_visible_load_progression({"equipment_type": "bodyweight"}) is True
    assert app.should_hide_visible_load_progression({"input_kind": "bodyweight_reps"}) is True
    assert app.should_hide_visible_load_progression({"input_kind": "time"}) is True
    assert app.should_hide_visible_load_progression({
        "supports_bodyweight": True,
        "load_optional": True,
    }) is True
    assert app.should_hide_visible_load_progression({
        "equipment_type": "barbell",
        "input_kind": "load_reps",
    }) is False
