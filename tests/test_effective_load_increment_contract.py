import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "app/backend"))

from progression_engine import get_effective_load_increment


def test_equipment_increment_overrides_exercise_default_increment():
    exercise = {
        "id": "squat",
        "equipment_type": "barbell",
        "load_increment": 10,
        "progression_step": 10,
    }
    user_settings = {
        "equipment_increments": {
            "barbell": 2.5,
        }
    }

    assert get_effective_load_increment(exercise, user_settings) == 2.5


def test_exercise_default_increment_is_used_when_user_equipment_increment_is_missing():
    exercise = {
        "id": "squat",
        "equipment_type": "barbell",
        "load_increment": 10,
        "progression_step": 10,
    }
    user_settings = {
        "equipment_increments": {},
    }

    assert get_effective_load_increment(exercise, user_settings) == 10.0


def test_progression_step_is_used_when_no_equipment_or_exercise_increment_exists():
    exercise = {
        "id": "custom_bodyweight",
        "progression_step": 3,
    }
    user_settings = {
        "equipment_increments": {},
    }

    assert get_effective_load_increment(exercise, user_settings) == 3.0
