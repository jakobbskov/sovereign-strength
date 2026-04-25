from datetime import datetime, timezone

def get_effective_load_increment(exercise, user_settings):
    if not isinstance(exercise, dict):
        exercise = {}
    if not isinstance(user_settings, dict):
        user_settings = {}

    load_increment = exercise.get("load_increment", None)
    try:
        if load_increment is not None:
            load_increment = float(load_increment)
            if load_increment >= 0:
                return load_increment
    except Exception:
        pass

    equipment_type = str(exercise.get("equipment_type", "")).strip()
    increments = user_settings.get("equipment_increments", {})
    if equipment_type and isinstance(increments, dict):
        try:
            val = increments.get(equipment_type, None)
            if val is not None:
                val = float(val)
                if val >= 0:
                    return val
        except Exception:
            pass

    try:
        step = exercise.get("progression_step", 0)
        step = float(step)
        if step >= 0:
            return step
    except Exception:
        pass

    return 0.0


def get_effective_recommended_step(exercise):
    if not isinstance(exercise, dict):
        return 0.0
    try:
        step = exercise.get("recommended_step", exercise.get("progression_step", 0))
        step = float(step)
        if step >= 0:
            return step
    except Exception:
        return 0.0
    return 0.0


def compute_next_possible_load(last_load, effective_load_increment):
    try:
        last_load = float(last_load)
        effective_load_increment = float(effective_load_increment)
    except Exception:
        return None

    if effective_load_increment <= 0:
        return last_load

    return last_load + effective_load_increment


def parse_number_from_load(value):
    x = str(value or "").strip().lower().replace("kg", "").strip()
    if not x:
        return None
    try:
        return float(x.replace(",", "."))
    except Exception:
        return None


def parse_top_rep(rep_range):
    txt = str(rep_range or "").strip()
    if "-" in txt:
        try:
            return int(txt.split("-")[-1])
        except Exception:
            return None
    try:
        return int(txt)
    except Exception:
        return None


def parse_seconds_value(value):
    txt = str(value or "").strip().lower().replace("sek", "").replace("sec", "").strip()
    if not txt:
        return None
    try:
        return int(float(txt.replace(",", ".")))
    except Exception:
        return None


def evaluate_progression_jump_guard(last_load, recommended_next_load, actual_possible_next_load):
    try:
        last_load = float(last_load)
    except Exception:
        return {
            "guard_triggered": False,
            "guard_reason": None,
        }

    candidate_next = actual_possible_next_load
    if candidate_next is None:
        candidate_next = recommended_next_load

    try:
        candidate_next = float(candidate_next)
    except Exception:
        return {
            "guard_triggered": False,
            "guard_reason": None,
        }

    if candidate_next <= last_load:
        return {
            "guard_triggered": False,
            "guard_reason": None,
        }

    absolute_jump = candidate_next - last_load
    relative_jump = absolute_jump / last_load if last_load > 0 else 0.0

    if last_load >= 80 and (absolute_jump > 2.5 or relative_jump > 0.05):
        return {
            "guard_triggered": True,
            "guard_reason": "konservativ progression ved høj belastning",
        }

    return {
        "guard_triggered": False,
        "guard_reason": None,
    }


def evaluate_equipment_constraint(last_load, recommended_step, effective_load_increment, candidate_for_progression):
    equipment_constraint = False
    recommended_next_load = None
    actual_possible_next_load = None
    secondary_constraints = []

    if candidate_for_progression and last_load is not None:
        recommended_next_load = float(last_load) + recommended_step
        actual_possible_next_load = compute_next_possible_load(float(last_load), effective_load_increment)

        ideal_jump = recommended_next_load - float(last_load)
        actual_jump = actual_possible_next_load - float(last_load)

        if actual_jump > ideal_jump:
            equipment_constraint = True
            secondary_constraints.append("equipment_constraint")

    return {
        "equipment_constraint": equipment_constraint,
        "secondary_constraints": secondary_constraints,
        "recommended_next_load": recommended_next_load,
        "actual_possible_next_load": actual_possible_next_load,
    }


