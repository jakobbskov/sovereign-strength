from flask import Flask, jsonify, request
from pathlib import Path
from datetime import datetime, timezone, timedelta
import json
import re
import logging
import uuid
import os
from storage import get_storage_backend
import urllib.request
import urllib.error
from progression_engine import (
    get_effective_load_increment,
    get_effective_recommended_step,
    compute_next_possible_load,
    evaluate_equipment_constraint,
    parse_number_from_load,
    parse_top_rep,
    parse_seconds_value,
    analyze_session_result_for_progression,
    get_relevant_strength_history,
    decide_progression_from_context,
)

app = Flask(__name__)

logger = logging.getLogger(__name__)

def log_auth_failure(context, error):
    logger.warning(
        "auth_failure context=%s error=%s",
        context,
        error,
    )

def log_storage_failure(operation, error, extra=None):
    logger.error(
        "storage_failure operation=%s error=%s extra=%s",
        operation,
        error,
        extra,
    )

AUTH_VALIDATE_URL = os.getenv("AUTH_VALIDATE_URL", "https://auth.innosocia.dk/api/auth/validate")
AUTH_COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "sovereign_session")
AUTH_CACHE_TTL_SECONDS = int(os.getenv("AUTH_CACHE_TTL_SECONDS", "300") or "300")

_AUTH_CACHE = {}


def _prune_auth_cache(now_ts):
    expired = [key for key, value in _AUTH_CACHE.items() if not isinstance(value, dict) or value.get("expires_at", 0) <= now_ts]
    for key in expired:
        _AUTH_CACHE.pop(key, None)


def _get_cached_auth_user(raw_cookie):
    now_ts = datetime.now(timezone.utc).timestamp()
    cached = _AUTH_CACHE.get(raw_cookie)
    if not isinstance(cached, dict):
        logger.info("Auth cache miss")
        return None, False

    if cached.get("expires_at", 0) <= now_ts:
        _AUTH_CACHE.pop(raw_cookie, None)
        logger.info("Auth cache miss")
        return None, False

    logger.info("Auth cache hit")
    return cached.get("user"), True


def _set_cached_auth_user(raw_cookie, user):
    now_ts = datetime.now(timezone.utc).timestamp()
    if len(_AUTH_CACHE) > 1024:
        _prune_auth_cache(now_ts)

    _AUTH_CACHE[raw_cookie] = {
        "user": user,
        "expires_at": now_ts + AUTH_CACHE_TTL_SECONDS,
    }


def get_current_auth_user():
    raw_cookie = request.headers.get("Cookie", "").strip()
    if not raw_cookie:
        return "unauthorized", None

    cached_user, cache_hit = _get_cached_auth_user(raw_cookie)
    if cache_hit:
        if cached_user and cached_user.get("user_id"):
            return "ok", cached_user
        return "unauthorized", None

    req = urllib.request.Request(
        AUTH_VALIDATE_URL,
        headers={
            "Cookie": raw_cookie,
            "User-Agent": "sovereign-strength-api/1.0",
        },
        method="GET",
    )

    try:
        with urllib.request.urlopen(req, timeout=2) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 401:
            _set_cached_auth_user(raw_cookie, None)
            return "unauthorized", None
        logger.exception("Auth HTTP error from %s: %s", AUTH_VALIDATE_URL, e)
        return "unavailable", None
    except Exception as e:
        logger.exception("Auth validation failed against %s: %s", AUTH_VALIDATE_URL, e)
        return "unavailable", None

    if not payload or not payload.get("ok") or not payload.get("authenticated"):
        _set_cached_auth_user(raw_cookie, None)
        return "unauthorized", None

    user = {
        "user_id": payload.get("user_id"),
        "username": payload.get("username"),
        "role": payload.get("role"),
    }
    _set_cached_auth_user(raw_cookie, user)
    return "ok", user




def filter_items_for_user(items, user_id):
    out = []
    for item in (items or []):
        if not isinstance(item, dict):
            continue
        item_user_id = str(item.get("user_id", "")).strip()
        if item_user_id == str(user_id).strip():
            out.append(item)
    return out


def require_auth_user():
    auth_status, auth_user = get_current_auth_user()
    if auth_status == "unavailable":
        return None, (jsonify({"ok": False, "error": "auth_unavailable"}), 503)
    if auth_status != "ok" or not auth_user or not auth_user.get("user_id"):
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
        if not isinstance(data, list):
            logger.warning("Expected list in %s but got %s", path, type(data).__name__)
            return []
        return data
    except Exception as e:
        logger.exception("Failed to read list JSON from %s: %s", path, e)
        return []

def write_json_file(path: Path, data):
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    with open(tmp_path, "w", encoding="utf-8") as f:
        f.write(payload)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp_path, path)

def read_json_object_file(path: Path):
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            logger.warning("Expected dict in %s but got %s", path, type(data).__name__)
            return {}
        return data
    except Exception as e:
        logger.exception("Failed to read object JSON from %s: %s", path, e)
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

def get_storage_last_error():
    storage = get_storage()
    getter = getattr(storage, "get_last_error", None)
    if callable(getter):
        return getter()
    return None

def get_latest_user_item(file_key, user_id, sort_keys=("created_at", "date")):
    return get_storage().get_latest_user_item(file_key, user_id, sort_keys=sort_keys)

def delete_user_item(file_key, user_id, item_id):
    return get_storage().delete_user_item(file_key, user_id, item_id)

def get_user_item(file_key, user_id, item_id):
    return get_storage().get_user_item(file_key, user_id, item_id)

def update_user_item(file_key, user_id, item_id, item):
    return get_storage().update_user_item(file_key, user_id, item_id, item)



def consume_manual_override_workout_storage(user_id, date):
    return get_storage().consume_manual_override_workout(user_id, date)

def get_iso_weekday_key(date_str):
    date_str = str(date_str or "").strip()
    if not date_str:
        return None
    try:
        dt = datetime.fromisoformat(date_str).date()
    except Exception:
        return None

    mapping = {
        1: "mon",
        2: "tue",
        3: "wed",
        4: "thu",
        5: "fri",
        6: "sat",
        7: "sun",
    }
    return mapping.get(dt.isoweekday())


def get_training_day_context(user_settings, date_str):
    if not isinstance(user_settings, dict):
        user_settings = {}

    training_days = user_settings.get("training_days", [])
    if not isinstance(training_days, list):
        training_days = []

    training_days = [str(x).strip().lower() for x in training_days if str(x).strip()]
    preferred_sessions = user_settings.get("preferred_sessions_per_week", 3)
    try:
        preferred_sessions = int(preferred_sessions)
    except Exception:
        preferred_sessions = 3

    weekday_key = get_iso_weekday_key(date_str)
    is_training_day = bool(weekday_key and weekday_key in training_days)

    return {
        "weekday_key": weekday_key,
        "training_days": training_days,
        "preferred_sessions_per_week": preferred_sessions,
        "is_training_day": is_training_day,
    }


def get_user_settings_for(user_id):
    return get_storage().get_user_settings_for(user_id)

def save_user_settings_for(user_id, settings):
    return get_storage().save_user_settings_for(user_id, settings)


def consume_manual_override_workout(user_id, date):
    return get_storage().consume_manual_override_workout(user_id, date)


def list_workouts_for_user(user_id):
    return list_user_items("workouts", user_id)

def make_error_payload(error, message, **extra):
    payload = {
        "ok": False,
        "error": error,
        "message": message,
    }
    payload.update(extra)
    return payload


def ensure_error_contract(payload, status):
    if not isinstance(payload, dict):
        return payload, status

    if payload.get("ok") is not False:
        return payload, status

    return {
        "ok": False,
        "error": str(payload.get("error") or "unknown_error"),
        "message": str(payload.get("message") or ""),
        **{k: v for k, v in payload.items() if k not in ("ok", "error", "message")}
    }, status


def _parse_non_negative_int(value, field_name):
    try:
        parsed = int(value)
    except Exception:
        return None, make_error_payload(
            "invalid_number",
            f"{field_name} skal være et tal",
            field=field_name,
        ), 400
    if parsed < 0:
        return None, make_error_payload(
            "negative_value",
            f"{field_name} må ikke være negativ",
            field=field_name,
        ), 400
    return parsed, None, None

def _parse_int_in_range(value, field_name, min_value, max_value):
    try:
        parsed = int(value)
    except Exception:
        return None, make_error_payload(
            "invalid_number",
            f"{field_name} skal være et tal",
            field=field_name,
        ), 400
    if parsed < min_value or parsed > max_value:
        return None, make_error_payload(
            "out_of_range",
            f"{field_name} skal være mellem {min_value} og {max_value}",
            field=field_name,
            min_value=min_value,
            max_value=max_value,
        ), 400
    return parsed, None, None

def _parse_optional_int(value, default=None):
    if value in (None, "", "null"):
        return default
    try:
        return int(value)
    except Exception:
        return default

def _parse_local_signals(value):
    if value in (None, "", []):
        return [], None, None
    if not isinstance(value, list):
        return None, make_error_payload(
            "invalid_local_signals",
            "local_signals skal være en liste",
            field="local_signals",
        ), 400

    allowed_regions = {
        "ankle_calf",
        "knee",
        "hip",
        "low_back",
        "shoulder",
        "elbow",
        "wrist",
    }
    allowed_signals = {"caution", "irritated"}

    parsed = []
    seen = set()

    for idx, item in enumerate(value):
        if not isinstance(item, dict):
            return None, make_error_payload(
                "invalid_local_signal_entry",
                "hver local_signal skal være et objekt",
                field="local_signals",
                index=idx,
            ), 400

        region = str(item.get("region", "")).strip().lower()
        signal = str(item.get("signal", "")).strip().lower()

        if region not in allowed_regions:
            return None, make_error_payload(
                "invalid_local_signal_region",
                "ukendt region i local_signals",
                field="local_signals",
                index=idx,
                region=region,
            ), 400

        if signal not in allowed_signals:
            return None, make_error_payload(
                "invalid_local_signal_value",
                "ukendt signal i local_signals",
                field="local_signals",
                index=idx,
                signal=signal,
            ), 400

        key = region
        if key in seen:
            continue
        seen.add(key)

        parsed.append({
            "region": region,
            "signal": signal,
        })

    return parsed, None, None

def create_workout(user_id, payload):
    if not isinstance(payload, dict):
        return None, make_error_payload("invalid_payload", "ugyldig payload"), 400

    date = str(payload.get("date", "")).strip()
    session_type = str(payload.get("type", "")).strip()
    duration_min = payload.get("duration_min", 0)
    notes = str(payload.get("notes", "")).strip()
    program_id = str(payload.get("program_id", "")).strip()
    program_day_label = str(payload.get("program_day_label", "")).strip()
    entries = payload.get("entries", [])

    if not date:
        return None, make_error_payload("missing_date", "date mangler", field="date"), 400

    if session_type == "cardio":
        session_type = "løb"

    if session_type not in ("styrke", "løb", "mobilitet", "andet"):
        return None, make_error_payload("invalid_session_type", "ugyldig type", field="type"), 400

    duration_min, err, status = _parse_non_negative_int(duration_min, "duration_min")
    if err:
        return None, err, status

    if not isinstance(entries, list):
        return None, make_error_payload("invalid_entries", "entries skal være en liste", field="entries"), 400

    clean_entries = []
    for e in entries:
        if not isinstance(e, dict):
            return None, make_error_payload("invalid_entry", "hver entry skal være et objekt", field="entries"), 400

        sets_raw = str(e.get("sets", "")).strip()
        if sets_raw:
            try:
                int(float(sets_raw))
            except Exception:
                return None, make_error_payload("invalid_sets", "sets skal være et tal eller tom", field="sets"), 400

        clean_entry = {
            "exercise_id": str(e.get("exercise_id", "")).strip(),
            "sets": sets_raw,
            "reps": str(e.get("reps", "")).strip(),
            "achieved_reps": str(e.get("achieved_reps", "")).strip(),
            "load": str(e.get("load", "")).strip(),
            "notes": str(e.get("notes", "")).strip(),
        }

        has_meaningful_data = bool(
            clean_entry["exercise_id"]
            or clean_entry["sets"]
            or clean_entry["reps"]
            or clean_entry["achieved_reps"]
            or clean_entry["load"]
        )

        if has_meaningful_data:
            clean_entries.append(clean_entry)

    if session_type == "styrke" and not clean_entries:
        return None, make_error_payload("empty_workout", "ingen træningsdata at gemme"), 400

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
        "is_manual_override": True,
        "is_consumed": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    item, count = append_user_item("workouts", item)
    return item, None, count

def list_checkins_for_user(user_id):
    return list_user_items("checkins", user_id)

def list_session_results_for_user(user_id):
    return list_user_items("session_results", user_id)

def get_latest_checkin_for_user(user_id):
    return get_latest_user_item("checkins", user_id)


def build_recent_recovery_context(user_id, max_items=3):
    checkins = list_checkins_for_user(user_id)
    if not isinstance(checkins, list):
        checkins = []

    recent = []
    for item in checkins:
        if not isinstance(item, dict):
            continue
        recent.append(item)
        if len(recent) >= max_items:
            break

    poor_recovery_count = 0
    latest_readiness_score = None

    for idx, item in enumerate(recent):
        try:
            sleep_score = int(item.get("sleep_score", 0) or 0)
        except Exception:
            sleep_score = 0
        try:
            energy_score = int(item.get("energy_score", 0) or 0)
        except Exception:
            energy_score = 0
        try:
            soreness_score = int(item.get("soreness_score", 0) or 0)
        except Exception:
            soreness_score = 0
        try:
            readiness_score = int(item.get("readiness_score", 0) or 0)
        except Exception:
            readiness_score = 0

        if idx == 0:
            latest_readiness_score = readiness_score

        poor_recovery = bool(
            sleep_score <= 2 or
            energy_score <= 2 or
            soreness_score >= 4
        )
        if poor_recovery:
            poor_recovery_count += 1

    if poor_recovery_count >= 2:
        pressure = "high"
        reason = "gentagne tegn på lav restitution i de seneste checkins"
    elif poor_recovery_count == 1:
        pressure = "moderate"
        reason = "ét nyligt checkin med lav restitution"
    else:
        pressure = "low"
        reason = None

    return {
        "recent_checkin_count": len(recent),
        "poor_recovery_count": poor_recovery_count,
        "latest_readiness_score": latest_readiness_score,
        "multi_session_fatigue_pressure": pressure,
        "multi_session_fatigue_reason": reason,
    }


def compute_readiness_score(sleep_score, energy_score, soreness_score):
    readiness_score = round((sleep_score + energy_score + (6 - soreness_score)) / 3)
    readiness_score = max(1, min(5, readiness_score))
    return readiness_score

def _parse_optional_bool(value, field):
    if value in (None, "", "null"):
        return None, None, None
    if isinstance(value, bool):
        return value, None, None
    s = str(value).strip().lower()
    if s in ("true", "1", "yes", "ja"):
        return True, None, None
    if s in ("false", "0", "no", "nej"):
        return False, None, None
    return None, make_error_payload("invalid_boolean", f"{field} skal være true/false", field=field), 400

def _parse_menstrual_pain(value):
    if value in (None, "", "null"):
        return "none", None, None
    allowed = {"none", "light", "moderate", "severe"}
    s = str(value).strip().lower()
    if s in allowed:
        return s, None, None
    return None, make_error_payload(
        "invalid_menstrual_pain",
        "menstrual_pain skal være none, light, moderate eller severe",
        field="menstrual_pain",
    ), 400

def build_checkin_item(user_id, payload, existing_item=None):
    if not isinstance(payload, dict):
        return None, make_error_payload("invalid_payload", "ugyldig payload"), 400

    existing_item = existing_item if isinstance(existing_item, dict) else {}

    date = str(payload.get("date", "")).strip()
    notes = str(payload.get("notes", "")).strip()
    time_budget_min = payload.get("time_budget_min", 0)
    local_signals = payload.get("local_signals", [])

    if not date:
        return None, make_error_payload("missing_date", "date mangler", field="date"), 400

    sleep_score, err, status = _parse_int_in_range(payload.get("sleep_score", ""), "sleep_score", 1, 5)
    if err:
        return None, err, status

    energy_score, err, status = _parse_int_in_range(payload.get("energy_score", ""), "energy_score", 1, 5)
    if err:
        return None, err, status

    soreness_score, err, status = _parse_int_in_range(payload.get("soreness_score", ""), "soreness_score", 1, 5)
    if err:
        return None, err, status

    time_budget_min, err, status = _parse_non_negative_int(time_budget_min, "time_budget_min")
    if err:
        return None, err, status

    local_signals, err, status = _parse_local_signals(local_signals)
    if err:
        return None, err, status

    menstruation_today, err, status = _parse_optional_bool(payload.get("menstruation_today"), "menstruation_today")
    if err:
        return None, err, status

    rest_day_acknowledged, err, status = _parse_optional_bool(payload.get("rest_day_acknowledged"), "rest_day_acknowledged")
    if err:
        return None, err, status

    menstrual_pain, err, status = _parse_menstrual_pain(payload.get("menstrual_pain"))
    if err:
        return None, err, status

    readiness_score = compute_readiness_score(
        sleep_score=sleep_score,
        energy_score=energy_score,
        soreness_score=soreness_score,
    )

    item = {
        "id": str(existing_item.get("id") or uuid.uuid4()),
        "user_id": user_id,
        "date": date,
        "sleep_score": sleep_score,
        "energy_score": energy_score,
        "soreness_score": soreness_score,
        "time_budget_min": time_budget_min,
        "readiness_score": readiness_score,
        "notes": notes,
        "local_signals": local_signals,
        "menstruation_today": menstruation_today,
        "rest_day_acknowledged": rest_day_acknowledged,
        "menstrual_pain": menstrual_pain,
        "created_at": existing_item.get("created_at") or datetime.now(timezone.utc).isoformat()
    }
    return item, None, None


def create_checkin(user_id, payload):
    item, err, status = build_checkin_item(user_id, payload)
    if err:
        return None, err, status
    item, count = append_user_item("checkins", item)
    return item, None, count

def update_checkin(user_id, checkin_id, payload):
    existing = get_user_item("checkins", user_id, checkin_id)
    if not isinstance(existing, dict):
        return None, make_error_payload("not_found", "checkin blev ikke fundet", id=checkin_id), 404

    item, err, status = build_checkin_item(user_id, payload, existing_item=existing)
    if err:
        return None, err, status

    item["id"] = existing.get("id")
    item["created_at"] = existing.get("created_at")

    updated = update_user_item("checkins", user_id, checkin_id, item)
    if not isinstance(updated, dict):
        return None, make_error_payload("update_failed", "checkin kunne ikke opdateres", id=checkin_id), 500

    return updated, None, None


def create_session_result(user_id, payload):
    date = str(payload.get("date", "")).strip()
    session_type = str(payload.get("session_type", "")).strip()
    timing_state = str(payload.get("timing_state", "")).strip()
    notes = str(payload.get("notes", "")).strip()
    completed = bool(payload.get("completed", False))
    readiness_score = payload.get("readiness_score", None)
    source = str(payload.get("source", "autoplan")).strip() or "autoplan"
    results = payload.get("results", [])

    if not date:
        return None, {"ok": False, "error": "date mangler"}, 400
    if session_type == "cardio":
        session_type = "løb"

    if session_type not in ("styrke", "løb", "restitution"):
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
        # cardio-sessioner kan være gyldige uden sets
        if session_type in ("løb", "cardio", "run"):
            clean_results.append({
                "exercise_id": "cardio_session",
                "completed": True,
                "target_reps": "",
                "achieved_reps": "",
                "load": "",
                "sets": [],
                "hit_failure": False,
                "notes": ""
            })
        else:
            return None, {"ok": False, "error": "ingen træningsdata at gemme"}, 400

    cardio_kind = str(payload.get("cardio_kind", "")).strip().lower()
    avg_rpe = payload.get("avg_rpe", None)
    distance_km = payload.get("distance_km", None)
    duration_min = payload.get("duration_min", None)
    duration_sec = payload.get("duration_sec", None)

    avg_rpe = _parse_optional_int(avg_rpe, None)

    try:
        distance_km = float(distance_km) if distance_km not in (None, "", "null") else None
    except Exception:
        distance_km = None

    duration_min = _parse_optional_int(duration_min, 0)
    duration_sec = _parse_optional_int(duration_sec, 0)

    if duration_min < 0:
        duration_min = 0
    if duration_sec < 0:
        duration_sec = 0
    if duration_sec > 59:
        duration_sec = 59

    duration_total_sec = (duration_min * 60) + duration_sec

    pace_sec_per_km = None
    if distance_km and distance_km > 0 and duration_total_sec > 0:
        try:
            pace_sec_per_km = round(duration_total_sec / float(distance_km), 2)
        except Exception:
            pace_sec_per_km = None

    session_type_normalized = str(session_type or "").strip().lower()
    counts_toward_weekly_goal = False

    has_meaningful_results = False
    for r in clean_results:
        if not isinstance(r, dict):
            continue
        if str(r.get("exercise_id", "")).strip():
            has_meaningful_results = True
            break
        if str(r.get("achieved_reps", "")).strip():
            has_meaningful_results = True
            break
        raw_sets = r.get("sets", [])
        if isinstance(raw_sets, list) and raw_sets:
            has_meaningful_results = True
            break

    if completed:
        if session_type_normalized in ("styrke", "strength"):
            counts_toward_weekly_goal = has_meaningful_results
        elif session_type_normalized in ("løb", "run", "cardio"):
            dist_ok = False
            dur_ok = False
            try:
                dist_ok = float(distance_km or 0) > 0
            except Exception:
                dist_ok = False
            try:
                dur_ok = float(duration_total_sec or 0) > 0
            except Exception:
                dur_ok = False
            counts_toward_weekly_goal = bool(dist_ok or dur_ok or has_meaningful_results)
        elif session_type_normalized in ("restitution", "mobilitet", "mobility", "recovery"):
            counts_toward_weekly_goal = False

    item = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "date": date,
        "session_type": session_type,
        "timing_state": timing_state,
        "readiness_score": readiness_score,
        "completed": completed,
        "source": source,
        "counts_toward_weekly_goal": counts_toward_weekly_goal,
        "notes": notes,
        "cardio_kind": cardio_kind if session_type in ("løb", "cardio", "run") else "",
        "avg_rpe": avg_rpe if session_type in ("løb", "cardio", "run") else None,
        "distance_km": distance_km if session_type in ("løb", "cardio", "run") else None,
        "duration_total_sec": duration_total_sec if session_type in ("løb", "cardio", "run") else None,
        "pace_sec_per_km": pace_sec_per_km if session_type in ("løb", "cardio", "run") else None,
        "results": clean_results,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    item["summary"] = build_session_summary(item)

    item, count = append_user_item("session_results", item)
    return item, None, count

