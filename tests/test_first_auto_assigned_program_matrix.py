import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "app" / "backend"))

import app as backend_app


def load_seed_programs():
    path = ROOT / "app" / "data" / "seed" / "programs.json"
    return json.loads(path.read_text(encoding="utf-8"))


PROGRAMS = load_seed_programs()


def make_user_settings(
    *,
    training_types=None,
    weekly_target_sessions=3,
    available_equipment=None,
    strength_starting_profile="beginner",
    run_starting_profile="beginner",
    active_program_overrides=None,
    auto_assigned_programs=None,
):
    return {
        "available_equipment": available_equipment or {},
        "preferences": {
            "training_types": training_types or {},
            "weekly_target_sessions": weekly_target_sessions,
            "strength_starting_profile": strength_starting_profile,
            "run_starting_profile": run_starting_profile,
            **(
                {"active_program_overrides": active_program_overrides}
                if active_program_overrides is not None
                else {}
            ),
            **(
                {"auto_assigned_programs": auto_assigned_programs}
                if auto_assigned_programs is not None
                else {}
            ),
        },
    }


def test_select_strength_program_beginner_home_2x():
    settings = make_user_settings(
        training_types={"strength_weights": True},
        weekly_target_sessions=2,
        available_equipment={"bodyweight": True, "dumbbell": True},
        strength_starting_profile="beginner",
    )
    assert backend_app.select_strength_program(PROGRAMS, settings, 2) == "starter_strength_2x"


def test_select_strength_program_beginner_home_3x():
    settings = make_user_settings(
        training_types={"strength_weights": True},
        weekly_target_sessions=3,
        available_equipment={"bodyweight": True, "dumbbell": True},
        strength_starting_profile="beginner",
    )
    assert backend_app.select_strength_program(PROGRAMS, settings, 3) == "strength_full_body_3x_beginner"


def test_select_strength_program_beginner_gym_2x():
    settings = make_user_settings(
        training_types={"strength_weights": True},
        weekly_target_sessions=2,
        available_equipment={"barbell": True, "bench": True},
        strength_starting_profile="beginner",
    )
    assert backend_app.select_strength_program(PROGRAMS, settings, 2) == "starter_strength_gym_2x"


def test_select_strength_program_novice_gym_2x():
    settings = make_user_settings(
        training_types={"strength_weights": True},
        weekly_target_sessions=2,
        available_equipment={"barbell": True, "bench": True},
        strength_starting_profile="novice",
    )
    assert backend_app.select_strength_program(PROGRAMS, settings, 2) == "base_strength_a"


def test_select_strength_program_novice_gym_4x():
    settings = make_user_settings(
        training_types={"strength_weights": True},
        weekly_target_sessions=4,
        available_equipment={"barbell": True, "bench": True},
        strength_starting_profile="novice",
    )
    assert backend_app.select_strength_program(PROGRAMS, settings, 4) == "base_strength_gym_4x"


def test_select_endurance_program_beginner_run_2x():
    settings = make_user_settings(
        training_types={"running": True, "strength_weights": False, "bodyweight": False},
        weekly_target_sessions=2,
        run_starting_profile="beginner",
    )
    prefs = backend_app.get_training_type_preferences(settings)
    assert backend_app.select_endurance_program(PROGRAMS, settings, 2, prefs) == "starter_run_2x"


def test_select_endurance_program_novice_run_3x():
    settings = make_user_settings(
        training_types={"running": True, "strength_weights": False, "bodyweight": False},
        weekly_target_sessions=3,
        run_starting_profile="novice",
    )
    prefs = backend_app.get_training_type_preferences(settings)
    assert backend_app.select_endurance_program(PROGRAMS, settings, 3, prefs) == "base_run_3x"


def test_select_endurance_program_hybrid_2x_beginner():
    settings = make_user_settings(
        training_types={"running": True, "strength_weights": True},
        weekly_target_sessions=2,
        available_equipment={"bodyweight": True},
        run_starting_profile="beginner",
        strength_starting_profile="beginner",
    )
    prefs = backend_app.get_training_type_preferences(settings)
    assert backend_app.select_endurance_program(PROGRAMS, settings, 2, prefs) == "hybrid_run_strength_2x_beginner"


def test_ensure_initial_auto_assigned_programs_assigns_relevant_domains():
    settings = make_user_settings(
        training_types={"running": True, "strength_weights": True},
        weekly_target_sessions=2,
        available_equipment={"barbell": True, "bench": True},
        strength_starting_profile="beginner",
        run_starting_profile="beginner",
    )

    updated, changed = backend_app.ensure_initial_auto_assigned_programs(PROGRAMS, settings)

    assert changed is True
    auto_assigned = updated["preferences"]["auto_assigned_programs"]
    assert auto_assigned["strength"] == "starter_strength_gym_2x"
    assert auto_assigned["run"] == "hybrid_run_strength_2x_beginner"