def format_rep_progression_target(current_target, increment=2):
    txt = str(current_target or "").strip()
    if not txt:
        return current_target

    if "-" in txt:
        parts = txt.split("-")
        try:
            lo = int(parts[0].strip())
            hi = int(parts[-1].strip())
            return f"{lo + increment}-{hi + increment}"
        except Exception:
            return current_target

    try:
        val = int(txt)
        return str(val + increment)
    except Exception:
        return current_target


def format_time_progression_target(current_target, increment=5):
    secs = parse_seconds_value(current_target)
    if secs is None:
        return current_target
    return f"{secs + increment} sek"


def analyze_session_result_for_progression(result):
    if not isinstance(result, dict):
        return {
            "source": "none",
            "has_sets": False,
            "first_set_load": None,
            "first_set_reps": None,
            "min_reps": None,
            "hit_failure": False,
            "load_drop_detected": False,
        }

    raw_sets = result.get("sets", [])
    hit_failure = bool(result.get("hit_failure", False))

    if isinstance(raw_sets, list) and raw_sets:
        clean_sets = []
        for x in raw_sets:
            if not isinstance(x, dict):
                continue
            reps_raw = str(x.get("reps", "")).strip()
            load_raw = x.get("load", "")
            reps_num = None
            try:
                reps_num = int(reps_raw) if reps_raw != "" else None
            except Exception:
                reps_num = None
            load_num = parse_number_from_load(load_raw)
            clean_sets.append({
                "reps": reps_num,
                "load": load_num,
            })

        first_set = clean_sets[0] if clean_sets else {}
        first_set_load = first_set.get("load")
        first_set_reps = first_set.get("reps")

        rep_values = [x["reps"] for x in clean_sets if x.get("reps") is not None]
        min_reps = min(rep_values) if rep_values else None

        load_values = [x["load"] for x in clean_sets if x.get("load") is not None]
        load_drop_detected = False
        if len(load_values) >= 2 and load_values[0] is not None:
            for later in load_values[1:]:
                if later is not None and later < load_values[0]:
                    load_drop_detected = True
                    break

        return {
            "source": "session_result",
            "has_sets": True,
            "first_set_load": first_set_load,
            "first_set_reps": first_set_reps,
            "min_reps": min_reps,
            "hit_failure": hit_failure,
            "load_drop_detected": load_drop_detected,
        }

    fallback_load = parse_number_from_load(result.get("load", ""))
    fallback_reps = None
    try:
        achieved_raw = str(result.get("achieved_reps", "")).strip()
        fallback_reps = int(achieved_raw) if achieved_raw != "" else None
    except Exception:
        fallback_reps = None

    return {
        "source": "session_result",
        "has_sets": False,
        "first_set_load": fallback_load,
        "first_set_reps": fallback_reps,
        "min_reps": fallback_reps,
        "hit_failure": hit_failure,
        "load_drop_detected": False,
    }



def parse_session_sort_datetime(session):
    if not isinstance(session, dict):
        return None

    created_at = str(session.get("created_at", "")).strip()
    if created_at:
        try:
            return datetime.fromisoformat(created_at)
        except Exception:
            pass

    date_str = str(session.get("date", "")).strip()
    if date_str:
        try:
            return datetime.fromisoformat(date_str)
        except Exception:
            return None

    return None



def normalize_dt_for_compare(dt):
    if dt is None:
        return None
    try:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def days_between_datetimes(newer, older):
    newer_dt = normalize_dt_for_compare(newer)
    older_dt = normalize_dt_for_compare(older)
    if newer_dt is None or older_dt is None:
        return None
    try:
        return max(0, (newer_dt - older_dt).days)
    except Exception:
        return None