def build_session_result_item(user_id, payload, existing_item=None):
    if not isinstance(payload, dict):
        return None, {"ok": False, "error": "ugyldig payload"}, 400

    existing_item = existing_item if isinstance(existing_item, dict) else {}

    date = str(payload.get("date", "")).strip()
    session_type = str(payload.get("session_type", "")).strip() or str(existing_item.get("session_type", "")).strip() or "styrke"
    timing_state = str(payload.get("timing_state", "")).strip() or str(existing_item.get("timing_state", "")).strip() or "on_time"
    notes = str(payload.get("notes", "")).strip()
    source = str(payload.get("source", "")).strip() or str(existing_item.get("source", "")).strip() or "manual"
    completed = bool(payload.get("completed", False))
    readiness_score = payload.get("readiness_score", existing_item.get("readiness_score"))
    cardio_kind = str(payload.get("cardio_kind", "")).strip()
    avg_rpe = payload.get("avg_rpe")
    distance_km = payload.get("distance_km")
    duration_total_sec = payload.get("duration_total_sec")
    pace_sec_per_km = payload.get("pace_sec_per_km")
    results = payload.get("results", [])

    if not date:
        return None, {"ok": False, "error": "date mangler", "field": "date"}, 400

    if readiness_score in (None, ""):
        readiness_score = None
    else:
        try:
            readiness_score = int(float(readiness_score))
        except Exception:
            return None, {"ok": False, "error": "ugyldig readiness_score", "field": "readiness_score"}, 400

    if avg_rpe in (None, ""):
        avg_rpe = None
    else:
        try:
            avg_rpe = float(avg_rpe)
        except Exception:
            return None, {"ok": False, "error": "ugyldig avg_rpe", "field": "avg_rpe"}, 400

    if distance_km in (None, ""):
        distance_km = None
    else:
        try:
            distance_km = float(distance_km)
        except Exception:
            return None, {"ok": False, "error": "ugyldig distance_km", "field": "distance_km"}, 400

    if duration_total_sec in (None, ""):
        duration_total_sec = None
    else:
        try:
            duration_total_sec = int(float(duration_total_sec))
        except Exception:
            return None, {"ok": False, "error": "ugyldig duration_total_sec", "field": "duration_total_sec"}, 400

    if pace_sec_per_km in (None, ""):
        pace_sec_per_km = None
    else:
        try:
            pace_sec_per_km = int(float(pace_sec_per_km))
        except Exception:
            return None, {"ok": False, "error": "ugyldig pace_sec_per_km", "field": "pace_sec_per_km"}, 400

    if not isinstance(results, list):
        return None, {"ok": False, "error": "ugyldige results", "field": "results"}, 400

    clean_results = []
    has_meaningful_results = False
    for raw in results:
        if not isinstance(raw, dict):
            continue
        cleaned = dict(raw)
        clean_results.append(cleaned)

        if str(cleaned.get("exercise_id", "")).strip():
            has_meaningful_results = True
        if str(cleaned.get("achieved_reps", "")).strip():
            has_meaningful_results = True
        raw_sets = cleaned.get("sets", [])
        if isinstance(raw_sets, list) and raw_sets:
            has_meaningful_results = True

    session_type_normalized = str(session_type).strip().lower()
    counts_toward_weekly_goal = False
    if completed:
        if session_type_normalized in ("styrke", "strength"):
            counts_toward_weekly_goal = has_meaningful_results
        elif session_type_normalized in ("løb", "run", "cardio"):
            dist_ok = False
            dur_ok = False
            try:
                dist_ok = float(distance_km or 0) > 0
            except Exception:
                dist_ok = False
            try:
                dur_ok = float(duration_total_sec or 0) > 0
            except Exception:
                dur_ok = False
            counts_toward_weekly_goal = bool(dist_ok or dur_ok or has_meaningful_results)
        elif session_type_normalized in ("restitution", "mobilitet", "mobility", "recovery"):
            counts_toward_weekly_goal = False

    item = {
        "id": str(existing_item.get("id") or uuid.uuid4()),
        "user_id": user_id,
        "date": date,
        "session_type": session_type,
        "timing_state": timing_state,
        "readiness_score": readiness_score,
        "completed": completed,
        "source": source,
        "counts_toward_weekly_goal": counts_toward_weekly_goal,
        "notes": notes,
        "cardio_kind": cardio_kind if session_type in ("løb", "cardio", "run") else "",
        "avg_rpe": avg_rpe if session_type in ("løb", "cardio", "run") else None,
        "distance_km": distance_km if session_type in ("løb", "cardio", "run") else None,
        "duration_total_sec": duration_total_sec if session_type in ("løb", "cardio", "run") else None,
        "pace_sec_per_km": pace_sec_per_km if session_type in ("løb", "cardio", "run") else None,
        "results": clean_results,
        "created_at": existing_item.get("created_at") or datetime.now(timezone.utc).isoformat()
    }
    item["summary"] = build_session_summary(item)
    return item, None, None

def update_session_result(user_id, session_result_id, payload):
    existing = get_user_item("session_results", user_id, session_result_id)
    if not isinstance(existing, dict):
        return None, {"ok": False, "error": "session_result blev ikke fundet", "id": session_result_id}, 404

    item, err_payload, status = build_session_result_item(user_id, payload, existing_item=existing)
    if err_payload is not None:
        return None, err_payload, status

    item["id"] = existing.get("id")
    item["created_at"] = existing.get("created_at")

    updated = update_user_item("session_results", user_id, session_result_id, item)
    if not isinstance(updated, dict):
        return None, {"ok": False, "error": "session_result kunne ikke opdateres", "id": session_result_id}, 500

    updated["summary"] = build_session_summary(updated)
    return updated, None, None


def create_session_result_from_workout(user_id, workout_item):
    if not isinstance(workout_item, dict):
        return None, {"ok": False, "error": "ugyldigt workout_item"}, 400

    date = str(workout_item.get("date", "")).strip()
    session_type = str(workout_item.get("session_type", "")).strip() or "styrke"
    notes = str(workout_item.get("notes", "")).strip()
    entries = workout_item.get("entries", [])
    if not isinstance(entries, list):
        entries = []

    clean_results = []
    for e in entries:
        if not isinstance(e, dict):
            continue

        sets_raw = str(e.get("sets", "")).strip()
        reps_raw = str(e.get("reps", "")).strip()
        load_raw = str(e.get("load", "")).strip()
        achieved_raw = str(e.get("achieved_reps", "")).strip()

        set_items = []
        try:
            set_count = int(float(sets_raw)) if sets_raw else 0
        except Exception:
            set_count = 0

        if set_count > 0 and (reps_raw or load_raw):
            for _ in range(set_count):
                set_items.append({
                    "reps": achieved_raw or reps_raw,
                    "load": load_raw
                })

        clean_results.append({
            "exercise_id": str(e.get("exercise_id", "")).strip(),
            "target_reps": reps_raw,
            "achieved_reps": achieved_raw or reps_raw,
            "load": load_raw,
            "completed": True,
            "hit_failure": False,
            "notes": str(e.get("notes", "")).strip(),
            "sets": set_items
        })

    payload = {
        "date": date,
        "session_type": session_type,
        "timing_state": "",
        "completed": True,
        "readiness_score": None,
        "notes": notes,
        "results": clean_results,
        "source": "manual_override"
    }

    return create_session_result(user_id, payload)

def get_exercise_config(exercises, exercise_id):
    for ex in (exercises or []):
        if str(ex.get("id", "")).strip() == str(exercise_id).strip():
            return ex
    return {}


def get_training_type_preferences(user_settings):
    settings = user_settings if isinstance(user_settings, dict) else {}
    preferences = settings.get("preferences", {})
    if not isinstance(preferences, dict):
        preferences = {}
    training_types = preferences.get("training_types", {})
    if not isinstance(training_types, dict):
        training_types = {}

    return {
        "running": bool(training_types.get("running", True)),
        "strength_weights": bool(training_types.get("strength_weights", True)),
        "bodyweight": bool(training_types.get("bodyweight", True)),
        "mobility": bool(training_types.get("mobility", True)),
    }

def get_training_day_preferences(user_settings):
    settings = user_settings if isinstance(user_settings, dict) else {}
    preferences = settings.get("preferences", {})
    if not isinstance(preferences, dict):
        preferences = {}
    training_days = preferences.get("training_days", {})
    if not isinstance(training_days, dict):
        training_days = {}

    defaults = {
        "mon": True,
        "tue": True,
        "wed": True,
        "thu": True,
        "fri": True,
        "sat": True,
        "sun": True,
    }

    return {
        key: bool(training_days.get(key, default))
        for key, default in defaults.items()
    }

def get_weekly_target_sessions(user_settings):
    settings = user_settings if isinstance(user_settings, dict) else {}
    preferences = settings.get("preferences", {})
    if not isinstance(preferences, dict):
        preferences = {}

    raw = preferences.get("weekly_target_sessions", 3)
    try:
        val = int(raw)
    except Exception:
        val = 3

    if val < 1:
        val = 1
    if val > 7:
        val = 7
    return val




def get_local_load_targets_for_exercise(exercise_id, exercises=None):
    exercise_id = str(exercise_id or "").strip()
    if not exercise_id:
        return []

    exercise_items = exercises if isinstance(exercises, list) else read_json_file(FILES["exercises"])
    if not isinstance(exercise_items, list):
        return []

    for item in exercise_items:
        if not isinstance(item, dict):
            continue
        if str(item.get("id", "")).strip() != exercise_id:
            continue

        raw = item.get("local_load_targets", [])
        if not isinstance(raw, list):
            return []

        cleaned = []
        seen = set()
        for value in raw:
            target = str(value or "").strip()
            if not target or target in seen:
                continue
            seen.add(target)
            cleaned.append(target)
        return cleaned

    return []

def choose_best_substitute(original_exercise_id, candidate_ids, exercise_map, available_equipment, local_state=None, exercises=None):
    original_meta = exercise_map.get(original_exercise_id, {}) or {}
    original_pattern = str(original_meta.get("movement_pattern", "")).strip()
    local_state = local_state if isinstance(local_state, dict) else {}
    try:
        original_tier = int(original_meta.get("difficulty_tier", 1) or 1)
    except Exception:
        original_tier = 1

    ranked = []

    for candidate_index, candidate_id in enumerate(candidate_ids or []):
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

        local_targets = get_local_load_targets_for_exercise(candidate_id, exercises=exercises)
        blocked_regions = []
        caution_count = 0
        for region in local_targets:
            info = local_state.get(region, {}) if isinstance(local_state, dict) else {}
            if not isinstance(info, dict):
                continue
            region_state = str(info.get("state", "")).strip()
            if region_state == "protect":
                blocked_regions.append(region)
            elif region_state == "caution":
                caution_count += 1

        if blocked_regions:
            continue

        same_pattern = 1 if original_pattern and candidate_pattern == original_pattern else 0
        tier_distance = abs(candidate_tier - original_tier)

        ranked.append((
            caution_count,       # fewer caution hits first
            -same_pattern,       # same pattern first
            tier_distance,       # closest difficulty next
            candidate_tier,      # then easier before harder if equal distance
            candidate_index,     # preserve intentional fallback priority
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


def compute_fatigue_score(
    latest_strength_failed,
    latest_strength_load_drop_count,
    latest_strength_completed,
    days_since_last_strength,
):
    fatigue_score = (
        (3 if latest_strength_failed else 0)
        + (2 * latest_strength_load_drop_count)
        + (1 if latest_strength_completed is False else 0)
        + (1 if days_since_last_strength is not None and days_since_last_strength < 2 else 0)
    )
    return fatigue_score


def compute_fatigue_score_from_latest_strength(session_results, workouts, user_id=None, latest_checkin=None):
    """
    Deprecated wrapper: kept for compatibility.
    Delegates to compute_fatigue_score + helpers.
    """

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

    fatigue_score = compute_fatigue_score(
        latest_strength_failed=latest_strength_failed,
        latest_strength_load_drop_count=latest_strength_load_drop_count,
        latest_strength_completed=latest_strength_completed,
        days_since_last_strength=days_since_last_strength,
    )

    return {
        "fatigue_score": fatigue_score,
        "latest_strength_failed": latest_strength_failed,
        "latest_strength_load_drop_count": latest_strength_load_drop_count,
        "latest_strength_completed": latest_strength_completed,
        "days_since_last_strength_for_fatigue": days_since_last_strength,
    }





def decide_fatigue_session_override(fatigue_score, recovery_state):
    recovery = recovery_state if isinstance(recovery_state, dict) else {}

    if recovery.get("recovery_state") == "recover":
        return "restitution"
    if fatigue_score >= 6:
        return "restitution"
    if fatigue_score >= 2:
        return "light_strength"
    return None


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
            "progression_reason": "recovery prioritized",
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
            "progression_reason": "recovery prioritized",
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
            "progression_reason": "recovery prioritized",
            "recommended_next_load": None,
            "actual_possible_next_load": None,
            "equipment_constraint": False,
            "secondary_constraints": [],
            "next_target_reps": None,
            "substituted_from": None,
        },
    ]




def build_reentry_strength_plan(time_budget_min):
    try:
        time_budget_min = int(time_budget_min or 0)
    except Exception:
        time_budget_min = 20

    if time_budget_min <= 0:
        time_budget_min = 20

    rounds = 1 if time_budget_min <= 20 else 2

    return [
        {
            "exercise_id": "glute_bridge",
            "sets": rounds,
            "target_reps": "8-10",
            "target_load": None,
            "progression_decision": "no_progression",
            "progression_reason": "re-entry strength prioritized",
            "recommended_next_load": None,
            "actual_possible_next_load": None,
            "equipment_constraint": False,
            "secondary_constraints": [],
            "next_target_reps": None,
            "substituted_from": None,
        },
        {
            "exercise_id": "incline_push_ups",
            "sets": rounds,
            "target_reps": "6-8",
            "target_load": None,
            "progression_decision": "no_progression",
            "progression_reason": "re-entry strength prioritized",
            "recommended_next_load": None,
            "actual_possible_next_load": None,
            "equipment_constraint": False,
            "secondary_constraints": [],
            "next_target_reps": None,
            "substituted_from": None,
        },
        {
            "exercise_id": "bird_dog",
            "sets": rounds,
            "target_reps": "20 sek",
            "target_load": None,
            "progression_decision": "no_progression",
            "progression_reason": "re-entry strength prioritized",
            "recommended_next_load": None,
            "actual_possible_next_load": None,
            "equipment_constraint": False,
            "secondary_constraints": [],
            "next_target_reps": None,
            "substituted_from": None,
        },
    ]


def should_use_reentry_strength(readiness_score, fatigue_score, recovery_state, days_since_last_strength, training_day_ctx=None):
    try:
        readiness_score = int(readiness_score or 0)
    except Exception:
        readiness_score = 0

    try:
        fatigue_score = int(fatigue_score or 0)
    except Exception:
        fatigue_score = 0

    try:
        days_since_last_strength = int(days_since_last_strength) if days_since_last_strength is not None else None
    except Exception:
        days_since_last_strength = None

    training_day_ctx = training_day_ctx if isinstance(training_day_ctx, dict) else {}

    recovery_state = recovery_state if isinstance(recovery_state, dict) else {}
    recovery_key = str(recovery_state.get("recovery_state", "")).strip().lower()
    load_status = str(recovery_state.get("load_status", "")).strip().lower()

    logger.warning(
        "reentry_check readiness=%s fatigue=%s recovery_key=%s load_status=%s days_since_last_strength=%s training_day_ctx=%s",
        readiness_score,
        fatigue_score,
        recovery_key,
        load_status,
        days_since_last_strength,
        training_day_ctx,
    )
    if readiness_score > 3:
        logger.warning("reentry_check_result=false reason=readiness_above_3")
        return False
    if fatigue_score >= 4:
        logger.warning("reentry_check_result=false reason=fatigue_gte_4")
        return False
    if recovery_key == "recover":
        logger.warning("reentry_check_result=false reason=recovery_key_recover")
        return False
    if load_status not in ("underloaded", "balanced"):
        logger.warning("reentry_check_result=false reason=load_status_not_allowed")
        return False
    if days_since_last_strength is not None and days_since_last_strength < 3:
        logger.warning("reentry_check_result=false reason=recent_strength")
        return False

    logger.warning("reentry_check_result=true")
    return True


def get_live_adaptation_state_for(user_id):
    try:
        user_id = str(user_id or "").strip()
        raw = get_adaptation_state()
        if not isinstance(raw, dict):
            return {}
        users = raw.get("users", {})
        if not isinstance(users, dict):
            return {}
        state = users.get(user_id, {})
        return state if isinstance(state, dict) else {}
    except Exception:
        return {}

def _decision_label(decision):
    decision = str(decision or "").strip()
    labels = {
        "progress": "Progressér",
        "hold": "Hold niveau",
        "simplify": "Forenkle",
        "recover": "Restitution",
        "follow_plan": "Følg planen",
    }
    return labels.get(decision, decision or "Følg planen")





# -------------------------------------------------------
# EXERCISE IDENTITY GRAPH
# -------------------------------------------------------

def _identity_text(v):
    return str(v or "").strip()

def _safe_list(v):
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    if not v:
        return []
    return [str(v).strip()]

def build_exercise_identity_graph(exercises):
    graph = {}

    for ex in exercises or []:
        if not isinstance(ex, dict):
            continue

        ex_id = _identity_text(ex.get("id"))
        if not ex_id:
            continue

        movement = _identity_text(ex.get("movement_pattern"))
        category = _identity_text(ex.get("category") or ex.get("exercise_category"))
        fatigue_group = _identity_text(ex.get("fatigue_group") or movement or category)
        load_type = _identity_text(
            ex.get("equipment_type") or
            ("bodyweight" if ex.get("supports_bodyweight") else "external")
        )

        graph[ex_id] = {
            "exercise_id": ex_id,
            "movement_pattern": movement,
            "category": category,
            "fatigue_group": fatigue_group,
            "load_type": load_type,
            "related_exercises": []
        }

    ids = list(graph.keys())

    for ex_id in ids:
        base = graph[ex_id]
        related = []

        for other_id in ids:
            if other_id == ex_id:
                continue

            other = graph[other_id]
            score = 0

            if base["movement_pattern"] and base["movement_pattern"] == other["movement_pattern"]:
                score += 3

            if base["fatigue_group"] and base["fatigue_group"] == other["fatigue_group"]:
                score += 2

            if base["category"] and base["category"] == other["category"]:
                score += 1

            if score > 0:
                related.append({
                    "exercise_id": other_id,
                    "score": score
                })

        related.sort(key=lambda x: -x["score"])
        base["related_exercises"] = related[:8]

    return graph


def build_recovery_state(user_id, latest_checkin, days_since_last_strength=None):
    """
    Recovery model v0.1
    Uses:
    - sleep_score
    - energy_score
    - soreness_score
    - load_status
    - days_since_last_strength
    """
    state = get_live_adaptation_state_for(user_id)
    load_metrics = state.get("load_metrics", {}) if isinstance(state, dict) else {}
    load_status = str(load_metrics.get("load_status", "underloaded")).strip()

    sleep_score = 0
    energy_score = 0
    soreness_score = 0

    if isinstance(latest_checkin, dict):
        try:
            sleep_score = int(latest_checkin.get("sleep_score", 0) or 0)
        except Exception:
            sleep_score = 0
        try:
            energy_score = int(latest_checkin.get("energy_score", 0) or 0)
        except Exception:
            energy_score = 0
        try:
            soreness_score = int(latest_checkin.get("soreness_score", 0) or 0)
        except Exception:
            soreness_score = 0

    score = 50
    explanation = []

    # Sleep
    score += (sleep_score - 3) * 8
    if sleep_score >= 4:
        explanation.append("god søvn")
    elif sleep_score <= 2:
        explanation.append("lav søvnkvalitet")

    # Energy
    score += (energy_score - 3) * 8
    if energy_score >= 4:
        explanation.append("god energi")
    elif energy_score <= 2:
        explanation.append("lav energi")

    # Soreness
    score -= max(0, soreness_score - 2) * 10
    if soreness_score >= 4:
        explanation.append("høj ømhed")
    elif soreness_score <= 2:
        explanation.append("lav ømhed")

    # Global load
    if load_status == "spiking":
        score -= 18
        explanation.append("belastning er i spike")
    elif load_status == "elevated":
        score -= 10
        explanation.append("belastning er forhøjet")
    elif load_status == "underloaded":
        score += 4
        explanation.append("belastning er lav")

    # Days since last strength
    try:
        d = int(days_since_last_strength) if days_since_last_strength is not None else None
    except Exception:
        d = None

    if d is not None:
        if d >= 2:
            score += 6
            explanation.append("du har haft lidt afstand til sidste styrkepas")
        elif d == 0:
            score -= 6
            explanation.append("du trænede styrke meget for nylig")

    score = max(0, min(100, int(round(score))))

    if score >= 70:
        recovery_state = "ready"
    elif score >= 45:
        recovery_state = "caution"
    else:
        recovery_state = "recover"

    strain_flag = bool(load_status in ("spiking", "elevated") and score < 60)

    return {
        "recovery_score": score,
        "recovery_state": recovery_state,
        "strain_flag": strain_flag,
        "explanation": explanation,
        "sleep_score": sleep_score,
        "energy_score": energy_score,
        "soreness_score": soreness_score,
        "load_status": load_status,
        "days_since_last_strength": days_since_last_strength,
    }


