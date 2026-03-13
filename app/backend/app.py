from flask import Flask, jsonify, request
from pathlib import Path
from datetime import datetime, timezone, timedelta
import json
import re
import uuid
import os
from storage import get_storage_backend
import urllib.request
import urllib.error
import json

app = Flask(__name__)

AUTH_VALIDATE_URL = os.getenv("AUTH_VALIDATE_URL", "https://auth.innosocia.dk/api/auth/validate")
AUTH_COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "sovereign_session")


def get_current_auth_user():
    raw_cookie = request.headers.get("Cookie", "").strip()
    if not raw_cookie:
        return None

    req = urllib.request.Request(
        AUTH_VALIDATE_URL,
        headers={
            "Cookie": raw_cookie,
            "User-Agent": "sovereign-strength-api/1.0",
        },
        method="GET",
    )

    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 401:
            return None
        raise
    except Exception:
        raise

    if not payload or not payload.get("ok") or not payload.get("authenticated"):
        return None

    return {
        "user_id": payload.get("user_id"),
        "username": payload.get("username"),
        "role": payload.get("role"),
    }




def filter_items_for_user(items, user_id):
    out = []
    for item in (items or []):
        if not isinstance(item, dict):
            continue
        item_user_id = item.get("user_id", 1)
        if item_user_id == user_id:
            out.append(item)
    return out


def require_auth_user():
    auth_user = get_current_auth_user()
    if not auth_user or not auth_user.get("user_id"):
        return None, (jsonify({"ok": False, "error": "unauthorized"}), 401)
    return auth_user, None




DATA_DIR = Path("/var/www/sovereign-strength/data")

FILES = {
    "workouts": DATA_DIR / "workouts.json",
    "runs": DATA_DIR / "runs.json",
    "recovery": DATA_DIR / "recovery.json",
    "checkins": DATA_DIR / "checkins.json",
    "recommendations": DATA_DIR / "recommendations.json",
    "session_results": DATA_DIR / "session_results.json",
    "programs": DATA_DIR / "programs.json",
    "exercises": DATA_DIR / "exercises.json",
    "user_settings": DATA_DIR / "user_settings.json",
    "adaptation_state": DATA_DIR / "adaptation_state.json",
}

def read_json_file(path: Path):
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []

def write_json_file(path: Path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def read_json_object_file(path: Path):
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}




def _sort_user_items_desc(items, *keys):
    def _key(x):
        if not isinstance(x, dict):
            return ""
        for k in keys:
            v = x.get(k)
            if v not in (None, ""):
                return str(v)
        return ""
    return sorted(items or [], key=_key, reverse=True)

def get_storage():
    return get_storage_backend(
        data_dir=DATA_DIR,
        db_path=Path(__file__).resolve().parent / "sovereign_strength.db",
        mode=os.getenv("SOVEREIGN_STRENGTH_STORAGE", "json"),
    )

def list_user_items(file_key, user_id, sort_keys=("created_at", "date")):
    return get_storage().list_user_items(file_key, user_id, sort_keys=sort_keys)

def append_user_item(file_key, item):
    return get_storage().append_item(file_key, item)

def get_latest_user_item(file_key, user_id, sort_keys=("created_at", "date")):
    return get_storage().get_latest_user_item(file_key, user_id, sort_keys=sort_keys)

def get_user_settings_for(user_id):
    return get_storage().get_user_settings_for(user_id)

def save_user_settings_for(user_id, settings):
    return get_storage().save_user_settings_for(user_id, settings)

def list_workouts_for_user(user_id):
    return list_user_items("workouts", user_id)

def create_workout(user_id, payload):
    date = str(payload.get("date", "")).strip()
    session_type = str(payload.get("type", "")).strip()
    duration_min = payload.get("duration_min", 0)
    notes = str(payload.get("notes", "")).strip()
    program_id = str(payload.get("program_id", "")).strip()
    program_day_label = str(payload.get("program_day_label", "")).strip()
    entries = payload.get("entries", [])

    if not date:
        return None, {"ok": False, "error": "date mangler"}, 400

    if session_type not in ("styrke", "løb", "mobilitet", "andet"):
        return None, {"ok": False, "error": "ugyldig type"}, 400

    try:
        duration_min = int(duration_min)
    except Exception:
        return None, {"ok": False, "error": "duration_min skal være et tal"}, 400

    if duration_min < 0:
        return None, {"ok": False, "error": "duration_min må ikke være negativ"}, 400

    if not isinstance(entries, list):
        return None, {"ok": False, "error": "entries skal være en liste"}, 400

    clean_entries = []
    for e in entries:
        if not isinstance(e, dict):
            continue
        clean_entries.append({
            "exercise_id": str(e.get("exercise_id", "")).strip(),
            "sets": str(e.get("sets", "")).strip(),
            "reps": str(e.get("reps", "")).strip(),
            "achieved_reps": str(e.get("achieved_reps", "")).strip(),
            "load": str(e.get("load", "")).strip(),
            "notes": str(e.get("notes", "")).strip(),
        })

    item = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "date": date,
        "session_type": session_type,
        "duration_min": duration_min,
        "notes": notes,
        "program_id": program_id,
        "program_day_label": program_day_label,
        "entries": clean_entries,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    item, count = append_user_item("workouts", item)
    return item, None, count

def list_checkins_for_user(user_id):
    return list_user_items("checkins", user_id)

def get_latest_checkin_for_user(user_id):
    return get_latest_user_item("checkins", user_id)

def create_checkin(user_id, payload):
    date = str(payload.get("date", "")).strip()
    notes = str(payload.get("notes", "")).strip()
    time_budget_min = payload.get("time_budget_min", 0)

    def parse_score(name):
        value = payload.get(name, "")
        try:
            value = int(value)
        except Exception:
            raise ValueError(f"{name} skal være et tal")
        if value < 1 or value > 5:
            raise ValueError(f"{name} skal være mellem 1 og 5")
        return value

    if not date:
        return None, {"ok": False, "error": "date mangler"}, 400

    try:
        sleep_score = parse_score("sleep_score")
        energy_score = parse_score("energy_score")
        soreness_score = parse_score("soreness_score")
        time_budget_min = int(time_budget_min)
    except ValueError as e:
        return None, {"ok": False, "error": str(e)}, 400
    except Exception:
        return None, {"ok": False, "error": "ugyldige inputværdier"}, 400

    readiness_score = round((sleep_score + energy_score + (6 - soreness_score)) / 3)
    readiness_score = max(1, min(5, readiness_score))

    item = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "date": date,
        "sleep_score": sleep_score,
        "energy_score": energy_score,
        "soreness_score": soreness_score,
        "time_budget_min": time_budget_min,
        "readiness_score": readiness_score,
        "notes": notes,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    item, count = append_user_item("checkins", item)
    return item, None, count

