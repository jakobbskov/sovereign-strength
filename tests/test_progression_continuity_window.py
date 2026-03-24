import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "app" / "backend"))

import app as backend_app


def make_strength_session(date, created_at, exercise_id="bench_press", reps=8, load=100, *, hit_failure=False):
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
                "sets": [
                    {"reps": str(reps), "load": f"{load} kg"},
                    {"reps": str(reps), "load": f"{load} kg"},
                ],
            }
        ],
    }


def test_keeps_recent_continuous_block():
    session_results = [
        make_strength_session("2026-03-01", "2026-03-01T06:00:00+00:00", load=96),
        make_strength_session("2026-03-08", "2026-03-08T06:00:00+00:00", load=98),
        make_strength_session("2026-03-12", "2026-03-12T06:00:00+00:00", load=100),
    ]

    history = backend_app.get_relevant_strength_history(
        session_results,
        "bench_press",
        max_items=6,
        recent_days=42,
        continuity_gap_days=14,
    )

    assert len(history) == 3, history
    assert [item["date"] for item in history] == ["2026-03-12", "2026-03-08", "2026-03-01"], history


def test_stops_at_large_gap_and_excludes_older_block():
    session_results = [
        make_strength_session("2026-02-10", "2026-02-10T06:00:00+00:00", load=94),
        make_strength_session("2026-03-01", "2026-03-01T06:00:00+00:00", load=96),
        make_strength_session("2026-03-08", "2026-03-08T06:00:00+00:00", load=98),
        make_strength_session("2026-03-12", "2026-03-12T06:00:00+00:00", load=100),
    ]

    history = backend_app.get_relevant_strength_history(
        session_results,
        "bench_press",
        max_items=6,
        recent_days=42,
        continuity_gap_days=14,
    )

    assert len(history) == 3, history
    assert [item["date"] for item in history] == ["2026-03-12", "2026-03-08", "2026-03-01"], history


def test_excludes_sessions_older_than_recent_window():
    session_results = [
        make_strength_session("2026-01-20", "2026-01-20T06:00:00+00:00", load=94),
        make_strength_session("2026-02-05", "2026-02-05T06:00:00+00:00", load=96),
        make_strength_session("2026-03-01", "2026-03-01T06:00:00+00:00", load=98),
        make_strength_session("2026-03-12", "2026-03-12T06:00:00+00:00", load=100),
    ]

    history = backend_app.get_relevant_strength_history(
        session_results,
        "bench_press",
        max_items=6,
        recent_days=30,
        continuity_gap_days=14,
    )

    assert [item["date"] for item in history] == ["2026-03-12", "2026-03-01"], history


if __name__ == "__main__":
    test_keeps_recent_continuous_block()
    test_stops_at_large_gap_and_excludes_older_block()
    test_excludes_sessions_older_than_recent_window()
    print("All progression continuity window tests passed")