def build_training_decision(user_id, plan_item, readiness, time_available):
    state = get_live_adaptation_state_for(user_id)
    load_metrics = state.get("load_metrics", {}) if isinstance(state, dict) else {}
    exercise_profiles = state.get("exercise_profiles", {}) if isinstance(state, dict) else {}
    identity_graph = state.get("exercise_identity_graph", {}) if isinstance(state, dict) else {}
    family_fatigue_map = state.get("family_fatigue", {}) if isinstance(state, dict) else {}
    learning_signals = state.get("learning_signals", {}) if isinstance(state, dict) else {}

    load_status = str(load_metrics.get("load_status", "underloaded")).strip()
    exercise_id = str((plan_item or {}).get("exercise_id", "")).strip()
    profile = exercise_profiles.get(exercise_id, {}) if isinstance(exercise_profiles, dict) else {}
    learning = learning_signals.get(exercise_id, {}) if isinstance(learning_signals, dict) else {}

    trend = str(profile.get("trend", "stable")).strip()
    recommended = str(profile.get("recommended_action", "hold")).strip()
    confidence = profile.get("confidence", None)

    learned_recommendation = str(learning.get("learned_recommendation", "")).strip()
    next_variation = str(learning.get("next_variation", "")).strip()
    progression_channels = learning.get("progression_channels", [])
    if not isinstance(progression_channels, list):
        progression_channels = []
    try:
        top_hit_rate = float(learning.get("top_hit_rate", 0) or 0)
    except Exception:
        top_hit_rate = 0.0
    try:
        failure_signal = float(learning.get("failure_signal", 0) or 0)
    except Exception:
        failure_signal = 0.0
    try:
        dropoff_signal = float(learning.get("dropoff_signal", 0) or 0)
    except Exception:
        dropoff_signal = 0.0
    try:
        consistency_signal = float(learning.get("consistency_signal", 0) or 0)
    except Exception:
        consistency_signal = 0.0

    node = identity_graph.get(exercise_id, {}) if isinstance(identity_graph, dict) else {}
    family_key = (
        str(node.get("fatigue_group", "")).strip()
        or str(node.get("movement_pattern", "")).strip()
        or str(node.get("category", "")).strip()
    ) or None

    family_info = family_fatigue_map.get(family_key, {}) if (family_key and isinstance(family_fatigue_map, dict)) else {}
    family_state = str(family_info.get("family_state", "unknown")).strip()
    family_signals = family_info.get("signals", []) if isinstance(family_info, dict) else []
    if not isinstance(family_signals, list):
        family_signals = []

    explanation = []

    if load_status == "spiking":
        explanation.append("samlet belastning er høj")
    elif load_status == "elevated":
        explanation.append("samlet belastning er forhøjet")
    elif load_status == "underloaded":
        explanation.append("samlet belastning er lav")

    try:
        readiness_val = int(readiness or 0)
    except Exception:
        readiness_val = 0

    if readiness_val <= 2:
        explanation.append("low readiness reported")
    elif readiness_val >= 4:
        explanation.append("high readiness reported")

    try:
        time_val = int(time_available or 0)
    except Exception:
        time_val = 0

    if time_val and time_val <= 20:
        explanation.append("kort træningstid i dag")

    if trend == "progressing":
        explanation.append(f"{exercise_id} viser fremgang")
    elif trend == "regressing":
        explanation.append(f"{exercise_id} viser tegn på tilbagegang")
    elif trend == "stable":
        explanation.append(f"{exercise_id} er stabil")

    if family_state == "fatigued" and family_key:
        explanation.append(f"{family_key} family shows fatigue")
    elif family_state == "ready" and family_key:
        explanation.append(f"{family_key}-familien er klar")
    elif family_state == "stable" and family_key:
        explanation.append(f"{family_key}-familien er stabil")

    if recommended == "increase_load":
        explanation.append("øvelsen tåler sandsynligvis mere belastning")
    elif recommended == "increase_reps":
        explanation.append("øvelsen tåler sandsynligvis flere reps")
    elif recommended == "hold":
        explanation.append("øvelsen bør holdes stabil")
    elif recommended == "simplify":
        explanation.append("øvelsen bør forenkles")

    if learned_recommendation == "increase_load":
        explanation.append("systemet har lært at mere belastning sandsynligvis er klar")
    elif learned_recommendation == "increase_reps":
        explanation.append("systemet har lært at flere reps sandsynligvis er klar")
    elif learned_recommendation == "increase_time":
        explanation.append("systemet har lært at længere tid sandsynligvis er klar")
    elif learned_recommendation == "progress_variation":
        explanation.append("systemet har lært at næste variation sandsynligvis er klar")
        if next_variation:
            explanation.append(f"næste variation: {next_variation}")
    elif learned_recommendation == "simplify":
        explanation.append("systemet har lært at øvelsen bør forenkles")

    if top_hit_rate >= 0.66:
        explanation.append(f"høj top-hit-rate ({top_hit_rate})")
    if failure_signal >= 0.34:
        explanation.append(f"forhøjet failure-signal ({failure_signal})")
    if dropoff_signal >= 0.35:
        explanation.append(f"tydelig set-dropoff ({dropoff_signal})")
    if consistency_signal >= 0.75:
        explanation.append(f"god konsistens ({consistency_signal})")

    if bool((plan_item or {}).get("equipment_constraint", False)):
        explanation.append("næste vægtspring er større end anbefalet progression")

    if load_status == "spiking":
        decision = "hold"
    elif family_state == "fatigued":
        decision = "simplify"
    elif learned_recommendation == "simplify":
        decision = "simplify"
    elif recommended == "simplify":
        decision = "simplify"
    elif trend == "regressing":
        decision = "simplify"
    elif family_state == "ready" and learned_recommendation in ("increase_load", "increase_reps", "increase_time", "progress_variation") and readiness_val >= 4:
        decision = "progress"
    elif learned_recommendation in ("increase_load", "increase_reps", "increase_time", "progress_variation") and readiness_val >= 4 and load_status not in ("spiking", "elevated"):
        decision = "progress"
    elif family_state == "ready" and recommended in ("increase_load", "increase_reps") and readiness_val >= 4:
        decision = "progress"
    elif recommended in ("increase_load", "increase_reps") and readiness_val >= 4:
        decision = "progress"
    elif recommended == "hold":
        decision = "hold"
    else:
        decision = "follow_plan"

    label = _decision_label(decision)

    coach_text = "Følg planen i dag."
    if explanation:
        coach_text = label + ". " + " · ".join(explanation) + "."

    suggested_variation = ""
    if (
        learned_recommendation == "progress_variation"
        and next_variation
        and readiness_val >= 4
        and load_status not in ("spiking", "elevated")
    ):
        suggested_variation = next_variation

    return {
        "decision": decision,
        "decision_label": label,
        "explanation": explanation,
        "coach_text": coach_text,
        "confidence": confidence,
        "family_key": family_key,
        "family_state": family_state,
        "family_signals": family_signals[:5],
        "learned_recommendation": learned_recommendation,
        "next_variation": next_variation,
        "suggested_variation": suggested_variation,
        "progression_channels": progression_channels,
        "top_hit_rate": top_hit_rate,
        "failure_signal": failure_signal,
        "dropoff_signal": dropoff_signal,
        "consistency_signal": consistency_signal
    }


def compute_cardio_load_metrics(user_id):
    user_id = str(user_id or "").strip()

    session_items = list_session_results_for_user(user_id)
    cardio_items = []

    for item in session_items:
        if not isinstance(item, dict):
            continue
        session_type = str(item.get("session_type", item.get("type", ""))).strip().lower()
        if session_type not in ("løb", "cardio", "run"):
            continue
        cardio_items.append(item)

    if not cardio_items:
        workouts = list_workouts_for_user(user_id)
        for item in workouts:
            if not isinstance(item, dict):
                continue
            session_type = str(item.get("session_type", item.get("type", ""))).strip().lower()
            if session_type not in ("løb", "cardio", "run"):
                continue
            cardio_items.append(item)

    cardio_items = sorted(
        cardio_items,
        key=lambda x: str(x.get("date", x.get("created_at", "")))
    )

    today_str = datetime.now(timezone.utc).date().isoformat()
    weekly_cardio_load = 0.0
    last_cardio_kind = None
    days_since_last_cardio = None
    last_hard_cardio_days_ago = None

    def cardio_intensity_factor(kind):
        k = str(kind or "").strip().lower()
        mapping = {
            "restitution": 0.6,
            "recovery": 0.6,
            "base": 1.0,
            "tempo": 1.4,
            "threshold": 1.4,
            "interval": 1.8,
            "intervals": 1.8,
            "test": 2.0,
            "benchmark": 2.0,
        }
        return mapping.get(k, 1.0)

    for item in cardio_items:
        date_str = str(item.get("date", "")).strip()
        kind = str(item.get("cardio_kind", item.get("cardio_type", "base"))).strip().lower() or "base"
        duration = item.get("duration_min", 0)
        try:
            duration = int(duration or 0)
        except Exception:
            duration = 0

        rpe = item.get("avg_rpe", None)
        try:
            rpe = int(rpe) if rpe not in (None, "", "null") else None
        except Exception:
            rpe = None

        rpe_factor = 1.0
        if rpe is not None:
            rpe_factor = max(0.7, min(1.3, rpe / 5.0))

        if date_str:
            diff = days_between_iso_dates(today_str, date_str)
            if diff is not None and diff >= 0 and diff <= 6:
                weekly_cardio_load += duration * cardio_intensity_factor(kind) * rpe_factor

    if cardio_items:
        last = cardio_items[-1]
        last_cardio_kind = str(last.get("cardio_kind", last.get("cardio_type", "base"))).strip().lower() or "base"
        last_date = str(last.get("date", "")).strip()
        if last_date:
            days_since_last_cardio = days_between_iso_dates(today_str, last_date)

        for item in reversed(cardio_items):
            kind = str(item.get("cardio_kind", item.get("cardio_type", "base"))).strip().lower()
            if kind in ("tempo", "threshold", "interval", "intervals", "test", "benchmark"):
                last_date = str(item.get("date", "")).strip()
                if last_date:
                    last_hard_cardio_days_ago = days_between_iso_dates(today_str, last_date)
                break

    load_status = "balanced"
    if weekly_cardio_load < 30:
        load_status = "underloaded"
    elif weekly_cardio_load <= 75:
        load_status = "balanced"
    elif weekly_cardio_load <= 110:
        load_status = "elevated"
    else:
        load_status = "spiking"

    return {
        "weekly_cardio_load": round(weekly_cardio_load, 2),
        "last_cardio_kind": last_cardio_kind,
        "days_since_last_cardio": days_since_last_cardio,
        "last_hard_cardio_days_ago": last_hard_cardio_days_ago,
        "load_status": load_status,
    }


def get_local_protect_regions(user_id, regions=None):
    user_id = str(user_id or "").strip()
    state = get_live_adaptation_state_for(user_id)
    local_state = state.get("local_state", {}) if isinstance(state, dict) else {}
    if not isinstance(local_state, dict):
        local_state = {}

    if not isinstance(regions, (list, tuple, set)):
        regions = local_state.keys()

    out = []
    for region in regions:
        key = str(region or "").strip()
        if not key:
            continue
        info = local_state.get(key, {})
        if not isinstance(info, dict):
            continue
        if str(info.get("state", "")).strip() == "protect":
            out.append(key)
    return sorted(set(out))


def build_local_risk_planning_override(user_id, readiness_score, fatigue_score, timing_state, time_budget_min):
    protect_regions = get_local_protect_regions(user_id, regions=("knee", "ankle_calf", "low_back"))
    if not protect_regions:
        return None

    if timing_state == "early":
        return {
            "session_type": "restitution",
            "template_id": "restitution_easy",
            "plan_entries": build_restitution_plan(time_budget_min),
            "plan_variant": "local_protection_override",
            "reason": f"lokal beskyttelse i {', '.join(protect_regions)} overstyrer cardiovalg",
            "autoplan_meta": {
                "template_mode": "local_protection_override_v0_1",
                "families_selected": [],
                "local_protection_override": True,
                "protected_regions": protect_regions,
            },
        }

    if int(fatigue_score or 0) >= 4:
        return {
            "session_type": "restitution",
            "template_id": "restitution_easy",
            "plan_entries": build_restitution_plan(time_budget_min),
            "plan_variant": "local_protection_override",
            "reason": f"lokal beskyttelse i {', '.join(protect_regions)} prioriterer restitution",
            "autoplan_meta": {
                "template_mode": "local_protection_override_v0_1",
                "families_selected": [],
                "local_protection_override": True,
                "protected_regions": protect_regions,
            },
        }

    return None


def choose_cardio_session(user_id, readiness=None, time_budget_min=None, recovery_state=None, training_day_context=None):
    user_id = str(user_id or "").strip()
    metrics = compute_cardio_load_metrics(user_id)

    try:
        readiness_val = int(readiness if readiness is not None else 0)
    except Exception:
        readiness_val = 0

    try:
        time_val = int(time_budget_min if time_budget_min is not None else 30)
    except Exception:
        time_val = 30

    recovery_key = ""
    if isinstance(recovery_state, dict):
        recovery_key = str(recovery_state.get("recovery_state", "")).strip().lower()

    training_ctx = training_day_context if isinstance(training_day_context, dict) else {}
    is_training_day = training_ctx.get("is_training_day", True)

    weekly_cardio_load = float(metrics.get("weekly_cardio_load", 0) or 0)
    last_cardio_kind = str(metrics.get("last_cardio_kind", "")).strip().lower()
    last_hard_days = metrics.get("last_hard_cardio_days_ago")
    load_status = str(metrics.get("load_status", "balanced")).strip().lower()
    protect_regions = get_local_protect_regions(user_id, regions=("knee", "ankle_calf", "low_back"))

    kind = "base"
    duration = 30
    reason = []

    # first gate: recovery / off-day
    if recovery_key == "recover":
        kind = "restitution"
        duration = min(time_val, 20) if time_val > 0 else 20
        reason.extend(["recovery requires restitution", "low load prioritized"])
    elif is_training_day is False:
        if readiness_val >= 4 and load_status in ("underloaded", "balanced"):
            kind = "base"
            duration = min(max(20, time_val), 35)
            reason.extend(["not a planned training day", "chosen as an optional light session"])
        else:
            kind = "restitution"
            duration = min(time_val, 20) if time_val > 0 else 20
            reason.extend(["not a planned training day", "recovery prioritized"])
    else:
        # planned training day
        if readiness_val <= 2:
            kind = "restitution"
            duration = min(time_val, 20) if time_val > 0 else 20
            reason.extend(["low readiness", "light cardio prioritized"])
        elif time_val <= 20:
            if (last_hard_days is None or last_hard_days >= 4) and load_status in ("underloaded", "balanced") and readiness_val >= 4:
                kind = "interval"
                duration = 20
                reason.extend(["limited time", "no hard cardio recently", "high readiness"])
            else:
                kind = "base"
                duration = 20
                reason.extend(["limited time", "easy base is the most robust choice"])
        else:
            if (last_hard_days is None or last_hard_days >= 4) and readiness_val >= 4 and load_status in ("underloaded", "balanced"):
                if weekly_cardio_load < 45:
                    kind = "tempo"
                    duration = min(max(25, time_val), 40)
                    reason.extend(["high readiness", "low/moderate cardio load", "tempo prioritized"])
                else:
                    kind = "base"
                    duration = min(max(25, time_val), 40)
                    reason.extend(["cardio load is already moderate", "easy base prioritized"])
            elif load_status == "spiking":
                kind = "restitution"
                duration = min(time_val, 25)
                reason.extend(["cardio load is high", "recovery prioritized"])
            else:
                kind = "base"
                duration = min(max(25, time_val), 40)
                reason.extend(["moderate readiness", "base session prioritized"])

    # avoid repeating hard sessions too close together
    if kind in ("interval", "tempo") and last_cardio_kind in ("interval", "tempo", "threshold", "test", "benchmark"):
        if last_hard_days is not None and last_hard_days < 3:
            kind = "base"
            duration = min(max(20, time_val), 35)
            reason.append("hård cardio for nylig, nedjusteret til base")

    if protect_regions:
        knee_or_calf = any(x in protect_regions for x in ("knee", "ankle_calf"))
        low_back_protect = "low_back" in protect_regions

        if knee_or_calf:
            kind = "restitution"
            duration = min(time_val, 20) if time_val > 0 else 20
            reason.append(f"lokal beskyttelse i {', '.join(protect_regions)}")
            reason.append("cardio nedjusteret til restitution")
        elif low_back_protect and kind in ("interval", "tempo"):
            kind = "base"
            duration = min(max(20, time_val), 30)
            reason.append("lokal beskyttelse i low_back")
            reason.append("hård cardio nedjusteret til base")

    return {
        "cardio_kind": kind,
        "duration_min": int(duration),
        "reason": reason[:6],
        "metrics": metrics,
    }