def list_session_results_for_user(user_id):
    return list_user_items("session_results", user_id)

def create_session_result(user_id, payload):
    date = str(payload.get("date", "")).strip()
    session_type = str(payload.get("session_type", "")).strip()
    timing_state = str(payload.get("timing_state", "")).strip()
    notes = str(payload.get("notes", "")).strip()
    completed = bool(payload.get("completed", False))
    readiness_score = payload.get("readiness_score", None)
    results = payload.get("results", [])

    if not date:
        return None, {"ok": False, "error": "date mangler"}, 400
    if session_type not in ("styrke", "cardio", "restitution"):
        return None, {"ok": False, "error": "ugyldig session_type"}, 400
    if timing_state not in ("early", "on_time", "late", ""):
        return None, {"ok": False, "error": "ugyldig timing_state"}, 400
    if not isinstance(results, list):
        return None, {"ok": False, "error": "results skal være en liste"}, 400

    clean_results = []
    for r in results:
        if not isinstance(r, dict):
            continue

        raw_sets = r.get("sets", [])
        clean_sets = []
        if isinstance(raw_sets, list):
            for x in raw_sets:
                if not isinstance(x, dict):
                    continue
                reps_val = str(x.get("reps", "")).strip()
                load_val = str(x.get("load", "")).strip()
                if not reps_val and not load_val:
                    continue
                clean_sets.append({
                    "reps": reps_val,
                    "load": load_val
                })

        achieved_reps = str(r.get("achieved_reps", "")).strip()
        base_load = str(r.get("load", "")).strip()
        notes_val = str(r.get("notes", "")).strip()
        has_meaningful_data = bool(clean_sets or achieved_reps or base_load)

        if not has_meaningful_data:
            continue

        clean_results.append({
            "exercise_id": str(r.get("exercise_id", "")).strip(),
            "completed": bool(r.get("completed", False)),
            "target_reps": str(r.get("target_reps", "")).strip(),
            "achieved_reps": achieved_reps,
            "load": base_load,
            "sets": clean_sets,
            "hit_failure": bool(r.get("hit_failure", False)),
            "notes": notes_val
        })

    if not clean_results:
        return None, {"ok": False, "error": "ingen træningsdata at gemme"}, 400

    item = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "date": date,
        "session_type": session_type,
        "timing_state": timing_state,
        "readiness_score": readiness_score,
        "completed": completed,
        "notes": notes,
        "results": clean_results,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    item["summary"] = build_session_summary(item)

    item, count = append_user_item("session_results", item)
    return item, None, count

def get_exercise_config(exercises, exercise_id):
    for ex in (exercises or []):
        if str(ex.get("id", "")).strip() == str(exercise_id).strip():
            return ex
    return {}


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


def choose_best_substitute(original_exercise_id, candidate_ids, exercise_map, available_equipment):
    original_meta = exercise_map.get(original_exercise_id, {}) or {}
    original_pattern = str(original_meta.get("movement_pattern", "")).strip()
    try:
        original_tier = int(original_meta.get("difficulty_tier", 1) or 1)
    except Exception:
        original_tier = 1

    ranked = []

    for candidate_id in (candidate_ids or []):
        candidate_meta = exercise_map.get(candidate_id, {}) or {}
        if not candidate_meta:
            continue

        equipment_type = str(candidate_meta.get("equipment_type", "")).strip()
        allowed = (not equipment_type) or bool(available_equipment.get(equipment_type, True))
        if not allowed:
            continue

        candidate_pattern = str(candidate_meta.get("movement_pattern", "")).strip()
        try:
            candidate_tier = int(candidate_meta.get("difficulty_tier", 1) or 1)
        except Exception:
            candidate_tier = 1

        same_pattern = 1 if original_pattern and candidate_pattern == original_pattern else 0
        tier_distance = abs(candidate_tier - original_tier)

        ranked.append((
            -same_pattern,      # same pattern first
            tier_distance,      # closest difficulty next
            candidate_tier,     # then easier before harder if equal distance
            str(candidate_id),  # stable tie-break
            candidate_id
        ))

    if not ranked:
        return None

    ranked.sort()
    return ranked[0][-1]





def days_between_iso_dates(date_a, date_b):
    from datetime import datetime
    try:
        a = datetime.fromisoformat(str(date_a))
        b = datetime.fromisoformat(str(date_b))
        return abs((a - b).days)
    except Exception:
        return None


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


def session_has_failure(session):
    if not session:
        return False
    for r in session.get("results", []):
        if r.get("hit_failure"):
            return True
    return False


def count_load_drop_exercises(session):
    if not session:
        return 0
    count = 0
    for r in session.get("results", []):
        sets = r.get("sets", [])
        if isinstance(sets, list) and len(sets) >= 2:
            try:
                first = float(str(sets[0].get("load", "")).replace("kg", "").strip())
                for s in sets[1:]:
                    val = float(str(s.get("load", "")).replace("kg", "").strip())
                    if val < first:
                        count += 1
                        break
            except Exception:
                pass
    return count


def compare_dates(d1, d2):
    from datetime import datetime
    try:
        a = datetime.fromisoformat(str(d1))
        b = datetime.fromisoformat(str(d2))
        if a < b:
            return -1
        if a > b:
            return 1
        return 0
    except Exception:
        return 0

def find_latest_session_result_for_exercise(session_results, exercise_id):
    for session in reversed(session_results):
        for result in reversed(session.get("results", [])):
            if str(result.get("exercise_id", "")).strip() == exercise_id:
                return result, session
    return None, None







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


