import sys
from collections import Counter
from pathlib import Path
from unittest.mock import patch

sys.path.append(str(Path(__file__).resolve().parents[1] / "app" / "backend"))

import app as backend_app


def run_longitudinal_day(*, day_index, readiness_score, fatigue_score, timing_state="on_time", recovery_state=None, training_day_ctx=None, weekly_status=None, user_settings=None, session_results=None):
    if recovery_state is None:
        recovery_state = {}
    if training_day_ctx is None:
        training_day_ctx = {}
    if weekly_status is None:
        weekly_status = {}
    if user_settings is None:
        user_settings = {}
    if session_results is None:
        session_results = []

    client = backend_app.app.test_client()

    auth_user = {"user_id": "1", "username": "jakob", "role": "admin"}
    month = 4 + (day_index // 28)
    day_of_month = (day_index % 28) + 1
    date_str = f"2026-{month:02d}-{day_of_month:02d}"

    checkins = [{
        "id": f"c{day_index + 1}",
        "user_id": "1",
        "date": date_str,
        "created_at": f"{date_str}T08:00:00+00:00"
    }]

    today_ctx = {
        "readiness_score": readiness_score,
        "checkin_date": date_str,
        "time_budget_min": 45,
        "user_settings": user_settings,
        "training_day_ctx": training_day_ctx,
        "weekly_target_sessions": 3,
        "weekly_status": weekly_status,
    }

    fatigue_ctx = {
        "latest_strength": None,
        "days_since_last_strength": None,
        "session_results": session_results,
        "previous_recommendation": None,
        "latest_strength_session": None,
        "latest_strength_failed": False,
        "latest_strength_load_drop_count": 0,
        "latest_strength_completed": None,
        "fatigue_score": fatigue_score,
        "recovery_state": recovery_state,
        "fatigue_session_override": None,
    }

    real_read_json_file = backend_app.read_json_file

    def fake_read_json_file(path_value):
        if path_value == backend_app.FILES["programs"]:
            return real_read_json_file(path_value)
        if path_value == backend_app.FILES["exercises"]:
            return real_read_json_file(path_value)
        if path_value == backend_app.FILES["session_results"]:
            return session_results
        if path_value == backend_app.FILES["recommendations"]:
            return []
        return []

    with patch.object(backend_app, "require_auth_user", return_value=(auth_user, None)), \
         patch.object(backend_app, "list_user_items", return_value=checkins), \
         patch.object(backend_app, "get_storage_last_error", return_value=None), \
         patch.object(backend_app, "list_workouts_for_user", return_value=[]), \
         patch.object(backend_app, "read_json_file", side_effect=fake_read_json_file), \
         patch.object(backend_app, "build_today_plan_context", return_value=today_ctx), \
         patch.object(backend_app, "build_today_plan_fatigue_context", return_value=fatigue_ctx), \
         patch.object(backend_app, "build_today_plan_timing_state", return_value=timing_state), \
         patch.object(backend_app, "append_today_plan_trace", return_value=None):
        response = client.get("/api/today-plan")

    assert response.status_code == 200, response.data.decode("utf-8")
    payload = response.get_json()
    assert payload and payload.get("ok") is True, payload
    assert isinstance(payload.get("item"), dict), payload
    return payload["item"]


def run_scenario(days):
    outputs = []
    for idx, day in enumerate(days):
        item = run_longitudinal_day(
            day_index=idx,
            readiness_score=day["readiness_score"],
            fatigue_score=day["fatigue_score"],
            timing_state=day.get("timing_state", "on_time"),
            recovery_state=day.get("recovery_state", {}),
            training_day_ctx=day.get("training_day_ctx", {}),
            weekly_status=day.get("weekly_status", {}),
            user_settings=day.get("user_settings", {}),
            session_results=day.get("session_results", []),
        )
        outputs.append(item)
    return outputs


def count_session_types(outputs):
    counts = {}
    for item in outputs:
        session_type = item.get("session_type")
        counts[session_type] = counts.get(session_type, 0) + 1
    return counts


def count_field(outputs, field_name):
    counter = Counter()
    for item in outputs:
        value = str(item.get(field_name, "") or "").strip()
        if value:
            counter[value] += 1
    return dict(counter)


def top_counts(counts, limit=5):
    return sorted(counts.items(), key=lambda x: (-x[1], x[0]))[:limit]


def longest_streak(values):
    if not values:
        return 0
    best = 1
    current = 1
    previous = values[0]
    for value in values[1:]:
        if value == previous:
            current += 1
            best = max(best, current)
        else:
            previous = value
            current = 1
    return best


def summarize_outputs(outputs):
    session_types = [item.get("session_type") for item in outputs]
    templates = count_field(outputs, "template_id")
    reasons = count_field(outputs, "reason")
    variants = count_field(outputs, "plan_variant")

    milestones = {}
    for index in (13, 27, 83, 181):
        if 0 <= index < len(outputs):
            item = outputs[index]
            milestones[index + 1] = {
                "session_type": item.get("session_type"),
                "template_id": item.get("template_id"),
                "plan_variant": item.get("plan_variant"),
                "reason": item.get("reason"),
            }

    return {
        "days": len(outputs),
        "session_type_counts": count_session_types(outputs),
        "template_counts": templates,
        "reason_counts": reasons,
        "plan_variant_counts": variants,
        "longest_session_type_streak": longest_streak(session_types),
        "milestones": milestones,
    }


def format_summary(name, outputs):
    summary = summarize_outputs(outputs)

    lines = [
        f"=== {name} ===",
        f"days: {summary['days']}",
        f"session types: {top_counts(summary['session_type_counts'])}",
        f"templates: {top_counts(summary['template_counts'])}",
        f"plan variants: {top_counts(summary['plan_variant_counts'])}",
        f"top reasons: {top_counts(summary['reason_counts'])}",
        f"longest session-type streak: {summary['longest_session_type_streak']}",
    ]

    if summary["milestones"]:
        lines.append("milestones:")
        for day_number, item in sorted(summary["milestones"].items()):
            lines.append(
                f"  day {day_number}: session_type={item.get('session_type')} "
                f"template_id={item.get('template_id')} "
                f"plan_variant={item.get('plan_variant')} "
                f"reason={item.get('reason')}"
            )

    return "\n".join(lines)


def build_running_focused_user_14_days():
    days = []
    for idx in range(14):
        days.append({
            "readiness_score": 5 if idx % 4 else 4,
            "fatigue_score": 4 if idx in (2, 5, 9, 12) else 2,
            "timing_state": "early" if idx in (1, 4, 8, 11) else "on_time",
            "training_day_ctx": {"is_training_day": idx % 2 == 0},
            "weekly_status": {"completed_sessions": idx % 3},
        })
    return days


def build_mixed_user_14_days():
    days = []
    for idx in range(14):
        days.append({
            "readiness_score": 6 if idx % 3 else 4,
            "fatigue_score": 1 if idx % 5 else 5,
            "timing_state": "on_time",
            "training_day_ctx": {"is_training_day": idx in (0, 2, 4, 7, 9, 11)},
            "weekly_status": {"completed_sessions": idx % 4},
        })
    return days


def build_recurring_hip_irritation_user_14_days():
    days = []
    for idx in range(14):
        days.append({
            "readiness_score": 5,
            "fatigue_score": 2 if idx % 2 == 0 else 4,
            "timing_state": "on_time",
            "training_day_ctx": {"is_training_day": True},
            "weekly_status": {"completed_sessions": idx % 3},
            "recovery_state": {
                "local_state": {
                    "hip": {"state": "protect" if idx in (1, 2, 6, 7, 11) else "caution"}
                }
            }
        })
    return days


def build_mixed_user_28_days():
    days = []
    training_day_pattern = {0, 2, 4, 6}
    for idx in range(28):
        weekday = idx % 7
        days.append({
            "readiness_score": 6 if weekday in (1, 2, 4) else 4,
            "fatigue_score": 5 if idx in (6, 13, 20, 27) else (3 if weekday == 5 else 1),
            "timing_state": "early" if idx in (3, 10, 17, 24) else "on_time",
            "training_day_ctx": {"is_training_day": weekday in training_day_pattern},
            "weekly_status": {"completed_sessions": idx % 4},
        })
    return days


def build_running_focused_user_26_weeks():
    days = []
    total_days = 26 * 7
    for idx in range(total_days):
        weekday = idx % 7
        is_training_day = weekday in (1, 3, 5)
        fatigue_score = 4 if weekday == 6 else (3 if weekday in (2, 5) else 1)
        timing_state = "early" if weekday in (0, 4) else "on_time"
        readiness_score = 5 if weekday not in (6,) else 4

        days.append({
            "readiness_score": readiness_score,
            "fatigue_score": fatigue_score,
            "timing_state": timing_state,
            "training_day_ctx": {"is_training_day": is_training_day},
            "weekly_status": {"completed_sessions": idx % 3},
        })
    return days


def test_strength_program_switch_guidance_when_weekly_target_outgrows_2_day_structure():
    outputs = run_scenario([
        {
            "readiness_score": 5,
            "fatigue_score": 1,
            "timing_state": "on_time",
            "training_day_ctx": {"is_training_day": True},
            "weekly_status": {"completed_sessions": 1, "weekly_target_sessions": 3},
            "user_settings": {
                "available_equipment": {"bodyweight": True, "dumbbell": True},
                "preferences": {
                    "training_types": {
                        "running": False,
                        "strength_weights": False,
                        "bodyweight": True,
                        "mobility": True,
                    }
                },
            },
        }
    ])

    assert len(outputs) == 1
    item = outputs[0]
    guidance = item.get("next_guidance", {}) or {}

    assert item.get("session_type") == "styrke", item
    assert item.get("selected_strength_program_id") == "starter_strength_2x", item
    assert guidance.get("kind") == "program_switch_recommendation", guidance
    assert guidance.get("source") == "program_switch_v0_1", guidance
    assert guidance.get("recommended_program_id") == "strength_full_body_3x_beginner", guidance


def test_strength_plateau_guidance_requires_repeated_holds_and_no_recent_increase():
    plateau_history = [
        {
            "session_type": "styrke",
            "completed": True,
            "results": [{"progression_decision": "hold"}],
        },
        {
            "session_type": "styrke",
            "completed": True,
            "results": [{"progression_decision": "hold"}],
        },
        {
            "session_type": "styrke",
            "completed": True,
            "results": [{"progression_decision": "hold"}],
        },
        {
            "session_type": "styrke",
            "completed": True,
            "results": [{"progression_decision": "hold"}],
        },
    ]

    outputs = run_scenario([
        {
            "readiness_score": 5,
            "fatigue_score": 1,
            "timing_state": "on_time",
            "training_day_ctx": {"is_training_day": True},
            "weekly_status": {"completed_sessions": 2, "weekly_target_sessions": 2},
            "user_settings": {
                "available_equipment": {"bodyweight": True, "dumbbell": True},
                "preferences": {
                    "training_types": {
                        "running": False,
                        "strength_weights": False,
                        "bodyweight": True,
                        "mobility": True,
                    }
                },
            },
            "session_results": plateau_history,
        }
    ])

    assert len(outputs) == 1
    item = outputs[0]
    guidance = item.get("next_guidance", {}) or {}

    assert item.get("session_type") == "styrke", item
    assert guidance.get("kind") == "plateau_signal", guidance
    assert guidance.get("source") == "plateau_detection_v0_1", guidance
    assert guidance.get("hold_sessions") == 4, guidance
    assert guidance.get("increase_sessions") == 0, guidance


def test_strength_plateau_guidance_does_not_trigger_when_recent_increase_exists():
    mixed_history = [
        {
            "session_type": "styrke",
            "completed": True,
            "results": [{"progression_decision": "increase"}],
        },
        {
            "session_type": "styrke",
            "completed": True,
            "results": [{"progression_decision": "hold"}],
        },
        {
            "session_type": "styrke",
            "completed": True,
            "results": [{"progression_decision": "hold"}],
        },
        {
            "session_type": "styrke",
            "completed": True,
            "results": [{"progression_decision": "hold"}],
        },
    ]

    outputs = run_scenario([
        {
            "readiness_score": 5,
            "fatigue_score": 1,
            "timing_state": "on_time",
            "training_day_ctx": {"is_training_day": True},
            "weekly_status": {"completed_sessions": 2, "weekly_target_sessions": 2},
            "user_settings": {
                "available_equipment": {"bodyweight": True, "dumbbell": True},
                "preferences": {
                    "training_types": {
                        "running": False,
                        "strength_weights": False,
                        "bodyweight": True,
                        "mobility": True,
                    }
                },
            },
            "session_results": mixed_history,
        }
    ])

    assert len(outputs) == 1
    item = outputs[0]
    guidance = item.get("next_guidance", {}) or {}

    assert item.get("session_type") == "styrke", item
    assert guidance.get("kind") != "plateau_signal", guidance


def test_running_focused_user_14_days():
    outputs = run_scenario(build_running_focused_user_14_days())
    session_types = [item["session_type"] for item in outputs]

    assert len(outputs) == 14
    assert all(s in ("styrke", "cardio", "restitution", "løb") for s in session_types), session_types
    assert any(s == "cardio" for s in session_types), session_types
    assert any(s != "restitution" for s in session_types), session_types


def test_mixed_user_14_days_has_variation():
    outputs = run_scenario(build_mixed_user_14_days())
    session_types = [item["session_type"] for item in outputs]
    unique_types = set(session_types)

    assert len(outputs) == 14
    assert len(unique_types) >= 2, session_types
    assert "styrke" in unique_types or "løb" in unique_types or "cardio" in unique_types, session_types


def test_recurring_hip_irritation_user_14_days_stays_conservative():
    outputs = run_scenario(build_recurring_hip_irritation_user_14_days())
    session_types = [item["session_type"] for item in outputs]

    assert len(outputs) == 14
    assert any(s in ("cardio", "restitution") for s in session_types), session_types
    assert not all(s == "styrke" for s in session_types), session_types


def test_mixed_user_28_days_has_distribution_balance():
    outputs = run_scenario(build_mixed_user_28_days())
    session_types = [item["session_type"] for item in outputs]
    counts = count_session_types(outputs)

    assert len(outputs) == 28
    assert len(counts) >= 2, counts
    assert counts.get("restitution", 0) < 20, counts
    assert counts.get("styrke", 0) + counts.get("cardio", 0) + counts.get("løb", 0) >= 8, counts
    assert longest_streak(session_types) <= 10, session_types


def test_running_focused_user_26_weeks_does_not_drift_into_single_mode():
    outputs = run_scenario(build_running_focused_user_26_weeks())
    session_types = [item["session_type"] for item in outputs]
    counts = count_session_types(outputs)

    assert len(outputs) == 26 * 7
    assert counts.get("cardio", 0) >= 20, counts
    assert counts.get("styrke", 0) >= 10 or counts.get("løb", 0) >= 10, counts
    assert counts.get("restitution", 0) < 26 * 7, counts
    assert longest_streak(session_types) <= 21, counts


if __name__ == "__main__":
    scenarios = [
        ("running_focused_user_14_days", build_running_focused_user_14_days()),
        ("mixed_user_14_days", build_mixed_user_14_days()),
        ("recurring_hip_irritation_user_14_days", build_recurring_hip_irritation_user_14_days()),
        ("mixed_user_28_days", build_mixed_user_28_days()),
        ("running_focused_user_26_weeks", build_running_focused_user_26_weeks()),
    ]

    for name, days in scenarios:
        outputs = run_scenario(days)
        print(format_summary(name, outputs))
        print()

    test_running_focused_user_14_days()
    test_mixed_user_14_days_has_variation()
    test_recurring_hip_irritation_user_14_days_stays_conservative()
    test_mixed_user_28_days_has_distribution_balance()
    test_running_focused_user_26_weeks_does_not_drift_into_single_mode()
    print("All longitudinal scenario tests passed")
