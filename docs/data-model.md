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

Stores user-specific equipment increments and related profile settings.

Typical structure:

- `user_id`
- `equipment_increments`
  - `barbell`
  - `dumbbell`
  - `machine`
  - `cable`
  - `bodyweight`

Purpose:

- translate ideal progression into realistic next loads
- calculate `actual_possible_next_load`

---

### `exercises.json` / seed exercise definitions

Stores exercise definitions used by planning, substitution, progression, and review logic.

The current implementation uses richer metadata than the minimal early schema.

Common documented fields include:

- `id`
- `name`
- `name_en`
- `category`
- `category_en`
- `movement_pattern`
- `difficulty_tier`
- `equipment_type`
- `default_unit`
- `input_kind`
- `local_load_targets`

`local_load_targets` is a compact protection-oriented metadata field.

It defines which local regions an exercise typically loads enough that local irritation or protection signals may matter later in planning logic.

It is intended as a practical mapping layer, not a medical model.

Current target keys include:

- `ankle_calf`
- `knee`
- `hip`
- `low_back`
- `shoulder`
- `elbow`
- `wrist`
- `progression_mode`
- `progression_style`
- `progression_step`
- `recommended_step`
- `load_increment`
- `load_optional`
- `supports_bodyweight`
- `supports_load`
- `start_weight`
- `notes`
- `notes_en`

Optional configuration fields may include:

- `set_options`
- `rep_options`
- `time_options`
- `load_options`
- `progression_channels`
- `progression_ladder`
- `image_folder`
- `external_images`
- `rep_display_hint`

Purpose:

- define exercise identity
- group related exercises by movement family
- support progression rules
- support substitution and variation
- support different review/input modes
- support media-backed exercise display where available

Important clarification:

The exercise layer is no longer just a minimal list of names and load steps.
It now provides the identity metadata used by family-aware planning logic.

---

### `workouts.json`

Stores workout history.

Documented structure includes fields such as:

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
- support family-aware training interpretation

---

### `checkins.json`

Stores daily check-in data.

Documented fields include:

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

Current limitation:

The documented and observed model does not yet expose a mature local irritation or injury-specific input layer such as:

- `knee_pain`
- `back_pain`
- `local_soreness`
- side-specific pain tracking

That remains a future extension if implemented explicitly.

---

### `recovery.json`

Stores recent recovery-oriented context used by the planning engine.

Purpose may include:

- recent readiness context
- multi-session fatigue pressure
- short-term recovery interpretation

---

### `runs.json`

Stores running/cardio-related session history where relevant.

Purpose:

- preserve running session continuity
- support simple cardio-aware planning
- support running-related review and forecasting where implemented

## Derived concepts

The current documented engine uses several computed concepts.

### `readiness_score`

Derived from:

- sleep
- energy
- soreness

Used for:

- plan type
- session intensity
- lighter-session bias

### `fatigue_score`

Derived from signals such as:

- failure
- load drop between sets
- recent training history

Documented interpretation:

- `0` = fresh
- `1` = light fatigue
- `2` = moderate fatigue
- `3` = high fatigue

### Family-aware exercise identity

The implementation also uses exercise identity metadata to derive related concepts such as:

- movement family
- family fatigue state
- related exercise clusters
- variation readiness
- substitution candidates

Family keys may be based on:

- `fatigue_group` where present
- otherwise `movement_pattern`
- otherwise `category`

### Equipment-aware load values

The system distinguishes between:

- `recommended_next_load`
- `actual_possible_next_load`

If the available equipment forces a larger jump than the ideal progression step, the system flags:

- `equipment_constraint = true`

## Important boundary

The current model is richer than the original minimal documentation, but it still does not claim to fully implement:

- explicit local tissue tolerance tracking
- side-specific injury history
- persistent local vulnerability profiles
- detailed biomechanical load accounting per structure

Do not confuse movement-family-aware planning with a full tissue model.
That would be documentation fraud with extra steps.

## Suggested near-term extension

As the repository matures, the data model may be documented more explicitly around:

- exercise identity and family metadata
- session history
- running/cardio history
- user settings
- optional vulnerability or limitation signals

That split should only be committed as canonical once implementation and documentation stay aligned.

Do not let documentation become fan fiction.