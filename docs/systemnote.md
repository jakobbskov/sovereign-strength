# System note

## Purpose

This document describes the current documented operating logic of SovereignStrength.

It is intended to function as the technical bridge between:

- earlier internal system notes
- repository documentation
- actual implementation as it stabilizes toward version 1.0

This file should describe how the system thinks, not just where files happen to live.

## Scope

The current documented SovereignStrength core includes:

- forecast output
- check-in and readiness input
- fatigue-aware planning
- movement-family-aware exercise interpretation
- progression logic
- controlled variation and substitution
- equipment-aware load adjustment
- workout logging
- review-oriented feedback

The documented user flow is:

`Forecast -> Check-in -> Plan -> Workout -> Review`

## Design intent

SovereignStrength is not intended to be a high-engagement fitness platform.
It is intended to be a calm, deterministic, local-first training system.

Its design goals are:

- practical training support
- explainable recommendations
- low technical complexity
- repairable data structures
- user-controlled logic and storage

## Core operating model

At the highest level, the system combines these inputs:

- current readiness
- recent fatigue and recovery signals
- exercise-specific progression state
- exercise identity metadata
- family-based fatigue interpretation
- controlled variation/substitution signals
- equipment constraints

These inputs influence the daily plan, suggested exercise form, and recommended next loads.

## Forecast

The forecast layer gives the user a quick view of likely training direction before the full session flow begins.

Its purpose is to:

- orient the user
- make the system feel legible
- provide a pre-session expectation

The forecast is informative, not magical.
It should reflect current system state, not invent motivational fiction.

## Check-in and readiness

The check-in layer captures short pre-session input from the user.

Documented input fields include:

- `sleep_score`
- `energy_score`
- `soreness_score`
- optional notes

These are used to derive a `readiness_score`.

The purpose of readiness is not to replace judgment.
It is to give the system a simple, structured representation of current capacity.

Readiness influences:

- plan type
- session intensity
- whether the system should bias toward lighter work

Important limitation:

The current documented check-in remains mostly global.
It does not yet document a mature local irritation layer such as:
- knee pain
- back pain
- calf irritation
- side-specific soreness

That means the engine can reason about family fatigue more strongly than it can reason about explicit local tissue symptoms.

## Exercise identity layer

The exercise system now contains more than minimal display metadata.

Seed exercise definitions include fields such as:

- `category`
- `movement_pattern`
- `difficulty_tier`
- `input_kind`
- `progression_mode`
- `progression_style`

This identity layer allows the backend to treat exercises as related members of broader movement families rather than isolated names.

That supports:

- family-level fatigue interpretation
- substitution between related exercises
- controlled variation
- more coherent review/input behavior

## Fatigue model

The fatigue model is one of the core decision layers in the system.

It uses recent training signals to estimate whether the user is likely carrying residual fatigue.

Documented fatigue inputs include:

- failure or near-failure performance
- load drop between sets
- recent workout history
- days since last strength session

Documented fatigue interpretation:

- `0` = fresh
- `1` = light fatigue
- `2` = moderate fatigue
- `3` = high fatigue

Fatigue affects:

- plan selection
- progression confidence
- whether lighter variants should be preferred

A documented example rule is:

- if `fatigue_score >= 2`, bias toward lighter work

## Family fatigue model

The backend also computes family-level fatigue context.

Family keys may be derived from:

- `fatigue_group` where available
- otherwise `movement_pattern`
- otherwise `category`

This allows the system to reason not only about a single exercise, but about related exercises or movement families.

Documented family-level outputs may include:

- `family_state`
- `family_signals`
- related exercise members

Current observed family states include values such as:

- `fatigued`
- `ready`
- `stable`

This is an important clarification:
the system is not only progression-aware per exercise.
It is also capable of family-aware training interpretation.

## Plan generation

The main documented planning endpoint is `GET /plan/today`.

Its role is to translate current system state into a session recommendation.

The plan generator should be explainable.
It should not only return what to do, but also why that recommendation was made.

Documented explanation fields may include:

- `progression_decision`
- `progression_reason`
- fatigue-related explanation text
- family-related explanation text
- equipment-related explanation text
- variation/substitution explanation text

