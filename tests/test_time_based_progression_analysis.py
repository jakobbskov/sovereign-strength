import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_PATH = ROOT / "app" / "backend"
ENGINE_PATH = BACKEND_PATH / "progression_engine.py"


def load_engine():
    sys.path.insert(0, str(BACKEND_PATH))
    spec = importlib.util.spec_from_file_location("progression_engine", ENGINE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_parse_seconds_value_requires_time_suffix():
    engine = load_engine()

    assert engine.parse_seconds_value("20 sec") == 20
    assert engine.parse_seconds_value("20s") == 20
    assert engine.parse_seconds_value("20 sek") == 20
    assert engine.parse_seconds_value("20 seconds") == 20
    assert engine.parse_seconds_value("20") is None


def test_time_based_sets_are_summed_for_progression_analysis():
    engine = load_engine()

    result = {
        "exercise_id": "plank",
        "sets": [
            {"reps": "20 sec", "load": ""},
            {"reps": "25s", "load": ""},
            {"reps": "30 sek", "load": ""},
        ],
        "hit_failure": False,
    }

    analysis = engine.analyze_session_result_for_progression(result)

    assert analysis["source"] == "session_result"
    assert analysis["has_sets"] is True
    assert analysis["first_set_reps"] == 20
    assert analysis["min_reps"] == 20
    assert analysis["total_time_under_tension_sec"] == 75


def test_plain_rep_sets_do_not_count_as_time_under_tension():
    engine = load_engine()

    result = {
        "exercise_id": "squat",
        "sets": [
            {"reps": "8", "load": "50 kg"},
            {"reps": "7", "load": "50 kg"},
        ],
        "hit_failure": False,
    }

    analysis = engine.analyze_session_result_for_progression(result)

    assert analysis["first_set_reps"] == 8
    assert analysis["min_reps"] == 7
    assert analysis["total_time_under_tension_sec"] == 0
