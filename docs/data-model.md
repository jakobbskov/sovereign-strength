# Data model

## Overview

SovereignStrength uses local JSON files as its primary persistence model.

This is a deliberate design choice:

- simple to inspect
- easy to back up
- easy to repair
- no hidden state in external services

## Core documented files

### `user_settings.json`

Stores user-specific equipment increments.

Example structure:

```json
{
  "user_id": 1,
  "equipment_increments": {
    "barbell": 10,
    "dumbbell": 5,
    "machine": 5,
    "cable": 5,
    "bodyweight": 0
  }
}
```

Purpose:

- translate ideal progression into realistic next loads
- calculate `actual_possible_next_load`

---

### `exercises.json`

Stores exercise definitions.

Documented fields:

- `id`
- `name`
- `equipment_type`
- `default_unit`
- `start_weight`
- `progression_step`

Purpose:

- define exercise metadata
- support load logic
- support progression rules

---

### `workouts.json`

Stores workout history.

Documented structure:

- `date`
- `entries[]`
  - `exercise_id`
  - `sets`
  - `reps`
  - `achieved_reps`
  - `load`
  - `notes`

Purpose:

- preserve workout history
- drive progression decisions
- support fatigue-aware planning

---

### `checkins.json`

Stores daily check-in data.

Documented fields:

- `date`
- `sleep_score`
- `energy_score`
- `soreness_score`
- `readiness_score`
- `notes`

Purpose:

- record readiness inputs
- influence plan type
- influence session intensity

## Derived concepts

The current documented engine uses several computed concepts:

### `readiness_score`

Derived from:
- sleep
- energy
- soreness

Used for:
- plan type
- session intensity

### `fatigue_score`

Derived from:
- failure
- load drop between sets
- recent training history

Documented interpretation:

- `0` = fresh
- `1` = light fatigue
- `2` = moderate fatigue
- `3` = high fatigue

### Equipment-aware load values

The system distinguishes between:

- `recommended_next_load`
- `actual_possible_next_load`

If the available equipment forces a larger jump than the ideal progression step, the system flags:

- `equipment_constraint = true`

## Suggested near-term extension

As the repository matures, the data model may be split more explicitly into:

- exercise definitions
- program structure
- session history
- user settings
- optional body metrics
- optional running/cardio logs

That split should only be committed as canonical once implementation catches up.
Do not let documentation become fan fiction.
