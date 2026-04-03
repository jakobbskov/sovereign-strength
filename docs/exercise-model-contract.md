# Exercise Model Contract

## Purpose

This document defines the stable exercise metadata contract for SovereignStrength.

The goal is not to invent a new exercise schema from scratch.
The goal is to formalize the model already used by planning, review, progression, and UI rendering so later work can build on one contract instead of inventing parallel structures.

This contract should support:

- deterministic plan selection
- correct review input behavior
- progression compatibility
- optional media-backed exercise presentation
- future catalog import and controlled variation

It should remain readable, conservative, and backward-compatible.

---

## Design principles

- prefer explicit metadata over guessed behavior
- keep the core contract compact and stable
- support both strength and time-based exercises
- keep advanced fields optional
- avoid forcing media or catalog-scale assumptions into the core schema
- preserve compatibility with existing exercise records

---

## Required core fields

The following fields are currently treated as required core contract fields:

- `id`
- `name`
- `name_en`
- `category`
- `category_en`
- `default_unit`
- `difficulty_tier`
- `equipment_type`
- `input_kind`
- `load_increment`
- `load_optional`
- `local_load_targets`
- `movement_pattern`
- `notes`
- `notes_en`
- `progression_mode`
- `progression_step`
- `progression_style`
- `recommended_step`
- `set_options`
- `start_weight`
- `supports_bodyweight`
- `supports_load`

### Core shape example

Example entry shape:

{
  "id": "bench_press",
  "name": "Bænkpres",
  "name_en": "Bench Press",
  "category": "push",
  "category_en": "push",
  "default_unit": "kg",
  "difficulty_tier": 2,
  "equipment_type": "barbell",
  "input_kind": "reps",
  "load_increment": 2.5,
  "load_optional": false,
  "local_load_targets": ["shoulder", "elbow"],
  "movement_pattern": "horizontal_push",
  "notes": "Standard vandret presøvelse.",
  "notes_en": "Standard horizontal press.",
  "progression_mode": "double_progression",
  "progression_step": 2.5,
  "progression_style": "load_then_reps",
  "recommended_step": 1,
  "set_options": [2, 3, 4],
  "start_weight": 20,
  "supports_bodyweight": false,
  "supports_load": true
}

---

## Optional common fields

These fields are valid but not required for every exercise:

- `rep_options`
- `time_options`
- `load_options`

These fields are typically tied to input and review behavior.

### Guidance

- `rep_options` is most relevant for rep-based exercises
- `time_options` is most relevant for time-based exercises
- `load_options` is most relevant when `supports_load = true`

---

## Optional media fields

These fields support richer frontend presentation but are not required for correctness:

- `image_folder`
- `external_images`

### Rules

- UI must still function if these fields are missing
- image references should not be treated as required for planning or progression logic

---

## Optional advanced progression fields

These fields are valid advanced extensions:

- `progression_channels`
- `progression_ladder`
- `rep_display_hint`
- `form_cues`
- `form_cues_en`

These should be treated as optional metadata for richer progression or review behavior.
Core logic must retain safe defaults if they are absent.

---

## Input-kind rules

### `input_kind = "time"` or `"cardio_time"`

Expected behavior:

- review should prefer `time_options` when available
- rep-based interpretation should not be forced
- `rep_options` may exist historically but should not drive review behavior

### `input_kind = "bodyweight_reps"`

Expected behavior:

- review should prefer `rep_options` when available
- load is usually omitted or treated as bodyweight
- `supports_bodyweight` should normally be `true`

### `input_kind = "reps"` or equivalent rep-driven strength input

Expected behavior:

- review should use rep-based options and load where relevant
- `load_options` is only meaningful when `supports_load = true`

---

## Load-related rules

### `supports_load = false`

- `load_options` is optional and may be absent
- frontend and backend must not require explicit load input

### `load_optional = true`

- blank load values are valid
- bodyweight or unloaded execution may still be correct

### `supports_bodyweight = true`

- exercise may still be valid without explicit external load
- this does not imply that load can never be added, only that bodyweight execution is valid

---

## Local protection compatibility

`local_load_targets` is required because the exercise model must remain compatible with local protection logic.

Rules:

- every exercise should map to one or more relevant local load targets
- these targets are practical planning signals, not diagnosis labels
- absence of this field is considered a contract violation

---

## Backward-compatibility expectations

The contract should remain compatible with the current dataset and existing planner behavior.

That means:

- advanced fields remain optional
- media remains optional
- review-specific option arrays remain optional when safe defaults exist
- existing exercises must not require a full migration before the app can run

---

## Non-goals

This contract does not yet define:

- full external catalog import behavior
- full substitution/variation engine logic
- complete UI card design requirements
- medical or biomechanical modeling

Those should build on this contract later, not expand it casually inside unrelated issues.

---

## Validation expectations

The repository should include an audit/validation script that:

- verifies required core fields
- flags unknown fields
- checks simple type expectations
- checks input-kind compatibility rules
- fails loudly on contract drift

This validation is part of keeping the exercise model stable over time.