def get_relevant_strength_history(session_results, exercise_id, max_items=6, recent_days=42, continuity_gap_days=14):
    history = []
    exercise_id = str(exercise_id or "").strip()
    newest_relevant_dt = None
    previous_kept_dt = None

    if not exercise_id:
        return history

    for session in reversed(session_results or []):
        if not isinstance(session, dict):
            continue

        session_type = str(session.get("session_type", "")).strip().lower()
        if session_type != "strength":
            continue

        results = session.get("results", [])
        if not isinstance(results, list) or not results:
            continue

        matched_result = None
        for result in reversed(results):
            if not isinstance(result, dict):
                continue
            if str(result.get("exercise_id", "")).strip() == exercise_id:
                matched_result = result
                break

        if not matched_result:
            continue

        analysis = analyze_session_result_for_progression(matched_result)
        has_usable_data = bool(
            analysis.get("first_set_load") is not None or
            analysis.get("first_set_reps") is not None or
            analysis.get("hit_failure", False) or
            analysis.get("has_sets", False)
        )
        if not has_usable_data:
            continue

        sort_dt = parse_session_sort_datetime(session)
        if sort_dt is None:
            continue

        if newest_relevant_dt is None:
            newest_relevant_dt = sort_dt

        age_from_newest_days = days_between_datetimes(newest_relevant_dt, sort_dt)
        if age_from_newest_days is not None and age_from_newest_days > recent_days:
            continue

        if previous_kept_dt is not None:
            gap_days = days_between_datetimes(previous_kept_dt, sort_dt)
            if gap_days is not None and gap_days > continuity_gap_days:
                break

        history.append({
            "session": session,
            "result": matched_result,
            "analysis": analysis,
            "date": str(session.get("date", "")).strip(),
            "created_at": str(session.get("created_at", "")).strip(),
            "sort_dt": sort_dt,
        })

        previous_kept_dt = sort_dt

        if len(history) >= max_items:
            break

    return history


def detect_progression_phase(relevant_history, pause_days=21, min_trend_sessions=3):
    count = len(relevant_history or [])
    latest_dt = None

    if relevant_history:
        latest_dt = relevant_history[0].get("sort_dt")

    days_since_last_relevant_session = None
    if latest_dt is not None:
        try:
            now_dt = datetime.now(timezone.utc)
            latest_cmp = latest_dt
            if latest_cmp.tzinfo is None:
                latest_cmp = latest_cmp.replace(tzinfo=timezone.utc)
            days_since_last_relevant_session = max(0, (now_dt - latest_cmp).days)
        except Exception:
            days_since_last_relevant_session = None

    if days_since_last_relevant_session is not None and days_since_last_relevant_session > pause_days:
        phase = "recalibration"
    elif count < min_trend_sessions:
        phase = "calibration"
    else:
        phase = "trend"

    return {
        "phase": phase,
        "relevant_session_count": count,
        "days_since_last_relevant_session": days_since_last_relevant_session,
        "pause_days_threshold": pause_days,
        "min_trend_sessions": min_trend_sessions,
    }


