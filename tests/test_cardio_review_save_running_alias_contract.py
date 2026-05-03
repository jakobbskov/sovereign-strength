from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app" / "frontend" / "app.js"
BACKEND = ROOT / "app" / "backend" / "app.py"


def test_frontend_running_alias_shows_cardio_review_fields_and_program_id():
    js = APP_JS.read_text(encoding="utf-8")

    assert 'const isCardio = sessionType === "løb" || sessionType === "cardio" || sessionType === "run" || sessionType === "running";' in js
    assert 'if (sessionType === "løb" || sessionType === "run" || sessionType === "running" || sessionType === "cardio"){' in js


def test_backend_running_alias_counts_and_preserves_cardio_metrics():
    py = BACKEND.read_text(encoding="utf-8")

    assert 'session_type in ("løb", "cardio", "run", "running")' in py
    assert 'session_type_normalized in ("løb", "run", "running", "cardio")' in py

    for field in [
        '"cardio_kind": cardio_kind if session_type in ("løb", "cardio", "run", "running") else ""',
        '"avg_rpe": avg_rpe if session_type in ("løb", "cardio", "run", "running") else None',
        '"distance_km": distance_km if session_type in ("løb", "cardio", "run", "running") else None',
        '"duration_total_sec": duration_total_sec if session_type in ("løb", "cardio", "run", "running") else None',
        '"pace_sec_per_km": pace_sec_per_km if session_type in ("løb", "cardio", "run", "running") else None',
    ]:
        assert field in py