The planning layer also includes protection against repeating hard sessions too closely and may surface learned variation suggestions where relevant.

## Progression engine

The progression engine determines how an exercise should move from one session to the next.

The documented core function is `compute_progression_for_exercise()`.

Its job is to turn workout history plus current context into an actionable load recommendation.

Documented output fields include:

- `next_load`
- `recommended_next_load`
- `actual_possible_next_load`
- `progression_decision`
- `progression_reason`
- `equipment_constraint`
- `fatigue_score`

This is important because ideal progression and physically possible progression are not always the same thing.

## Equipment-aware adjustment

The system explicitly accounts for available equipment increments.

That means the engine may distinguish between:

- the ideal next load
- the actually available next load

If available equipment forces a larger step than desired, the system should flag an equipment constraint instead of pretending the jump is elegant.

This is one of the practical strengths of the model.
It acknowledges reality instead of writing poetry about barbell math.

## Variation and substitution

The current implementation includes controlled variation and substitution logic.

This supports use cases such as:

- moving to a related exercise when needed
- selecting among related movement forms
- surfacing a likely next variation

This is not random exercise shuffling.
It is part of the engine's attempt to remain explainable while still avoiding static, brittle planning.

## Workout logging

Workout logging preserves the training history used by later decisions.

Documented workout history includes fields such as:

- exercise
- sets
- target reps
- achieved reps
- load
- notes

Workout data serves at least these purposes:

- preserve session history
- support progression logic
- support fatigue interpretation
- support family-aware planning

## Review layer

The review layer closes the session.

In the current system, review means the session can be interpreted after execution rather than merely stored.

A useful review output may include:

- completed exercises
- total sets
- total reps
- estimated volume
- fatigue interpretation
- simple next-session guidance

For cardio and non-standard exercise inputs, review behavior may differ by exercise identity and input configuration.

## Data model relationship

The operating logic described here depends on a small local JSON model.

The main documented file types are:

- `user_settings.json`
- exercise definition files / seed exercise data
- `workouts.json`
- `checkins.json`
- `recovery.json`
- `runs.json` where relevant

Those structures are described in more detail in `docs/data-model.md`.

## Current limitation boundary

The current implementation is stronger than a simple readiness-only planner, but it does not yet claim to fully implement:

- long-term trend analysis
- stagnation detection
- adaptive program restructuring in a fully general sense
- explicit local injury profile tracking
- side-specific soreness or tissue tolerance tracking
- mature local vulnerability override rules
- full cardio support in every layer

Movement-family-aware planning is real.
A full tissue-aware protection model is not yet documented as complete.

## Versioning rule

This document should stay aligned with:

- `docs/architecture.md`
- `docs/data-model.md`
- `docs/deployment.md`
- `docs/api-contract.md`

If implementation changes the logic materially, this file should be updated in the same commit.

Do not let the system note become historical fiction with markdown headings.


## Cardio boundary note

Cardio is currently chosen through the daily planning flow rather than through the strength progression engine.

In practice this means:

- recent cardio load is evaluated separately
- cardio kind is selected from planning context
- restitution can override cardio
- strength progression remains exercise-specific and separate

This boundary should be preserved unless a later change explicitly redesigns the planning architecture.


## Deload trigger note

Deload logic already exists in the live progression engine.

The current model is deliberately narrow:

- only evaluated in `trend` phase
- triggered by repeated failures, repeated load drops, or instability combined with fatigue
- scoped at exercise level

This means deload is treated as a response to persistent instability, not as a generic reaction to one bad session or temporary fatigue alone.


## Progression phase note

The live progression engine already uses an explicit phase model over recent exercise history.

Current live boundaries:

- up to 6 relevant sessions as context
- 3-session trend window for recent decision signals
- `recalibration` after a pause longer than 21 days
- `calibration` when relevant history is still below 3 sessions
- `trend` when stable recent context exists

Progression requires:
- candidate-positive latest session
- repeated success
- no blocking signal

This should be maintained as one coherent progression model together with deload logic, not as several loosely connected heuristics.

