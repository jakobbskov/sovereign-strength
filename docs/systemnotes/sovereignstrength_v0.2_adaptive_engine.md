SovereignStrength

Systemnote v0.2 – Adaptive Engine

Status: Design specification
Scope: Introduce long-term adaptation layer separating Plan, Execution, and Adaptation

---

1. Purpose

SovereignStrength currently supports:

- check-in
- plan generation
- workout execution
- session summary

However, the system lacks a persistent adaptation layer.

The goal of the Adaptive Engine is to answer:

«Based on patterns over time, what should the system change next?»

This transforms SovereignStrength from a logging system into a self-adjusting training regulator.

---

2. Architectural separation

The system should be structured into five independent layers.

Check-in
   ↓
Plan
   ↓
Execution
   ↓
Session Summary
   ↓
Adaptive Engine

Each layer has a specific responsibility.

---

3. Layer responsibilities

3.1 Check-in

Purpose: capture current state.

Inputs:

- energy
- soreness
- sleep
- time available
- readiness score

Outputs:

{
  readiness_score,
  time_budget_min,
  timing_state
}

Check-in does not decide progression.

It only describes the state of the system today.

---

3.2 Plan Layer

Purpose: generate a session plan.

Inputs:

- readiness state
- available time
- adaptation recommendations
- exercise library
- available equipment

Outputs:

{
  session_type,
  template_id,
  entries[]
}

Plan layer translates strategy into a concrete session.

---

3.3 Execution Layer

Purpose: record what actually happened.

Inputs:

- sets
- reps
- time
- load
- failure flags
- completion

Output example:

{
  exercise_id,
  sets[],
  achieved_reps,
  load,
  hit_failure,
  completed
}

Execution layer performs no interpretation.

---

3.4 Session Summary Layer

Purpose: interpret a single workout.

Inputs:

- execution data

Outputs:

{
  total_sets
  total_reps
  time_under_tension_sec
  estimated_volume
  hit_failure_count
  fatigue
  next_step_hint
}

Additionally computes:

session_load

Session load formula

session_load =
(volume / 100)
+ (time_under_tension_sec / 60)
+ (hit_failure_count * 5)
+ (total_sets * 0.5)

This produces a scalar training stress estimate.

---

4. Adaptive Engine

The Adaptive Engine evaluates historical patterns.

It generates persistent adaptation state.

Responsibilities:

- training load monitoring
- exercise response modelling
- session tolerance modelling
- strategic recommendations

Output is stored in:

data/adaptation_state.json

---

5. Training load model

For each session:

daily_load += session_load

Derived metrics:

Acute Load

acute_7d_load = sum(load over last 7 days)

Chronic Load

chronic_28d_load = sum(load over last 28 days)

Load Ratio

load_ratio = acute_7d_load / max(chronic_28d_load / 4, 1)

Interpretation:

Ratio| Interpretation
< 0.8| underloaded
0.8 – 1.3| balanced
> 1.5| spike

Output example:

load_metrics {
  acute_7d_load
  chronic_28d_load
  load_ratio
  load_status
}

---

6. Exercise Response Profiles

The engine evaluates performance per exercise.

Window:

last 5–10 sessions

Metrics:

- completion_rate
- failure_rate
- top_range_hits
- stability score
- load progression trend

Example:

exercise_profiles {
  push_ups {
    sessions: 6
    completion_rate: 1.0
    failure_rate: 0.0
    trend: progressing
    recommended_action: increase_reps
    confidence: 0.84
  }
}

---

7. Session Tolerance Profiles

The engine learns how well the user tolerates session formats.

Example session types:

strength_30min
strength_45min
restitution_20min
cardio_30min

Metrics:

- completion rate
- fatigue frequency
- mean session load
- dropout risk

Example:

session_tolerance {
  strength_45min {
    completion_rate: 0.62
    failure_rate: 0.31
    recommended_mode: simplify
  }
}

---

8. Strategy system

The adaptive engine outputs strategy signals.

Possible values:

progress
hold
simplify
restore
maintain

Definitions:

progress

Increase difficulty.

Triggers:

- high completion
- low failure
- stable execution

---

hold

Maintain current parameters.

Triggers:

- mixed results
- moderate fatigue

---

simplify

Reduce complexity or load.

Triggers:

- repeated failure
- unstable performance

---

restore

Recovery-focused session.

Triggers:

- load spike
- readiness collapse

---

maintain

Keep structure but block progression.

Triggers:

- high load ratio
- high fatigue

---

9. Adaptation State Model

File:

data/adaptation_state.json

Example structure:

{
  "users": {
    "1": {
      "updated_at": "...",
      "load_metrics": {},
      "exercise_profiles": {},
      "session_tolerance": {}
    }
  }
}

The adaptation state is recalculated periodically or after session submission.

---

10. Plan engine integration

Plan generation should read adaptation state.

Example decision chain:

readiness
+ load_metrics
+ exercise_profile
= strategy

Example outcome:

Dead bug
strategy: simplify
reason:
- failure in 3 of last 5 sessions
- high load ratio

---

11. Transparency principle

Every recommendation should be explainable.

Example UI message:

Dead bug simplified today.

Reason:
Recent failure frequency is high.
Load ratio currently elevated.

The system must always provide reasoned decisions, not opaque automation.

---

12. Implementation phases

Recommended build order:

Phase 1

Training load metrics.

- session_load
- acute_7d_load
- chronic_28d_load

Phase 2

Exercise response profiles.

Phase 3

Session tolerance profiles.

Phase 4

Strategy signals.

Phase 5

Plan engine integration.

---

13. Design philosophy

SovereignStrength is not intended to be:

- a workout logger
- a rigid program generator

It is intended to be:

a personal cybernetic training regulator

The system observes:

actions → responses → patterns

Then adjusts future actions accordingly.

---

14. Future extensions

Potential later additions:

- injury risk indicators
- readiness trend modelling
- monotony / strain metrics
- adaptive deload scheduling
- long-term progression graphs

---

End of system note.
