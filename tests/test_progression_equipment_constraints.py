import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "app" / "backend"))

import app as backend_app


def test_analyze_session_result_detects_load_drop():
    result = {
        "exercise_id": "bench_press",
        "hit_failure": False,
        "sets": [
            {"reps": "8", "load": "100kg"},
            {"reps": "7", "load": "90kg"},
        ],
    }

    analysis = backend_app.analyze_session_result_for_progression(result)

    assert analysis["source"] == "session_result", analysis
    assert analysis["has_sets"] is True, analysis
    assert analysis["first_set_load"] == 100.0, analysis
    assert analysis["first_set_reps"] == 8, analysis
    assert analysis["min_reps"] == 7, analysis
    assert analysis["load_drop_detected"] is True, analysis


def test_decide_progression_increase_without_equipment_constraint():
    latest_result = {
        "target_reps": "6-8",
    }

    ctx = {
        "step": 2,
        "start_weight": 40,
        "latest_result": latest_result,
        "analysis": {
            "source": "session_result",
            "has_sets": True,
            "first_set_load": 100.0,
            "first_set_reps": 8,
            "min_reps": 8,
            "hit_failure": False,
            "load_drop_detected": False,
        },
        "fatigue_score": 0,
        "last_load": 100,
        "last_entry": {"reps": "6-8", "achieved_reps": "8"},
        "recommended_step": 2,
        "effective_load_increment": 2,
        "exercise": {
            "progression_mode": "double_progression",
            "progression_style": "",
        },
    }

    out = backend_app.decide_progression_from_context("bench_press", ctx)

    assert out["progression_decision"] == "increase", out
    assert out["equipment_constraint"] is False, out
    assert out["recommended_next_load"] == 102.0, out
    assert out["actual_possible_next_load"] == 102.0, out
    assert out["next_load"] == 102, out


def test_decide_progression_holds_when_equipment_increment_is_too_large():
    latest_result = {
        "target_reps": "6-8",
    }

    ctx = {
        "step": 2,
        "start_weight": 40,
        "latest_result": latest_result,
        "analysis": {
            "source": "session_result",
            "has_sets": True,
            "first_set_load": 100.0,
            "first_set_reps": 8,
            "min_reps": 8,
            "hit_failure": False,
            "load_drop_detected": False,
        },
        "fatigue_score": 0,
        "last_load": 100,
        "last_entry": {"reps": "6-8", "achieved_reps": "8"},
        "recommended_step": 2,
        "effective_load_increment": 5,
        "exercise": {
            "progression_mode": "double_progression",
            "progression_style": "",
        },
    }

    out = backend_app.decide_progression_from_context("bench_press", ctx)

    assert out["progression_decision"] == "hold", out
    assert out["equipment_constraint"] is True, out
    assert out["recommended_next_load"] == 102.0, out
    assert out["actual_possible_next_load"] == 105.0, out
    assert out["next_load"] == 100, out
    assert "equipment_constraint" in out["secondary_constraints"], out


if __name__ == "__main__":
    test_analyze_session_result_detects_load_drop()
    test_decide_progression_increase_without_equipment_constraint()
    test_decide_progression_holds_when_equipment_increment_is_too_large()
    print("All progression/equipment constraint tests passed")
