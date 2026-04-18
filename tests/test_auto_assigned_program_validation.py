import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "app" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import (
    ensure_initial_auto_assigned_programs,
    is_valid_program_id_for_domain,
    sanitize_auto_assigned_program_ids,
)


def make_programs():
    return [
        {"id": "starter_strength_2x", "kind": "strength", "supported_weekly_sessions": [2], "equipment_profiles": ["minimal_home", "dumbbell_home"]},
        {"id": "strength_full_body_3x_beginner", "kind": "strength", "supported_weekly_sessions": [3], "equipment_profiles": ["minimal_home", "dumbbell_home"]},
        {"id": "starter_run_2x", "kind": "run", "supported_weekly_sessions": [2], "equipment_profiles": ["minimal_home", "dumbbell_home", "gym_basic", "full_gym"]},
        {"id": "starter_run_3x_beginner", "kind": "run", "supported_weekly_sessions": [3], "equipment_profiles": ["minimal_home", "dumbbell_home", "gym_basic", "full_gym"]},
    ]


def make_settings(*, weekly_target_sessions=2, running=True, strength_weights=True, bodyweight=True, auto_assigned=None, overrides=None):
    return {
        "available_equipment": {"dumbbell": True},
        "preferences": {
            "weekly_target_sessions": weekly_target_sessions,
            "training_types": {
                "running": running,
                "strength_weights": strength_weights,
                "bodyweight": bodyweight,
                "mobility": False,
            },
            "auto_assigned_programs": auto_assigned if isinstance(auto_assigned, dict) else {},
            "active_program_overrides": overrides if isinstance(overrides, dict) else {},
        },
    }


def test_is_valid_program_id_for_domain_accepts_matching_program_kind():
    programs = make_programs()
    assert is_valid_program_id_for_domain(programs, "starter_strength_2x", "strength") is True
    assert is_valid_program_id_for_domain(programs, "starter_run_2x", "run") is True


def test_is_valid_program_id_for_domain_rejects_missing_or_wrong_domain():
    programs = make_programs()
    assert is_valid_program_id_for_domain(programs, "missing_program", "strength") is False
    assert is_valid_program_id_for_domain(programs, "starter_run_2x", "strength") is False
    assert is_valid_program_id_for_domain(programs, "starter_strength_2x", "run") is False


def test_sanitize_auto_assigned_program_ids_keeps_only_valid_entries():
    programs = make_programs()
    cleaned = sanitize_auto_assigned_program_ids(
        programs,
        {
            "strength": "starter_strength_2x",
            "run": "missing_run_program",
        },
    )
    assert cleaned == {"strength": "starter_strength_2x"}


def test_ensure_initial_auto_assigned_programs_persists_valid_selected_ids():
    programs = make_programs()
    settings = make_settings(
        weekly_target_sessions=2,
        auto_assigned={},
    )

    next_settings, changed = ensure_initial_auto_assigned_programs(programs, settings)

    assert changed is True
    auto_assigned = next_settings["preferences"]["auto_assigned_programs"]
    assert auto_assigned["strength"] == "starter_strength_2x"
    assert auto_assigned["run"] == "starter_run_2x"


def test_ensure_initial_auto_assigned_programs_removes_invalid_existing_auto_assigned_ids():
    programs = make_programs()
    settings = make_settings(
        weekly_target_sessions=2,
        auto_assigned={
            "strength": "missing_strength_program",
            "run": "starter_run_2x",
        },
    )

    next_settings, changed = ensure_initial_auto_assigned_programs(programs, settings)

    assert changed is True
    auto_assigned = next_settings["preferences"]["auto_assigned_programs"]
    assert auto_assigned["strength"] == "starter_strength_2x"
    assert auto_assigned["run"] == "starter_run_2x"


def test_ensure_initial_auto_assigned_programs_does_not_persist_invalid_new_selection():
    programs = [
        {"id": "starter_strength_2x", "kind": "strength", "supported_weekly_sessions": [2], "equipment_profiles": ["minimal_home", "dumbbell_home"]},
    ]
    settings = make_settings(
        weekly_target_sessions=2,
        running=True,
        strength_weights=True,
        bodyweight=True,
        auto_assigned={},
    )

    next_settings, changed = ensure_initial_auto_assigned_programs(programs, settings)

    assert changed is True
    auto_assigned = next_settings["preferences"]["auto_assigned_programs"]
    assert auto_assigned["strength"] == "starter_strength_2x"
    assert "run" not in auto_assigned