def find_latest_strength_workout(workouts):
    for workout in reversed(workouts or []):
        if str(workout.get("session_type", "")).strip() == "styrke":
            return workout

        entries = workout.get("entries", [])
        if isinstance(entries, list) and entries:
            return workout
    return None




def find_latest_session_by_type(session_results, session_type):
    for session in reversed(session_results or []):
        if str(session.get("session_type", "")).strip() == session_type:
            return session
    return None


def compute_fatigue_score_from_latest_strength(session_results, workouts):
    latest_strength_session = find_latest_session_by_type(session_results, "styrke")
    latest_strength_failed = session_has_failure(latest_strength_session)
    latest_strength_load_drop_count = count_load_drop_exercises(latest_strength_session)
    latest_strength_completed = None if latest_strength_session is None else bool(latest_strength_session.get("completed", False))

    latest_strength_workout = find_latest_strength_workout(workouts)
    days_since_last_strength = None
    if latest_strength_workout and latest_strength_session:
        try:
            session_date = str(latest_strength_session.get("date", "")).strip()
            workout_date = str(latest_strength_workout.get("date", "")).strip()
            if session_date and workout_date:
                days_since_last_strength = days_between_iso_dates(session_date, workout_date)
        except Exception:
            days_since_last_strength = None

    fatigue_score = (
        (3 if latest_strength_failed else 0)
        + (2 * latest_strength_load_drop_count)
        + (1 if latest_strength_completed is False else 0)
        + (1 if days_since_last_strength is not None and days_since_last_strength < 2 else 0)
    )

    return {
        "fatigue_score": fatigue_score,
        "latest_strength_failed": latest_strength_failed,
        "latest_strength_load_drop_count": latest_strength_load_drop_count,
        "latest_strength_completed": latest_strength_completed,
        "days_since_last_strength_for_fatigue": days_since_last_strength,
    }





def build_restitution_plan(time_budget_min):
    try:
        time_budget_min = int(time_budget_min or 0)
    except Exception:
        time_budget_min = 20

    if time_budget_min <= 0:
        time_budget_min = 20

    if time_budget_min <= 20:
        duration = "20 sek"
        rounds = 2
    elif time_budget_min <= 30:
        duration = "30 sek"
        rounds = 2
    else:
        duration = "40 sek"
        rounds = 3

    return [
        {
            "exercise_id": "bird_dog",
            "sets": rounds,
            "target_reps": duration,
            "target_load": None,
            "progression_decision": "no_progression",
            "progression_reason": "restitution prioriteres",
            "recommended_next_load": None,
            "actual_possible_next_load": None,
            "equipment_constraint": False,
            "secondary_constraints": [],
            "next_target_reps": None,
            "substituted_from": None,
        },
        {
            "exercise_id": "dead_bug",
            "sets": rounds,
            "target_reps": "8/side",
            "target_load": None,
            "progression_decision": "no_progression",
            "progression_reason": "restitution prioriteres",
            "recommended_next_load": None,
            "actual_possible_next_load": None,
            "equipment_constraint": False,
            "secondary_constraints": [],
            "next_target_reps": None,
            "substituted_from": None,
        },
        {
            "exercise_id": "plank",
            "sets": rounds,
            "target_reps": duration,
            "target_load": None,
            "progression_decision": "no_progression",
            "progression_reason": "restitution prioriteres",
            "recommended_next_load": None,
            "actual_possible_next_load": None,
            "equipment_constraint": False,
            "secondary_constraints": [],
            "next_target_reps": None,
            "substituted_from": None,
        },
    ]