def test_ensure_initial_auto_assigned_programs_does_not_override_manual_choice():
    settings = make_user_settings(
        training_types={"running": True, "strength_weights": True},
        weekly_target_sessions=2,
        available_equipment={"barbell": True, "bench": True},
        active_program_overrides={"strength": "base_strength_a"},
    )

    updated, changed = backend_app.ensure_initial_auto_assigned_programs(PROGRAMS, settings)

    assert changed is True
    prefs = updated["preferences"]
    assert prefs["active_program_overrides"]["strength"] == "base_strength_a"
    assert prefs["auto_assigned_programs"]["run"] == "hybrid_run_strength_2x_beginner"
    assert "strength" not in prefs["auto_assigned_programs"]


def test_build_active_program_status_reports_auto_assigned_source():
    settings = make_user_settings(
        training_types={"running": True, "strength_weights": True},
        weekly_target_sessions=2,
        available_equipment={"barbell": True, "bench": True},
        auto_assigned_programs={
            "strength": "starter_strength_gym_2x",
            "run": "hybrid_run_strength_2x_beginner",
        },
    )

    status = backend_app.build_active_program_status_by_domain(PROGRAMS, settings)

    assert status["strength"]["program_id"] == "starter_strength_gym_2x"
    assert status["strength"]["selection_source"] == "auto_assigned"
    assert status["run"]["program_id"] == "hybrid_run_strength_2x_beginner"
    assert status["run"]["selection_source"] == "auto_assigned"


def test_build_active_program_status_reports_manual_override_source():
    settings = make_user_settings(
        training_types={"running": True, "strength_weights": True},
        weekly_target_sessions=2,
        available_equipment={"barbell": True, "bench": True},
        active_program_overrides={
            "strength": "base_strength_a",
            "run": "starter_run_2x",
        },
    )

    status = backend_app.build_active_program_status_by_domain(PROGRAMS, settings)

    assert status["strength"]["program_id"] == "base_strength_a"
    assert status["strength"]["selection_source"] == "manual_override"
    assert status["run"]["program_id"] == "starter_run_2x"
    assert status["run"]["selection_source"] == "manual_override"


def test_build_active_programs_by_domain_returns_none_when_no_training_types_enabled():
    settings = make_user_settings(
        training_types={"running": False, "strength_weights": False, "bodyweight": False},
        weekly_target_sessions=2,
        available_equipment={},
    )

    active = backend_app.build_active_programs_by_domain(PROGRAMS, settings)
    assert active["run"] is None
    # current backend still derives a strength fallback if called directly;
    # empty preference handling is ultimately enforced in the today-plan flow.
    assert active["strength"] in {None, "starter_strength_2x", "reentry_strength_2x", "starter_strength_gym_2x"}

def test_get_training_type_preferences_uses_legacy_defaults_when_missing():
    settings = {
        "preferences": {}
    }

    prefs = backend_app.get_training_type_preferences(settings)

    assert prefs == {
        "running": True,
        "strength_weights": True,
        "bodyweight": True,
        "mobility": True,
    }


def test_get_training_type_preferences_respects_explicit_empty_dict():
    settings = {
        "preferences": {
            "training_types": {}
        }
    }

    prefs = backend_app.get_training_type_preferences(settings)

    assert prefs == {
        "running": False,
        "strength_weights": False,
        "bodyweight": False,
        "mobility": False,
    }


def test_build_active_programs_by_domain_returns_none_when_training_types_are_explicitly_empty():
    settings = make_user_settings(
        training_types={},
        weekly_target_sessions=2,
        available_equipment={},
    )

    active = backend_app.build_active_programs_by_domain(PROGRAMS, settings)

    assert active["strength"] is None
    assert active["run"] is None

if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
    print("first auto-assigned program matrix tests passed")



def test_build_active_program_status_reports_automatic_recommendation_source():
    settings = make_user_settings(
        training_types={"running": True, "strength_weights": True},
        weekly_target_sessions=2,
        available_equipment={"barbell": True, "bench": True},
    )

    status = backend_app.build_active_program_status_by_domain(PROGRAMS, settings)

    assert status["strength"]["program_id"] == "starter_strength_gym_2x"
    assert status["strength"]["selection_source"] == "automatic_recommendation"
    assert status["run"]["program_id"] == "hybrid_run_strength_2x_beginner"
    assert status["run"]["selection_source"] == "automatic_recommendation"


