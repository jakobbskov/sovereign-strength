"""Issue #810: performed work determines the next achievable prescription."""
import sys
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app/backend"))
import app
import progression_engine as engine


@pytest.fixture(autouse=True)
def fixed_clock():
    with patch.object(engine, "datetime", wraps=datetime) as clock:
        clock.now.return_value = datetime(2026, 9, 12, tzinfo=timezone.utc)
        yield


def result(reps=(8, 8), loads=(52.5, 52.5), failure=False):
    return {
        "exercise_id": "bench_press", "target_reps": "6-8", "hit_failure": failure,
        "sets": [{"reps": str(r), "load": f"{load} kg"} for r, load in zip(reps, loads)],
    }


def context(results, increment=2.5, age=0, mode="double_progression", fatigue=0):
    sessions = [
        {"session_type": "strength", "date": (datetime(2026, 9, 12) - timedelta(
            days=age + (len(results) - 1 - i) * 3)).isoformat(), "results": [entry]}
        for i, entry in enumerate(results)
    ]
    exercise = {"id": "bench_press", "equipment_type": "barbell", "default_unit": "kg",
                "progression_step": 2.5, "load_increment": 5, "progression_mode": mode}
    settings = {"equipment_increments": {"barbell": increment}}
    return {
        "step": 2.5, "start_weight": 20, "latest_result": results[-1],
        "analysis": engine.analyze_session_result_for_progression(results[-1]),
        "session_results": sessions, "fatigue_score": fatigue, "last_load": 999,
        "last_entry": None, "exercise": exercise, "user_settings": settings,
        "recommended_step": 2.5,
        "effective_load_increment": engine.get_effective_load_increment(exercise, settings),
    }


def decide(results, **kwargs):
    return engine.decide_progression_from_context("bench_press", context(results, **kwargs))


@pytest.mark.parametrize("entry, decision, load", [
    (result(reps=(7, 6)), "hold", 52.5),
    (result(failure=True), "reduce", 50),
    (result(reps=(5, 5)), "reduce", 50),
    (result(reps=(8, 5)), "reduce", 50),
    (result(loads=(52.5, 47.5)), "reduce", 47.5),
    (result(loads=(52.5, 47.5), failure=True), "reduce", 47.5),
])
def test_single_session_response(entry, decision, load):
    out = decide([entry])
    assert out["progression_decision"] == decision
    assert out["next_load"] == load
    assert out["last_load"] == 52.5
    assert out["deload_recommended"] is False


@pytest.mark.parametrize("entry, expected", [
    (result(failure=True), 50),
    (result(loads=(52.5, 47.5)), 47.5),
    (result(loads=(52.5, 47.5), failure=True), 47.5),
])
def test_repeated_negative_sessions_actually_deload(entry, expected):
    out = decide([result(), entry, entry])
    assert out["deload_recommended"] is True
    assert out["progression_decision"] == "deload"
    assert out["next_load"] == expected < 52.5


def test_failure_and_drop_in_one_session_are_not_two_negative_sessions():
    ctx = context([result(), result(), result(loads=(52.5, 47.5), failure=True)], fatigue=2)
    trend = engine.summarize_strength_trend(engine.get_relevant_strength_history(ctx["session_results"], "bench_press"))
    assert trend["negative_signal_sessions"] == 1
    out = engine.decide_progression_from_context("bench_press", ctx)
    assert out["deload_recommended"] is False
    assert out["progression_decision"] == "reduce"


def test_below_range_is_not_success_in_current_or_historical_session():
    out = decide([result(), result(reps=(8, 5)), result()])
    assert out["trend_successful_sessions"] == 2
    assert out["progression_decision"] == "hold"
    assert out["next_load"] == 52.5


@pytest.mark.parametrize("increment, initial, expected", [(5, 52.5, 47.5), (1.25, 52.5, 51.25), (0.1, 10.3, 10.2), (0, 52.5, 52.5), (5, 2.5, 2.5), (2.5, 2.5, 2.5)])
def test_equipment_steps_decimals_and_positive_load_floor(increment, initial, expected):
    out = decide([result(loads=(initial, initial), failure=True)], increment=increment)
    assert out["next_load"] == expected
    assert out["progression_decision"] == ("reduce" if expected < initial else "hold")