def build_strength_plan(programs, exercises, latest_strength, time_budget_min, fatigue_score, user_settings=None):
    program = None
    for p in programs:
        if p.get("id") == "base_strength_a":
            program = p
            break

    if not program:
        return {
            "ok": True,
            "template_id": None,
            "plan_entries": [],
            "plan_variant": "default",
            "reason": "missing_program_template"
        }

    latest_day = str(latest_strength.get("program_day_label", "")).strip() if latest_strength else ""
    next_day_label = "Dag A"
    if latest_day == "Dag A":
        next_day_label = "Dag B"
    elif latest_day == "Dag B":
        next_day_label = "Dag A"

    selected_day = None
    for day in program.get("days", []):
        if day.get("label") == next_day_label:
            selected_day = day
            break

    if not selected_day:
        return {
            "ok": True,
            "template_id": None,
            "plan_entries": [],
            "plan_variant": "default",
            "reason": "missing_program_day"
        }

    template_id = f"strength_{next_day_label.lower().replace(' ', '_')}"
    exercise_map = {e.get("id"): e for e in exercises}

    selected_exercises = list(selected_day.get("exercises", []))
    plan_variant = "full"

    if time_budget_min <= 20:
        selected_exercises = selected_exercises[:2]
        plan_variant = "short_20"
    elif fatigue_score >= 2:
        selected_exercises = selected_exercises[:3]
        plan_variant = "light_strength"
    elif time_budget_min <= 30:
        selected_exercises = selected_exercises[:3]
        plan_variant = "short_30"

    if fatigue_score >= 2:
        reason = "moderat muskeltræthed, let styrkepas prioriteres"
    else:
        reason = "styrke prioriteres"

    if not isinstance(user_settings, dict):
        user_settings = {}

    available_equipment = user_settings.get("available_equipment", {})
    if not isinstance(available_equipment, dict):
        available_equipment = {}

    substitution_map = {
        "squat": ["lunges", "split_squat", "step_ups", "single_leg_sit_to_stand"],
        "bench_press": ["push_ups", "incline_push_ups", "diamond_push_ups"],
        "overhead_press": ["pike_push_ups", "push_ups", "incline_push_ups"],
        "barbell_row": ["dumbbell_row", "reverse_snow_angels", "superman_hold"],
        "romanian_deadlift": ["glute_bridge", "single_leg_glute_bridge", "hamstring_walkouts", "hip_hinge_bw"],
    }

    filtered_exercises = []
    excluded_due_to_equipment = []
    substitutions_used = []

    for ex in selected_exercises:
        exercise_id = ex.get("exercise_id", "")
        meta = exercise_map.get(exercise_id, {}) or {}
        equipment_type = str(meta.get("equipment_type", "")).strip()

        if not equipment_type:
            filtered_exercises.append(ex)
            continue

        allowed = bool(available_equipment.get(equipment_type, True))
        if allowed:
            filtered_exercises.append(ex)
            continue

        substitute_candidates = substitution_map.get(exercise_id, [])
        if isinstance(substitute_candidates, str):
            substitute_candidates = [substitute_candidates]

        chosen_substitute_id = choose_best_substitute(
            original_exercise_id=exercise_id,
            candidate_ids=substitute_candidates,
            exercise_map=exercise_map,
            available_equipment=available_equipment
        )

        if chosen_substitute_id:
            substituted = dict(ex)
            substituted["exercise_id"] = chosen_substitute_id
            substituted["_substituted_from"] = exercise_id
            filtered_exercises.append(substituted)
            substitutions_used.append({
                "from_exercise_id": exercise_id,
                "to_exercise_id": chosen_substitute_id,
                "missing_equipment_type": equipment_type
            })
        else:
            excluded_due_to_equipment.append({
                "exercise_id": exercise_id,
                "equipment_type": equipment_type
            })

    selected_exercises = filtered_exercises

    if not selected_exercises:
        excluded_types = sorted({x.get("equipment_type", "") for x in excluded_due_to_equipment if x.get("equipment_type")})
        missing_txt = ", ".join(excluded_types) if excluded_types else "nødvendigt udstyr"
        return {
            "ok": True,
            "template_id": template_id,
            "plan_entries": [],
            "plan_variant": plan_variant,
            "reason": f"ingen egnede styrkeøvelser med nuværende udstyr ({missing_txt})",
            "excluded_due_to_equipment": excluded_due_to_equipment,
            "substitutions_used": substitutions_used
        }

    if substitutions_used:
        reason = f"{reason} · øvelser erstattet pga. udstyr: {len(substitutions_used)}"

    if excluded_due_to_equipment:
        excluded_types = sorted({x.get("equipment_type", "") for x in excluded_due_to_equipment if x.get("equipment_type")})
        if excluded_types:
            reason = f"{reason} · filtreret efter udstyr: {', '.join(excluded_types)}"

    plan_entries = []
    for ex in selected_exercises:
        exercise_id = ex.get("exercise_id", "")
        sets = ex.get("sets", "")
        reps = ex.get("reps", "")

        meta = exercise_map.get(exercise_id, {})
        progression = compute_progression_for_exercise(exercise_id)
        next_load = progression.get("next_load")

        target_load = (
            f"{next_load} kg"
            if next_load not in (None, "", 0) and meta.get("default_unit") == "kg"
            else None
        )

        progression_reason = progression.get("progression_reason", "") or ""

        plan_entries.append({
            "exercise_id": exercise_id,
            "sets": sets,
            "target_reps": reps,
            "target_load": target_load,
            "progression_decision": progression.get("progression_decision", "hold"),
            "progression_reason": progression_reason,
            "equipment_constraint": progression.get("equipment_constraint", False),
            "recommended_next_load": progression.get("recommended_next_load"),
            "actual_possible_next_load": progression.get("actual_possible_next_load"),
            "next_target_reps": progression.get("next_target_reps"),
            "secondary_constraints": progression.get("secondary_constraints", []),
            "substituted_from": ex.get("_substituted_from"),
        })

    return {
        "ok": True,
        "template_id": template_id,
        "plan_entries": plan_entries,
        "plan_variant": plan_variant,
        "reason": reason,
        "excluded_due_to_equipment": excluded_due_to_equipment,
        "substitutions_used": substitutions_used
    }


def build_progression_context(exercise_id):
    workouts = read_json_file(FILES["workouts"])
    exercises = read_json_file(FILES["exercises"])
    user_settings = get_user_settings_for(auth_user.get("user_id"))

    session_results = read_json_file(FILES["session_results"])

    step = None
    start_weight = None
    for ex in exercises:
        if ex.get("id") == exercise_id:
            exercise = ex
            step = ex.get("progression_step")
            start_weight = ex.get("start_weight")
            recommended_step = get_effective_recommended_step(exercise)
            effective_load_increment = get_effective_load_increment(exercise, user_settings)

            break

    latest_result, latest_session = find_latest_session_result_for_exercise(session_results, exercise_id)
    analysis = analyze_session_result_for_progression(latest_result)
    fatigue_ctx = compute_fatigue_score_from_latest_strength(session_results, workouts)
    fatigue_score = fatigue_ctx.get("fatigue_score", 0)

    last_load = None
    last_entry = None

    for w in reversed(workouts):
        for e in w.get("entries", []):
            if e.get("exercise_id") == exercise_id:
                load = str(e.get("load", "")).strip().replace("kg","").strip()
                try:
                    last_load = int(float(load))
                except Exception:
                    last_load = None
                last_entry = e
                break
        if last_entry:
            break

    return {
        "workouts": workouts,
        "session_results": session_results,
        "step": step,
        "start_weight": start_weight,
        "exercise": exercise,
        "user_settings": user_settings,
        "recommended_step": recommended_step,
        "effective_load_increment": effective_load_increment,
        "latest_result": latest_result,
        "latest_session": latest_session,
        "analysis": analysis,
        "fatigue_score": fatigue_score,
        "last_load": last_load,
        "last_entry": last_entry,
    }




