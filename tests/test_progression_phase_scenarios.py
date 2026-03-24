import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "app" / "backend"))

import app as backend_app


def make_strength_session(date, created_at, exercise_id, reps, load, *, hit_failure=False, load_drop=False):
    sets = [
        {"reps": str(reps), "load": f"{load} kg"},
        {"reps": str(reps if not load_drop else max(1, reps - 1)), "load": f"{load if not load_drop else load - 5} kg"},
    ]
    return {
        "date": date,
        "created_at": created_at,
        "session_type": "strength",
        "results": [
            {
                "exercise_id": exercise_id,
                "target_reps": "6-8",
                "achieved_reps": str(reps),
                "hit_failure": hit_failure,
                "sets": sets,
            }
        ],
    }


def run_strength_progression_scenario(*, session_results, reps=8, load=100.0, fatigue_score=0):
    latest_result, latest_session = backend_app.find_latest_session_result_for_exercise(session_results, "bench_press")
    analysis = backend_app.analyze_session_result_for_progression(latest_result)

    ctx = {
        "session_results": session_results,
        "workouts": [],
        "step": 2,
        "start_weight": 40,
        "exercise": {
            "progression_mode": "double_progression",
            "progression_style": "",
        },
        "user_settings": {},
        "recommended_step": 2,
        "effective_load_increment": 2,
        "latest_result": latest_result,
        "latest_session": latest_session,
        "analysis": analysis,
        "fatigue_score": fatigue_score,
        "last_load": int(load),
        "last_entry": {"reps": "6-8", "achieved_reps": str(reps)},
    }

    out = backend_app.decide_progression_from_context("bench_press", ctx)
    assert out["ok"] is True, out
    return out


def test_calibration_requires_repeated_success():
    session_results = [
        make_strength_session(
            "2026-03-17",
            "2026-03-17T06:41:23+00:00",
            "bench_press",
            8,
            100,
        )
    ]

    out = run_strength_progression_scenario(session_results=session_results)

    assert out["progression_phase"] == "calibration", out
    assert out["relevant_session_count"] == 1, out
    assert out["trend_repeated_success"] is False, out
    assert out["progression_decision"] == "hold", out
    assert out["progression_reason"] == "afventer gentagen succes", out


def test_trend_allows_progression_after_repeated_success():
    session_results = [
        make_strength_session("2026-03-10", "2026-03-10T06:00:00+00:00", "bench_press", 8, 96),
        make_strength_session("2026-03-13", "2026-03-13T06:00:00+00:00", "bench_press", 8, 98),
        make_strength_session("2026-03-17", "2026-03-17T06:00:00+00:00", "bench_press", 8, 100),
    ]

    out = run_strength_progression_scenario(session_results=session_results)

    assert out["progression_phase"] == "trend", out
    assert out["relevant_session_count"] == 3, out
    assert out["trend_repeated_success"] is True, out
    assert out["progression_decision"] == "increase", out
    assert out["next_load"] == 102, out


def test_trend_blocks_progression_when_failure_exists_in_window():
    session_results = [
        make_strength_session("2026-03-10", "2026-03-10T06:00:00+00:00", "bench_press", 8, 96),
        make_strength_session("2026-03-13", "2026-03-13T06:00:00+00:00", "bench_press", 8, 98, hit_failure=True),
        make_strength_session("2026-03-17", "2026-03-17T06:00:00+00:00", "bench_press", 8, 100),
    ]

    out = run_strength_progression_scenario(session_results=session_results)

    assert out["progression_phase"] == "trend", out
    assert out["trend_failure_sessions"] == 1, out
    assert out["trend_repeated_success"] is True, out
    assert out["progression_decision"] == "hold", out


def test_recalibration_blocks_progression_after_long_pause():
    session_results = [
        make_strength_session("2026-02-01", "2026-02-01T06:00:00+00:00", "bench_press", 8, 100),
        make_strength_session("2026-01-28", "2026-01-28T06:00:00+00:00", "bench_press", 8, 98),
        make_strength_session("2026-01-24", "2026-01-24T06:00:00+00:00", "bench_press", 8, 96),
    ]

    out = run_strength_progression_scenario(session_results=session_results)

    assert out["progression_phase"] == "recalibration", out
    assert out["progression_decision"] == "hold", out
    assert out["progression_reason"] == "rekalibrering efter pause", out



def test_trend_at_minimum_threshold_without_repeated_success_holds():
    session_results = [
        make_strength_session("2026-03-10", "2026-03-10T06:00:00+00:00", "bench_press", 7, 96),
        make_strength_session("2026-03-13", "2026-03-13T06:00:00+00:00", "bench_press", 8, 98),
        make_strength_session("2026-03-17", "2026-03-17T06:00:00+00:00", "bench_press", 8, 100),
    ]

    out = run_strength_progression_scenario(session_results=session_results)

    assert out["progression_phase"] == "trend", out
    assert out["relevant_session_count"] == 3, out
    assert out["trend_successful_sessions"] == 2, out
    assert out["trend_repeated_success"] is True, out
    assert out["progression_decision"] == "increase", out


def test_trend_blocks_progression_when_load_drop_exists_in_window():
    session_results = [
        make_strength_session("2026-03-10", "2026-03-10T06:00:00+00:00", "bench_press", 8, 96),
        make_strength_session("2026-03-13", "2026-03-13T06:00:00+00:00", "bench_press", 8, 98, load_drop=True),
        make_strength_session("2026-03-17", "2026-03-17T06:00:00+00:00", "bench_press", 8, 100),
    ]

    out = run_strength_progression_scenario(session_results=session_results)

    assert out["progression_phase"] == "trend", out
    assert out["trend_load_drop_sessions"] == 1, out
    assert out["trend_repeated_success"] is True, out
    assert out["progression_decision"] == "hold", out



def test_trend_recommends_deload_after_repeated_failures():
    session_results = [
        make_strength_session("2026-03-10", "2026-03-10T06:00:00+00:00", "bench_press", 8, 96, hit_failure=True),
        make_strength_session("2026-03-13", "2026-03-13T06:00:00+00:00", "bench_press", 8, 98, hit_failure=True),
        make_strength_session("2026-03-17", "2026-03-17T06:00:00+00:00", "bench_press", 8, 100),
    ]

    out = run_strength_progression_scenario(session_results=session_results)

    assert out["progression_phase"] == "trend", out
    assert out["trend_failure_sessions"] == 2, out
    assert out["deload_recommended"] is True, out
    assert out["deload_reason"] == "gentagne failures", out
    assert out["deload_scope"] == "exercise", out
    assert out["progression_decision"] == "hold", out


if __name__ == "__main__":
    test_calibration_requires_repeated_success()
    test_trend_allows_progression_after_repeated_success()
    test_trend_blocks_progression_when_failure_exists_in_window()
    test_recalibration_blocks_progression_after_long_pause()
    print("All progression phase scenario tests passed")
