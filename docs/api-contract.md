# API contract

## Overview

This document defines the current and near-term API contract for SovereignStrength.

Its purpose is to keep frontend expectations, backend behavior, and documentation aligned.

This is not a promise of infinite future elegance.
It is a working contract for the current system and the immediate path to version 1.0.

## Principles

The API should be:

- deterministic
- explainable
- local-first
- stable enough for the frontend to rely on
- small enough to debug without ritual sacrifice

## Authentication model

### `POST /auth/login`

Authenticates the user and starts a session.

#### Request body

```json
{
  "username": "jakob",
  "password": "example-password"
}
```

#### Success response

```json
{
  "ok": true,
  "user": {
    "id": 1,
    "username": "jakob"
  }
}
```

#### Failure response

```json
{
  "ok": false,
  "error": "invalid_credentials"
}
```

#### Notes

- Session handling is cookie-based.
- A successful login establishes an authenticated session for later requests.

---

## Planning endpoints

### `GET /plan/today`

Returns the current recommended training plan for the day.

This endpoint is the main planning endpoint currently documented for the system.

#### Purpose

- determine today's plan
- incorporate readiness and fatigue context
- provide explainable output for the frontend

#### Example response

```json
{
  "ok": true,
  "date": "2026-03-12",
  "decision_mode": "fatigue_primary_v1",
  "plan_type": "light_strength",
  "readiness_score": 2,
  "fatigue_score": 2,
  "days_since_last_strength": 3,
  "time_budget": 30,
  "exercises": [
    {
      "exercise_id": "bench_press",
      "name": "Bench Press",
      "sets": 3,
      "target_reps": "6-8",
      "recommended_next_load": 62.5,
      "actual_possible_next_load": 65,
      "equipment_constraint": true,
      "progression_decision": "increase_if_clean",
      "progression_reason": "Last session met rep target, but available equipment requires a larger increment."
    }
  ],
  "explanation": [
    "Fatigue score is elevated.",
    "Plan type adjusted to light_strength.",
    "Load recommendation respects available equipment increments."
  ]
}
```

#### Notes

- `plan_type` may currently include:
  - `short_20`
  - `short_30`
  - `light_strength`
- `decision_mode` is currently documented as `fatigue_primary_v1`.

---

## Check-in endpoints

### `POST /checkin`

Stores a daily readiness check-in.

This endpoint is included here as a near-term canonical contract even if implementation details may still be evolving.

#### Request body

```json
{
  "date": "2026-03-12",
  "sleep_score": 3,
  "energy_score": 2,
  "soreness_score": 2,
  "notes": "Slept okay, mild leg soreness"
}
```

#### Success response

```json
{
  "ok": true,
  "checkin": {
    "date": "2026-03-12",
    "sleep_score": 3,
    "energy_score": 2,
    "soreness_score": 2,
    "readiness_score": 2,
    "notes": "Slept okay, mild leg soreness"
  }
}
```

#### Notes

- `readiness_score` may be computed server-side from submitted inputs.
- The endpoint should preserve raw check-in values as part of the system history.

---

## Workout endpoints

### `POST /workout/start`

Starts a workout session.

This endpoint is part of the near-term 1.0 contract and may not yet be fully implemented.

#### Request body

```json
{
  "date": "2026-03-12",
  "program_day": "A",
  "time_budget": 30
}
```

#### Success response

```json
{
  "ok": true,
  "workout_id": "2026-03-12_A",
  "started_at": "17:42"
}
```

---

### `POST /workout/entry`

Stores one exercise entry within an active workout.

#### Request body

```json
{
  "workout_id": "2026-03-12_A",
  "exercise_id": "bench_press",
  "performed_sets": [
    { "load": 60, "reps": 8, "rir": 2, "notes": "" },
    { "load": 60, "reps": 8, "rir": 2, "notes": "" },
    { "load": 60, "reps": 7, "rir": 1, "notes": "" }
  ]
}
```

#### Success response

```json
{
  "ok": true,
  "saved": true
}
```

---

### `POST /workout/complete`

Completes a workout and returns a session summary.

#### Request body

```json
{
  "workout_id": "2026-03-12_A"
}
```

#### Success response

```json
{
  "ok": true,
  "summary": {
    "total_sets": 9,
    "total_reps": 63,
    "estimated_volume": 4060,
    "fatigue": "moderate",
    "progress_flags": ["bench_up", "row_hold"]
  }
}
```

---

## Response conventions

The API should follow these conventions where practical:

- `ok: true` for successful operations
- `ok: false` for handled application errors
- machine-readable `error` values where useful
- stable field names across endpoints
- explainable output wherever decision logic affects recommendations

## Versioning note

The contract in this file mixes:

- currently documented endpoints
- near-term 1.0 endpoints that should become canonical soon

If implementation differs from this document, either:

1. update the backend to match the contract, or
2. update this document in the same commit that changes behavior

Do not let the frontend, backend, and documentation drift into separate religions.
