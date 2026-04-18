import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "app" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import get_training_goal


def test_get_training_goal_returns_valid_explicit_goal():
    settings = {"preferences": {"training_goal": "fat_loss"}}
    assert get_training_goal(settings) == "fat_loss"


def test_get_training_goal_falls_back_for_invalid_value():
    settings = {"preferences": {"training_goal": "banana_mode"}}
    assert get_training_goal(settings) == "general_health"


def test_get_training_goal_defaults_when_missing():
    settings = {"preferences": {}}
    assert get_training_goal(settings) == "general_health"