def decide_progression_from_context(exercise_id, ctx):
    step = ctx["step"]
    start_weight = ctx["start_weight"]
    latest_result = ctx["latest_result"]
    analysis = ctx["analysis"]
    fatigue_score = ctx["fatigue_score"]
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
        target_top = parse_top_rep(latest_result.get("target_reps", ""))
        first_set_load = analysis.get("first_set_load")
        first_set_reps = analysis.get("first_set_reps")
        hit_failure = analysis.get("hit_failure", False)
        load_drop_detected = analysis.get("load_drop_detected", False)

        equipment_constraint = False
        recommended_next_load = None
        actual_possible_next_load = None
        progression_reason = "progression holdes"
        secondary_constraints = []

        candidate_for_progression = bool(
            first_set_load is not None and
            target_top is not None and
            first_set_reps is not None and
            first_set_reps >= target_top
        )

        if candidate_for_progression:
            recommended_next_load = float(first_set_load) + recommended_step
            actual_possible_next_load = compute_next_possible_load(float(first_set_load), effective_load_increment)

            ideal_jump = recommended_next_load - float(first_set_load)
            actual_jump = actual_possible_next_load - float(first_set_load)

            if actual_jump > ideal_jump:
                equipment_constraint = True
                secondary_constraints.append("equipment_constraint")

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
        elif candidate_for_progression:
            if equipment_constraint:
                next_load = int(first_set_load)
                decision = "hold"
                progression_reason = "næste mulige spring er for stort"
            else:
                next_load = int(actual_possible_next_load)
                decision = "increase"
                progression_reason = "top af rep-interval ramt"
        else:
            next_load = int(first_set_load)
            decision = "hold"
            progression_reason = "progression holdes"

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
            "set_analysis": analysis,
            "progression_decision": decision,
            "progression_reason": progression_reason,
            "equipment_constraint": equipment_constraint,
            "secondary_constraints": secondary_constraints,
            "recommended_next_load": recommended_next_load,
            "actual_possible_next_load": actual_possible_next_load
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
            "start_weight": start_weight,
            "progression_decision": "use_start_weight",
            "progression_reason": "ingen historik, bruger startvægt",
            "equipment_constraint": False,
            "recommended_next_load": None,
            "actual_possible_next_load": None,
            "source": "fallback_start_weight"
        }

    target_top = parse_top_rep(last_entry.get("reps", ""))
    achieved = parse_top_rep(last_entry.get("achieved_reps", ""))

    should_increase = bool(
        progression_mode != "none" and
        last_load is not None and
        target_top is not None and
        achieved is not None and
        achieved >= target_top and
        fatigue_score < 2
    )

    equipment_constraint = False
    recommended_next_load = None
    actual_possible_next_load = None
    progression_reason = "progression holdes"
    secondary_constraints = []
    decision = "hold"
    next_load = last_load

    candidate_for_progression = bool(
        progression_mode != "none" and
        last_load is not None and
        target_top is not None and
        achieved is not None and
        achieved >= target_top
    )

    if candidate_for_progression:
        recommended_next_load = float(last_load) + recommended_step
        actual_possible_next_load = compute_next_possible_load(float(last_load), effective_load_increment)

        ideal_jump = recommended_next_load - float(last_load)
        actual_jump = actual_possible_next_load - float(last_load)

        if actual_jump > ideal_jump:
            equipment_constraint = True
            secondary_constraints.append("equipment_constraint")

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


def compute_progression_for_exercise(exercise_id):
    ctx = build_progression_context(exercise_id)
    return decide_progression_from_context(exercise_id, ctx)





@app.get("/api/health")
def api_health():
    return jsonify({
        "ok": True,
        "service": "sovereign-strength-api",
        "status": "healthy"
    })

@app.get("/api/auth/whoami")
def auth_whoami():
    auth_user = get_current_auth_user()
    if not auth_user:
        return jsonify({
            "ok": False,
            "authenticated": False,
            "user": None
        }), 401

    return jsonify({
        "ok": True,
        "authenticated": True,
        "user": auth_user
    })




@app.get("/api/debug/exercise-config/<exercise_id>")
def debug_exercise_config(exercise_id):
    auth_user, auth_err = require_auth_user()
    if auth_err:
        return auth_err

    exercises = read_json_file(FILES["exercises"])
    user_settings = get_user_settings_for(auth_user.get("user_id"))
    exercise = get_exercise_config(exercises, exercise_id)

    return jsonify({
        "ok": True,
        "exercise_id": exercise_id,
        "exercise": exercise,
        "recommended_step": get_effective_recommended_step(exercise),
        "effective_load_increment": get_effective_load_increment(exercise, user_settings),
        "user_settings": user_settings
    })

@app.get("/api/progression/<exercise_id>")
def progression(exercise_id):
    auth_user, auth_err = require_auth_user()
    if auth_err:
        return auth_err
    return jsonify(compute_progression_for_exercise(exercise_id))