def test_unchanged_history_never_compounds_reduction():
    ctx = context([result(failure=True)] * 3)
    original = deepcopy(ctx)
    for _ in range(4):
        out = engine.decide_progression_from_context("bench_press", ctx)
        assert out["next_load"] == 50
        ctx["last_load"] = out["next_load"]
    ctx["last_load"] = original["last_load"]
    assert ctx == original


def test_recalibration_and_successful_repeated_progression():
    out = decide([result()] * 3, age=22)
    assert out["progression_decision"] == "recalibrate"
    assert out["next_load"] == 52.5
    history = [result(), result()]
    for expected in (55, 57.5, 60):
        out = decide(history)
        assert out["progression_decision"] == "increase"
        assert out["next_load"] == expected
        history.append(result(loads=(expected, expected)))


def test_high_load_jump_guard_remains_active():
    ctx = context([result(loads=(100, 100))] * 3, increment=5)
    ctx["recommended_step"] = 5
    out = engine.decide_progression_from_context("bench_press", ctx)
    assert out["next_load"] == 100
    assert out["progression_decision"] == "hold"
    assert "progression_jump_guard" in out["secondary_constraints"]


def test_non_load_mode_and_recovery_protection():
    out = decide([result(failure=True)] * 3, mode="none")
    assert out["next_load"] == 52.5
    assert out["progression_decision"] == "no_progression"
    out = decide([result()] * 3, fatigue=2)
    assert out["next_load"] == 52.5
    assert out["progression_decision"] == "hold"


def test_fallback_result_below_range_and_lower_reference_validity():
    out = decide([{"exercise_id": "bench_press", "target_reps": "6-8", "achieved_reps": "5", "load": "52.5 kg"}])
    assert out["next_load"] == 50
    analysis = engine.analyze_session_result_for_progression(result(reps=(8, 0), loads=(52.5, 40)))
    assert analysis["lower_load_reference"] is None


@pytest.mark.parametrize("results, expected_load, decision", [
    ([result(loads=(52.5, 47.5))] * 3, "47.5 kg", "deload"),
    ([result(failure=True)], "50 kg", "reduce"),
    ([result()] * 3, "55 kg", "increase"),
])
def test_engine_recommendation_becomes_next_plan_target_load(monkeypatch, results, expected_load, decision):
    ctx = context(results)
    monkeypatch.setattr(app, "build_progression_context", lambda exercise_id, user_id=None: deepcopy(ctx))
    # Keep unrelated plan explanation independent of local persisted user state.
    monkeypatch.setattr(app, "build_training_decision", lambda **kwargs: {})
    programs = [{"id": "test_strength", "kind": "strength", "days": [{"label": "A", "exercises": [
        {"exercise_id": "bench_press", "sets": 3, "reps": "6-8"}]}]}]
    plan = app.build_strength_plan(
        programs=programs, exercises=[ctx["exercise"]], latest_strength={},
        time_budget_min=30, fatigue_score=0, user_settings={"available_equipment": {"barbell": True}},
        user_id=None, selected_program_id="test_strength",
    )
    entry, = plan["plan_entries"]
    assert entry["target_load"] == expected_load
    assert entry["progression_decision"] == decision


def test_whole_workout_at_manual_lower_load_uses_performed_reference():
    entry = result(reps=(7, 7), loads=(47.5, 47.5))
    entry["load"] = "52.5 kg"
    out = decide([entry])
    assert out["next_load"] == 47.5
    assert out["progression_decision"] == "hold"


@pytest.mark.parametrize("style, target, expected", [
    ("reps_then_variant", "8", "10"),
    ("time_then_variant", "20 sec", "25 sek"),
])
def test_non_load_progression_preserved(style, target, expected):
    entry = {"target_reps": target, "achieved_reps": target}
    ctx = context([entry], mode="reps_only")
    ctx["step"] = 0
    ctx["exercise"]["progression_style"] = style
    out = engine.decide_progression_from_context("bench_press", ctx)
    assert out["next_load"] is None
    assert out["next_target_reps"] == expected
    assert out["progression_decision"] == "increase_reps"