def build_autoplan_cardio(user_id, readiness=None, time_budget_min=None, recovery_state=None, training_day_context=None):
    picked = choose_cardio_session(
        user_id=user_id,
        readiness=readiness,
        time_budget_min=time_budget_min,
        recovery_state=recovery_state,
        training_day_context=training_day_context,
    )

    kind = str(picked.get("cardio_kind", "base")).strip().lower()
    duration = int(picked.get("duration_min", 30) or 30)

    if kind == "restitution":
        target_reps = f"{duration} min rolig gang eller meget let jog"
        exercise_id = "cardio_restitution"
    elif kind == "interval":
        work_blocks = max(6, min(10, duration // 2))
        target_reps = f"10 min opvarmning + {work_blocks}x(1 min hurtigt / 1 min roligt) + 5 min nedkøling"
        exercise_id = "cardio_intervals"
    elif kind == "tempo":
        target_reps = "10 min opvarmning + 2 x 8 min kontrolleret hårdt tempo + 2 min roligt mellem + 5 min nedkøling"
        exercise_id = "cardio_tempo"
    else:
        target_reps = f"{duration} min roligt løb i snakketempo"
        exercise_id = "cardio_base"

    entry = {
        "exercise_id": exercise_id,
        "sets": 1,
        "target_reps": target_reps,
        "target_load": None,
        "progression_decision": "autoplan_cardio_initial",
        "progression_reason": "autoplan selected a cardio session based on readiness, recovery, and recent cardio load",
        "recommended_next_load": None,
        "actual_possible_next_load": None,
        "equipment_constraint": False,
        "secondary_constraints": [],
        "next_target_reps": None,
        "substituted_from": None,
        "autoplan_family": "cardio",
        "autoplan_score": None,
        "autoplan_reason": picked.get("reason", []),
        "decision": {
            "decision": kind,
            "decision_label": kind.title(),
            "explanation": picked.get("reason", []),
            "coach_text": " · ".join(picked.get("reason", [])),
            "metrics": picked.get("metrics", {}),
        }
    }

    return {
        "session_type": "løb",
        "template_mode": "autoplan_cardio_v0_1",
        "cardio_kind": kind,
        "reason": picked.get("reason", []),
        "entries": [entry],
    }



def build_cardio_plan(time_budget_min, user_id=None, readiness=None, recovery_state=None, training_day_context=None):
    cardio_plan = build_autoplan_cardio(
        user_id=user_id,
        readiness=readiness,
        time_budget_min=time_budget_min,
        recovery_state=recovery_state,
        training_day_context=training_day_context,
    )
    if isinstance(cardio_plan, dict):
        entries = cardio_plan.get("entries", [])
        return entries if isinstance(entries, list) else []
    return []

def normalize_program_day_label(label):
    value = str(label or "").strip().lower()
    if value in ("dag a", "day a"):
        return "day_a"
    if value in ("dag b", "day b"):
        return "day_b"
    return value.replace(" ", "_")

def infer_equipment_profile(user_settings):
    if not isinstance(user_settings, dict):
        return "minimal_home"

    available = user_settings.get("available_equipment", {})
    if not isinstance(available, dict):
        available = {}

    has_barbell = bool(available.get("barbell"))
    has_bench = bool(available.get("bench"))
    has_dumbbell = bool(available.get("dumbbell"))
    has_machine = bool(available.get("machine"))
    has_cable = bool(available.get("cable"))

    if has_barbell and has_bench and (has_machine or has_cable):
        return "full_gym"
    if has_barbell and has_bench:
        return "gym_basic"
    if has_dumbbell:
        return "dumbbell_home"
    return "minimal_home"


def select_strength_program(programs, user_settings, weekly_target_sessions):
    equipment_profile = infer_equipment_profile(user_settings)
    target_sessions = int(weekly_target_sessions or 2)

    candidates = []
    for program in programs:
        if str(program.get("kind", "")).strip() != "strength":
            continue

        supported_sessions = program.get("supported_weekly_sessions", []) or []
        equipment_profiles = program.get("equipment_profiles", []) or []

        if target_sessions in supported_sessions and equipment_profile in equipment_profiles:
            candidates.append(program)

    preferred_ids = []
    if target_sessions >= 3 and equipment_profile in ("minimal_home", "dumbbell_home"):
        preferred_ids.append("strength_full_body_3x_beginner")
    if target_sessions == 2 and equipment_profile in ("gym_basic", "full_gym"):
        preferred_ids.append("base_strength_a")
    if target_sessions == 2 and equipment_profile in ("minimal_home", "dumbbell_home"):
        preferred_ids.append("starter_strength_2x")

    for pid in preferred_ids:
        for program in candidates:
            if program.get("id") == pid:
                return pid

    if candidates:
        return str(candidates[0].get("id"))

    for pid in ("starter_strength_2x", "base_strength_a"):
        for program in programs:
            if program.get("id") == pid:
                return pid

    return None



def select_endurance_program(programs, user_settings, weekly_target_sessions, prefs):
    equipment_profile = infer_equipment_profile(user_settings)
    target_sessions = int(weekly_target_sessions or 2)
    prefs = prefs if isinstance(prefs, dict) else {}

    running_enabled = bool(prefs.get("running", True))
    strength_enabled = bool(prefs.get("strength_weights", True)) or bool(prefs.get("bodyweight", True))

    if not running_enabled:
        return None

    if running_enabled and strength_enabled and target_sessions >= 3:
        for program in programs:
            if program.get("id") == "hybrid_run_strength_3x_beginner":
                return "hybrid_run_strength_3x_beginner"

    if target_sessions >= 3:
        for program in programs:
            if program.get("id") == "base_run_3x":
                return "base_run_3x"

    if target_sessions == 2:
        for program in programs:
            if program.get("id") == "starter_run_2x":
                return "starter_run_2x"

    for program in programs:
        if str(program.get("kind", "")).strip() != "run":
            continue
        supported_sessions = program.get("supported_weekly_sessions", []) or []
        equipment_profiles = program.get("equipment_profiles", []) or []
        if target_sessions in supported_sessions and equipment_profile in equipment_profiles:
            return str(program.get("id"))

    return None


def build_strength_plan(programs, exercises, latest_strength, time_budget_min, fatigue_score, user_settings=None, user_id=None, selected_program_id=None):
    program = None

    if selected_program_id:
        for p in programs:
            if p.get("id") == selected_program_id:
                program = p
                break

    if not program:
        for p in programs:
            if p.get("id") == "starter_strength_2x":
                program = p
                break

    if not program:
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

    latest_day = normalize_program_day_label(latest_strength.get("program_day_label", "") if latest_strength else "")
    next_day_key = "day_a"
    if latest_day == "day_a":
        next_day_key = "day_b"
    elif latest_day == "day_b":
        next_day_key = "day_a"

    selected_day = None
    for day in program.get("days", []):
        if normalize_program_day_label(day.get("label")) == next_day_key:
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

    template_id = f"strength_{next_day_key}"
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

    state = get_live_adaptation_state_for(user_id) if user_id is not None else {}
    local_state = state.get("local_state", {}) if isinstance(state, dict) else {}
    if not isinstance(local_state, dict):
        local_state = {}

    substitution_map = {
        "squat": ["lunges", "split_squat", "step_ups", "single_leg_sit_to_stand"],
        "bench_press": ["push_ups", "incline_push_ups", "diamond_push_ups"],
        "overhead_press": ["pike_push_ups", "push_ups", "incline_push_ups"],
        "barbell_row": ["dumbbell_row", "reverse_snow_angels", "superman_hold"],
        "incline_push_ups": ["bird_dog", "dead_bug", "plank"],
        "dumbbell_row": ["reverse_snow_angels", "bird_dog", "dead_bug"],
        "dead_bug": ["bird_dog", "plank", "glute_bridge"],
        "romanian_deadlift": ["glute_bridge", "single_leg_glute_bridge", "hamstring_walkouts", "hip_hinge_bw"],
    }

    ankle_calf_protect = False
    ankle_info = local_state.get("ankle_calf", {}) if isinstance(local_state, dict) else {}
    if isinstance(ankle_info, dict):
        ankle_calf_protect = str(ankle_info.get("state", "")).strip() == "protect"

    knee_protect = False
    knee_info = local_state.get("knee", {}) if isinstance(local_state, dict) else {}
    if isinstance(knee_info, dict):
        knee_protect = str(knee_info.get("state", "")).strip() == "protect"

    hip_protect = False
    hip_info = local_state.get("hip", {}) if isinstance(local_state, dict) else {}
    if isinstance(hip_info, dict):
        hip_protect = str(hip_info.get("state", "")).strip() == "protect"

    filtered_exercises = []
    excluded_due_to_equipment = []
    substitutions_used = []

    for ex in selected_exercises:
        exercise_id = ex.get("exercise_id", "")
        meta = exercise_map.get(exercise_id, {}) or {}
        equipment_type = str(meta.get("equipment_type", "")).strip()
        local_targets = get_local_load_targets_for_exercise(exercise_id, exercises=exercises)
        blocked_regions = []

        for region in local_targets:
            info = local_state.get(region, {}) if isinstance(local_state, dict) else {}
            if not isinstance(info, dict):
                continue
            region_state = str(info.get("state", "")).strip()
            if region_state == "protect":
                blocked_regions.append(region)

        local_blocked = bool(blocked_regions)

        if not equipment_type and not local_blocked:
            filtered_exercises.append(ex)
            continue

        allowed = bool(available_equipment.get(equipment_type, True)) if equipment_type else True
        if allowed and not local_blocked:
            filtered_exercises.append(ex)
            continue

        substitute_candidates = substitution_map.get(exercise_id, [])
        upper_body_protect = local_blocked and any(region in {"shoulder", "elbow", "wrist"} for region in blocked_regions)

        if exercise_id == "incline_push_ups" and upper_body_protect:
            substitute_candidates = [
                "bird_dog",
                "dead_bug",
                "plank",
            ]
        elif exercise_id == "dumbbell_row" and upper_body_protect:
            substitute_candidates = [
                "reverse_snow_angels",
                "bird_dog",
                "dead_bug",
            ]
        elif exercise_id == "squat" and local_blocked and ankle_calf_protect:
            substitute_candidates = [
                "glute_bridge",
                "hamstring_walkouts",
                "hip_hinge_bw",
                "split_squat",
                "step_ups",
            ]
        elif exercise_id == "squat" and local_blocked and knee_protect:
            substitute_candidates = [
                "glute_bridge",
                "hip_hinge_bw",
                "hamstring_walkouts",
                "step_ups",
                "split_squat",
            ]
        elif exercise_id == "squat" and local_blocked and hip_protect:
            substitute_candidates = [
                "glute_bridge",
                "hamstring_walkouts",
                "bird_dog",
                "plank",
            ]
        elif exercise_id == "dead_bug" and local_blocked and hip_protect:
            substitute_candidates = [
                "bird_dog",
                "plank",
                "glute_bridge",
            ]
        if isinstance(substitute_candidates, str):
            substitute_candidates = [substitute_candidates]

        chosen_substitute_id = choose_best_substitute(
            original_exercise_id=exercise_id,
            candidate_ids=substitute_candidates,
            exercise_map=exercise_map,
            available_equipment=available_equipment,
            local_state=local_state,
            exercises=exercises
        )

        if chosen_substitute_id:
            existing_ids = {
                str(item.get("exercise_id", "")).strip()
                for item in filtered_exercises
                if isinstance(item, dict)
            }
            duplicate_conservative_fallback = (
                chosen_substitute_id in {"dead_bug", "bird_dog", "plank", "reverse_snow_angels", "glute_bridge", "hamstring_walkouts"}
                and chosen_substitute_id in existing_ids
            )

            if duplicate_conservative_fallback:
                excluded_due_to_equipment.append({
                    "exercise_id": exercise_id,
                    "equipment_type": equipment_type,
                    "local_protection_regions": sorted(set(blocked_regions)),
                })
            else:
                substituted = dict(ex)
                substituted["exercise_id"] = chosen_substitute_id
                substituted["_substituted_from"] = exercise_id
                filtered_exercises.append(substituted)
                substitutions_used.append({
                    "from_exercise_id": exercise_id,
                    "to_exercise_id": chosen_substitute_id,
                    "missing_equipment_type": None if allowed else equipment_type,
                    "local_protection_regions": sorted(set(blocked_regions)),
                })
        else:
            excluded_due_to_equipment.append({
                "exercise_id": exercise_id,
                "equipment_type": equipment_type,
                "local_protection_regions": sorted(set(blocked_regions)),
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
        progression = compute_progression_for_exercise(exercise_id, user_id=latest_strength.get("user_id") if isinstance(latest_strength, dict) else None)
        next_load = progression.get("next_load")

        target_load = (
            f"{next_load} kg"
            if next_load not in (None, "", 0) and meta.get("default_unit") == "kg"
            else None
        )

        progression_reason = progression.get("progression_reason", "") or ""

        result_entry = {
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
        }

        result_entry["decision"] = build_training_decision(
            user_id=user_id,
            plan_item=result_entry,
            readiness=latest_strength.get("readiness_score", 0) if isinstance(latest_strength, dict) else 5,
            time_available=time_budget_min
        )

        plan_entries.append(result_entry)

    return {
        "ok": True,
        "template_id": template_id,
        "plan_entries": plan_entries,
        "plan_variant": plan_variant,
        "reason": reason,
        "excluded_due_to_equipment": excluded_due_to_equipment,
        "substitutions_used": substitutions_used
    }


def build_progression_context(exercise_id, user_id=None):
    exercise = {}
    workouts = read_json_file(FILES["workouts"])
    exercises = read_json_file(FILES["exercises"])
    user_settings = get_user_settings_for(user_id) if user_id not in (None, "") else {}

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
    fatigue_ctx = compute_fatigue_score_from_latest_strength(session_results, workouts, user_id=user_id, latest_checkin=None)
    fatigue_score = fatigue_ctx.get("fatigue_score", 0)
    recent_recovery_ctx = build_recent_recovery_context(user_id, max_items=3)

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
        "recent_recovery_ctx": recent_recovery_ctx,
        "last_load": last_load,
        "last_entry": last_entry,
    }





def compute_progression_for_exercise(exercise_id, user_id=None):
    ctx = build_progression_context(exercise_id, user_id=user_id)
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
    auth_status, auth_user = get_current_auth_user()
    if auth_status != "ok" or not auth_user:
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




def build_manual_override_today_plan_response(latest_checkin, checkin_date, readiness_score, manual_override):
    override_entries = []
    raw_entries = manual_override.get("entries", [])
    if not isinstance(raw_entries, list):
        raw_entries = []

    for e in raw_entries:
        if not isinstance(e, dict):
            continue
        override_entries.append({
            "exercise_id": str(e.get("exercise_id", "")).strip(),
            "sets": e.get("sets", ""),
            "target_reps": str(e.get("reps", "")).strip(),
            "target_load": str(e.get("load", "")).strip() or None,
            "progression_decision": "manual_override",
            "progression_reason": "Manuel plan valgt som dagens træning",
            "recommended_next_load": None,
            "actual_possible_next_load": None,
            "equipment_constraint": False,
            "secondary_constraints": [],
            "next_target_reps": None,
            "substituted_from": None
        })



    return jsonify({
        "ok": True,
        "item": {
            "checkin_id": latest_checkin.get("id"),
            "date": checkin_date,
            "recommended_for": checkin_date,
            "decision_mode": "manual_override_v0_1",
            "timing_state": "on_time",
            "previous_recommended_for": None,
            "readiness_score": readiness_score,
            "weekly_status": None,
            "time_budget_min": latest_checkin.get("time_budget_min"),
            "session_type": str(manual_override.get("session_type", "")).strip() or "styrke",
            "latest_strength_failed": None,
            "latest_strength_load_drop_count": 0,
            "latest_strength_completed": None,
            "fatigue_score": 0,
            "recovery_state": None,
            "template_id": str(manual_override.get("program_id", "")).strip() or "manual_override",
            "template_mode": "manual_override_v0_1",
            "plan_variant": "manual_override",
            "reason": "Manuel plan overstyrer dagens autoplan.",
            "families_selected": [],
            "training_day_context": {},
            "entries": override_entries,
            "source": "manual_override",
            "manual_override_workout_id": manual_override.get("id")
        }
    })


def build_today_plan_context(auth_user, latest_checkin):
    readiness_score = int(latest_checkin.get("readiness_score", 0))
    checkin_date = str(latest_checkin.get("date", "")).strip()
    time_budget_min = int(latest_checkin.get("time_budget_min", 45) or 45)
    user_settings = get_user_settings_for(auth_user.get("user_id"))
    training_day_ctx = get_training_day_context(user_settings, checkin_date)
    weekly_target_sessions = get_weekly_target_sessions(user_settings)
    weekly_status = build_weekly_training_status(
        user_id=auth_user.get("user_id"),
        checkin_date=checkin_date,
        training_day_prefs=get_training_day_preferences(user_settings),
        weekly_target_sessions=weekly_target_sessions,
    )

    return {
        "readiness_score": readiness_score,
        "checkin_date": checkin_date,
        "time_budget_min": time_budget_min,
        "user_settings": user_settings,
        "training_day_ctx": training_day_ctx,
        "weekly_target_sessions": weekly_target_sessions,
        "weekly_status": weekly_status,
    }


def build_today_plan_timing_state(previous_recommendation, checkin_date):
    timing_state = "on_time"

    if previous_recommendation:
        previous_for = str(previous_recommendation.get("recommended_for", "")).strip()
        if previous_for and checkin_date:
            day_diff = days_between_iso_dates(checkin_date, previous_for)
            if day_diff is not None:
                if day_diff < 0:
                    timing_state = "early"
                elif day_diff > 1:
                    timing_state = "late"
                else:
                    timing_state = "on_time"

    return timing_state


def build_today_plan_fatigue_context(auth_user, latest_checkin, workouts, checkin_date):
    latest_strength = find_latest_strength_workout(workouts)
    days_since_last_strength = None
    if latest_strength:
        days_since_last_strength = days_between_iso_dates(checkin_date, latest_strength.get("date", ""))

    session_results = list_session_results_for_user(auth_user.get("user_id"))
    recommendations = read_json_file(FILES["recommendations"])
    previous_recommendation = recommendations[-1] if recommendations else None

    latest_strength_session = find_latest_session_by_type(session_results, "styrke")
    latest_strength_failed = session_has_failure(latest_strength_session)
    latest_strength_load_drop_count = count_load_drop_exercises(latest_strength_session)
    latest_strength_completed = None if latest_strength_session is None else bool(latest_strength_session.get("completed", False))

    fatigue_score = compute_fatigue_score(
        latest_strength_failed=latest_strength_failed,
        latest_strength_load_drop_count=latest_strength_load_drop_count,
        latest_strength_completed=latest_strength_completed,
        days_since_last_strength=days_since_last_strength,
    )

    recovery_state = build_recovery_state(
        user_id=auth_user.get("user_id"),
        latest_checkin=latest_checkin,
        days_since_last_strength=days_since_last_strength
    )

    fatigue_session_override = decide_fatigue_session_override(
        fatigue_score=fatigue_score,
        recovery_state=recovery_state,
    )

    return {
        "latest_strength": latest_strength,
        "days_since_last_strength": days_since_last_strength,
        "session_results": session_results,
        "previous_recommendation": previous_recommendation,
        "latest_strength_session": latest_strength_session,
        "latest_strength_failed": latest_strength_failed,
        "latest_strength_load_drop_count": latest_strength_load_drop_count,
        "latest_strength_completed": latest_strength_completed,
        "fatigue_score": fatigue_score,
        "recovery_state": recovery_state,
        "fatigue_session_override": fatigue_session_override,
    }


@app.get("/api/debug/exercise-config/<exercise_id>")
def debug_exercise_config(exercise_id):
    auth_user, auth_err = require_auth_user()
    if auth_err:
        return auth_err

    exercises = read_json_file(FILES["exercises"])
    user_settings = get_user_settings_for(auth_user.get("user_id"))
    exercise = get_exercise_config(exercises, exercise_id) or {}

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
    return jsonify(compute_progression_for_exercise(exercise_id, user_id=auth_user.get("user_id")))





def log_today_plan_decision(auth_user, checkin_date, session_type, template_id, plan_variant, reason, plan_entries):
    logger.info(
        "today_plan_decision user_id=%s date=%s session_type=%s template_id=%s plan_variant=%s reason=%s entries=%s",
        auth_user.get("user_id") if isinstance(auth_user, dict) else None,
        checkin_date,
        session_type,
        template_id,
        plan_variant,
        reason,
        len(plan_entries) if isinstance(plan_entries, list) else 0,
    )


def append_today_plan_trace(user_id, trace):
    if not isinstance(trace, dict):
        return

    item = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        **trace,
    }

    try:
        append_user_item("today_plan_traces", item)
    except Exception:
        logger.exception("today_plan_trace_write_failed")


def get_menstruation_planning_signal(latest_checkin):
    if not isinstance(latest_checkin, dict):
        return None

    menstrual_pain = str(latest_checkin.get("menstrual_pain", "none") or "none").strip().lower()
    menstruation_today = latest_checkin.get("menstruation_today")

    if menstrual_pain in ("moderate", "severe"):
        return {
            "active": True,
            "menstrual_pain": menstrual_pain,
            "menstruation_today": menstruation_today,
            "reason": f"rapporterede menstruationssmerter ({menstrual_pain})"
        }

    return None

def build_today_plan_priority_decision(
    auth_user,
    readiness_score,
    fatigue_score,
    timing_state,
    recovery_state,
    days_since_last_strength,
    time_budget_min,
    training_day_ctx,
    weekly_status,
    latest_checkin=None,
):
    local_override = build_local_risk_planning_override(
        auth_user.get("user_id") if isinstance(auth_user, dict) else None,
        readiness_score=readiness_score,
        fatigue_score=fatigue_score,
        timing_state=timing_state,
        time_budget_min=time_budget_min,
    )
    if isinstance(local_override, dict):
        local_override["weekly_status"] = weekly_status
        return local_override

    menstruation_signal = get_menstruation_planning_signal(latest_checkin)
    if isinstance(menstruation_signal, dict):
        return {
            "session_type": "restitution",
            "template_id": "restitution_easy",
            "plan_entries": build_restitution_plan(time_budget_min),
            "plan_variant": "menstruation_support_override",
            "reason": f"{menstruation_signal.get('reason')} · restitution prioriteres",
            "autoplan_meta": {
                "template_mode": "menstruation_support_v0_1",
                "families_selected": [],
                "menstruation_support_applied": True,
                "menstrual_pain": menstruation_signal.get("menstrual_pain"),
                "menstruation_today": menstruation_signal.get("menstruation_today"),
            },
            "weekly_status": weekly_status,
        }

    if should_use_reentry_strength(
        readiness_score=readiness_score,
        fatigue_score=fatigue_score,
        recovery_state=recovery_state,
        days_since_last_strength=days_since_last_strength,
        training_day_ctx=training_day_ctx,
    ):
        return {
            "session_type": "styrke",
            "template_id": "reentry_strength",
            "plan_entries": build_reentry_strength_plan(time_budget_min),
            "plan_variant": "reentry_strength",
            "reason": "low readiness, but recent load is low and re-entry strength is prioritized",
            "autoplan_meta": {
                "template_mode": "reentry_strength_v0_1",
                "families_selected": [],
                "reentry_strength_applied": True,
                "days_since_last_strength": days_since_last_strength,
                "load_status": recovery_state.get("load_status") if isinstance(recovery_state, dict) else None,
            },
            "weekly_status": weekly_status,
        }

    if readiness_score <= 3:
        return {
            "session_type": "restitution",
            "template_id": "restitution_easy",
            "plan_entries": build_restitution_plan(time_budget_min),
            "plan_variant": "default",
            "reason": "low readiness",
            "autoplan_meta": None,
            "weekly_status": weekly_status,
        }

    if timing_state == "early":
        return {
            "session_type": "cardio",
            "template_id": "cardio_easy",
            "plan_entries": build_cardio_plan(
                time_budget_min,
                user_id=auth_user.get("user_id"),
                readiness=readiness_score,
                recovery_state=recovery_state,
                training_day_context=training_day_ctx,
            ),
            "plan_variant": "default",
            "reason": "early check-in, so cardio is chosen instead of strength",
            "autoplan_meta": None,
            "weekly_status": weekly_status,
        }

    if fatigue_score >= 6:
        return {
            "session_type": "restitution",
            "template_id": "restitution_easy",
            "plan_entries": build_restitution_plan(time_budget_min),
            "plan_variant": "default",
            "reason": "high fatigue, recovery prioritized",
            "autoplan_meta": None,
            "weekly_status": weekly_status,
        }

    if fatigue_score >= 4:
        return {
            "session_type": "cardio",
            "template_id": "cardio_easy",
            "plan_entries": build_cardio_plan(
                time_budget_min,
                user_id=auth_user.get("user_id"),
                readiness=readiness_score,
                recovery_state=recovery_state,
                training_day_context=training_day_ctx,
            ),
            "plan_variant": "default",
            "reason": "high fatigue, cardio prioritized",
            "autoplan_meta": None,
            "weekly_status": weekly_status,
        }

    return None


def build_today_plan_training_decision(
    auth_user,
    checkin_date,
    readiness_score,
    fatigue_score,
    recovery_state,
    time_budget_min,
    user_settings,
    training_day_ctx,
    programs,
    exercises,
    latest_strength,
):
    weekly_target_sessions = get_weekly_target_sessions(user_settings)
    selected_strength_program_id = select_strength_program(
        programs=programs,
        user_settings=user_settings,
        weekly_target_sessions=weekly_target_sessions,
    )

    prefs = get_training_type_preferences(user_settings)
    selected_endurance_program_id = select_endurance_program(
        programs=programs,
        user_settings=user_settings,
        weekly_target_sessions=weekly_target_sessions,
        prefs=prefs,
    )

    strength_ctx = build_strength_plan(
        programs=programs,
        exercises=exercises,
        latest_strength=latest_strength,
        time_budget_min=time_budget_min,
        fatigue_score=fatigue_score,
        user_settings=user_settings,
        user_id=auth_user.get("user_id"),
        selected_program_id=selected_strength_program_id,
    )

    training_day_prefs = get_training_day_preferences(user_settings)
    weekly_status = build_weekly_training_status(
        user_id=auth_user.get("user_id"),
        checkin_date=checkin_date,
        training_day_prefs=training_day_prefs,
        weekly_target_sessions=weekly_target_sessions,
    )

    completed_sessions_this_week = int((weekly_status or {}).get("completed_sessions", 0) or 0)
    weekly_goal_reached = completed_sessions_this_week >= int(weekly_target_sessions or 3)

    planning_mode = "fixed"
    if isinstance(user_settings, dict):
        planning_mode = str(user_settings.get("planning_mode", "fixed")).strip() or "fixed"

    autoplan_meta = None

    weekday_key = None
    try:
        weekday_idx = datetime.fromisoformat(str(checkin_date)).weekday()
        weekday_key = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][weekday_idx]
    except Exception:
        weekday_key = None

    if weekday_key and not training_day_prefs.get(weekday_key, True):
        session_type = "restitution"
        template_id = "restitution_easy"
        plan_entries = build_restitution_plan(time_budget_min)
        plan_variant = "calendar_rest"
        reason = "dagen er ikke valgt som mulig træningsdag"
        autoplan_meta = {
            "template_mode": "calendar_rest",
            "families_selected": [],
            "blocked_by_training_day_preferences": True,
            "weekday": weekday_key,
        }

    elif weekly_goal_reached and isinstance(training_day_ctx, dict) and training_day_ctx.get("is_training_day") is False:
        session_type = "restitution"
        template_id = "weekly_goal_reached_restitution"
        plan_entries = build_restitution_plan(time_budget_min)
        plan_variant = "weekly_goal_cap"
        reason = "weekly goal reached · not a planned training day · recovery prioritized"
        autoplan_meta = {
            "template_mode": "weekly_goal_cap_v0_1",
            "families_selected": [],
            "weekly_goal_reached": True,
        }

    elif isinstance(training_day_ctx, dict) and training_day_ctx.get("is_training_day") is False:
        if prefs.get("running", True):
            cardio_plan = build_autoplan_cardio(
                user_id=auth_user.get("user_id"),
                readiness=readiness_score,
                time_budget_min=time_budget_min,
                recovery_state=recovery_state,
                training_day_context=training_day_ctx,
            )

            session_type = "løb"
            template_id = "autoplan_cardio"
            plan_entries = cardio_plan.get("entries", []) if isinstance(cardio_plan, dict) else []
            plan_variant = "autoplan_cardio"
            reason = "ikke planlagt styrkedag · cardio-autoplan aktiv"

            if isinstance(cardio_plan, dict):
                autoplan_meta = {
                    "template_mode": cardio_plan.get("template_mode"),
                    "families_selected": [],
                    "selected_endurance_program_id": selected_endurance_program_id,
                }

            if not plan_entries:
                if prefs.get("strength_weights", True) or prefs.get("bodyweight", True):
                    session_type = "styrke"
                    template_id = strength_ctx.get("template_id")
                    plan_entries = strength_ctx.get("plan_entries", [])
                    plan_variant = strength_ctx.get("plan_variant", "default")
                    reason = "ikke planlagt styrkedag · cardio tom, fallback til styrkeplan"
                    autoplan_meta = None
                else:
                    session_type = "restitution"
                    template_id = "restitution_easy"
                    plan_entries = build_restitution_plan(time_budget_min)
                    plan_variant = "default"
                    reason = "løb fravalgt og ingen styrkevalg · restitution vælges"
                    autoplan_meta = None
        elif prefs.get("strength_weights", True) or prefs.get("bodyweight", True):
            session_type = "styrke"
            template_id = strength_ctx.get("template_id")
            plan_entries = strength_ctx.get("plan_entries", [])
            plan_variant = strength_ctx.get("plan_variant", "default")
            reason = "løb fravalgt · styrke vælges på ikke-planlagt styrkedag"
            autoplan_meta = None
        else:
            session_type = "restitution"
            template_id = "restitution_easy"
            plan_entries = build_restitution_plan(time_budget_min)
            plan_variant = "default"
            reason = "løb og styrke fravalgt · restitution vælges"
            autoplan_meta = None

    elif planning_mode == "autoplan":
        if prefs.get("strength_weights", True) or prefs.get("bodyweight", True):
            autoplan = build_autoplan_strength(
                user_id=auth_user.get("user_id"),
                readiness=readiness_score,
                time_budget_min=time_budget_min,
                user_settings=user_settings,
                limit=3 if int(time_budget_min or 0) >= 20 else 2
            )

            session_type = "styrke"
            template_id = "autoplan_strength"
            plan_entries = autoplan.get("entries", []) if isinstance(autoplan, dict) else []
            plan_variant = "autoplan"
            reason = "styrke prioriteres · autoplan aktiv"

            if isinstance(autoplan, dict):
                autoplan_meta = {
                    "template_mode": autoplan.get("template_mode"),
                    "families_selected": autoplan.get("families_selected", [])
                }

            if not plan_entries:
                session_type = "styrke"
                template_id = strength_ctx.get("template_id")
                plan_entries = strength_ctx.get("plan_entries", [])
                plan_variant = strength_ctx.get("plan_variant", "default")
                reason = "styrke prioriteres · autoplan tom, fallback til fast plan"
                autoplan_meta = None

        elif prefs.get("running", True):
            cardio_plan = build_autoplan_cardio(
                user_id=auth_user.get("user_id"),
                readiness=readiness_score,
                time_budget_min=time_budget_min,
                recovery_state=recovery_state,
                training_day_context=training_day_ctx,
            )
            session_type = "løb"
            template_id = "autoplan_cardio"
            plan_entries = cardio_plan.get("entries", []) if isinstance(cardio_plan, dict) else []
            plan_variant = "autoplan_cardio"
            reason = "styrke fravalgt · cardio vælges"
            autoplan_meta = {
                "template_mode": cardio_plan.get("template_mode") if isinstance(cardio_plan, dict) else None,
                "families_selected": []
            }
        else:
            session_type = "restitution"
            template_id = "restitution_easy"
            plan_entries = build_restitution_plan(time_budget_min)
            plan_variant = "default"
            reason = "løb og styrke fravalgt · restitution vælges"
            autoplan_meta = None
    else:
        if prefs.get("strength_weights", True) or prefs.get("bodyweight", True):
            session_type = "styrke"
            template_id = strength_ctx.get("template_id")
            plan_entries = strength_ctx.get("plan_entries", [])
            plan_variant = strength_ctx.get("plan_variant", "default")
            reason = strength_ctx.get("reason", "styrke prioriteres")
            autoplan_meta = None
        elif prefs.get("running", True):
            cardio_plan = build_autoplan_cardio(
                user_id=auth_user.get("user_id"),
                readiness=readiness_score,
                time_budget_min=time_budget_min,
                recovery_state=recovery_state,
                training_day_context=training_day_ctx,
            )
            session_type = "løb"
            template_id = "autoplan_cardio"
            plan_entries = cardio_plan.get("entries", []) if isinstance(cardio_plan, dict) else []
            plan_variant = "autoplan_cardio"
            reason = "styrke fravalgt · cardio vælges"
            autoplan_meta = {
                "template_mode": cardio_plan.get("template_mode") if isinstance(cardio_plan, dict) else None,
                "families_selected": []
            }
        else:
            session_type = "restitution"
            template_id = "restitution_easy"
            plan_entries = build_restitution_plan(time_budget_min)
            plan_variant = "default"
            reason = "løb og styrke fravalgt · restitution vælges"
            autoplan_meta = None

    return {
        "session_type": session_type,
        "template_id": template_id,
        "plan_entries": plan_entries,
        "plan_variant": plan_variant,
        "reason": reason,
        "autoplan_meta": autoplan_meta,
        "weekly_status": weekly_status,
    }


def get_autoplan_meta_value(autoplan_meta, key, default=None):
    if isinstance(autoplan_meta, dict):
        return autoplan_meta.get(key, default)
    return default


def normalize_session_type(raw):
    x = str(raw or "").strip().lower()
    if x in ("styrke", "strength"):
        return "strength"
    if x in ("løb", "run", "cardio"):
        return "cardio"
    if x in ("restitution", "mobility", "recovery", "mobilitet", "rest"):
        return "restitution"
    return x or "unknown"


def build_decision_trace(
    readiness_score,
    fatigue_score,
    session_type,
    timing_state,
    fatigue_session_override,
    plan_variant=None,
):
    readiness_bucket = "low" if readiness_score <= 3 else "high"

    if fatigue_score >= 6:
        fatigue_bucket = "high"
    elif fatigue_score >= 4:
        fatigue_bucket = "moderate"
    elif fatigue_score >= 2:
        fatigue_bucket = "elevated"
    else:
        fatigue_bucket = "low"

    normalized = normalize_session_type(session_type)

    rule_applied = "strength_default"
    override_label = None

    if fatigue_session_override == "restitution":
        rule_applied = "fatigue_override_restitution"
        override_label = "fatigue_session_override"
    elif str(plan_variant or "").strip() == "reentry_strength":
        rule_applied = "reentry_strength"
    elif readiness_score <= 3:
        rule_applied = "low_readiness_restitution"
    elif timing_state == "early":
        rule_applied = "early_timing_cardio"
    elif fatigue_score >= 6:
        rule_applied = "high_fatigue_restitution"
    elif fatigue_score >= 4:
        rule_applied = "fatigue_cardio"
    elif normalized == "cardio":
        rule_applied = "cardio_default"
    elif normalized == "restitution":
        rule_applied = "restitution_default"

    return {
        "readiness_bucket": readiness_bucket,
        "fatigue_bucket": fatigue_bucket,
        "timing": timing_state or "unknown",
        "rule_applied": rule_applied,
        "override": override_label,
    }


def _safe_iso_date_string(value):
    s = str(value or "").strip()
    if not s:
        return ""
    try:
        return datetime.fromisoformat(s[:10]).date().isoformat()
    except Exception:
        return ""

def _session_type_label_da(session_type):
    normalized = str(session_type or "").strip().lower()
    if normalized in ("styrke", "strength"):
        return "styrke"
    if normalized in ("løb", "run", "cardio"):
        return "løb"
    if normalized in ("restitution", "mobilitet", "mobility", "recovery", "rest"):
        return "restitution"
    return normalized or "træning"

def _guess_next_session_type_from_training_day_context(training_day_ctx):
    ctx = training_day_ctx if isinstance(training_day_ctx, dict) else {}
    if ctx.get("is_training_day") is True:
        return "styrke"
    return "styrke"

def find_next_planned_training_date(training_day_ctx, from_date, max_days=14):
    ctx = training_day_ctx if isinstance(training_day_ctx, dict) else {}
    training_days = ctx.get("training_days", [])
    if not isinstance(training_days, list):
        training_days = []

    normalized_days = {str(x).strip().lower() for x in training_days if str(x).strip()}
    if not normalized_days:
        return None

    start = _safe_iso_date(from_date)
    if not start:
        return None

    weekday_map = {
        0: "mon",
        1: "tue",
        2: "wed",
        3: "thu",
        4: "fri",
        5: "sat",
        6: "sun",
    }

    for offset in range(1, max_days + 1):
        candidate = start + timedelta(days=offset)
        weekday_key = weekday_map.get(candidate.weekday())
        if weekday_key in normalized_days:
            return candidate.isoformat()

    return None

def detect_strength_plateau_signal(user_id):
    user_id = str(user_id or "").strip()
    if not user_id:
        return None

    session_results = list_session_results_for_user(user_id)
    if not isinstance(session_results, list):
        session_results = []

    strength_sessions = []
    for item in reversed(session_results):
        if not isinstance(item, dict):
            continue
        if str(item.get("session_type", "")).strip().lower() != "styrke":
            continue
        if not bool(item.get("completed", False)):
            continue
        strength_sessions.append(item)
        if len(strength_sessions) >= 6:
            break

    if len(strength_sessions) < 4:
        return None

    hold_count = 0
    increase_count = 0

    for session in strength_sessions:
        results = session.get("results", [])
        if not isinstance(results, list):
            continue
        session_has_hold = False
        session_has_increase = False
        for result in results:
            if not isinstance(result, dict):
                continue
            decision = str(result.get("progression_decision", "")).strip().lower()
            if decision == "increase":
                session_has_increase = True
            elif decision == "hold":
                session_has_hold = True
        if session_has_increase:
            increase_count += 1
        elif session_has_hold:
            hold_count += 1

    if hold_count >= 3 and increase_count == 0:
        return {
            "plateau_detected": True,
            "plateau_scope": "strength",
            "plateau_reason": "flere nylige styrkepas har holdt niveau uden progression",
            "guidance_message": "Du har ligget stabilt i flere styrkepas. Hvis du vil øge videre, kan du overveje en ekstra ugentlig træningsdag eller et andet program.",
            "recent_strength_sessions": len(strength_sessions),
            "hold_sessions": hold_count,
            "increase_sessions": increase_count,
        }

    return None


def build_next_guidance(today_plan_item, completed_today=False):
    item = today_plan_item if isinstance(today_plan_item, dict) else {}
    if not item:
        return None

    user_id = str(item.get("user_id", "")).strip()
    session_type = str(item.get("session_type", "")).strip().lower()

    if not completed_today and session_type == "styrke" and user_id:
        plateau_signal = detect_strength_plateau_signal(user_id)
        if isinstance(plateau_signal, dict) and plateau_signal.get("plateau_detected"):
            return {
                "kind": "plateau_signal",
                "next_session_type": "styrke",
                "next_date": None,
                "source": "plateau_detection_v0_1",
                "message": plateau_signal.get("guidance_message"),
                "plateau_reason": plateau_signal.get("plateau_reason"),
                "recent_strength_sessions": plateau_signal.get("recent_strength_sessions"),
                "hold_sessions": plateau_signal.get("hold_sessions"),
                "increase_sessions": plateau_signal.get("increase_sessions"),
            }

    date_str = _safe_iso_date_string(item.get("date"))
    if not date_str:
        return None

    session_type = str(item.get("session_type", "")).strip().lower()
    training_day_ctx = item.get("training_day_context", {})
    if not isinstance(training_day_ctx, dict):
        training_day_ctx = {}

    next_date = find_next_planned_training_date(training_day_ctx, date_str)
    next_session_type = _guess_next_session_type_from_training_day_context(training_day_ctx)

    today_label = _session_type_label_da(session_type)
    next_label = _session_type_label_da(next_session_type)

    if completed_today:
        if next_date:
            return {
                "kind": "completed_today",
                "next_session_type": next_session_type,
                "next_date": next_date,
                "source": "after_session",
                "message": f"Session gemt. Næste forventede træning er {next_label} {next_date}."
            }
        return {
            "kind": "completed_today",
            "next_session_type": None,
            "next_date": None,
            "source": "after_session",
            "message": "Session gemt. Der er ingen næste træningsdag endnu."
        }

    is_training_day = bool(training_day_ctx.get("is_training_day"))
    if session_type == "restitution" or not is_training_day:
        if next_date:
            return {
                "kind": "rest_today",
                "next_session_type": next_session_type,
                "next_date": next_date,
                "source": "weekly_plan",
                "message": f"I dag er {today_label}. Næste forventede træning er {next_label} {next_date}."
            }
        return {
            "kind": "rest_today",
            "next_session_type": None,
            "next_date": None,
            "source": "weekly_plan",
            "message": f"I dag er {today_label}. Der er ingen næste træningsdag endnu."
        }

    if next_date:
        return {
            "kind": "next_training",
            "next_session_type": next_session_type,
            "next_date": next_date,
            "source": "adaptive",
            "message": f"Dagens fokus er {today_label}. Næste forventede træning efter i dag er {next_label} {next_date}."
        }

    return {
        "kind": "next_training",
        "next_session_type": None,
        "next_date": None,
        "source": "adaptive",
        "message": f"Dagens fokus er {today_label}. Der er ingen næste træningsdag endnu."
    }



def validate_today_plan_item(item):
    if not isinstance(item, dict):
        return {
            "session_type": "restitution",
            "template_id": "restitution_easy",
            "template_mode": "consistency_fallback_v0_1",
            "plan_variant": "consistency_fallback",
            "reason": "invalid plan item structure",
            "entries": build_restitution_plan(30),
        }

    session_type = str(item.get("session_type", "")).strip().lower()
    plan_variant = str(item.get("plan_variant", "")).strip().lower()
    entries = item.get("entries", [])
    if not isinstance(entries, list):
        entries = []

    has_entries = bool(entries)
    has_exercise_entries = any(
        isinstance(e, dict) and str(e.get("exercise_id", "")).strip()
        for e in entries
    )
    is_reentry_strength = plan_variant == "reentry_strength"

    invalid = False
    invalid_reason = None

    if (session_type == "styrke" or is_reentry_strength) and not has_entries:
        invalid = True
        invalid_reason = "strength plan missing entries"
    elif session_type in ("cardio", "løb") and not has_entries:
        invalid = True
        invalid_reason = "cardio plan missing entries"
    elif session_type not in ("styrke", "restitution", "cardio", "løb"):
        invalid = True
        invalid_reason = "unknown session_type"

    if not invalid:
        return item

    logger.warning(
        "today_plan_consistency_fallback session_type=%s reason=%s",
        session_type,
        invalid_reason,
    )

    fixed = dict(item)
    fixed["session_type"] = "restitution"
    fixed["template_id"] = "restitution_easy"
    fixed["template_mode"] = "consistency_fallback_v0_1"
    fixed["plan_variant"] = "consistency_fallback"
    fixed["reason"] = f"consistency fallback: {invalid_reason}"
    fixed["entries"] = build_restitution_plan(int(item.get("time_budget_min", 30) or 30))
    return fixed


@app.get("/api/today-plan")
def get_today_plan():
    query_args = request.args or {}
    allowed_query_params = set()
    unexpected_query_params = sorted([key for key in query_args.keys() if key not in allowed_query_params])
    if unexpected_query_params:
        return jsonify(make_error_payload(
            "invalid_query_params",
            "ukendte query parametre",
            fields=unexpected_query_params,
        )), 400

    auth_user, auth_err = require_auth_user()
    if auth_err:
        log_auth_failure("today-plan", auth_err)
        return auth_err

    update_adaptation_state(auth_user.get("user_id"))

    checkins = list_user_items("checkins", auth_user.get("user_id"))
    checkins_error = get_storage_last_error()
    if checkins_error and checkins_error.get("file_key") == "checkins":
        return jsonify({
            "ok": False,
            "error": "storage_error",
            "source": "checkins",
        })

    workouts = list_workouts_for_user(auth_user.get("user_id"))
    programs = read_json_file(FILES["programs"])
    exercises = read_json_file(FILES["exercises"])

    if not checkins:
        return jsonify({
            "ok": True,
            "item": None,
            "reason": "no_checkin"
        })

    latest_checkin = sorted(checkins, key=lambda x: str(x.get("created_at", x.get("date", ""))), reverse=True)[0]
    today_ctx = build_today_plan_context(auth_user, latest_checkin)
    readiness_score = today_ctx["readiness_score"]
    checkin_date = today_ctx["checkin_date"]
    time_budget_min = today_ctx["time_budget_min"]
    user_settings = today_ctx["user_settings"]
    training_day_ctx = today_ctx["training_day_ctx"]
    weekly_target_sessions = today_ctx["weekly_target_sessions"]
    weekly_status = today_ctx["weekly_status"]

    checkin_date = str(latest_checkin.get("date", "")).strip()
    manual_override = None
    for w in sorted(workouts, key=lambda x: str(x.get("created_at", x.get("date", ""))), reverse=True):
        if not isinstance(w, dict):
            continue
        if str(w.get("date", "")).strip() != checkin_date:
            continue
        if not bool(w.get("is_manual_override", False)):
            continue
        if bool(w.get("is_consumed", False)):
            continue
        manual_override = w
        break

    if manual_override:
        return build_manual_override_today_plan_response(
            latest_checkin=latest_checkin,
            checkin_date=checkin_date,
            readiness_score=readiness_score,
            manual_override=manual_override,
        )

    fatigue_ctx = build_today_plan_fatigue_context(
        auth_user=auth_user,
        latest_checkin=latest_checkin,
        workouts=workouts,
        checkin_date=checkin_date,
    )

    latest_strength = fatigue_ctx["latest_strength"]
    days_since_last_strength = fatigue_ctx["days_since_last_strength"]
    session_results = fatigue_ctx["session_results"]
    previous_recommendation = fatigue_ctx["previous_recommendation"]
    latest_strength_session = fatigue_ctx["latest_strength_session"]
    latest_strength_failed = fatigue_ctx["latest_strength_failed"]
    latest_strength_load_drop_count = fatigue_ctx["latest_strength_load_drop_count"]
    latest_strength_completed = fatigue_ctx["latest_strength_completed"]
    fatigue_score = fatigue_ctx["fatigue_score"]
    recovery_state = fatigue_ctx["recovery_state"]
    fatigue_session_override = fatigue_ctx["fatigue_session_override"]

    if fatigue_session_override == "restitution":
        session_type = "restitution"
        template_id = "restitution_easy"
        plan_entries = build_restitution_plan(time_budget_min)
        plan_variant = "default"
        autoplan_meta = None
        if recovery_state.get("recovery_state") == "recover":
            reason = "recovery state requires restitution"
        else:
            reason = "low readiness"
        plan_variant = "default"


    timing_state = build_today_plan_timing_state(
        previous_recommendation=previous_recommendation,
        checkin_date=checkin_date,
    )

    autoplan_meta = None

    logger.info(
        "today_plan_inputs user_id=%s date=%s readiness=%s fatigue=%s timing=%s recovery=%s manual_override=%s time_budget_min=%s",
        auth_user.get("user_id"),
        checkin_date,
        readiness_score,
        fatigue_score,
        timing_state,
        recovery_state.get("recovery_state") if isinstance(recovery_state, dict) else None,
        bool(manual_override),
        time_budget_min,
    )

    priority_decision_ctx = build_today_plan_priority_decision(
        auth_user=auth_user,
        readiness_score=readiness_score,
        fatigue_score=fatigue_score,
        timing_state=timing_state,
        recovery_state=recovery_state,
        days_since_last_strength=days_since_last_strength,
        time_budget_min=time_budget_min,
        training_day_ctx=training_day_ctx,
        weekly_status=weekly_status,
        latest_checkin=latest_checkin,
    )

    if isinstance(priority_decision_ctx, dict):
        logger.warning(
            "priority_decision_result session_type=%s plan_variant=%s reason=%s readiness=%s fatigue=%s recovery_state=%s load_status=%s days_since_last_strength=%s",
            priority_decision_ctx.get("session_type"),
            priority_decision_ctx.get("plan_variant", "default"),
            priority_decision_ctx.get("reason"),
            readiness_score,
            fatigue_score,
            recovery_state.get("recovery_state") if isinstance(recovery_state, dict) else None,
            recovery_state.get("load_status") if isinstance(recovery_state, dict) else None,
            days_since_last_strength,
        )
        session_type = priority_decision_ctx.get("session_type")
        template_id = priority_decision_ctx.get("template_id")
        plan_entries = priority_decision_ctx.get("plan_entries", [])
        plan_variant = priority_decision_ctx.get("plan_variant", "default")
        reason = priority_decision_ctx.get("reason")
        autoplan_meta = priority_decision_ctx.get("autoplan_meta")
        weekly_status = priority_decision_ctx.get("weekly_status")
    else:
        decision_ctx = build_today_plan_training_decision(
            auth_user=auth_user,
            checkin_date=checkin_date,
            readiness_score=readiness_score,
            fatigue_score=fatigue_score,
            recovery_state=recovery_state,
            time_budget_min=time_budget_min,
            user_settings=user_settings,
            training_day_ctx=training_day_ctx,
            programs=programs,
            exercises=exercises,
            latest_strength=latest_strength,
        )
        session_type = decision_ctx.get("session_type")
        template_id = decision_ctx.get("template_id")
        plan_entries = decision_ctx.get("plan_entries", [])
        plan_variant = decision_ctx.get("plan_variant", "default")
        reason = decision_ctx.get("reason")
        autoplan_meta = decision_ctx.get("autoplan_meta")
        weekly_status = decision_ctx.get("weekly_status")

    recommended_for = checkin_date

    todays_results = list_session_results_for_user(auth_user.get("user_id"))
    already_logged_today = False
    if isinstance(todays_results, list):
        for sr in reversed(todays_results):
            if not isinstance(sr, dict):
                continue
            if str(sr.get("date", "")).strip() != str(checkin_date).strip():
                continue
            if bool(sr.get("completed", False)):
                already_logged_today = True
                break

    if already_logged_today:
        log_today_plan_decision(
        auth_user=auth_user,
        checkin_date=checkin_date,
        session_type=session_type,
        template_id=template_id,
        plan_variant=plan_variant,
        reason=reason,
        plan_entries=plan_entries,
    )

    decision_trace = build_decision_trace(
        readiness_score=readiness_score,
        fatigue_score=fatigue_score,
        session_type=session_type,
        timing_state=timing_state,
        fatigue_session_override=fatigue_session_override,
        plan_variant=plan_variant,
    )

    item = {
        "checkin_id": latest_checkin.get("id"),
        "user_id": auth_user.get("user_id"),
        "date": checkin_date,
        "recommended_for": recommended_for,
        "decision_mode": "fatigue_primary_v1",
        "timing_state": timing_state,
        "previous_recommended_for": previous_recommendation.get("recommended_for") if previous_recommendation else None,
        "readiness_score": readiness_score,
        "weekly_status": weekly_status,
        "time_budget_min": time_budget_min,
        "session_type": session_type,
        "latest_strength_failed": latest_strength_failed,
        "latest_strength_load_drop_count": latest_strength_load_drop_count,
        "latest_strength_completed": latest_strength_completed,
        "fatigue_score": fatigue_score,
        "recovery_state": recovery_state,
        "template_id": template_id,
        "template_mode": get_autoplan_meta_value(autoplan_meta, "template_mode"),
        "families_selected": get_autoplan_meta_value(autoplan_meta, "families_selected", []),
        "training_day_context": training_day_ctx if isinstance(training_day_ctx, dict) else {},
        "reason": reason,
        "days_since_last_strength": days_since_last_strength,
        "decision_trace": decision_trace,
        "plan_variant": plan_variant if session_type in ("styrke", "restitution", "cardio") else "default",
        "entries": plan_entries
    }

    item = validate_today_plan_item(item)
    item["next_guidance"] = build_next_guidance(
        item,
        completed_today=already_logged_today,
    )

    append_today_plan_trace(
        auth_user.get("user_id"),
        {
            "date": checkin_date,
            "session_type": item.get("session_type"),
            "template_id": item.get("template_id"),
            "plan_variant": item.get("plan_variant"),
            "reason": item.get("reason"),
            "readiness_score": item.get("readiness_score"),
            "fatigue_score": item.get("fatigue_score"),
        }
    )

    return jsonify({
        "ok": True,
        "item": item
    })


@app.get("/api/admin/today-plan-traces")
def get_today_plan_traces():
    auth_user, auth_err = require_auth_user()
    if auth_err:
        log_auth_failure("admin:today-plan-traces", auth_err)
        return auth_err

    user_id = auth_user.get("user_id")

    items = list_user_items("today_plan_traces", user_id)

    # defensive check
    if not isinstance(items, list):
        return jsonify({
            "ok": False,
            "error": "storage_error",
            "message": "Kunne ikke læse today_plan_traces"
        }), 500

    # newest first
    items_sorted = sorted(
        items,
        key=lambda x: str(x.get("created_at", "")),
        reverse=True
    )

    # hard limit
    limit = 50
    items_limited = items_sorted[:limit]

    return jsonify({
        "ok": True,
        "items": items_limited,
        "count": len(items_limited)
    })


@app.post("/api/admin/reset-catalog")
def post_reset_catalog():
    auth_user = require_auth_user()
    if isinstance(auth_user, tuple):
        return auth_user
    user_id = auth_user.get("user_id")
    if not user_id:
        return jsonify({"ok": False, "error": "missing_user"}), 401

    repo_root = Path(__file__).resolve().parents[2]
    seed_dir = repo_root / "app" / "data" / "seed"

    seed_exercises = seed_dir / "exercises.json"
    seed_programs = seed_dir / "programs.json"

    if not seed_exercises.exists() or not seed_programs.exists():
        return jsonify({
            "ok": False,
            "error": "missing_seed_files",
            "seed_dir": str(seed_dir),
        }), 500

    exercises = read_json_file(seed_exercises)
    programs = read_json_file(seed_programs)

    write_json_file(FILES["exercises"], exercises)
    write_json_file(FILES["programs"], programs)

    return jsonify({
        "ok": True,
        "message": "Catalog data reset from seed.",
        "counts": {
            "exercises": len(exercises) if isinstance(exercises, list) else 0,
            "programs": len(programs) if isinstance(programs, list) else 0,
        }
    })

@app.get("/api/admin/today-plan-debug")
def get_today_plan_debug():
    auth_user, auth_err = require_auth_user()
    if auth_err:
        log_auth_failure("admin:today-plan-debug", auth_err)
        return auth_err

    checkins = list_user_items("checkins", auth_user.get("user_id"))
    checkins_error = get_storage_last_error()
    if checkins_error and checkins_error.get("file_key") == "checkins":
        log_storage_failure("admin:today-plan-debug:checkins", checkins_error)
        return jsonify({
            "ok": False,
            "error": "storage_error",
            "source": "checkins",
            "message": "Kunne ikke læse checkins",
        }), 500

    workouts = list_workouts_for_user(auth_user.get("user_id"))
    programs = read_json_file(FILES["programs"])
    exercises = read_json_file(FILES["exercises"])

    if not checkins:
        return jsonify({
            "ok": True,
            "item": None,
            "reason": "no_checkin",
            "debug": {
                "latest_checkin": None,
                "today_ctx": None,
                "fatigue_ctx": None,
                "decision": None,
            }
        })

    latest_checkin = sorted(
        checkins,
        key=lambda x: str(x.get("created_at", x.get("date", ""))),
        reverse=True,
    )[0]

    today_ctx = build_today_plan_context(auth_user, latest_checkin)
    readiness_score = today_ctx["readiness_score"]
    checkin_date = str(latest_checkin.get("date", "")).strip()
    time_budget_min = today_ctx["time_budget_min"]
    training_day_ctx = today_ctx["training_day_ctx"]
    weekly_status = today_ctx["weekly_status"]

    fatigue_ctx = build_today_plan_fatigue_context(
        auth_user=auth_user,
        latest_checkin=latest_checkin,
        workouts=workouts,
        checkin_date=checkin_date,
    )

    previous_recommendation = fatigue_ctx["previous_recommendation"]
    fatigue_score = fatigue_ctx["fatigue_score"]
    recovery_state = fatigue_ctx["recovery_state"]
    timing_state = build_today_plan_timing_state(
        previous_recommendation=previous_recommendation,
        checkin_date=checkin_date,
    )

    strength_ctx = build_strength_plan(
        programs=programs,
        exercises=exercises,
        latest_strength=fatigue_ctx["latest_strength"],
        time_budget_min=time_budget_min,
        fatigue_score=fatigue_score,
        user_settings=today_ctx["user_settings"],
        user_id=auth_user.get("user_id"),
    )

    autoplan_meta = None

    if should_use_reentry_strength(
        readiness_score=readiness_score,
        fatigue_score=fatigue_score,
        recovery_state=recovery_state,
        days_since_last_strength=fatigue_ctx["days_since_last_strength"],
        training_day_ctx=training_day_ctx,
    ):
        session_type = "styrke"
        template_id = "reentry_strength"
        reason = "low readiness, but recent load is low and re-entry strength is prioritized"
        plan_variant = "reentry_strength"
        plan_entries = build_reentry_strength_plan(time_budget_min)
    elif readiness_score <= 3:
        session_type = "restitution"
        template_id = "restitution_easy"
        reason = "low readiness"
        plan_variant = "default"
        plan_entries = build_restitution_plan(time_budget_min)
    elif timing_state == "early":
        session_type = "cardio"
        template_id = "cardio_easy"
        reason = "early check-in, so cardio is chosen instead of strength"
        plan_variant = "default"
        plan_entries = build_cardio_plan(
            time_budget_min,
            user_id=auth_user.get("user_id"),
            readiness=readiness_score,
            recovery_state=recovery_state,
            training_day_context=training_day_ctx,
        )
    elif fatigue_score >= 6:
        session_type = "restitution"
        template_id = "restitution_easy"
        reason = "high fatigue, recovery prioritized"
        plan_variant = "default"
        plan_entries = build_restitution_plan(time_budget_min)
    elif fatigue_score >= 4:
        session_type = "cardio"
        template_id = "cardio_easy"
        reason = "high fatigue, cardio prioritized"
        plan_variant = "default"
        plan_entries = build_cardio_plan(
            time_budget_min,
            user_id=auth_user.get("user_id"),
            readiness=readiness_score,
            recovery_state=recovery_state,
            training_day_context=training_day_ctx,
        )
    else:
        session_type = "styrke"
        template_id = strength_ctx.get("template_id")
        plan_entries = strength_ctx.get("plan_entries", [])
        plan_variant = strength_ctx.get("plan_variant", "default")
        reason = strength_ctx.get("reason", "styrke prioriteres")

    item = {
        "checkin_id": latest_checkin.get("id"),
        "date": checkin_date,
        "recommended_for": checkin_date,
        "decision_mode": "today_plan_debug_v0_1",
        "timing_state": timing_state,
        "previous_recommended_for": previous_recommendation.get("recommended_for") if previous_recommendation else None,
        "readiness_score": readiness_score,
        "weekly_status": weekly_status,
        "time_budget_min": time_budget_min,
        "session_type": session_type,
        "latest_strength_failed": fatigue_ctx["latest_strength_failed"],
        "latest_strength_load_drop_count": fatigue_ctx["latest_strength_load_drop_count"],
        "latest_strength_completed": fatigue_ctx["latest_strength_completed"],
        "fatigue_score": fatigue_score,
        "recovery_state": recovery_state,
        "template_id": template_id,
        "template_mode": get_autoplan_meta_value(autoplan_meta, "template_mode"),
        "families_selected": get_autoplan_meta_value(autoplan_meta, "families_selected", []),
        "training_day_context": training_day_ctx if isinstance(training_day_ctx, dict) else {},
        "reason": reason,
        "days_since_last_strength": fatigue_ctx["days_since_last_strength"],
        "plan_variant": plan_variant if session_type in ("styrke", "restitution", "cardio") else "default",
        "entries": plan_entries,
    }

    item = validate_today_plan_item(item)

    return jsonify({
        "ok": True,
        "item": item,
        "debug": {
            "latest_checkin": latest_checkin,
            "today_ctx": today_ctx,
            "fatigue_ctx": fatigue_ctx,
            "decision": {
                "readiness_score": readiness_score,
                "fatigue_score": fatigue_score,
                "timing_state": timing_state,
                "session_type": session_type,
                "template_id": template_id,
                "plan_variant": plan_variant,
                "reason": reason,
            }
        }
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
    profile = payload.get("profile", current.get("profile", {}))
    preferences = payload.get("preferences", current.get("preferences", {}))

    item = {
        "user_id": auth_user.get("user_id"),
        "equipment_increments": equipment_increments if isinstance(equipment_increments, dict) else {},
        "available_equipment": available_equipment if isinstance(available_equipment, dict) else {},
        "profile": profile if isinstance(profile, dict) else {},
        "preferences": preferences if isinstance(preferences, dict) else {},
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



def _parse_time_under_tension_seconds(value):
    s = str(value or "").strip().lower()
    if not s:
        return 0.0
    num = _parse_numeric_token(s)
    if num <= 0:
        return 0.0
    if "min" in s:
        return float(num) * 60.0
    if "sek" in s or "sec" in s or s.endswith("s"):
        return float(num)
    return 0.0

def build_weekly_training_status(user_id, checkin_date, training_day_prefs, weekly_target_sessions):
    status = {
        "week_start": None,
        "week_end": None,
        "completed_sessions": 0,
        "completed_strength_sessions": 0,
        "completed_running_sessions": 0,
        "completed_restitution_sessions": 0,
        "allowed_days_total": 0,
        "allowed_days_remaining": 0,
        "weekly_target_sessions": int(weekly_target_sessions or 3),
    }

    try:
        dt = datetime.fromisoformat(str(checkin_date))
    except Exception:
        return status

    week_start = dt - timedelta(days=dt.weekday())
    week_end = week_start + timedelta(days=6)

    status["week_start"] = week_start.date().isoformat()
    status["week_end"] = week_end.date().isoformat()

    allowed_days_total = 0
    allowed_days_remaining = 0
    day_keys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

    for i in range(7):
        current = week_start + timedelta(days=i)
        key = day_keys[current.weekday()]
        allowed = bool(training_day_prefs.get(key, True))
        if allowed:
            allowed_days_total += 1
            if current.date() >= dt.date():
                allowed_days_remaining += 1

    status["allowed_days_total"] = allowed_days_total
    status["allowed_days_remaining"] = allowed_days_remaining

    session_results = list_session_results_for_user(user_id)
    if not isinstance(session_results, list):
        session_results = []

    seen_sessions = set()

    for item in session_results:
        if not isinstance(item, dict):
            continue
        if str(item.get("user_id", "")) != str(user_id):
            continue

        raw_date = str(item.get("date", "")).strip()
        try:
            item_dt = datetime.fromisoformat(raw_date)
        except Exception:
            continue

        if item_dt.date() < week_start.date() or item_dt.date() > week_end.date():
            continue

        normalized_type = normalize_session_type(item.get("session_type", ""))

        counts_toward_weekly_goal = item.get("counts_toward_weekly_goal", None)
        if counts_toward_weekly_goal is None:
            fallback_completed = bool(item.get("completed", False))
            fallback_counts = False

            results = item.get("results", [])
            if not isinstance(results, list):
                results = []

            has_meaningful_results = False
            for r in results:
                if not isinstance(r, dict):
                    continue
                if str(r.get("exercise_id", "")).strip():
                    has_meaningful_results = True
                    break
                if str(r.get("achieved_reps", "")).strip():
                    has_meaningful_results = True
                    break
                raw_sets = r.get("sets", [])
                if isinstance(raw_sets, list) and raw_sets:
                    has_meaningful_results = True
                    break

            if fallback_completed and normalized_type == "strength":
                fallback_counts = has_meaningful_results
            elif fallback_completed and normalized_type == "running":
                dist_ok = False
                dur_ok = False
                try:
                    dist_ok = float(item.get("distance_km", 0) or 0) > 0
                except Exception:
                    dist_ok = False
                try:
                    dur_ok = float(item.get("duration_total_sec", 0) or 0) > 0
                except Exception:
                    dur_ok = False
                fallback_counts = bool(dist_ok or dur_ok or has_meaningful_results)

            counts_toward_weekly_goal = fallback_counts

        if counts_toward_weekly_goal is not True:
            if normalized_type == "restitution":
                status["completed_restitution_sessions"] += 1
            continue

        results = item.get("results", [])
        if not isinstance(results, list):
            results = []

        has_meaningful_results = False
        for r in results:
            if not isinstance(r, dict):
                continue
            if str(r.get("exercise_id", "")).strip():
                has_meaningful_results = True
                break
            if str(r.get("achieved_reps", "")).strip():
                has_meaningful_results = True
                break
            raw_sets = r.get("sets", [])
            if isinstance(raw_sets, list) and raw_sets:
                has_meaningful_results = True
                break

        if normalized_type == "strength":
            if not has_meaningful_results:
                continue

        elif normalized_type == "running":
            dist = item.get("distance_km", 0) or 0
            dur_sec = item.get("duration_total_sec", 0) or 0
            try:
                dist = float(dist)
            except Exception:
                dist = 0.0
            try:
                dur_sec = float(dur_sec)
            except Exception:
                dur_sec = 0.0
            if dist <= 0 and dur_sec <= 0 and not has_meaningful_results:
                continue

        elif normalized_type == "restitution":
            if not has_meaningful_results:
                continue

        session_key = (item_dt.date().isoformat(), normalized_type)
        if session_key in seen_sessions:
            continue
        seen_sessions.add(session_key)

        if normalized_type == "strength":
            status["completed_sessions"] += 1
            status["completed_strength_sessions"] += 1
        elif normalized_type == "running":
            status["completed_sessions"] += 1
            status["completed_running_sessions"] += 1
        elif normalized_type == "restitution":
            status["completed_restitution_sessions"] += 1

    return status


def _get_bodyweight_kg_for_session(session_item):
    if isinstance(session_item, dict):
        try:
            direct = float(session_item.get("bodyweight_kg", 0) or 0)
            if direct > 0:
                return direct
        except Exception:
            pass

        user_id = session_item.get("user_id")
        if user_id not in (None, ""):
            settings = get_user_settings_for(user_id)
            if isinstance(settings, dict):
                profile = settings.get("profile", {})
                if isinstance(profile, dict):
                    try:
                        val = float(profile.get("bodyweight_kg", 0) or 0)
                        if val > 0:
                            return val
                    except Exception:
                        pass

                # fallback for legacy flat structure
                try:
                    val = float(settings.get("bodyweight_kg", 0) or 0)
                    if val > 0:
                        return val
                except Exception:
                    pass

    return 0.0

BODYWEIGHT_LOAD_FACTORS = {
    "pull_ups": 1.0,
    "chin_ups": 1.0,
    "dips": 0.9,
    "push_ups": 0.65,
    "incline_push_ups": 0.5,
    "diamond_push_ups": 0.7,
    "lunges": 0.75,
    "split_squat": 0.75,
    "step_ups": 0.7,
    "single_leg_sit_to_stand": 0.75,
    "glute_bridge": 0.55,
    "single_leg_glute_bridge": 0.6,
    "hamstring_walkouts": 0.5,
    "hip_hinge_bw": 0.6,
    "plank": 0.0,
    "side_plank": 0.0,
    "dead_bug": 0.0,
    "bird_dog": 0.0,
    "superman_hold": 0.0,
    "reverse_snow_angels": 0.15,
}

def _get_exercise_meta_for_summary(exercise_id):
    try:
        exercises = read_json_file(FILES["exercises"])
    except Exception:
        exercises = []
    return get_exercise_config(exercises, exercise_id) or {}

def _is_time_based_result(result_item, exercise_meta):
    input_kind = str((exercise_meta or {}).get("input_kind", "")).strip()
    if input_kind in ("time", "cardio_time"):
        return True

    candidates = []
    if isinstance(result_item, dict):
        candidates.append(result_item.get("achieved_reps", ""))
        raw_sets = result_item.get("sets", [])
        if isinstance(raw_sets, list):
            for s in raw_sets:
                if isinstance(s, dict):
                    candidates.append(s.get("reps", ""))

    for value in candidates:
        s = str(value or "").lower()
        if "sek" in s or "sec" in s or "min" in s:
            return True
    return False

def _estimate_effective_load_for_result(result_item, exercise_meta, bodyweight_kg, explicit_load):
    try:
        explicit_load = float(explicit_load or 0)
    except Exception:
        explicit_load = 0.0

    if explicit_load > 0:
        return explicit_load

    meta = exercise_meta or {}
    exercise_id = str(meta.get("id", "")).strip()
    supports_bodyweight = bool(meta.get("supports_bodyweight", False))
    equipment_type = str(meta.get("equipment_type", "")).strip()
    input_kind = str(meta.get("input_kind", "")).strip()
    load_optional = bool(meta.get("load_optional", False))

    if supports_bodyweight or equipment_type == "bodyweight" or input_kind in ("time", "bodyweight_reps", "cardio_time") or load_optional:
        if bodyweight_kg > 0:
            factor = BODYWEIGHT_LOAD_FACTORS.get(exercise_id, 0.4)
            try:
                factor = float(factor)
            except Exception:
                factor = 0.4
            if factor <= 0:
                return 0.0
            return factor * bodyweight_kg

    return 0.0

def build_session_summary(session_item):
    results = session_item.get("results", []) if isinstance(session_item, dict) else []
    if not isinstance(results, list):
        results = []

    total_exercises = len(results)
    completed_exercises = sum(1 for r in results if bool(r.get("completed", False)))
    hit_failure_count = sum(1 for r in results if bool(r.get("hit_failure", False)))

    total_sets = 0
    total_reps = 0
    total_time_under_tension_sec = 0.0
    estimated_volume = 0.0
    progress_flags = []

    bodyweight_kg = _get_bodyweight_kg_for_session(session_item)

    for r in results:
        if not isinstance(r, dict):
            continue

        exercise_id = str(r.get("exercise_id", "")).strip()
        exercise_meta = _get_exercise_meta_for_summary(exercise_id)
        is_time_based = _is_time_based_result(r, exercise_meta)

        sets = r.get("sets", [])
        achieved_reps = _safe_int(r.get("achieved_reps", "0"))
        achieved_tut = _parse_time_under_tension_seconds(r.get("achieved_reps", ""))
        base_load = _safe_float(r.get("load", "0"))
        effective_load = _estimate_effective_load_for_result(r, exercise_meta, bodyweight_kg, base_load)

        if isinstance(sets, list) and sets:
            non_empty_sets = 0
            for s in sets:
                if not isinstance(s, dict):
                    continue

                reps_val = _safe_int(s.get("reps", "0"))
                tut_val = _parse_time_under_tension_seconds(s.get("reps", ""))
                load_val = _safe_float(s.get("load", "0"))
                effective_set_load = _estimate_effective_load_for_result(r, exercise_meta, bodyweight_kg, load_val)

                if reps_val or tut_val or load_val:
                    non_empty_sets += 1

                if is_time_based:
                    total_time_under_tension_sec += tut_val
                    estimated_volume += tut_val * effective_set_load
                else:
                    total_reps += reps_val
                    total_time_under_tension_sec += tut_val
                    estimated_volume += reps_val * effective_set_load

            total_sets += non_empty_sets if non_empty_sets else len(sets)
        else:
            if achieved_reps or achieved_tut or base_load:
                total_sets += 1
                if is_time_based:
                    total_time_under_tension_sec += achieved_tut
                    estimated_volume += achieved_tut * effective_load
                else:
                    total_reps += achieved_reps
                    total_time_under_tension_sec += achieved_tut
                    estimated_volume += achieved_reps * effective_load

        if bool(r.get("completed", False)):
            progress_flags.append(f'{exercise_id}_done')
        if bool(r.get("hit_failure", False)):
            progress_flags.append(f'{exercise_id}_failure')

    fatigue_points = 0
    if hit_failure_count >= 2:
        fatigue_points += 3
    elif hit_failure_count == 1:
        fatigue_points += 2

    if total_sets >= 12:
        fatigue_points += 1
    if total_time_under_tension_sec >= 180:
        fatigue_points += 1
    if estimated_volume >= 3000:
        fatigue_points += 1
    if estimated_volume >= 6000:
        fatigue_points += 1

    if fatigue_points >= 4:
        fatigue = "high"
        next_step_hint = "Tag en lettere næste session."
    elif fatigue_points >= 2:
        fatigue = "moderate"
        next_step_hint = "Hold progressionen rolig næste session."
    else:
        fatigue = "light"
        next_step_hint = "Du kan sandsynligvis progressere næste gang."

    recovery_recommendation = {
        "level": fatigue,
        "text": next_step_hint,
    }

    progression_summary = next_step_hint

    session_type_value = str(session_item.get("session_type", "") or "").strip().lower()
    if session_type_value in ("restitution", "recovery", "rest", "mobilitet", "mobility"):
        post_workout_message = "Dagens restitution er registreret."
    elif session_type_value in ("løb", "run", "cardio"):
        post_workout_message = "Dagens konditionssession er gemt."
    else:
        post_workout_message = "Dagens session er gemt."

    explanation_bits = []
    if fatigue == "high":
        explanation_bits.append("Høj samlet belastning registreret.")
    elif fatigue == "moderate":
        explanation_bits.append("Moderat samlet belastning registreret.")
    elif fatigue == "light":
        explanation_bits.append("Lav samlet belastning registreret.")

    if next_step_hint:
        explanation_bits.append(next_step_hint)

    if hit_failure_count > 0:
        explanation_bits.append(f"Failure-markører: {hit_failure_count}")

    return {
        "completion_state": "completed_session",
        "session_type": session_item.get("session_type", ""),
        "cardio_kind": session_item.get("cardio_kind", ""),
        "distance_km": session_item.get("distance_km", None),
        "duration_total_sec": session_item.get("duration_total_sec", None),
        "pace_sec_per_km": session_item.get("pace_sec_per_km", None),
        "completed_exercises": completed_exercises,
        "total_exercises": total_exercises,
        "total_sets": total_sets,
        "total_reps": total_reps,
        "total_time_under_tension_sec": int(round(total_time_under_tension_sec)),
        "estimated_volume": round(estimated_volume, 1),
        "hit_failure_count": hit_failure_count,
        "fatigue": fatigue,
        "progress_flags": progress_flags,
        "next_step_hint": next_step_hint,
        "recovery_recommendation": recovery_recommendation,
        "progression_summary": progression_summary,
        "post_workout_message": post_workout_message,
        "explanation_bits": explanation_bits,
    }


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

def _did_hit_top_range(result_item):
    if not isinstance(result_item, dict):
        return False

    target = _extract_target_top_value(result_item.get("target_reps", ""))
    achieved = _extract_target_top_value(result_item.get("achieved_reps", ""))

    if target <= 0 or achieved <= 0:
        return False

    return achieved >= target


def _safe_int(value):
    try:
        return int(_parse_numeric_token(value))
    except Exception:
        return 0


def _safe_float(value):
    try:
        return float(_parse_numeric_token(value))
    except Exception:
        return 0.0

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

    for f, items in grouped.items():
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
    path = FILES["adaptation_state"]
    try:
        if not path.exists():
            return {"users": {}}
        raw = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(raw, dict) and isinstance(raw.get("users"), dict):
            return raw
    except Exception:
        pass
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



def build_local_state(user_id, exercises=None, recent_days=7, max_checkins=4):
    user_id = str(user_id or "").strip()
    if not user_id:
        return {}

    region_keys = [
        "ankle_calf",
        "knee",
        "hip",
        "low_back",
        "shoulder",
        "elbow",
        "wrist",
    ]

    out = {
        key: {
            "latest_signal": "none",
            "signal_persistence": 0,
            "recent_load_count": 0,
            "state": "ready",
            "reasons": [],
        }
        for key in region_keys
    }

    checkins = list_checkins_for_user(user_id)
    if not isinstance(checkins, list):
        checkins = []

    checkins = sorted(
        [x for x in checkins if isinstance(x, dict)],
        key=lambda x: str(x.get("created_at", x.get("date", ""))),
        reverse=True,
    )[:max_checkins]

    for idx, item in enumerate(checkins):
        local_signals = item.get("local_signals", [])
        if not isinstance(local_signals, list):
            continue
        for signal_item in local_signals:
            if not isinstance(signal_item, dict):
                continue
            region = str(signal_item.get("region", "")).strip()
            signal = str(signal_item.get("signal", "")).strip()
            if region not in out or signal not in ("caution", "irritated"):
                continue

            if idx == 0:
                out[region]["latest_signal"] = signal
            out[region]["signal_persistence"] += 1

    session_items = list_session_results_for_user(user_id)
    if not isinstance(session_items, list):
        session_items = []

    today = datetime.now(timezone.utc).date()

    for item in session_items:
        if not isinstance(item, dict):
            continue
        date_str = str(item.get("date", "")).strip()
        try:
            session_date = datetime.fromisoformat(date_str).date()
        except Exception:
            continue

        if (today - session_date).days < 0 or (today - session_date).days > recent_days:
            continue

        results = item.get("results", [])
        if not isinstance(results, list):
            continue

        for result in results:
            if not isinstance(result, dict):
                continue
            ex_id = str(result.get("exercise_id", "")).strip()
            if not ex_id:
                continue
            targets = get_local_load_targets_for_exercise(ex_id, exercises=exercises)
            for region in targets:
                if region in out:
                    out[region]["recent_load_count"] += 1

    workouts = list_workouts_for_user(user_id)
    if not isinstance(workouts, list):
        workouts = []

    for item in workouts:
        if not isinstance(item, dict):
            continue
        session_type = str(item.get("session_type", item.get("type", ""))).strip().lower()
        if session_type not in ("løb", "cardio", "run"):
            continue

        date_str = str(item.get("date", "")).strip()
        try:
            session_date = datetime.fromisoformat(date_str).date()
        except Exception:
            continue

        if (today - session_date).days < 0 or (today - session_date).days > recent_days:
            continue

        cardio_kind = str(item.get("cardio_kind", item.get("cardio_type", "base"))).strip().lower() or "base"

        cardio_kind_aliases = {
            "walk": "walking",
            "walking": "walking",
            "easy_walk": "walking",
            "hike": "walking",
            "easy_run": "easy_run",
            "run": "easy_run",
            "jog": "easy_run",
            "base": "easy_run",
            "tempo": "tempo_run",
            "threshold": "tempo_run",
            "interval": "interval_run",
            "intervals": "interval_run",
            "hill": "hill_run",
            "hills": "hill_run",
            "incline": "hill_run",
            "benchmark": "interval_run",
            "test": "interval_run",
            "cycling": "cycling",
            "bike": "cycling",
            "biking": "cycling",
            "row": "rowing",
            "rowing": "rowing",
            "restitution": "walking",
            "recovery": "walking",
        }
        normalized_cardio_kind = cardio_kind_aliases.get(cardio_kind, cardio_kind)

        cardio_targets_map = {
            "walking": ["ankle_calf"],
            "easy_run": ["ankle_calf", "hip"],
            "tempo_run": ["ankle_calf", "hip", "low_back"],
            "interval_run": ["ankle_calf", "knee", "hip"],
            "hill_run": ["ankle_calf", "knee", "hip", "low_back"],
            "cycling": ["knee", "hip"],
            "rowing": ["knee", "hip", "low_back"],
        }

        duration_min = 0
        duration_total_sec = item.get("duration_total_sec", None)
        if duration_total_sec not in (None, "", "null"):
            try:
                duration_min = max(duration_min, int(float(duration_total_sec or 0) / 60.0))
            except Exception:
                duration_min = duration_min

        raw_duration_min = item.get("duration_min", None)
        if raw_duration_min not in (None, "", "null"):
            try:
                duration_min = max(duration_min, int(float(raw_duration_min or 0)))
            except Exception:
                duration_min = duration_min

        avg_rpe = item.get("avg_rpe", None)
        try:
            avg_rpe = float(avg_rpe) if avg_rpe not in (None, "", "null") else None
        except Exception:
            avg_rpe = None

        extra_hits = 0
        if duration_min >= 45:
            extra_hits += 1
        if avg_rpe is not None and avg_rpe >= 7:
            extra_hits += 1
        if normalized_cardio_kind in ("interval_run", "hill_run"):
            extra_hits += 1

        target_regions = cardio_targets_map.get(normalized_cardio_kind, cardio_targets_map.get("easy_run", []))
        for region in target_regions:
            if region in out:
                out[region]["recent_load_count"] += 1 + extra_hits

    for region, info in out.items():
        latest_signal = info.get("latest_signal", "none")
        persistence = int(info.get("signal_persistence", 0) or 0)
        recent_load = int(info.get("recent_load_count", 0) or 0)
        reasons = []

        if latest_signal == "irritated":
            reasons.append("latest local signal is irritated")
        elif latest_signal == "caution":
            reasons.append("latest local signal is caution")

        if persistence >= 2:
            reasons.append("local signal persisted across recent check-ins")

        if recent_load >= 3:
            reasons.append("recent local load is elevated")
        elif recent_load >= 1:
            reasons.append("recent local load is present")

        if latest_signal == "irritated" or (persistence >= 2 and recent_load >= 2):
            state = "protect"
        elif latest_signal == "caution" or persistence >= 1 or recent_load >= 3:
            state = "caution"
        else:
            state = "ready"

        info["state"] = state
        info["reasons"] = reasons[:6]

    return out

def compute_family_fatigue(exercise_id, identity_graph, exercise_profiles):
    """
    Compute fatigue state for one movement/fatigue family.
    """
    exercise_id = str(exercise_id or "").strip()
    identity_graph = identity_graph if isinstance(identity_graph, dict) else {}
    exercise_profiles = exercise_profiles if isinstance(exercise_profiles, dict) else {}

    node = identity_graph.get(exercise_id, {})
    if not isinstance(node, dict):
        return {
            "family_key": "",
            "family_state": "unknown",
            "avg_failure_rate": 0.0,
            "avg_completion_rate": 0.0,
            "regressing_count": 0,
            "simplify_count": 0,
            "related_exercises": [],
            "signals": []
        }

    family_key = (
        str(node.get("fatigue_group", "")).strip()
        or str(node.get("movement_pattern", "")).strip()
        or str(node.get("category", "")).strip()
    ) or None

    family_members = []
    for ex_id, ex_node in identity_graph.items():
        if not isinstance(ex_node, dict):
            continue
        ex_family = (
            str(ex_node.get("fatigue_group", "")).strip()
            or str(ex_node.get("movement_pattern", "")).strip()
            or str(ex_node.get("category", "")).strip()
            or str(ex_id).strip()
        )
        if ex_family == family_key:
            family_members.append(str(ex_id).strip())

    seen = set()
    ordered_members = []
    for ex_id in [exercise_id] + family_members:
        if ex_id and ex_id not in seen:
            seen.add(ex_id)
            ordered_members.append(ex_id)

    failure_rates = []
    completion_rates = []
    regressing_count = 0
    simplify_count = 0
    signals = []

    for ex_id in ordered_members:
        profile = exercise_profiles.get(ex_id, {})
        if not isinstance(profile, dict):
            continue

        try:
            failure_rate = float(profile.get("failure_rate", 0) or 0)
        except Exception:
            failure_rate = 0.0

        try:
            completion_rate = float(profile.get("completion_rate", 0) or 0)
        except Exception:
            completion_rate = 0.0

        trend = str(profile.get("trend", "")).strip()
        action = str(profile.get("recommended_action", "")).strip()

        failure_rates.append(failure_rate)
        completion_rates.append(completion_rate)

        if trend == "regressing":
            regressing_count += 1
            signals.append(f"{ex_id} regressing")

        if action == "simplify":
            simplify_count += 1
            signals.append(f"{ex_id} simplify")

        if failure_rate >= 0.3:
            signals.append(f"{ex_id} høj failure rate")

        if completion_rate and completion_rate < 0.7:
            signals.append(f"{ex_id} lav completion")

    avg_failure_rate = round(sum(failure_rates) / len(failure_rates), 2) if failure_rates else 0.0
    avg_completion_rate = round(sum(completion_rates) / len(completion_rates), 2) if completion_rates else 0.0

    if simplify_count >= 1 or regressing_count >= 1 or avg_failure_rate >= 0.3:
        family_state = "fatigued"
    elif avg_completion_rate >= 0.85 and avg_failure_rate <= 0.1:
        family_state = "ready"
    else:
        family_state = "stable"

    return {
        "family_key": family_key,
        "family_state": family_state,
        "avg_failure_rate": avg_failure_rate,
        "avg_completion_rate": avg_completion_rate,
        "regressing_count": regressing_count,
        "simplify_count": simplify_count,
        "related_exercises": ordered_members,
        "signals": signals[:10]
    }

def build_family_fatigue_map(identity_graph, exercise_profiles):
    """
    Compute one fatigue object per family key.
    """
    identity_graph = identity_graph if isinstance(identity_graph, dict) else {}
    exercise_profiles = exercise_profiles if isinstance(exercise_profiles, dict) else {}

    out = {}
    processed = set()

    for exercise_id, node in identity_graph.items():
        if not isinstance(node, dict):
            continue
        family_key = (
            str(node.get("fatigue_group", "")).strip()
            or str(node.get("movement_pattern", "")).strip()
            or str(node.get("category", "")).strip()
        ) or None

        if not family_key or family_key in processed:
            continue

        processed.add(family_key)
        out[family_key] = compute_family_fatigue(exercise_id, identity_graph, exercise_profiles)

    return out




def _extract_target_top_value(value):
    s = str(value or "").strip().lower()
    if not s:
        return 0.0
    if "-" in s:
        parts = s.split("-")
        try:
            return float(str(parts[-1]).replace(",", ".").split()[0])
        except Exception:
            pass
    nums = re.findall(r'\d+(?:[.,]\d+)?', s)
    if nums:
        try:
            return float(str(nums[-1]).replace(",", "."))
        except Exception:
            return 0.0
    return 0.0

def _extract_set_reps_list(result_item):
    out = []
    sets = result_item.get("sets", []) if isinstance(result_item, dict) else []
    if isinstance(sets, list):
        for s in sets:
            if not isinstance(s, dict):
                continue
            raw = str(s.get("reps", "")).strip()
            if not raw:
                continue
            nums = re.findall(r'\d+(?:[.,]\d+)?', raw)
            if not nums:
                continue
            try:
                out.append(float(str(nums[0]).replace(",", ".")))
            except Exception:
                pass
    if out:
        return out

    raw = str((result_item or {}).get("achieved_reps", "")).strip()
    nums = re.findall(r'\d+(?:[.,]\d+)?', raw)
    if nums:
        try:
            return [float(str(nums[0]).replace(",", "."))]
        except Exception:
            return []
    return []

def _is_bodyweight_like(result_item, exercise_meta):
    if not isinstance(exercise_meta, dict):
        exercise_meta = {}
    if bool(exercise_meta.get("supports_bodyweight", False)):
        return True
    if str(exercise_meta.get("equipment_type", "")).strip() in ("bodyweight", ""):
        raw_load = str((result_item or {}).get("load", "")).strip()
        if not raw_load:
            return True
    return False



def get_progression_channels(exercise_meta):
    exercise_meta = exercise_meta if isinstance(exercise_meta, dict) else {}
    channels = exercise_meta.get("progression_channels", [])
    if not isinstance(channels, list):
        return []
    return [str(x).strip() for x in channels if str(x).strip()]

def get_next_variation(exercise_id, exercise_map):
    exercise_id = str(exercise_id or "").strip()
    exercise_map = exercise_map if isinstance(exercise_map, dict) else {}
    exercise_meta = exercise_map.get(exercise_id, {}) or {}
    ladder = exercise_meta.get("progression_ladder", [])
    if not isinstance(ladder, list):
        return None

    normalized = [str(x).strip() for x in ladder if str(x).strip()]
    if not normalized:
        return None

    try:
        idx = normalized.index(exercise_id)
    except ValueError:
        return None

    if idx + 1 < len(normalized):
        return normalized[idx + 1]
    return None




def get_family_key_for_exercise(exercise_id, identity_graph=None):
    exercise_id = str(exercise_id or "").strip()
    identity_graph = identity_graph if isinstance(identity_graph, dict) else {}
    node = identity_graph.get(exercise_id, {}) if isinstance(identity_graph, dict) else {}
    if not isinstance(node, dict):
        node = {}
    family_key = (
        str(node.get("fatigue_group", "")).strip()
        or str(node.get("movement_pattern", "")).strip()
        or str(node.get("category", "")).strip()
    )
    return family_key or None


def build_family_last_trained_map(user_id, identity_graph=None):
    user_id = str(user_id or "").strip()
    identity_graph = identity_graph if isinstance(identity_graph, dict) else {}

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

    out = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        session_date = str(item.get("date", "")).strip()
        if not session_date:
            continue
        for result in item.get("results", []) or []:
            if not isinstance(result, dict):
                continue
            ex_id = str(result.get("exercise_id", "")).strip()
            if not ex_id:
                continue
            family_key = get_family_key_for_exercise(ex_id, identity_graph)
            if not family_key:
                continue
            prev = out.get(family_key)
            if not prev or session_date > prev:
                out[family_key] = session_date
    return out




def get_family_role(family_key):
    family_key = str(family_key or "").strip()

    primary = {
        "squat",
        "hinge",
        "single_leg_squat",
        "horizontal_push",
        "horizontal_pull",
        "vertical_push"
    }

    support = {
        "core_bracing",
        "core_control",
        "core_lateral",
        "back_extension",
        "ankle_extension"
    }

    tertiary = {
        "steady_cardio",
        "interval_cardio",
        "cardio_general",
        "mobility_flow",
        "mobility_squat",
        "core_dynamic"
    }

    if family_key in primary:
        return "primary"
    if family_key in support:
        return "support"
    if family_key in tertiary:
        return "tertiary"
    return "support"


def build_family_priority_map(user_id, readiness=None, time_budget_min=None):
    user_id = str(user_id or "").strip()
    state = get_live_adaptation_state_for(user_id)

    identity_graph = state.get("exercise_identity_graph", {}) if isinstance(state, dict) else {}
    family_fatigue = state.get("family_fatigue", {}) if isinstance(state, dict) else {}
    load_metrics = state.get("load_metrics", {}) if isinstance(state, dict) else {}

    if not isinstance(identity_graph, dict):
        identity_graph = {}
    if not isinstance(family_fatigue, dict):
        family_fatigue = {}
    if not isinstance(load_metrics, dict):
        load_metrics = {}

    try:
        readiness_val = int(readiness if readiness is not None else 0)
    except Exception:
        readiness_val = 0

    try:
        time_val = int(time_budget_min if time_budget_min is not None else 0)
    except Exception:
        time_val = 0

    today_str = datetime.now(timezone.utc).date().isoformat()
    last_trained_map = build_family_last_trained_map(user_id, identity_graph)

    family_keys = set(family_fatigue.keys())
    for ex_id, node in identity_graph.items():
        family_key = get_family_key_for_exercise(ex_id, identity_graph)
        if family_key:
            family_keys.add(family_key)

    out = {}

    for family_key in sorted(family_keys):
        info = family_fatigue.get(family_key, {})
        if not isinstance(info, dict):
            info = {}

        family_state = str(info.get("family_state", "unknown")).strip() or "unknown"
        signals = info.get("signals", [])
        if not isinstance(signals, list):
            signals = []

        last_date = last_trained_map.get(family_key)
        days_since = None
        if last_date:
            try:
                days_since = days_between_iso_dates(last_date, today_str)
            except Exception:
                days_since = None

        priority = 0.0
        reasons = []
        family_role = get_family_role(family_key)

        if family_role == "primary":
            priority += 0.35
            reasons.append("primær styrkefamilie")
        elif family_role == "support":
            priority -= 0.05
        elif family_role == "tertiary":
            priority -= 0.75
            reasons.append("sekundær/tertiær familie i styrkekontekst")

        # recency
        if days_since is None:
            priority += 1.2
            reasons.append("ingen registreret historik i familien")
        elif days_since >= 5:
            priority += 1.0
            reasons.append(f"ikke trænet i {days_since} dage")
        elif days_since >= 3:
            priority += 0.6
            reasons.append(f"ikke trænet i {days_since} dage")
        elif days_since <= 1:
            priority -= 0.7
            reasons.append("trænet for nylig")

        # family state
        if family_state == "ready":
            priority += 0.8
            reasons.append("familien er klar")
        elif family_state == "stable":
            priority += 0.2
            reasons.append("familien er stabil")
        elif family_state == "fatigued":
            priority -= 1.0
            reasons.append("family shows fatigue")

        # readiness
        if readiness_val >= 4:
            priority += 0.3
            reasons.append("high readiness")
        elif readiness_val <= 2:
            priority -= 0.4
            reasons.append("low readiness")

        # time budget
        if time_val and time_val <= 20:
            if family_key in ("squat", "hinge", "horizontal_push", "horizontal_pull", "single_leg_squat"):
                priority += 0.15
                reasons.append("limited time favors large/simple movements")
            elif family_key in ("core_bracing", "core_control"):
                priority -= 0.1
        elif time_val >= 40 and family_key in ("core_bracing", "core_control", "steady_cardio"):
            priority += 0.15
            reasons.append("mere tid giver plads til supplerende arbejde")

        # signals
        negative_signal_count = 0
        for s in signals:
            s_norm = str(s or "").strip().lower()
            if any(token in s_norm for token in ("failure", "simplify", "lav completion", "regressing")):
                negative_signal_count += 1
        if negative_signal_count:
            penalty = min(0.6, 0.15 * negative_signal_count)
            priority -= penalty
            reasons.append(f"{negative_signal_count} negative signaler i familien")

        # load status
        load_status = str(load_metrics.get("load_status", "")).strip()
        if load_status == "spiking":
            if family_key in ("squat", "hinge", "single_leg_squat"):
                priority -= 0.25
                reasons.append("samlet belastning er høj")
        elif load_status == "underloaded":
            if family_key in ("squat", "hinge", "horizontal_push", "horizontal_pull"):
                priority += 0.15
                reasons.append("samlet belastning er lav")

        out[family_key] = {
            "family_key": family_key,
            "family_role": family_role,
            "priority": round(priority, 2),
            "family_state": family_state,
            "days_since_last_family": days_since,
            "negative_signal_count": negative_signal_count,
            "reason": reasons[:6]
        }

    return out




def get_exercises_for_family(family_key, exercises=None, identity_graph=None):
    family_key = str(family_key or "").strip()
    exercises = exercises if isinstance(exercises, list) else read_json_file(FILES["exercises"])
    identity_graph = identity_graph if isinstance(identity_graph, dict) else build_exercise_identity_graph(exercises)

    out = []
    for item in exercises or []:
        if not isinstance(item, dict):
            continue
        ex_id = str(item.get("id", "")).strip()
        if not ex_id:
            continue
        ex_family = get_family_key_for_exercise(ex_id, identity_graph)
        if ex_family == family_key:
            out.append(item)
    return out


def build_exercise_last_trained_map(user_id):
    user_id = str(user_id or "").strip()

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

    out = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        session_date = str(item.get("date", "")).strip()
        if not session_date:
            continue
        for result in item.get("results", []) or []:
            if not isinstance(result, dict):
                continue
            ex_id = str(result.get("exercise_id", "")).strip()
            if not ex_id:
                continue
            prev = out.get(ex_id)
            if not prev or session_date > prev:
                out[ex_id] = session_date
    return out






def get_exercise_meta(exercise_id, exercises=None):
    exercise_id = str(exercise_id or "").strip()

    if exercises is None:
        exercises = read_json_file(FILES["exercises"])

    if not isinstance(exercises, list):
        return None

    for item in exercises:
        if not isinstance(item, dict):
            continue
        if str(item.get("id", "")).strip() == exercise_id:
            return item

    return None


def build_autoplan_strength(user_id, readiness=None, time_budget_min=None, user_settings=None, limit=3):
    user_id = str(user_id or "").strip()

    if user_settings is None:
        user_settings = read_json_file(FILES["user_settings"])

    selected_families = select_training_families(
        user_id,
        readiness=readiness,
        time_budget_min=time_budget_min,
        limit=limit
    )

    entries = []
    family_outputs = []

    for fam in selected_families:
        if not isinstance(fam, dict):
            continue

        family_key = str(fam.get("family_key", "")).strip()
        if not family_key:
            continue

        picked = choose_exercise_for_family(
            user_id,
            family_key,
            readiness=readiness,
            time_budget_min=time_budget_min,
            user_settings=user_settings
        )

        if not picked or not isinstance(picked, dict):
            continue

        raw_exercise_id = picked.get("exercise_id")
        exercise_id = str(raw_exercise_id).strip() if raw_exercise_id not in (None, "") else ""
        if not exercise_id:
            family_outputs.append({
                "family_key": family_key,
                "family_role": fam.get("family_role"),
                "priority": fam.get("priority"),
                "exercise_id": None,
                "exercise_score": None,
                "family_reason": fam.get("reason", []),
                "exercise_reason": picked.get("reason", []),
                "local_state_applied": bool(picked.get("blocked_by_local_state", False)),
                "blocked_by_local_state": bool(picked.get("blocked_by_local_state", False)),
                "blocked_regions": picked.get("blocked_regions", []),
                "blocked_reason": picked.get("blocked_reason")
            })
            continue

        exercise_meta = get_exercise_meta(exercise_id) or {}

        sets = exercise_meta.get("default_sets", 3)
        try:
            sets = int(sets or 3)
        except Exception:
            sets = 3
        if sets < 1:
            sets = 3

        target_reps = str(
            exercise_meta.get("default_reps")
            or exercise_meta.get("target_reps")
            or exercise_meta.get("rep_range")
            or "6-8"
        ).strip()

        input_kind = str(exercise_meta.get("input_kind", "")).strip()
        default_unit = str(exercise_meta.get("default_unit", "")).strip()
        target_load = exercise_meta.get("start_weight", None)

        if input_kind in ("time", "cardio_time", "bodyweight_reps"):
            target_load = None
        elif target_load is not None and default_unit:
            target_load = f"{target_load} {default_unit}"
        elif target_load is not None:
            target_load = str(target_load)
        else:
            target_load = None

        entry = {
            "exercise_id": exercise_id,
            "sets": sets,
            "target_reps": target_reps,
            "target_load": target_load,
            "progression_decision": "autoplan_initial",
            "progression_reason": "autoplan valgte øvelsen ud fra familieprioritet og historik",
            "recommended_next_load": None,
            "actual_possible_next_load": None,
            "equipment_constraint": False,
            "secondary_constraints": [],
            "next_target_reps": None,
            "substituted_from": None,
            "autoplan_family": family_key,
            "autoplan_score": picked.get("score", 0),
            "autoplan_reason": picked.get("reason", []),
            "decision": None
        }

        entry["decision"] = build_training_decision(
            user_id=user_id,
            plan_item=entry,
            readiness=readiness,
            time_available=time_budget_min
        )

        entries.append(entry)
        family_outputs.append({
            "family_key": family_key,
            "family_role": fam.get("family_role"),
            "priority": fam.get("priority"),
            "exercise_id": exercise_id,
            "exercise_score": picked.get("score", 0),
            "family_reason": fam.get("reason", []),
            "exercise_reason": picked.get("reason", []),
            "local_state_applied": any("lokal caution" in str(x) for x in (picked.get("reason", []) or []))
        })

    return {
        "template_mode": "autoplan_v0_1",
        "families_selected": family_outputs,
        "entries": entries
    }


def choose_exercise_for_family(user_id, family_key, readiness=None, time_budget_min=None, user_settings=None):
    user_id = str(user_id or "").strip()
    family_key = str(family_key or "").strip()

    state = get_live_adaptation_state_for(user_id)
    identity_graph = state.get("exercise_identity_graph", {}) if isinstance(state, dict) else {}
    learning_signals = state.get("learning_signals", {}) if isinstance(state, dict) else {}
    local_state = state.get("local_state", {}) if isinstance(state, dict) else {}
    if not isinstance(identity_graph, dict):
        identity_graph = {}
    if not isinstance(learning_signals, dict):
        learning_signals = {}
    if not isinstance(local_state, dict):
        local_state = {}

    exercises = read_json_file(FILES["exercises"])
    candidates = get_exercises_for_family(family_key, exercises=exercises, identity_graph=identity_graph)
    last_trained_map = build_exercise_last_trained_map(user_id)

    if user_settings is None:
        user_settings = read_json_file(FILES["user_settings"])
    available = {}
    if isinstance(user_settings, dict):
        available = user_settings.get("available_equipment", {}) or {}
    if not isinstance(available, dict):
        available = {}

    scored = []
    family_blocked_regions = set()

    for item in candidates:
        ex_id = str(item.get("id", "")).strip()
        if not ex_id:
            continue

        equipment = str(item.get("equipment", "") or item.get("default_equipment", "") or "").strip().lower()
        equipment_ok = True
        if equipment and equipment not in ("bodyweight", "none"):
            if available:
                equipment_ok = bool(available.get(equipment, False))

        if not equipment_ok:
            continue

        learning = learning_signals.get(ex_id, {}) if isinstance(learning_signals, dict) else {}
        if not isinstance(learning, dict):
            learning = {}

        learned = str(learning.get("learned_recommendation", "")).strip()
        next_variation = str(learning.get("next_variation", "")).strip()

        local_targets = get_local_load_targets_for_exercise(ex_id, exercises=exercises)
        blocked_regions = []
        caution_regions = []
        for region in local_targets:
            info = local_state.get(region, {}) if isinstance(local_state, dict) else {}
            if not isinstance(info, dict):
                continue
            region_state = str(info.get("state", "")).strip()
            if region_state == "protect":
                blocked_regions.append(region)
            elif region_state == "caution":
                caution_regions.append(region)

        if blocked_regions:
            for region in blocked_regions:
                family_blocked_regions.add(region)
            continue

        score = 0.0
        reasons = []

        if learned == "progress_variation":
            score += 1.0
            reasons.append("læring peger mod progression")
        elif learned in ("increase_load", "increase_reps", "increase_time"):
            score += 0.5
            reasons.append("læring peger mod progression")
        elif learned == "hold":
            score += 0.2
        elif learned == "simplify":
            score -= 0.5
            reasons.append("læring peger mod forenkling")

        if next_variation and ex_id == next_variation:
            score += 1.2
            reasons.append("er foreslået næste variation")

        last_date = last_trained_map.get(ex_id)
        days_since_last = None
        if last_date:
            days_since_last = days_since_date(last_date)

        if days_since_last is None:
            score += 0.35
            reasons.append("ingen nylig historik")
        elif days_since_last >= 14:
            score += 0.3
            reasons.append("ikke trænet for nylig")
        elif days_since_last >= 7:
            score += 0.1
            reasons.append("har lidt afstand")
        elif days_since_last >= 3:
            score -= 0.15
            reasons.append("trænet for nylig")
        else:
            score -= 0.35
            reasons.append("meget nyligt trænet")

        progression_mode = str(item.get("progression_mode", "")).strip()
        if progression_mode == "double_progression":
            score += 0.15

        if caution_regions:
            score -= 0.6 * len(caution_regions)
            reasons.append(f"lokal caution i: {', '.join(caution_regions[:3])}")

        input_kind = str(item.get("input_kind", "")).strip()
        if readiness is not None:
            try:
                readiness_val = int(readiness)
            except Exception:
                readiness_val = 0
            if readiness_val <= 2 and input_kind in ("time", "bodyweight_reps"):
                score += 0.1

        scored.append({
            "exercise_id": ex_id,
            "score": round(score, 2),
            "reason": reasons[:4],
            "item": item
        })

    scored.sort(key=lambda x: (x.get("score", 0), x.get("exercise_id", "")), reverse=True)

    if not scored:
        if family_blocked_regions:
            blocked_regions = sorted(family_blocked_regions)
            return {
                "family_key": family_key,
                "exercise_id": None,
                "score": None,
                "reason": [],
                "alternatives": [],
                "blocked_by_local_state": True,
                "blocked_regions": blocked_regions,
                "blocked_reason": f"lokal beskyttelse blokerede familien: {', '.join(blocked_regions)}"
            }
        return None

    top = scored[0]
    return {
        "family_key": family_key,
        "exercise_id": top.get("exercise_id"),
        "score": top.get("score", 0),
        "reason": top.get("reason", []),
        "alternatives": [
            {
                "exercise_id": x.get("exercise_id"),
                "score": x.get("score", 0)
            }
            for x in scored[1:4]
        ]
    }


def select_training_families(user_id, readiness=None, time_budget_min=None, limit=3):
    family_map = build_family_priority_map(user_id, readiness=readiness, time_budget_min=time_budget_min)
    items = [x for x in family_map.values() if isinstance(x, dict)]

    items.sort(key=lambda x: (x.get("priority", 0), str(x.get("family_key", ""))), reverse=True)

    limit = int(limit or 3)
    selected = []
    seen = set()

    primary_items = [x for x in items if str(x.get("family_role", "")).strip() == "primary"]
    support_items = [x for x in items if str(x.get("family_role", "")).strip() == "support"]
    tertiary_items = [x for x in items if str(x.get("family_role", "")).strip() == "tertiary"]

    # first pass: prefer up to 2 primary families
    for item in primary_items:
        family_key = str(item.get("family_key", "")).strip()
        if not family_key or family_key in seen:
            continue
        if len(selected) >= min(limit, 2):
            break
        selected.append(item)
        seen.add(family_key)

    # second pass: add at most 1 support family
    for item in support_items:
        family_key = str(item.get("family_key", "")).strip()
        if not family_key or family_key in seen:
            continue
        if len(selected) >= limit:
            break
        if any(str(x.get("family_role", "")).strip() == "support" for x in selected):
            continue
        selected.append(item)
        seen.add(family_key)

    # third pass: fill from remaining primary, then support, avoid tertiary unless necessary
    for pool in (primary_items, support_items, tertiary_items):
        for item in pool:
            family_key = str(item.get("family_key", "")).strip()
            if not family_key or family_key in seen:
                continue
            if len(selected) >= limit:
                break
            if str(item.get("family_role", "")).strip() == "tertiary":
                # tertiary only if still missing slots entirely
                if len(selected) >= max(1, limit - 1):
                    continue
            selected.append(item)
            seen.add(family_key)
        if len(selected) >= limit:
            break

    return selected


def build_learning_signals(user_id):
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

    exercises = read_json_file(FILES["exercises"])
    exercise_map = {}
    for ex in exercises or []:
        if isinstance(ex, dict) and str(ex.get("id", "")).strip():
            exercise_map[str(ex.get("id")).strip()] = ex

    grouped = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        for result in item.get("results", []) or []:
            if not isinstance(result, dict):
                continue
            ex_id = str(result.get("exercise_id", "")).strip()
            if not ex_id:
                continue
            grouped.setdefault(ex_id, []).append({
                "session_date": str(item.get("date", "")).strip(),
                "created_at": str(item.get("created_at", "")).strip(),
                "result": result,
                "session_completed": bool(item.get("completed", False))
            })

    out = {}

    for ex_id, rows in grouped.items():
        rows = sorted(
            rows,
            key=lambda x: (x.get("session_date", ""), x.get("created_at", "")),
            reverse=True
        )[:6]

        exercise_meta = exercise_map.get(ex_id, {}) or {}

        top_hits = 0
        failure_count = 0
        dropoffs = []
        consistency_values = []
        sample_count = 0

        for row in rows:
            result = row.get("result", {}) or {}
            target_top = _extract_target_top_value(result.get("target_reps", ""))
            reps_list = _extract_set_reps_list(result)

            if result.get("hit_failure", False):
                failure_count += 1

            if reps_list:
                sample_count += 1
                best = max(reps_list)
                worst = min(reps_list)

                if target_top > 0 and best >= target_top:
                    top_hits += 1

                if best > 0:
                    dropoffs.append(max(0.0, (best - worst) / best))
                    consistency_values.append(max(0.0, min(1.0, worst / best)))

        top_hit_rate = round(top_hits / sample_count, 2) if sample_count else 0.0
        failure_signal = round(failure_count / len(rows), 2) if rows else 0.0
        dropoff_signal = round(sum(dropoffs) / len(dropoffs), 2) if dropoffs else 0.0
        consistency_signal = round(sum(consistency_values) / len(consistency_values), 2) if consistency_values else 0.0

        bodyweight_like = _is_bodyweight_like((rows[0].get("result", {}) if rows else {}), exercise_meta)
        progression_channels = get_progression_channels(exercise_meta)
        next_variation = get_next_variation(ex_id, exercise_map)

        if failure_signal >= 0.34 or dropoff_signal >= 0.35:
            learned_recommendation = "simplify"
        elif top_hit_rate >= 0.66 and consistency_signal >= 0.75:
            if "variation" in progression_channels and next_variation:
                learned_recommendation = "progress_variation"
            elif "time" in progression_channels:
                learned_recommendation = "increase_time"
            elif bodyweight_like:
                learned_recommendation = "increase_reps"
            else:
                learned_recommendation = "increase_load"
        elif top_hit_rate >= 0.33 and consistency_signal >= 0.6:
            learned_recommendation = "hold"
        else:
            learned_recommendation = "hold"

        out[ex_id] = {
            "samples": len(rows),
            "top_hit_rate": top_hit_rate,
            "failure_signal": failure_signal,
            "dropoff_signal": dropoff_signal,
            "consistency_signal": consistency_signal,
            "learned_recommendation": learned_recommendation,
            "progression_channels": progression_channels,
            "next_variation": next_variation
        }

    return out


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

    exercises = read_json_file(FILES["exercises"])
    identity_graph = build_exercise_identity_graph(exercises)
    load_metrics = compute_load_metrics(items, user_id=user_id)
    exercise_profiles = build_exercise_profiles(user_id)
    family_fatigue = build_family_fatigue_map(identity_graph, exercise_profiles)
    learning_signals = build_learning_signals(user_id)
    local_state = build_local_state(user_id, exercises=exercises)

    state = get_adaptation_state()
    users = state.setdefault("users", {})
    current = users.get(user_id, {})
    if not isinstance(current, dict):
        current = {}

    current["user_id"] = user_id
    current["updated_at"] = datetime.now(timezone.utc).isoformat()
    current["load_metrics"] = load_metrics
    current["exercise_identity_graph"] = identity_graph
    current["exercise_profiles"] = exercise_profiles
    current["family_fatigue"] = family_fatigue
    current["learning_signals"] = learning_signals
    current["local_state"] = local_state

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

@app.get("/api/session-results/<session_result_id>")
def get_session_result_by_id(session_result_id):
    auth_user, auth_err = require_auth_user()
    if auth_err:
        log_auth_failure("session-result:get_by_id", auth_err)
        return auth_err

    item = get_user_item("session_results", auth_user.get("user_id"), session_result_id)
    if not isinstance(item, dict):
        return jsonify({"ok": False, "error": "not_found", "message": "session_result blev ikke fundet", "id": session_result_id}), 404

    item["summary"] = build_session_summary(item)
    return jsonify({"ok": True, "item": item})

@app.put("/api/session-results/<session_result_id>")
def put_session_result(session_result_id):
    auth_user, auth_err = require_auth_user()
    if auth_err:
        log_auth_failure("session-result:put", auth_err)
        return auth_err

    item, err_payload, status = update_session_result(
        auth_user.get("user_id"),
        session_result_id,
        request.get_json(silent=True) or {}
    )
    if err_payload is not None:
        payload, status = ensure_error_contract(err_payload, status)
        return jsonify(payload), status

    adaptation_state = update_adaptation_state(auth_user.get("user_id"))
    return jsonify({"ok": True, "item": item, "summary": item.get("summary"), "adaptation_state": adaptation_state})

@app.delete("/api/session-results/<session_result_id>")
def delete_session_result_by_id(session_result_id):
    auth_user, auth_err = require_auth_user()
    if auth_err:
        log_auth_failure("session-result:delete", auth_err)
        return auth_err

    deleted = delete_user_item("session_results", auth_user.get("user_id"), session_result_id)
    if not isinstance(deleted, dict):
        return jsonify({"ok": False, "error": "not_found", "message": "session_result blev ikke fundet", "id": session_result_id}), 404

    adaptation_state = update_adaptation_state(auth_user.get("user_id"))
    deleted["summary"] = build_session_summary(deleted)
    return jsonify({"ok": True, "deleted": deleted, "summary": deleted.get("summary"), "adaptation_state": adaptation_state})

@app.post("/api/session-result")
def post_session_result():
    auth_user, auth_err = require_auth_user()
    if auth_err:
        log_auth_failure("session-result", auth_err)
        return auth_err

    item, err_payload, third = create_session_result(
        auth_user.get("user_id"),
        request.get_json(silent=True) or {}
    )

    if err_payload is not None:
        payload, status = ensure_error_contract(err_payload, third)
        return jsonify(payload), status

    summary = build_session_summary(item)
    consume_manual_override_workout_storage(auth_user.get("user_id"), item.get("date"))
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
        log_auth_failure("workouts:get", auth_err)
        return auth_err
    items = list_workouts_for_user(auth_user.get("user_id"))
    return jsonify({"ok": True, "items": items})

@app.post("/api/workouts")
def post_workouts():
    auth_user, auth_err = require_auth_user()
    if auth_err:
        log_auth_failure("workouts:post", auth_err)
        return auth_err

    item, err_payload, third = create_workout(auth_user.get("user_id"), request.get_json(silent=True) or {})
    if err_payload is not None:
        payload, status = ensure_error_contract(err_payload, third)
        return jsonify(payload), status

    return jsonify({"ok": True, "item": item, "count": third}), 201

@app.get("/api/checkins")
def get_checkins():
    auth_user, auth_err = require_auth_user()
    if auth_err:
        log_auth_failure("checkin", auth_err)
        return auth_err
    items = list_checkins_for_user(auth_user.get("user_id"))
    return jsonify({"ok": True, "items": items})

@app.get("/api/checkins/<checkin_id>")
def get_checkin_by_id(checkin_id):
    auth_user, auth_err = require_auth_user()
    if auth_err:
        log_auth_failure("checkin:get_by_id", auth_err)
        return auth_err

    item = get_user_item("checkins", auth_user.get("user_id"), checkin_id)
    if not isinstance(item, dict):
        return jsonify(make_error_payload("not_found", "checkin blev ikke fundet", id=checkin_id)), 404

    return jsonify({"ok": True, "item": item})

@app.put("/api/checkins/<checkin_id>")
def put_checkin(checkin_id):
    auth_user, auth_err = require_auth_user()
    if auth_err:
        log_auth_failure("checkin:put", auth_err)
        return auth_err

    payload = request.get_json(silent=True) or {}
    item, err_payload, status = update_checkin(
        auth_user.get("user_id"),
        checkin_id,
        payload
    )
    if err_payload is not None:
        payload, status = ensure_error_contract(err_payload, status)
        return jsonify(payload), status

    return jsonify({"ok": True, "item": item})

@app.delete("/api/checkins/<checkin_id>")
def delete_checkin_by_id(checkin_id):
    auth_user, auth_err = require_auth_user()
    if auth_err:
        log_auth_failure("checkin:delete", auth_err)
        return auth_err

    deleted = delete_user_item("checkins", auth_user.get("user_id"), checkin_id)
    if not isinstance(deleted, dict):
        return jsonify(make_error_payload("not_found", "checkin blev ikke fundet", id=checkin_id)), 404

    return jsonify({"ok": True, "deleted": deleted})

@app.get("/api/checkin/latest")
def get_latest_checkin():
    auth_user, auth_err = require_auth_user()
    if auth_err:
        log_auth_failure("checkin", auth_err)
        return auth_err
    item = get_latest_checkin_for_user(auth_user.get("user_id"))
    return jsonify({"ok": True, "item": item})

@app.post("/api/checkin")
def post_checkin():
    auth_user, auth_err = require_auth_user()
    if auth_err:
        log_auth_failure("checkin", auth_err)
        return auth_err

    item, err_payload, third = create_checkin(auth_user.get("user_id"), request.get_json(silent=True) or {})
    if err_payload is not None:
        payload, status = ensure_error_contract(err_payload, third)
        return jsonify(payload), status

    return jsonify({"ok": True, "item": item, "count": third}), 201

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8091, debug=True)