def summarize_strength_trend(relevant_history, window_size=3):
    window = list(relevant_history or [])[:window_size]
    session_summaries = []

    for item in window:
        result = item.get("result", {}) or {}
        analysis = item.get("analysis", {}) or {}

        target_top = parse_top_rep(result.get("target_reps", ""))
        first_set_reps = analysis.get("first_set_reps")
        hit_failure = bool(analysis.get("hit_failure", False))
        load_drop_detected = bool(analysis.get("load_drop_detected", False))

        candidate_for_progression = bool(
            target_top is not None and
            first_set_reps is not None and
            first_set_reps >= target_top
        )

        successful_session = bool(
            candidate_for_progression and
            not hit_failure and
            not load_drop_detected
        )

        session_summaries.append({
            "candidate_for_progression": candidate_for_progression,
            "successful_session": successful_session,
            "hit_failure": hit_failure,
            "load_drop_detected": load_drop_detected,
        })

    successful_sessions = sum(1 for x in session_summaries if x["successful_session"])
    failure_sessions = sum(1 for x in session_summaries if x["hit_failure"])
    load_drop_sessions = sum(1 for x in session_summaries if x["load_drop_detected"])
    negative_signal_sessions = failure_sessions + load_drop_sessions

    latest_summary = session_summaries[0] if session_summaries else {}
    latest_blocking_signal = bool(
        latest_summary.get("hit_failure", False) or
        latest_summary.get("load_drop_detected", False)
    )

    repeated_success = successful_sessions >= 2
    blocking_signal_present = latest_blocking_signal or negative_signal_sessions >= 1

    return {
        "window_size": len(window),
        "successful_sessions": successful_sessions,
        "failure_sessions": failure_sessions,
        "load_drop_sessions": load_drop_sessions,
        "negative_signal_sessions": negative_signal_sessions,
        "latest_blocking_signal": latest_blocking_signal,
        "repeated_success": repeated_success,
        "blocking_signal_present": blocking_signal_present,
        "session_summaries": session_summaries,
    }



def evaluate_deload_need(phase, trend_ctx, fatigue_score):
    if phase != "trend":
        return {
            "deload_recommended": False,
            "deload_reason": None,
            "deload_scope": None,
        }

    failures = int(trend_ctx.get("failure_sessions", 0) or 0)
    load_drops = int(trend_ctx.get("load_drop_sessions", 0) or 0)

    if failures >= 2:
        return {
            "deload_recommended": True,
            "deload_reason": "gentagne failures",
            "deload_scope": "exercise",
        }

    if load_drops >= 2:
        return {
            "deload_recommended": True,
            "deload_reason": "gentagne load-drops",
            "deload_scope": "exercise",
        }

    if (failures + load_drops) >= 2 and fatigue_score >= 2:
        return {
            "deload_recommended": True,
            "deload_reason": "kombineret træthed og ustabil performance",
            "deload_scope": "exercise",
        }

    return {
        "deload_recommended": False,
        "deload_reason": None,
        "deload_scope": None,
    }


