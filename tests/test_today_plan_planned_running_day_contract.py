import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "app" / "backend"
APP_PATH = BACKEND_DIR / "app.py"

sys.path.insert(0, str(BACKEND_DIR))

spec = importlib.util.spec_from_file_location("backend_app", APP_PATH)
backend_app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backend_app)


def user_settings_for_strength_and_running():
    return {
        "preferences": {
            "training_types": {
                "running": True,
                "strength_weights": True,
                "bodyweight": True,
                "mobility": True,
            },
            "training_days": {
                "mon": True,
                "tue": False,
                "wed": True,
                "thu": True,
                "fri": True,
                "sat": True,
                "sun": True,
            },
            "weekly_target_sessions": 4,
        }
    }


def test_training_day_context_marks_planned_running_day_like_frontend_weekplan():
    settings = user_settings_for_strength_and_running()

    ctx = backend_app.get_training_day_context(settings, "2026-05-02")

    assert ctx["weekday_key"] == "sat"
    assert ctx["is_training_day"] is True
    assert ctx["planned_kind"] == "running"


def test_planned_running_day_prefers_cardio_over_generic_strength(monkeypatch):
    settings = user_settings_for_strength_and_running()
    ctx = backend_app.get_training_day_context(settings, "2026-05-02")

    monkeypatch.setattr(
        backend_app,
        "select_today_strength_program",
        lambda **kwargs: "base_strength_gym_4x",
    )
    monkeypatch.setattr(
        backend_app,
        "select_endurance_program",
        lambda **kwargs: "hybrid_run_strength_3x_beginner",
    )
    monkeypatch.setattr(
        backend_app,
        "build_strength_plan",
        lambda **kwargs: {
            "template_id": "strength_day_a",
            "plan_entries": [{"exercise_id": "squat"}],
            "plan_variant": "full",
            "reason": "styrke prioriteres",
        },
    )
    monkeypatch.setattr(
        backend_app,
        "shape_strength_ctx_for_local_protection",
        lambda strength_ctx, **kwargs: strength_ctx,
    )
    monkeypatch.setattr(
        backend_app,
        "build_weekly_training_status",
        lambda **kwargs: {"completed_sessions": 0, "weekly_target_sessions": 4},
    )
    monkeypatch.setattr(
        backend_app,
        "build_autoplan_cardio",
        lambda **kwargs: {
            "entries": [{"exercise_id": "run_easy"}],
            "template_mode": "autoplan_cardio_v0_1",
            "local_protection_override": False,
            "protected_regions": [],
        },
    )

    decision = backend_app.build_today_plan_training_decision(
        auth_user={"user_id": 3},
        checkin_date="2026-05-02",
        readiness_score=4,
        fatigue_score=1,
        recovery_state={"recovery_state": "ready", "load_status": "normal"},
        time_budget_min=45,
        user_settings=settings,
        training_day_ctx=ctx,
        programs=[],
        exercises=[],
        latest_strength=None,
    )

    assert decision["session_type"] == "løb"
    assert decision["template_id"] == "autoplan_cardio"
    assert decision["plan_variant"] == "autoplan_cardio"
    assert decision["reason"] == "ugeplanen foreslog løb · cardio vælges"
    assert len(decision["plan_entries"]) == 1


def test_low_readiness_still_overrides_planned_running_day(monkeypatch):
    settings = user_settings_for_strength_and_running()
    ctx = backend_app.get_training_day_context(settings, "2026-05-02")

    monkeypatch.setattr(
        backend_app,
        "build_local_risk_planning_override",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr(
        backend_app,
        "should_use_reentry_strength",
        lambda **kwargs: False,
    )
    monkeypatch.setattr(
        backend_app,
        "build_restitution_plan",
        lambda *args, **kwargs: [{"exercise_id": "easy_walk"}],
    )

    decision = backend_app.resolve_today_plan_decision_context(
        auth_user={"user_id": 3},
        checkin_date="2026-05-02",
        readiness_score=3,
        fatigue_score=1,
        timing_state="on_time",
        recovery_state={"recovery_state": "recover", "load_status": "normal"},
        days_since_last_strength=2,
        time_budget_min=45,
        training_day_ctx=ctx,
        weekly_status={"completed_sessions": 0, "weekly_target_sessions": 4},
        latest_checkin={"date": "2026-05-02", "readiness_score": 3},
        user_settings=settings,
        programs=[],
        exercises=[],
        latest_strength=None,
    )

    assert decision["session_type"] == "restitution"
    assert decision["template_id"] == "restitution_easy"
    assert decision["reason"] == "low readiness"

def test_today_plan_trace_payload_includes_planning_context():
    js = APP_PATH.read_text(encoding="utf-8")

    assert '"training_day_context": item.get("training_day_context")' in js
    assert '"weekly_status": item.get("weekly_status")' in js
    assert '"selected_strength_program_id": item.get("selected_strength_program_id")' in js
    assert '"selected_endurance_program_id": item.get("selected_endurance_program_id")' in js
    assert '"decision_trace": item.get("decision_trace")' in js