@app.get("/api/today-plan")
def get_today_plan():
    auth_user, auth_err = require_auth_user()
    if auth_err:
        return auth_err
    checkins = read_json_file(FILES["checkins"])
    checkins = filter_items_for_user(checkins, auth_user.get("user_id"))
    workouts = read_json_file(FILES["workouts"])
    workouts = filter_items_for_user(workouts, auth_user.get("user_id"))
    programs = read_json_file(FILES["programs"])
    exercises = read_json_file(FILES["exercises"])

    if not checkins:
        return jsonify({
            "ok": True,
            "item": None,
            "reason": "no_checkin"
        })

    latest_checkin = sorted(checkins, key=lambda x: str(x.get("created_at", x.get("date", ""))), reverse=True)[0]
    readiness_score = int(latest_checkin.get("readiness_score", 0))
    time_budget_min = int(latest_checkin.get("time_budget_min", 45) or 45)
    checkin_date = latest_checkin.get("date", "")

    latest_strength = find_latest_strength_workout(workouts)
    days_since_last_strength = None
    if latest_strength:
        days_since_last_strength = days_between_iso_dates(checkin_date, latest_strength.get("date", ""))

    session_results = read_json_file(FILES["session_results"])
    session_results = filter_items_for_user(session_results, auth_user.get("user_id"))
    recommendations = read_json_file(FILES["recommendations"])
    previous_recommendation = recommendations[-1] if recommendations else None

    latest_strength_session = find_latest_session_by_type(session_results, "styrke")
    latest_strength_failed = session_has_failure(latest_strength_session)
    latest_strength_load_drop_count = count_load_drop_exercises(latest_strength_session)
    latest_strength_completed = None if latest_strength_session is None else bool(latest_strength_session.get("completed", False))
    fatigue_score = (
        (3 if latest_strength_failed else 0)
        + (2 * latest_strength_load_drop_count)
        + (1 if latest_strength_completed is False else 0)
        + (1 if days_since_last_strength is not None and days_since_last_strength < 2 else 0)
    )


    

    # fatigue-based session override
    fatigue_session_override = None

    if fatigue_score >= 6:
        fatigue_session_override = "restitution"

    timing_state = "on_time"
    session_type = None
    template_id = None
    reason = ""
    plan_variant = "default"
    plan_entries = []

    if previous_recommendation:
        prev_date = previous_recommendation.get("recommended_for", "")
        cmp = compare_dates(checkin_date, prev_date)
        if cmp == -1:
            timing_state = "early"
        elif cmp == 1:
            timing_state = "late"
        else:
            timing_state = "on_time"

    if readiness_score <= 3:
        session_type = "restitution"
        template_id = "restitution_easy"
        reason = "lav readiness"
        plan_variant = "default"


    # meget enkel første beslutningsmotor
    if readiness_score <= 3:
        session_type = "restitution"
        template_id = "restitution_easy"
        reason = "lav readiness"
        plan_variant = "default"

        plan_entries = build_restitution_plan(time_budget_min)
    elif timing_state == "early":
        session_type = "cardio"
        template_id = "cardio_easy"
        reason = "tidligt check-in, derfor vælges cardio frem for styrke"
        plan_variant = "default"

        plan_entries = build_cardio_plan(time_budget_min)
    elif fatigue_score >= 6:
        session_type = "restitution"
        template_id = "restitution_easy"
        reason = "høj fatigue, restitution prioriteres"
        plan_variant = "default"

        if time_budget_min <= 20:
            plan_entries = [
                {
                    "exercise_id": "restitution_walk",
                    "sets": 1,
                    "target_reps": "20 min rolig gang",
                    "target_load": None,
                    "progression_decision": "no_progression"
                }
            ]
        elif time_budget_min <= 30:
            plan_entries = [
                {
                    "exercise_id": "restitution_walk",
                    "sets": 1,
                    "target_reps": "20-30 min rolig gang",
                    "target_load": None,
                    "progression_decision": "no_progression"
                },
                {
                    "exercise_id": "mobility",
                    "sets": 1,
                    "target_reps": "10 min mobilitet",
                    "target_load": None,
                    "progression_decision": "no_progression"
                }
            ]
        else:
            plan_entries = [
                {
                    "exercise_id": "restitution_walk",
                    "sets": 1,
                    "target_reps": "30 min rolig gang",
                    "target_load": None,
                    "progression_decision": "no_progression"
                },
                {
                    "exercise_id": "mobility",
                    "sets": 1,
                    "target_reps": "10-15 min mobilitet",
                    "target_load": None,
                    "progression_decision": "no_progression"
                }
            ]

    elif fatigue_score >= 4:
        session_type = "cardio"
        template_id = "cardio_easy"
        reason = "høj fatigue, cardio prioriteres"
        plan_variant = "default"

        if time_budget_min <= 20:
            plan_entries = [
                {
                    "exercise_id": "cardio_easy",
                    "sets": 1,
                    "target_reps": "20 min rolig gang/løb",
                    "target_load": None,
                    "progression_decision": "no_progression"
                }
            ]
        elif time_budget_min <= 30:
            plan_entries = [
                {
                    "exercise_id": "cardio_easy",
                    "sets": 1,
                    "target_reps": "30 min rolig cardio",
                    "target_load": None,
                    "progression_decision": "no_progression"
                }
            ]
        else:
            plan_entries = [
                {
                    "exercise_id": "cardio_intervals",
                    "sets": 1,
                    "target_reps": "5 min gang + 10x(1 min rask + 1 min rolig) + 5 min nedkøling",
                    "target_load": None,
                    "progression_decision": "no_progression"
                }
            ]
    else:
        user_settings = get_user_settings_for(auth_user.get("user_id"))
        strength_ctx = build_strength_plan(
            programs=programs,
            exercises=exercises,
            latest_strength=latest_strength,
            time_budget_min=time_budget_min,
            fatigue_score=fatigue_score,
            user_settings=user_settings,
        )

        session_type = "styrke"
        template_id = strength_ctx.get("template_id")
        plan_entries = strength_ctx.get("plan_entries", [])
        plan_variant = strength_ctx.get("plan_variant", "default")
        reason = strength_ctx.get("reason", "styrke prioriteres")

    recommended_for = checkin_date

    item = {
        "checkin_id": latest_checkin.get("id"),
        "date": checkin_date,
        "recommended_for": recommended_for,
        "decision_mode": "fatigue_primary_v1",
        "timing_state": timing_state,
        "previous_recommended_for": previous_recommendation.get("recommended_for") if previous_recommendation else None,
        "readiness_score": readiness_score,
        "time_budget_min": time_budget_min,
        "session_type": session_type,
        "latest_strength_failed": latest_strength_failed,
        "latest_strength_load_drop_count": latest_strength_load_drop_count,
        "latest_strength_completed": latest_strength_completed,
        "fatigue_score": fatigue_score,
        "template_id": template_id,
        "reason": reason,
        "days_since_last_strength": days_since_last_strength,
        "plan_variant": plan_variant if session_type in ("styrke", "restitution", "cardio") else "default",
        "entries": plan_entries
    }

    return jsonify({
        "ok": True,
        "item": item
    })




@app.get("/api/user-settings")
def get_user_settings():
    auth_user, auth_err = require_auth_user()
    if auth_err:
        return auth_err

    current = get_user_settings_for(auth_user.get("user_id"))
    return jsonify({"ok": True, "item": current})

@app.post("/api/user-settings")
def post_user_settings():
    auth_user, auth_err = require_auth_user()
    if auth_err:
        return auth_err

    payload = request.get_json(silent=True) or {}
    current = get_user_settings_for(auth_user.get("user_id"))

    equipment_increments = payload.get("equipment_increments", current.get("equipment_increments", {}))
    available_equipment = payload.get("available_equipment", current.get("available_equipment", {}))

    item = {
        "user_id": auth_user.get("user_id"),
        "equipment_increments": equipment_increments if isinstance(equipment_increments, dict) else {},
        "available_equipment": available_equipment if isinstance(available_equipment, dict) else {},
    }

    item = save_user_settings_for(auth_user.get("user_id"), item)
    return jsonify({"ok": True, "item": item})





def _safe_iso_date(value):
    s = str(value or "").strip()
    if not s:
        return None
    try:
        return datetime.fromisoformat(s[:10]).date()
    except Exception:
        return None

