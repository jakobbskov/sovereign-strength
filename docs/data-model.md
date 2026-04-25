# Data model

## Overview

SovereignStrength uses local JSON files as its primary persistence model.

This is a deliberate design choice:

- simple to inspect
- easy to back up
- easy to repair
- no hidden state in external services

## Core documented files
## `programs.json` / seed program definitions

Stores program templates used by the planner as structured multi-day training frameworks.

The current implementation now supports lightweight program-classification metadata in addition to day definitions.

Common documented fields include:

- `id`
- `name`
- `name_en`
- `kind`
- `recommended_levels`
- `supported_goals`
- `supported_weekly_sessions`
- `equipment_profiles`
- `days`

Strength programs may also include compact selector-oriented metadata such as:
- `training_style`
- `session_duration_min`
- `session_duration_max`
- `fatigue_profile`
- `complexity`
- `good_for_reentry`
- `good_for_concurrent_running`
- `program_family`
- `progression_model`
- `tags`
- `primary_goals`
- `secondary_goals`
- `recovery_sensitivity`
- `hybrid_profile`
- `recommended_use_cases`
- `excluded_use_cases`

Each `days` entry typically contains:

- `label`
- `exercises`

Each exercise entry typically contains:

- `exercise_id`
- `sets`
- `reps`

Purpose:

- define reusable multi-day program structures
- express which user profiles a program is meant to fit
- support later program-selection logic
- keep program templates human-readable and JSON-editable

Important clarification:

The program layer is no longer only a list of day labels with exercises.
It now also carries lightweight metadata about who a program is for, which is intended to support deterministic program selection later.

This metadata should stay compact and practical.
It is meant to improve program matching quality, not to turn the catalog into an overengineered ontology.

Practical interpretation:
- `training_style` describes the broad session structure
- `session_duration_min` / `session_duration_max` describe realistic session demand
- `fatigue_profile` and `complexity` provide practical fit signals
- `good_for_reentry` and `good_for_concurrent_running` support conservative matching
- `program_family` groups related templates
- `progression_model` describes the intended progression pattern at a high level
- `tags` support lightweight future filtering without making the core schema unreadable
- `primary_goals` names the main training intent in taxonomy language
- `secondary_goals` names useful but non-primary outcomes
- `recovery_sensitivity` describes how conservatively the template should react to poor recovery signals
- `hybrid_profile` describes how the strength template should coexist with running or mixed training
- `recommended_use_cases` gives concise machine-readable reasons the template is a good fit
- `excluded_use_cases` gives concise machine-readable reasons the template should not be recommended

These richer strength metadata fields are intentionally additive.
They should support matching, explainability, and future UI copy without replacing the existing selector fields.

Running and hybrid programs may also include running-specific metadata such as:
- `run_structure_type`
- `impact_profile`
- `hybrid_profile`
- `race_distance_support`
- `event_capability`
- `taper_support`
- `long_run_support`
- `primary_goals`
- `secondary_goals`
- `recommended_use_cases`
- `excluded_use_cases`

Practical interpretation:
- `run_structure_type` describes the weekly/session shape of the running work
- `impact_profile` describes expected mechanical impact and tissue-load cost
- `hybrid_profile` describes how running should coexist with strength or mixed training
- `race_distance_support` lists distance contexts the template can support
- `event_capability` describes whether the template is generic, base-supporting, or event-oriented
- `taper_support` describes whether the template can support tapering toward an event
- `long_run_support` describes whether long-run development is absent, optional, supportive, or central
- `primary_goals` names the main running or hybrid training intent
- `secondary_goals` names useful but non-primary outcomes
- `recommended_use_cases` gives concise machine-readable reasons the template is a good fit
- `excluded_use_cases` gives concise machine-readable reasons the template should not be recommended

These richer running metadata fields are intentionally additive.
They should support matching, explainability, race-aware planning, and hybrid coordination without replacing the existing selector fields.

---


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

## Adaptation-oriented rolling local state

The implementation now includes a compact rolling `local_state` structure inside adaptation-oriented user state.

Its purpose is to provide a small protection-oriented regional view that combines:

- recent local check-in signals
- recent exercise loading
- recent cardio loading
- explicit `local_load_targets` metadata

This is not a diagnosis layer.
It is a short-horizon protection context.

### `local_state`

`local_state` is keyed by compact region names such as:

- `ankle_calf`
- `knee`
- `hip`
- `low_back`
- `shoulder`
- `elbow`
- `wrist`

Each region contains a compact state object with fields such as:

- `latest_signal`
- `signal_persistence`
- `recent_load_count`
- `state`
- `reasons`

### `latest_signal`

Represents the latest recent local signal seen in check-in input for that region.

Current values include:

- `none`
- `caution`
- `irritated`

### `signal_persistence`

Counts how many recent check-ins included a local signal for that region within the short rolling window.

This is intended as a compact persistence hint, not a clinical severity scale.

### `recent_load_count`

Counts how often recent training history loaded that region through:

- exercise `local_load_targets`
- cardio mode local target mapping

This is a simple rolling pressure signal.
It is not a biomechanical quantity.

### `state`

Current compact local protection state.

Current values include:

- `ready`
- `caution`
- `protect`

This field is intended to be conservative and explainable.

### `reasons`

A short list of explanation strings describing why a region currently has its local state.

This exists for debugging and future planning transparency.

## Important local-state boundary

The rolling `local_state` model is still intentionally small.

It should not be confused with:

- diagnosis logic
- injury prediction
- side-specific pathology tracking
- long-horizon health modeling
- detailed tissue simulation

It is a deterministic protection-oriented state, not sports medicine cosplay.

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
