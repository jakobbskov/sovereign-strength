# Local protection state contract

## Purpose

This document defines a compact data contract for the local protection layer.

It exists to keep local protection explicit, deterministic, and small enough to remain maintainable.

This contract separates:

- raw user-reported local signals
- derived local protection state

That separation is intentional. User input should not be confused with system interpretation.

## Design principle

The local protection layer must not expand into another oversized global state object.

The contract should stay compact and should reuse the existing system shape:

- check-in stores raw local input
- derived state is computed into adaptation-oriented state
- planning and progression consume the derived state

## Contract split

### 1. Raw local input

Raw local input belongs to the daily check-in layer.

It represents what the user reports today. It should not try to store rolling history, inferred risk, or planner conclusions.

### Proposed field

`local_signals`

### Proposed shape

A check-in may include a `local_signals` field containing a list of small objects.

Each object should contain:

- `region`
- `laterality`
- `signal`

Example interpretation:

A left knee concern is represented as region `knee`, laterality `left`, signal `caution`.

### Field meanings

#### `region`

A small explicit body-region key.

Recommended current values:

- `ankle_calf`
- `knee`
- `hip`
- `low_back`
- `shoulder`
- `elbow`
- `wrist`

The set should stay intentionally small.

#### `laterality`

Laterality or position qualifier for the region.

Recommended values:

- `left`
- `right`
- `bilateral`
- `midline`

Use `midline` for structures such as low back where left/right is not always the right default representation.

#### `signal`

A compact user-reported state value.

Recommended current values:

- `caution`
- `irritated`

Absence should normally mean no active local signal was reported.

A stored `none` value is usually unnecessary and should be avoided unless a later implementation has a concrete need for it.

## Raw input rules

- raw input is user-reported only
- raw input does not contain derived risk scoring
- raw input does not contain planner decisions
- raw input does not contain rolling counters
- raw input should remain fast to enter
- raw input should remain optional

## 2. Derived local state

Derived local state belongs to the adaptation-oriented engine layer.

It represents the system's compact interpretation of recent local input and recent local loading.

This state should be derived from:

- recent check-in local signals
- recent workouts
- recent session results
- exercise/cardio local load-target mapping

### Proposed field

`local_state`

### Proposed shape

The adaptation-oriented state should expose a `local_state` object keyed by compact region-plus-laterality identifiers such as:

- `knee_left`
- `knee_right`
- `low_back_midline`
- `shoulder_left`

Each key should map to a compact derived state object.

### Derived field meanings

#### `latest_signal`

Latest reported raw local signal for this region key.

Recommended values:

- `none`
- `caution`
- `irritated`

Derived state may use `none` internally even when raw input omits inactive regions.

#### `recent_load`

A compact recent local load value derived from mapped session exposure over a short rolling window.

This is not a biomechanical number. It is a deterministic protection-layer signal.

#### `consecutive_exposure_days`

How many recent consecutive days this region has been meaningfully loaded.

#### `trend`

Simple directional interpretation.

Recommended values:

- `improving`
- `stable`
- `worsening`

#### `status`

Compact protection-oriented state used by planner and progression logic.

Recommended values:

- `ready`
- `caution`
- `protect`

## Derived state rules

- derived state must stay compact
- derived state must be deterministic
- derived state must be explainable from recent inputs and history
- derived state must not become a hidden scoring system
- derived state is for engine consumption, not raw user input

## Key separation rule

The same concept must not be stored twice in conflicting forms.

Use this rule:

- check-in stores what the user reports
- local derived state stores what the engine infers from recent history
- plan output stores what the engine decides today

That keeps the layers distinct.

## Storage and update flow

### Check-in layer

Stores:

- `local_signals`

### Derived adaptation-oriented layer

Stores or exposes:

- `local_state`

### Planning and progression layer

Consumes:

- `local_state`
- exercise/cardio local load-target mappings
- existing readiness, fatigue, and family signals

