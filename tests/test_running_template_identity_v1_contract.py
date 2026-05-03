import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_PATH = ROOT / "app" / "backend"
APP_PATH = BACKEND_PATH / "app.py"


def load_backend_app():
    sys.path.insert(0, str(BACKEND_PATH))
    spec = importlib.util.spec_from_file_location("backend_app", APP_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def install_cardio_test_guards(app, monkeypatch):
    monkeypatch.setattr(
        app,
        "compute_cardio_load_metrics",
        lambda user_id: {
            "weekly_cardio_load": 0,
            "last_cardio_kind": "base",
            "days_since_last_cardio": 5,
            "last_hard_cardio_days_ago": None,
            "recent_cardio_kinds": ["base", "base"],
            "recent_base_count": 2,
            "load_status": "underloaded",
        },
    )
    monkeypatch.setattr(app, "get_local_protect_regions", lambda user_id, regions=None: [])


def test_starter_run_template_does_not_drift_into_tempo_or_intervals(monkeypatch):
    app = load_backend_app()
    install_cardio_test_guards(app, monkeypatch)

    picked = app.choose_cardio_session(
        user_id="issue-620",
        readiness=5,
        time_budget_min=35,
        recovery_state={"recovery_state": "train"},
        training_day_context={"is_training_day": True},
        selected_endurance_program_id="starter_run_2x",
    )

    assert picked["cardio_kind"] == "base"
    assert picked["selected_endurance_program_id"] == "starter_run_2x"
    assert any("starter/re-entry" in reason for reason in picked["reason"])


def test_reentry_run_template_does_not_drift_into_tempo_or_intervals(monkeypatch):
    app = load_backend_app()
    install_cardio_test_guards(app, monkeypatch)

    picked = app.choose_cardio_session(
        user_id="issue-620",
        readiness=5,
        time_budget_min=35,
        recovery_state={"recovery_state": "train"},
        training_day_context={"is_training_day": True},
        selected_endurance_program_id="reentry_run_2x",
    )

    assert picked["cardio_kind"] == "base"
    assert picked["selected_endurance_program_id"] == "reentry_run_2x"
    assert any("starter/re-entry" in reason for reason in picked["reason"])


def test_hybrid_run_strength_template_stays_low_dose(monkeypatch):
    app = load_backend_app()
    install_cardio_test_guards(app, monkeypatch)

    picked = app.choose_cardio_session(
        user_id="issue-620",
        readiness=5,
        time_budget_min=35,
        recovery_state={"recovery_state": "train"},
        training_day_context={"is_training_day": True},
        selected_endurance_program_id="hybrid_run_strength_2x_beginner",
    )

    assert picked["cardio_kind"] == "base"
    assert picked["selected_endurance_program_id"] == "hybrid_run_strength_2x_beginner"
    assert any("hybrid-support" in reason for reason in picked["reason"])


def test_unknown_running_program_keeps_existing_generic_cardio_logic(monkeypatch):
    app = load_backend_app()
    install_cardio_test_guards(app, monkeypatch)

    picked = app.choose_cardio_session(
        user_id="issue-620",
        readiness=5,
        time_budget_min=35,
        recovery_state={"recovery_state": "train"},
        training_day_context={"is_training_day": True},
        selected_endurance_program_id="unknown_run_program",
    )

    assert picked["cardio_kind"] == "tempo"
    assert picked["selected_endurance_program_id"] == "unknown_run_program"