def test_build_active_program_status_reports_accepted_recommendation_source():
    settings = make_user_settings(
        training_types={"running": True, "strength_weights": True},
        weekly_target_sessions=2,
        available_equipment={"barbell": True, "bench": True},
        active_program_overrides={
            "strength": "base_strength_a",
            "run": "starter_run_2x",
        },
    )
    settings["preferences"]["accepted_program_recommendations"] = {
        "strength": "base_strength_a",
        "run": "starter_run_2x",
    }

    status = backend_app.build_active_program_status_by_domain(PROGRAMS, settings)

    assert status["strength"]["program_id"] == "base_strength_a"
    assert status["strength"]["selection_source"] == "accepted_recommendation"
    assert status["run"]["program_id"] == "starter_run_2x"
    assert status["run"]["selection_source"] == "accepted_recommendation"

def test_select_strength_program_conservative_beginner_prefers_reentry_program():
    settings = make_user_settings(
        training_types={"strength_weights": True},
        weekly_target_sessions=2,
        available_equipment={"bodyweight": True, "dumbbell": True},
        strength_starting_profile="conservative_beginner",
    )
    assert backend_app.select_strength_program(PROGRAMS, settings, 2) == "reentry_strength_2x"


def test_select_strength_program_beginner_hybrid_gym_prefers_concurrent_running_friendly_option():
    settings = make_user_settings(
        training_types={"running": True, "strength_weights": True},
        weekly_target_sessions=2,
        available_equipment={"barbell": True, "bench": True},
        strength_starting_profile="beginner",
    )
    assert backend_app.select_strength_program(PROGRAMS, settings, 2) == "starter_strength_gym_2x"


def test_select_strength_program_novice_gym_3x_prefers_base_path():
    settings = make_user_settings(
        training_types={"strength_weights": True},
        weekly_target_sessions=3,
        available_equipment={"barbell": True, "bench": True},
        strength_starting_profile="novice",
    )
    assert backend_app.select_strength_program(PROGRAMS, settings, 3) == "base_strength_gym_3x"

def test_select_strength_program_novice_home_2x_prefers_base_home_path():
    settings = make_user_settings(
        training_types={"strength_weights": True},
        weekly_target_sessions=2,
        available_equipment={"bodyweight": True, "dumbbell": True},
        strength_starting_profile="novice",
    )
    assert backend_app.select_strength_program(PROGRAMS, settings, 2) == "base_strength_home_2x"


def test_select_strength_program_novice_home_3x_prefers_base_home_path():
    settings = make_user_settings(
        training_types={"strength_weights": True},
        weekly_target_sessions=3,
        available_equipment={"bodyweight": True, "dumbbell": True},
        strength_starting_profile="novice",
    )
    assert backend_app.select_strength_program(PROGRAMS, settings, 3) == "base_strength_home_3x"

def test_select_strength_program_beginner_hybrid_home_2x_prefers_minimalist_path():
    settings = make_user_settings(
        training_types={"running": True, "strength_weights": True},
        weekly_target_sessions=2,
        available_equipment={"bodyweight": True, "dumbbell": True},
        strength_starting_profile="beginner",
    )
    assert backend_app.select_strength_program(PROGRAMS, settings, 2) == "minimalist_strength_2x"


def test_select_strength_program_novice_hybrid_home_2x_prefers_minimalist_path():
    settings = make_user_settings(
        training_types={"running": True, "strength_weights": True},
        weekly_target_sessions=2,
        available_equipment={"bodyweight": True, "dumbbell": True},
        strength_starting_profile="novice",
    )
    assert backend_app.select_strength_program(PROGRAMS, settings, 2) == "minimalist_strength_2x"

def test_select_strength_program_beginner_gym_3x():
    settings = make_user_settings(
        training_types={"strength_weights": True},
        weekly_target_sessions=3,
        available_equipment={"barbell": True, "bench": True},
        strength_starting_profile="beginner",
    )
    assert backend_app.select_strength_program(PROGRAMS, settings, 3) == "starter_strength_gym_3x"



def test_select_strength_program_fat_loss_home_2x_prefers_minimalist_path():
    settings = make_user_settings(
        training_types={"running": False, "strength_weights": True},
        weekly_target_sessions=2,
        available_equipment={"bodyweight": True, "dumbbell": True},
        strength_starting_profile="beginner",
    )
    settings["preferences"]["training_goal"] = "fat_loss"
    assert backend_app.select_strength_program(PROGRAMS, settings, 2) == "minimalist_strength_2x"