## Why this split is preferred

This split matches the current architecture direction better than stuffing everything into check-ins.

It avoids:

- oversized check-in payloads
- mixing raw input and derived interpretation
- duplicated local-state logic across routes
- accidental expansion of mega-state patterns

## Compatibility notes

This contract is designed to support:

- #166 raw local body-region signals in check-in
- #167 explicit local load-target mappings
- #168 rolling local load and irritation state
- later local override, progression blocking, and substitution logic

## Non-goals

This contract does not define:

- diagnosis logic
- injury prediction
- treatment recommendations
- pseudo-clinical severity scales
- a full anatomical model

It is a practical protection contract, not sports-medicine cosplay.

## Practical summary

Use a compact split contract:

- `local_signals` = raw user-reported daily local input
- `local_state` = derived rolling local protection state

Keep:

- regions explicit
- laterality explicit
- signal values small
- derived status compact
- planner integration downstream

Do not merge raw input, rolling state, and final decision into one oversized structure.


## Current implementation (v0.1)

The current implementation is intentionally narrower than the aspirational contract above.

### Raw local input currently implemented
Check-in currently accepts:

- `local_signals`

### Current raw input shape
Each `local_signals` entry currently uses:

- `region`
- `signal`

Current implementation does **not** yet use `laterality`.

### Current region keys
The current implementation uses these compact region keys:

- `ankle_calf`
- `knee`
- `hip`
- `low_back`
- `shoulder`
- `elbow`
- `wrist`

### Current signal values
Supported raw signal values:

- `caution`
- `irritated`

## Current derived local state shape

`local_state` is currently derived per region key and exposed inside adaptation-oriented state.

Each region currently contains compact fields such as:

- `latest_signal`
- `signal_persistence`
- `recent_load_count`
- `state`
- `reasons`

Additional fields may appear when relevant, for example:

- `menstrual_pain_signal`
- `manual_hold_state`

### Current derived state values
Current protection-oriented state values are:

- `ready`
- `caution`
- `protect`

## Current derivation sources

The current local protection layer is derived from:

- recent check-in `local_signals`
- recent exercise exposure through `local_load_targets`
- recent cardio exposure through cardio-kind-to-region mapping
- menstrual pain support logic for `hip` and `low_back`
- manual local protection holds stored in `user_settings`

## Current special integrations

### Menstrual pain integration
Moderate and severe menstrual pain currently influence local protection state for:

- `hip`
- `low_back`

Current behavior:

- `moderate` contributes to `caution`
- `severe` contributes to `protect`

This is implemented as explicit local-state input, not as a hidden planner-only side path.

### Manual protection holds
Manual holds can currently be persisted in `user_settings` as:

- `local_protection_holds`

Allowed manual hold values:

- `caution`
- `protect`

Manual holds act as a floor on computed local state:

- `protect` keeps a region in `protect`
- `caution` prevents a region from falling back to `ready`

### Planning override
Local protection currently influences planning through a deterministic override path.

Current protected planning regions are primarily:

- `knee`
- `ankle_calf`
- `low_back`

Examples of current effects:

- early cardio can be overridden into restitution
- higher-fatigue days can be pushed toward restitution
- today-plan output can expose `local_protection_explanation`

### Progression blocker
Local protection now also influences progression.

Current conservative rule:

- if an exercise maps to one or more local regions currently in `protect`
- and progression would otherwise increase load / reps / time / variation
- progression is blocked to `hold`

This blocker is deterministic and visible in progression output.

## Current boundaries

The current local protection layer does **not** try to:

- diagnose injury
- infer medical meaning
- predict tissue damage
- replace fatigue logic
- replace progression logic entirely
- create a hidden probabilistic risk model

It is a deterministic load-management layer only.

## Documentation priority rule

When this file conflicts with implementation, implementation is the source of truth.

This document should describe:
- what the system actually does now
- what fields are actually present now
- what later extensions are still only proposed

