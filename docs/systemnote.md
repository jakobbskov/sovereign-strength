# System note

## Purpose

This document describes the current documented operating logic of SovereignStrength.

It is intended to function as the technical bridge between:

- the earlier internal system notes
- the repository documentation
- the actual implementation as it stabilizes toward version 1.0

This file should describe how the system thinks, not just where files happen to live.

## Scope

The current documented SovereignStrength core includes:

- forecast output
- check-in and readiness input
- fatigue-aware planning
- progression logic
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

At the highest level, the system combines four inputs:

- current readiness
- recent fatigue signals
- exercise-specific progression state
- equipment constraints

These inputs influence the daily plan and recommended next loads.

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

- if `fatigue_score >= 2`, bias toward `light_strength`

## Plan generation

The main documented planning endpoint is `GET /plan/today`.

Its role is to translate current system state into a session recommendation.

Documented plan variants currently include:

- `short_20`
- `short_30`
- `light_strength`

The plan generator should be explainable.
It should not only return what to do, but also why that recommendation was made.

Documented explanation fields may include:

- `progression_decision`
- `progression_reason`
- fatigue-related explanation text
- equipment-related explanation text

## Progression engine

The progression engine determines how an exercise should move from one session to the next.

The currently documented core function is `compute_progression_for_exercise()`.

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

## Workout logging

Workout logging preserves the training history used by later decisions.

Documented workout history includes fields such as:

- exercise
- sets
- target reps
- achieved reps
- load
- notes

Workout data serves at least three purposes:

- preserve session history
- support progression logic
- support fatigue interpretation

## Review layer

The review layer closes the session.

In the currently documented system, review means the session can be interpreted after execution rather than merely stored.

Near-term 1.0 development should make this more explicit in the form of a session summary.

A useful review output should eventually include:

- completed exercises
- total sets
- total reps
- estimated volume
- fatigue interpretation
- simple next-session guidance

## Data model relationship

The operating logic described here depends on a small local JSON model.

The main documented file types are:

- `user_settings.json`
- `exercises.json`
- `workouts.json`
- `checkins.json`

Those structures are described in more detail in `docs/data-model.md`.

## Current limitation boundary

The currently documented system does not yet claim to fully implement:

- long-term trend analysis
- stagnation detection
- deload automation
- adaptive program restructuring
- full cardio support

Those belong to later development stages unless and until they are documented as implemented.

## Versioning rule

This document should stay aligned with:

- `docs/architecture.md`
- `docs/data-model.md`
- `docs/deployment.md`
- `docs/api-contract.md`

If implementation changes the logic materially, this file should be updated in the same commit.

Do not let the system note become historical fiction with markdown headings.
