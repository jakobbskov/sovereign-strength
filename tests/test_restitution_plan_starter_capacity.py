import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "app" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app as backend_app


def test_build_restitution_plan_very_low_capacity_uses_more_accessible_entry():
    entries = backend_app.build_restitution_plan(20, starter_capacity_profile="very_low_capacity")

    assert len(entries) == 3
    assert entries[0]["exercise_id"] == "bird_dog"
    assert entries[0]["target_reps"] == "15 sec"
    assert entries[1]["exercise_id"] == "dead_bug"
    assert entries[1]["target_reps"] == "6/side"
    assert entries[2]["exercise_id"] == "glute_bridge"
    assert entries[2]["target_reps"] == "8"


def test_build_restitution_plan_low_capacity_keeps_conservative_recovery_path():
    entries = backend_app.build_restitution_plan(20, starter_capacity_profile="low_capacity")

    assert len(entries) == 3
    assert entries[0]["exercise_id"] == "bird_dog"
    assert entries[0]["target_reps"] == "20 sec"
    assert entries[1]["exercise_id"] == "dead_bug"
    assert entries[1]["target_reps"] == "6/side"
    assert entries[2]["exercise_id"] == "glute_bridge"
    assert entries[2]["target_reps"] == "10"


def test_build_restitution_plan_general_beginner_keeps_standard_path():
    entries = backend_app.build_restitution_plan(20, starter_capacity_profile="general_beginner")

    assert len(entries) == 3
    assert entries[0]["exercise_id"] == "bird_dog"
    assert entries[0]["target_reps"] == "20 sec"
    assert entries[1]["exercise_id"] == "dead_bug"
    assert entries[1]["target_reps"] == "8/side"
    assert entries[2]["exercise_id"] == "plank"
    assert entries[2]["target_reps"] == "20 sec"