def compute_session_load(summary):
    if not isinstance(summary, dict):
        summary = {}

    try:
        volume = float(summary.get("estimated_volume", 0) or 0)
    except Exception:
        volume = 0.0

    try:
        tut = float(summary.get("total_time_under_tension_sec", 0) or 0)
    except Exception:
        tut = 0.0

    try:
        failures = int(summary.get("hit_failure_count", 0) or 0)
    except Exception:
        failures = 0

    try:
        sets = float(summary.get("total_sets", 0) or 0)
    except Exception:
        sets = 0.0

    load = (
        (volume / 100.0)
        + (tut / 60.0)
        + (failures * 5.0)
        + (sets * 0.5)
    )

    return round(load, 2)

def build_daily_load_map(session_results, user_id=None):
    daily = {}

    for item in session_results or []:
        if not isinstance(item, dict):
            continue

        if user_id is not None and str(item.get("user_id")) != str(user_id):
            continue

        d = _safe_iso_date(item.get("date"))
        if not d:
            continue

        summary = item.get("summary")
        if not isinstance(summary, dict):
            summary = build_session_summary(item)

        load = compute_session_load(summary)
        key = d.isoformat()
        daily[key] = round(daily.get(key, 0.0) + load, 2)

    return daily

def compute_load_metrics(session_results, user_id=None):
    daily = build_daily_load_map(session_results, user_id=user_id)

    today = datetime.now(timezone.utc).date()
    acute_start = today - timedelta(days=6)
    chronic_start = today - timedelta(days=27)

    acute = 0.0
    chronic = 0.0

    for key, value in daily.items():
        d = _safe_iso_date(key)
        if not d:
            continue

        if acute_start <= d <= today:
            acute += float(value or 0)

        if chronic_start <= d <= today:
            chronic += float(value or 0)

    today_load = float(daily.get(today.isoformat(), 0.0) or 0.0)
    ratio = acute / max(chronic / 4.0, 1.0)

    if ratio < 0.8:
        status = "underloaded"
    elif ratio <= 1.3:
        status = "balanced"
    elif ratio <= 1.5:
        status = "elevated"
    else:
        status = "spiking"

    return {
        "today_load": round(today_load, 2),
        "acute_7d_load": round(acute, 2),
        "chronic_28d_load": round(chronic, 2),
        "load_ratio": round(ratio, 2),
        "load_status": status,
        "daily_load_map": daily
    }





def _parse_numeric_token(value):
    s = str(value or "").strip()
    if not s:
        return 0.0
    matches = re.findall(r'\d+(?:[.,]\d+)?', s)
    if not matches:
        return 0.0
    nums = []
    for m in matches:
        try:
            nums.append(float(m.replace(",", ".")))
        except Exception:
            pass
    if not nums:
        return 0.0
    return max(nums)

def _safe_div(num, den):
    try:
        num = float(num)
        den = float(den)
        if den == 0:
            return 0.0
        return num / den
    except Exception:
        return 0.0

def _normalize_rep_text(value):
    return str(value or "").strip().lower()

def _extract_target_top_value(value):
    return _parse_numeric_token(value)

def _did_hit_top_range(result_item):
    if not isinstance(result_item, dict):
        return False

    target = _extract_target_top_value(result_item.get("target_reps", ""))
    achieved = _extract_target_top_value(result_item.get("achieved_reps", ""))

    if target <= 0 or achieved <= 0:
        return False

    return achieved >= target

def _result_effective_value(result_item):
    if not isinstance(result_item, dict):
        return 0.0

    load_val = _safe_float(result_item.get("load", "0"))
    if load_val > 0:
        return load_val

    return _extract_target_top_value(result_item.get("achieved_reps", ""))

def _infer_exercise_trend(result_items):
    cleaned = [x for x in result_items if isinstance(x, dict)]
    if len(cleaned) < 2:
        return "insufficient_data"

    recent = cleaned[-3:]
    values = [_result_effective_value(x) for x in recent]
    values = [v for v in values if v > 0]

    if len(values) < 2:
        return "insufficient_data"

    if values[-1] > values[0]:
        return "progressing"

    if values[-1] < values[0]:
        return "regressing"

    return "stable"

def _infer_recommended_action(completion_rate, failure_rate, top_range_hits, trend, stagnation_flag):
    if failure_rate >= 0.5:
        return "simplify"

    if stagnation_flag and failure_rate > 0.0:
        return "hold"

    if completion_rate < 0.7:
        return "simplify"

    if trend == "regressing":
        return "hold"

    if top_range_hits >= 3 and failure_rate <= 0.2:
        return "increase_load"

    if top_range_hits >= 2 and failure_rate == 0:
        return "increase_reps"

    if trend == "progressing" and completion_rate >= 0.8:
        return "increase_reps"

    return "hold"

def _infer_confidence(sessions, completion_rate, failure_rate):
    session_factor = min(float(sessions) / 6.0, 1.0)
    stability_factor = max(0.0, min(completion_rate, 1.0))
    failure_penalty = max(0.0, min(failure_rate, 1.0))

    confidence = (0.5 * session_factor) + (0.4 * stability_factor) + (0.1 * (1.0 - failure_penalty))
    return round(max(0.0, min(confidence, 1.0)), 2)

