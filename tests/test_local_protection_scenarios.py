import sys
from pathlib import Path
from unittest.mock import patch

sys.path.append(str(Path(__file__).resolve().parents[1] / "app" / "backend"))

import app as backend_app


def test_knee_protection_downgrades_cardio_and_exposes_explanation():
    with patch.object(backend_app, "compute_cardio_load_metrics", return_value={
        "weekly_cardio_load": 10.0,
        "last_cardio_kind": "",
        "last_hard_cardio_days_ago": 7,
        "recent_base_count": 0,
        "load_status": "underloaded",
    }), patch.object(backend_app, "get_local_protect_regions", return_value=["knee"]):
        cardio_plan = backend_app.build_autoplan_cardio(
            user_id="u1",
            readiness=5,
            time_budget_min=30,
            recovery_state={"recovery_state": "ready", "load_status": "underloaded"},
            training_day_context={"is_training_day": True},
        )

    assert cardio_plan["cardio_kind"] == "restitution", cardio_plan
    assert cardio_plan["local_protection_override"] is True, cardio_plan
    assert cardio_plan["protected_regions"] == ["knee"], cardio_plan

    explanation = backend_app.build_local_protection_explanation(
        "u1",
        {
            "local_protection_override": cardio_plan["local_protection_override"],
            "protected_regions": cardio_plan["protected_regions"],
        },
        "løb",
    )
    assert explanation is not None, explanation
    assert "knee" in explanation, explanation


def test_low_back_protection_blocks_progression_to_clean_hold():
    original_build = backend_app.build_progression_context
    original_decide = backend_app.decide_progression_from_context

    def fake_build_progression_context(exercise_id, user_id=None):
        return {
            "local_protection_regions": ["low_back"],
        }

    def fake_decide_progression_from_context(exercise_id, ctx):
        return {
            "ok": True,
            "exercise": exercise_id,
            "last_load": 50,
            "next_load": 52.5,
            "progression_decision": "increase_load",
            "progression_reason": "gentagen succes i stabil trend",
            "recommended_next_load": 52.5,
            "actual_possible_next_load": 55.0,
            "next_target_reps": "8-10",
            "secondary_constraints": ["equipment_constraint"],
        }

    backend_app.build_progression_context = fake_build_progression_context
    backend_app.decide_progression_from_context = fake_decide_progression_from_context

    try:
        result = backend_app.compute_progression_for_exercise("romanian_deadlift", user_id="u1")
    finally:
        backend_app.build_progression_context = original_build
        backend_app.decide_progression_from_context = original_decide

    assert result["progression_decision"] == "hold", result
    assert result["next_load"] == 50, result
    assert result["recommended_next_load"] is None, result
    assert result["actual_possible_next_load"] is None, result
    assert result["next_target_reps"] is None, result
    assert result["local_protection_blocked_progression"] is True, result
    assert result["local_protection_regions"] == ["low_back"], result
    assert "local_protection_block" in result["secondary_constraints"], result


def test_shoulder_protection_can_escalate_to_restitution_when_content_cannot_be_preserved():
    programs = [{
        "id": "starter_strength_gym_2x",
        "days": [{
            "label": "Day A",
            "exercises": [
                {"exercise_id": "overhead_press", "sets": "3", "reps": "5"},
            ],
        }],
    }]

    exercises = backend_app.read_json_file(backend_app.FILES["exercises"])

    fake_state = {
        "local_state": {
            "shoulder": {
                "state": "protect",
                "reasons": ["latest local signal is irritated"],
            }
        }
    }

    with patch.object(backend_app, "get_live_adaptation_state_for", return_value=fake_state):
        out = backend_app.build_strength_plan(
            programs=programs,
            exercises=exercises,
            latest_strength=None,
            time_budget_min=30,
            fatigue_score=0,
            user_settings={"available_equipment": {"barbell": True, "bodyweight": True}},
            user_id="u1",
            selected_program_id="starter_strength_gym_2x",
        )

    assert out["plan_entries"] == [], out
    assert out["plan_variant"] == "local_protection_restitution", out
    assert "shoulder" in out["reason"], out


def test_planning_and_progression_resume_when_local_protection_clears():
    original_build = backend_app.build_progression_context
    original_decide = backend_app.decide_progression_from_context

    def fake_build_progression_context(exercise_id, user_id=None):
        return {
            "local_protection_regions": [],
        }

    def fake_decide_progression_from_context(exercise_id, ctx):
        return {
            "ok": True,
            "exercise": exercise_id,
            "last_load": 50,
            "next_load": 52.5,
            "progression_decision": "increase_load",
            "progression_reason": "gentagen succes i stabil trend",
            "recommended_next_load": 52.5,
            "actual_possible_next_load": 55.0,
            "next_target_reps": "8-10",
            "secondary_constraints": ["equipment_constraint"],
        }

    backend_app.build_progression_context = fake_build_progression_context
    backend_app.decide_progression_from_context = fake_decide_progression_from_context

    try:
        result = backend_app.compute_progression_for_exercise("squat", user_id="u1")
    finally:
        backend_app.build_progression_context = original_build
        backend_app.decide_progression_from_context = original_decide

    assert result["progression_decision"] == "increase_load", result
    assert result["next_load"] == 52.5, result
    assert result["recommended_next_load"] == 52.5, result
    assert result["actual_possible_next_load"] == 55.0, result
    assert result["local_protection_blocked_progression"] is False, result
    assert result["local_protection_regions"] == [], result
    assert "local_protection_block" not in result["secondary_constraints"], result


if __name__ == "__main__":
    test_knee_protection_downgrades_cardio_and_exposes_explanation()
    test_low_back_protection_blocks_progression_to_clean_hold()
    test_shoulder_protection_can_escalate_to_restitution_when_content_cannot_be_preserved()
    test_planning_and_progression_resume_when_local_protection_clears()
    print("All local protection scenario tests passed")