def decide_progression_from_context(exercise_id, ctx):
    step = ctx["step"]
    start_weight = ctx["start_weight"]
    latest_result = ctx["latest_result"]
    analysis = ctx["analysis"]
    fatigue_score = ctx["fatigue_score"]
    recent_recovery_ctx = ctx.get("recent_recovery_ctx", {}) or {}
    last_load = ctx["last_load"]
    last_entry = ctx["last_entry"]
    recommended_step = float(ctx.get("recommended_step", step or 0) or 0)
    effective_load_increment = float(ctx.get("effective_load_increment", step or 0) or 0)
    exercise = ctx.get("exercise", {}) or {}
    progression_mode = str(exercise.get("progression_mode", "")).strip() or "double_progression"
    progression_style = str(exercise.get("progression_style", "")).strip()

    if step is None or step == 0:
        if progression_mode == "reps_only":
            target_value = None
            achieved_value = None

            if latest_result:
                target_raw = str(latest_result.get("target_reps", "")).strip()
                achieved_raw = str(latest_result.get("achieved_reps", "")).strip()
                target_value = parse_top_rep(target_raw)
                achieved_value = parse_top_rep(achieved_raw)

                if progression_style == "time_then_variant":
                    target_secs = parse_seconds_value(target_raw)
                    achieved_secs = parse_seconds_value(achieved_raw)

                    if target_secs is not None and achieved_secs is not None and achieved_secs >= target_secs:
                        return {
                            "ok": True,
                            "exercise": exercise_id,
                            "next_load": None,
                            "next_target_reps": format_time_progression_target(target_raw, 5),
                            "progression_decision": "increase_reps",
                            "progression_reason": "mål-tid ramt, øg tid næste gang",
                            "equipment_constraint": False,
                            "recommended_next_load": None,
                            "actual_possible_next_load": None,
                            "source": "bodyweight_time_progression",
                            "start_weight": start_weight,
                            "step": step,
                            "recommended_step": recommended_step,
                            "effective_load_increment": effective_load_increment
                        }

                if progression_style in ("reps_then_variant", "") and target_value is not None and achieved_value is not None and achieved_value >= target_value:
                    return {
                        "ok": True,
                        "exercise": exercise_id,
                        "next_load": None,
                        "next_target_reps": format_rep_progression_target(target_raw, 2),
                        "progression_decision": "increase_reps",
                        "progression_reason": "top af rep-interval ramt, øg reps næste gang",
                        "equipment_constraint": False,
                        "recommended_next_load": None,
                        "actual_possible_next_load": None,
                        "source": "bodyweight_rep_progression",
                        "start_weight": start_weight,
                        "step": step,
                        "recommended_step": recommended_step,
                        "effective_load_increment": effective_load_increment
                    }

            return {
                "ok": True,
                "exercise": exercise_id,
                "next_load": None,
                "next_target_reps": None,
                "progression_decision": "no_progression",
                "progression_reason": "ingen progression for denne øvelse endnu",
                "equipment_constraint": False,
                "recommended_next_load": None,
                "actual_possible_next_load": None,
                "source": "bodyweight_no_progression",
                "start_weight": start_weight,
                "step": step,
                "recommended_step": recommended_step,
                "effective_load_increment": effective_load_increment
            }

        return {
            "ok": True,
            "exercise": exercise_id,
            "next_load": None,
            "progression_decision": "no_progression",
            "progression_reason": "ingen progression for denne øvelse",
            "equipment_constraint": False,
            "recommended_next_load": None,
            "actual_possible_next_load": None,
            "source": "no_progression",
            "start_weight": start_weight,
            "step": step,
            "recommended_step": recommended_step,
            "effective_load_increment": effective_load_increment
        }

    if analysis["source"] == "session_result" and latest_result:
        session_results = ctx.get("session_results", [])
        relevant_history = get_relevant_strength_history(session_results, exercise_id, max_items=6)
        using_synthetic_single_session_history = False
        if not relevant_history and latest_result and analysis:
            relevant_history = [{
                "result": latest_result,
                "analysis": analysis,
            }]
            using_synthetic_single_session_history = True
        phase_ctx = detect_progression_phase(relevant_history, pause_days=21, min_trend_sessions=3)
        trend_ctx = summarize_strength_trend(relevant_history, window_size=3)

        target_top = parse_top_rep(latest_result.get("target_reps", ""))
        first_set_load = analysis.get("first_set_load")
        first_set_reps = analysis.get("first_set_reps")
        hit_failure = analysis.get("hit_failure", False)
        load_drop_detected = analysis.get("load_drop_detected", False)

        progression_reason = "progression holdes"
        phase = phase_ctx.get("phase")

        candidate_for_progression = bool(
            first_set_load is not None and
            target_top is not None and
            first_set_reps is not None and
            first_set_reps >= target_top
        )

        allow_progression_by_phase = False
        if phase in ("calibration", "trend"):
            allow_progression_by_phase = bool(
                candidate_for_progression and
                (
                    trend_ctx.get("repeated_success", False) or
                    using_synthetic_single_session_history
                ) and
                not trend_ctx.get("blocking_signal_present", False)
            )
        elif phase == "recalibration":
            allow_progression_by_phase = False

        constraint_ctx = evaluate_equipment_constraint(
            last_load=first_set_load,
            recommended_step=recommended_step,
            effective_load_increment=effective_load_increment,
            candidate_for_progression=allow_progression_by_phase,
        )
        equipment_constraint = constraint_ctx["equipment_constraint"]
        secondary_constraints = constraint_ctx["secondary_constraints"]
        recommended_next_load = constraint_ctx["recommended_next_load"]
        actual_possible_next_load = constraint_ctx["actual_possible_next_load"]
        jump_guard_ctx = evaluate_progression_jump_guard(
            last_load=first_set_load,
            recommended_next_load=recommended_next_load,
            actual_possible_next_load=actual_possible_next_load,
        )
        jump_guard_triggered = bool(jump_guard_ctx.get("guard_triggered"))
        jump_guard_reason = jump_guard_ctx.get("guard_reason")

        if first_set_load is None:
            next_load = start_weight
            decision = "use_start_weight"
            progression_reason = "ingen historik, bruger startvægt"
        elif progression_mode == "none":
            next_load = int(first_set_load)
            decision = "no_progression"
            progression_reason = "ingen progression for denne øvelse"
        elif hit_failure:
            next_load = int(first_set_load)
            decision = "hold"
            progression_reason = "failure registreret"
        elif load_drop_detected:
            next_load = int(first_set_load)
            decision = "hold"
            progression_reason = "load-drop mellem sæt"
        elif fatigue_score >= 2:
            next_load = int(first_set_load)
            decision = "hold"
            progression_reason = "muskeltræthed for høj til progression"
        elif candidate_for_progression and phase == "recalibration":
            next_load = int(first_set_load)
            decision = "hold"
            progression_reason = "rekalibrering efter pause"
        elif (
            candidate_for_progression and
            not trend_ctx.get("repeated_success", False) and
            not using_synthetic_single_session_history
        ):
            next_load = int(first_set_load)
            decision = "hold"
            progression_reason = "afventer gentagen succes"
        elif allow_progression_by_phase:
            if equipment_constraint:
                next_load = int(first_set_load)
                decision = "hold"
                progression_reason = "næste mulige spring er for stort"
            elif jump_guard_triggered:
                next_load = int(first_set_load)
                decision = "hold"
                progression_reason = jump_guard_reason or "konservativ progression guard"
                secondary_constraints = list(secondary_constraints or []) + ["progression_jump_guard"]
            else:
                next_load = int(actual_possible_next_load)
                decision = "increase"
                if phase == "calibration":
                    progression_reason = "gentagen succes i kalibrering"
                else:
                    progression_reason = "gentagen succes i stabil trend"

                if recent_recovery_ctx.get("multi_session_fatigue_pressure") == "high":
                    next_load = int(first_set_load)
                    decision = "hold"
                    progression_reason = (
                        "gentagen dårlig recovery over seneste check-ins "
                        "overrulede ellers positivt progressionssignal"
                    )
        else:
            next_load = int(first_set_load)
            decision = "hold"
            progression_reason = "progression holdes"

        deload_ctx = evaluate_deload_need(
            phase,
            trend_ctx,
            fatigue_score,
        )

        return {
            "ok": True,
            "exercise": exercise_id,
            "source": "session_result",
            "last_load": int(first_set_load) if first_set_load is not None else None,
            "next_load": next_load,
            "step": step,
            "recommended_step": recommended_step,
            "effective_load_increment": effective_load_increment,
            "start_weight": start_weight,
            "target_top_reps": target_top,
            "achieved_reps": first_set_reps,
            "hit_failure": hit_failure,
            "load_drop_detected": load_drop_detected,
            "fatigue_score": fatigue_score,
            "multi_session_fatigue_pressure": recent_recovery_ctx.get("multi_session_fatigue_pressure"),
            "multi_session_fatigue_reason": recent_recovery_ctx.get("multi_session_fatigue_reason"),
            "recent_recovery_checkin_count": recent_recovery_ctx.get("recent_checkin_count"),
            "recent_poor_recovery_count": recent_recovery_ctx.get("poor_recovery_count"),
            "latest_recovery_readiness_score": recent_recovery_ctx.get("latest_readiness_score"),
            "equipment_constraint": equipment_constraint,
            "secondary_constraints": secondary_constraints,
            "recommended_next_load": recommended_next_load,
            "actual_possible_next_load": actual_possible_next_load,
            "progression_decision": decision,
            "progression_reason": progression_reason,
            "progression_phase": phase_ctx.get("phase"),
            "relevant_session_count": phase_ctx.get("relevant_session_count"),
            "days_since_last_relevant_session": phase_ctx.get("days_since_last_relevant_session"),
            "trend_window_size": trend_ctx.get("window_size"),
            "trend_successful_sessions": trend_ctx.get("successful_sessions"),
            "trend_failure_sessions": trend_ctx.get("failure_sessions"),
            "trend_load_drop_sessions": trend_ctx.get("load_drop_sessions"),
            "trend_repeated_success": trend_ctx.get("repeated_success"),
            "deload_recommended": deload_ctx.get("deload_recommended"),
            "deload_reason": deload_ctx.get("deload_reason"),
            "deload_scope": deload_ctx.get("deload_scope"),
        }

    if last_entry is None:
        return {
            "ok": True,
            "exercise": exercise_id,
            "last_load": None,
            "next_load": start_weight,
            "step": step,
            "recommended_step": recommended_step,
            "effective_load_increment": effective_load_increment,
            "progression_decision": "use_start_weight",
            "progression_reason": "ingen historik, bruger startvægt",
            "equipment_constraint": False,
            "secondary_constraints": [],
            "recommended_next_load": None,
            "actual_possible_next_load": None,
            "source": "workout_entry",
            "start_weight": start_weight,
        }

    achieved = None
    try:
        achieved = int(str(last_entry.get("achieved_reps", "")).strip()) if str(last_entry.get("achieved_reps", "")).strip() else None
    except Exception:
        achieved = None

    target_top = parse_top_rep(last_entry.get("reps", ""))

    progression_reason = "progression holdes"
    decision = "hold"
    next_load = last_load

    candidate_for_progression = bool(
        progression_mode != "none" and
        last_load is not None and
        target_top is not None and
        achieved is not None and
        achieved >= target_top
    )

    constraint_ctx = evaluate_equipment_constraint(
        last_load=last_load,
        recommended_step=recommended_step,
        effective_load_increment=effective_load_increment,
        candidate_for_progression=candidate_for_progression,
    )
    equipment_constraint = constraint_ctx["equipment_constraint"]
    secondary_constraints = constraint_ctx["secondary_constraints"]
    recommended_next_load = constraint_ctx["recommended_next_load"]
    actual_possible_next_load = constraint_ctx["actual_possible_next_load"]

    if last_load is None:
        next_load = start_weight
        decision = "use_start_weight"
        progression_reason = "ingen historik, bruger startvægt"
    elif progression_mode == "none":
        next_load = last_load
        decision = "no_progression"
        progression_reason = "ingen progression for denne øvelse"
    elif fatigue_score >= 2:
        next_load = last_load
        decision = "hold"
        progression_reason = "muskeltræthed for høj til progression"
    elif candidate_for_progression:
        if equipment_constraint:
            next_load = last_load
            decision = "hold"
            progression_reason = "næste mulige spring er for stort"
        else:
            next_load = int(actual_possible_next_load)
            decision = "increase"
            progression_reason = "top af rep-interval ramt"

    return {
        "ok": True,
        "exercise": exercise_id,
        "source": "workout_entry",
        "last_load": last_load,
        "next_load": next_load,
        "step": step,
        "recommended_step": recommended_step,
        "effective_load_increment": effective_load_increment,
        "start_weight": start_weight,
        "target_top_reps": target_top,
        "achieved_reps": achieved,
        "fatigue_score": fatigue_score,
        "progression_decision": decision,
        "progression_reason": progression_reason,
        "equipment_constraint": equipment_constraint,
        "secondary_constraints": secondary_constraints,
        "recommended_next_load": recommended_next_load,
        "actual_possible_next_load": actual_possible_next_load
    }