def build_exercise_profiles(user_id, max_sessions_per_exercise=8):
    user_id = str(user_id)

    live_data_path = Path("/var/www/sovereign-strength/data/session_results.json")
    if live_data_path.exists():
        try:
            raw_items = json.loads(live_data_path.read_text(encoding="utf-8"))
            if not isinstance(raw_items, list):
                raw_items = []
        except Exception:
            raw_items = []
        session_items = [x for x in raw_items if isinstance(x, dict) and str(x.get("user_id")) == user_id]
    else:
        session_items = list_session_results_for_user(user_id)

    session_items = sorted(
        session_items,
        key=lambda x: str(x.get("created_at", x.get("date", "")))
    )

    grouped = {}

    for session in session_items:
        results = session.get("results", [])
        if not isinstance(results, list):
            continue

        for result in results:
            if not isinstance(result, dict):
                continue

            exercise_id = str(result.get("exercise_id", "")).strip()
            if not exercise_id:
                continue

            grouped.setdefault(exercise_id, []).append({
                "session_date": session.get("date", ""),
                "created_at": session.get("created_at", ""),
                "completed": bool(result.get("completed", False)),
                "hit_failure": bool(result.get("hit_failure", False)),
                "target_reps": result.get("target_reps", ""),
                "achieved_reps": result.get("achieved_reps", ""),
                "load": result.get("load", ""),
                "sets": result.get("sets", []),
                "raw": result,
            })

    profiles = {}

    for exercise_id, items in grouped.items():
        relevant = items[-max_sessions_per_exercise:]
        sessions = len(relevant)

        completed_count = sum(1 for x in relevant if x.get("completed"))
        failure_count = sum(1 for x in relevant if x.get("hit_failure"))
        top_range_hits = sum(1 for x in relevant if _did_hit_top_range(x))

        completion_rate = round(_safe_div(completed_count, sessions), 2)
        failure_rate = round(_safe_div(failure_count, sessions), 2)

        trend = _infer_exercise_trend(relevant)

        stagnation_flag = bool(
            sessions >= 4
            and top_range_hits <= 1
            and trend not in ("progressing",)
        )

        recommended_action = _infer_recommended_action(
            completion_rate=completion_rate,
            failure_rate=failure_rate,
            top_range_hits=top_range_hits,
            trend=trend,
            stagnation_flag=stagnation_flag,
        )

        confidence = _infer_confidence(
            sessions=sessions,
            completion_rate=completion_rate,
            failure_rate=failure_rate,
        )

        profiles[exercise_id] = {
            "sessions": sessions,
            "completion_rate": completion_rate,
            "failure_rate": failure_rate,
            "top_range_hits": top_range_hits,
            "stagnation_flag": stagnation_flag,
            "trend": trend,
            "recommended_action": recommended_action,
            "confidence": confidence,
        }

    return profiles


def get_adaptation_state():
    raw = read_json_file(FILES["adaptation_state"])
    if isinstance(raw, dict) and isinstance(raw.get("users"), dict):
        return raw
    return {"users": {}}

def save_adaptation_state(state):
    if not isinstance(state, dict):
        state = {"users": {}}
    if not isinstance(state.get("users"), dict):
        state["users"] = {}
    write_json_file(FILES["adaptation_state"], state)
    return state

def get_adaptation_state_for(user_id):
    state = get_adaptation_state()
    users = state.get("users", {})
    item = users.get(str(user_id), {})
    return item if isinstance(item, dict) else {}

def update_adaptation_state(user_id):
    user_id = str(user_id)

    live_data_path = Path("/var/www/sovereign-strength/data/session_results.json")
    if live_data_path.exists():
        try:
            raw_items = json.loads(live_data_path.read_text(encoding="utf-8"))
            if not isinstance(raw_items, list):
                raw_items = []
        except Exception:
            raw_items = []
        items = [x for x in raw_items if isinstance(x, dict) and str(x.get("user_id")) == user_id]
    else:
        items = list_session_results_for_user(user_id)

    load_metrics = compute_load_metrics(items, user_id=user_id)
    exercise_profiles = build_exercise_profiles(user_id)

    state = get_adaptation_state()
    users = state.setdefault("users", {})
    current = users.get(user_id, {})
    if not isinstance(current, dict):
        current = {}

    current["user_id"] = user_id
    current["updated_at"] = datetime.now(timezone.utc).isoformat()
    current["load_metrics"] = {
        "today_load": load_metrics.get("today_load", 0),
        "acute_7d_load": load_metrics.get("acute_7d_load", 0),
        "chronic_28d_load": load_metrics.get("chronic_28d_load", 0),
        "load_ratio": load_metrics.get("load_ratio", 0),
        "load_status": load_metrics.get("load_status", "underloaded"),
        "daily_load_map": load_metrics.get("daily_load_map", {}),
    }
    current["exercise_profiles"] = exercise_profiles

    users[user_id] = current
    save_adaptation_state(state)
    return current


@app.get("/api/session-results")
def get_session_results():
    auth_user, auth_err = require_auth_user()
    if auth_err:
        return auth_err
    items = list_session_results_for_user(auth_user.get("user_id"))
    return jsonify({"ok": True, "items": items})

@app.post("/api/session-result")
def post_session_result():
    auth_user, auth_err = require_auth_user()
    if auth_err:
        return auth_err

    item, err_payload, third = create_session_result(
        auth_user.get("user_id"),
        request.get_json(silent=True) or {}
    )

    if err_payload is not None:
        return jsonify(err_payload), third

    summary = build_session_summary(item)
    adaptation_state = update_adaptation_state(auth_user.get("user_id"))

    return jsonify({
        "ok": True,
        "item": item,
        "summary": summary,
        "adaptation_state": adaptation_state,
        "count": third
    }), 201

@app.get("/api/workouts")
def get_workouts():
    auth_user, auth_err = require_auth_user()
    if auth_err:
        return auth_err
    items = list_workouts_for_user(auth_user.get("user_id"))
    return jsonify({"ok": True, "items": items})

@app.post("/api/workouts")
def post_workouts():
    auth_user, auth_err = require_auth_user()
    if auth_err:
        return auth_err

    item, err_payload, third = create_workout(auth_user.get("user_id"), request.get_json(silent=True) or {})
    if err_payload is not None:
        return jsonify(err_payload), third

    return jsonify({"ok": True, "item": item, "count": third}), 201

@app.get("/api/checkins")
def get_checkins():
    auth_user, auth_err = require_auth_user()
    if auth_err:
        return auth_err
    items = list_checkins_for_user(auth_user.get("user_id"))
    return jsonify({"ok": True, "items": items})

@app.get("/api/checkin/latest")
def get_latest_checkin():
    auth_user, auth_err = require_auth_user()
    if auth_err:
        return auth_err
    item = get_latest_checkin_for_user(auth_user.get("user_id"))
    return jsonify({"ok": True, "item": item})

@app.post("/api/checkin")
def post_checkin():
    auth_user, auth_err = require_auth_user()
    if auth_err:
        return auth_err

    item, err_payload, third = create_checkin(auth_user.get("user_id"), request.get_json(silent=True) or {})
    if err_payload is not None:
        return jsonify(err_payload), third

    return jsonify({"ok": True, "item": item, "count": third}), 201

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8091, debug=True)
