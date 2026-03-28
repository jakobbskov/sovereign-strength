# Architecture

## Overview

SovereignStrength is structured as a small local-first training system with three main layers:

1. frontend
2. backend API
3. local JSON data storage

Its design goal is not architectural cleverness.
Its design goal is predictable behavior, debuggability, and long-term maintainability.

## System components

### Frontend

The frontend is a lightweight PWA-style interface located at:

`/var/www/sovereign-strength/`

Primary files:

- `index.html`
- `app.js`
- `styles.css`

Responsibilities:

- forecast display
- check-in flow
- plan display
- progression explanation
- workout logging
- review flow

### Backend API

The backend is a Flask API located at:

`/opt/sovereign-strength-api/`

Entry point:

`app.py`

Runtime model:

- Gunicorn
- systemd service
- unix socket

Documented service name:

`sovereign-strength-api.service`

Documented socket path:

`/home/jakob/nextcloud/nginx/html/strength-api.sock`

### Data layer

Training data is stored as local JSON files in:

`/var/www/sovereign-strength/data/`

This keeps the system portable and transparent.
Data is intended to remain readable without requiring a database server for core functionality.

## Request and decision flow

The documented user flow is:

`Forecast -> Check-in -> Plan -> Workout -> Review`

At a high level:

1. the user opens the app
2. the system shows a forecast
3. the user submits a check-in
4. the backend computes readiness and fatigue-aware planning
5. the user logs the session
6. the system stores workout history for future decisions

## Decision model

The current documented planning and progression model is based on:

- readiness
- fatigue
- recent training history
- equipment constraints

The documented plan endpoint is:

`GET /plan/today`

The documented progression core function is:

`compute_progression_for_exercise()`

This function returns fields such as:

- `next_load`
- `progression_decision`
- `progression_reason`
- `fatigue_score`
- `recommended_next_load`
- `actual_possible_next_load`
- `equipment_constraint`

## UX principles

The documented UI follows three principles:

### Calm technology
No gamification, no streaks, no badges.

### Explainable logic
The system should explain why it recommends a specific action.

### Determinism
Same input, same output.

## Current limitation boundary

The currently documented system does not yet claim to fully support:

- long-term trend analysis
- stagnation detection
- deload automation
- adaptive program structure
- full cardio support

Those belong to later iterations, not to the current documented core.


## Cardio integration boundaries

Cardio is integrated at the daily planning layer, not inside the strength progression engine.

The active cardio entry points are:

- `compute_cardio_load_metrics(...)`
- `choose_cardio_session(...)`
- `build_autoplan_cardio(...)`
- `build_cardio_plan(...)`

These helpers use top-level planning context such as:

- readiness
- fatigue
- recovery state
- timing / time budget
- training-day context
- recent cardio load

### What cardio is

Cardio is a planning outcome.
It is selected by the daily planner as a session recommendation.

### What cardio is not

Cardio is not a strength progression mode.

It does not rely on lift-specific progression internals such as:

- recent successful load progression for a given strength exercise
- progression phases
- exercise-level strength progression history

### Relationship to restitution

Restitution can override cardio.

This happens when recovery or fatigue logic determines that the safer daily recommendation is restitution instead of another cardio or strength session.

### Relationship to strength planning

Strength and cardio are both outputs of the daily planning layer, but they diverge after session selection:

- strength can continue into exercise-specific progression logic
- cardio remains a planning-layer recommendation based on top-level session signals and recent cardio load

### Maintenance rule

When refining cardio behavior, prefer changing planning-layer logic and explanation output before expanding strength progression internals.


## Deload trigger boundaries

The deload model is part of the progression engine and is only evaluated in the explicit trend phase.

Current live behavior is grounded in three layers:

- progression phase detection
- recent trend summary over relevant sessions
- a focused deload trigger check

### Phase boundary

Deload is only evaluated when the progression phase is `trend`.

This means deload is **not** triggered during:

- `recalibration`
- `calibration`

That boundary matters because the engine should not interpret sparse or recently reset history as stable enough to justify deload logic.

### Trend inputs used for deload

The current deload trigger evaluation uses:

- repeated failure sessions
- repeated load-drop sessions
- combined instability plus fatigue

The active trend summary exposes:

- `failure_sessions`
- `load_drop_sessions`
- `negative_signal_sessions`
- whether the latest session also showed a blocking signal

### Current trigger rules

In the live progression engine, deload is recommended only in trend phase and only when one of these conditions is true:

1. `failure_sessions >= 2`
2. `load_drop_sessions >= 2`
3. `(failure_sessions + load_drop_sessions) >= 2` **and** `fatigue_score >= 2`

Current deload scope is exercise-level.

### What does not trigger deload by itself

The current model does **not** recommend deload just because:

- fatigue is elevated by itself
- one isolated failure occurred
- one isolated load drop occurred
- the user is still in calibration or recalibration

### Relationship to fatigue

Fatigue is not an independent deload engine.
It strengthens the case for deload when instability is already present.

In other words:
fatigue contributes to the trigger model, but does not replace trend-based evidence.

### Relationship to progression behavior

Deload logic sits alongside progression gating, not instead of it.

The progression engine already uses:
- repeated success requirements
- blocking signals
- phase-aware progression constraints

Deload is the stronger protective response when trend instability becomes persistent enough.

### Maintenance rule

Refine deload thresholds inside the progression-engine vocabulary:
- phase
- repeated failure
- repeated load drop
- instability
- fatigue

Do not turn deload into a detached secondary framework.

