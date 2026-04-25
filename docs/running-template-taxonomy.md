# Running Template Taxonomy

## Purpose

This document defines the running-specific taxonomy layer for SovereignStrength program templates.

It builds on `docs/program-template-taxonomy.md`.

- The shared taxonomy defines cross-domain template identity.
- This document defines the dimensions that make one running template meaningfully different from another.

The goal is to treat running as a structured training domain, not as generic cardio with weather exposure.

## Why running needs its own layer

Running templates differ by more than weekly distance or number of sessions.

A meaningful running template can differ by:

- completion vs performance intent
- distance target
- impact tolerance
- progression strategy
- long-run role
- quality-session role
- hybrid compatibility
- re-entry sensitivity
- race specificity
- taper support capability

Without these distinctions, starter running, base running, 5K finish, 5K performance, 10K performance, half marathon, and hybrid-support running collapse into the same tired advice: “run more.” Truly the height of civilization.

## Relationship to shared taxonomy

Use `docs/program-template-taxonomy.md` for the shared dimensions:

- domain
- target level
- primary goal
- secondary goal
- weekly structure
- session structure
- progression model
- fatigue profile
- impact profile
- recovery sensitivity
- adaptive tolerance
- hybrid profile
- event capability
- complexity

This running taxonomy narrows those dimensions for running templates.

It should guide future running template metadata, recommendation rules, and explanation behavior without forcing an immediate migration of `programs.json`.

## Running-specific dimensions

### 1. Target level

Describes the runner’s current tolerance for running structure.

Recommended categories:

- `beginner`
- `novice`
- `intermediate`
- `reentry`

Interpretation:

- `beginner`: needs low complexity, short sessions, and simple progression
- `novice`: can tolerate more consistent weekly running and mild quality work
- `intermediate`: can use more structured quality sessions and distance-specific progression
- `reentry`: returning after break, discomfort, inconsistency, or low impact tolerance

Existing related metadata:

- `recommended_levels`

Guidance:

Running level should not be inferred only from fitness ambition.

A user wanting a 10K plan is not automatically ready for a 10K performance template. Humans do this thing where they confuse intent with capacity. Software should not encourage it.

### 2. Primary running goal

Describes why the running template exists.

Recommended categories:

- `habit`
- `base`
- `fat_loss`
- `general_health`
- `reentry`
- `5k_finish`
- `5k_performance`
- `10k_finish`
- `10k_performance`
- `half_marathon_base`
- `half_marathon_performance`
- `hybrid_support`

Existing related metadata:

- `supported_goals`
- `tags`
- `program_family`

Guidance:

The primary goal should shape frequency, intensity, progression, and recovery sensitivity.

Examples:

- `habit`: prioritize repeatability and low friction
- `base`: build aerobic consistency
- `reentry`: reduce impact and progression risk
- `5k_finish`: complete distance safely
- `5k_performance`: include structured quality work
- `hybrid_support`: support running while coordinating with strength

### 3. Completion vs performance intent

Describes whether the plan is built to finish, improve, or maintain.

Recommended categories:

- `completion`
- `base_building`
- `performance`
- `maintenance`
- `reentry`

Potential future field:

- `running_intent`

Guidance:

Completion-oriented templates should be conservative and success-focused.

Performance-oriented templates can include more quality structure, but must also carry higher fatigue and recovery sensitivity.

Maintenance templates should preserve running capacity without dominating the whole training week.

### 4. Distance orientation

Describes the distance target or distance family.

Recommended categories:

- `none`
- `general_base`
- `5k`
- `10k`
- `half_marathon`
- `event_unspecified`

Potential future field:

- `distance_orientation`

Guidance:

Distance orientation should not be added just to make the template sound specific.

A base running template can be useful without a race distance. A race-aware template should have clearer structure and progression logic.

### 5. Weekly structure

Describes the shape of the running week.

Recommended categories:

- `run_walk`
- `easy_base`
- `interval_plus_easy`
- `interval_tempo_easy`
- `long_run_focused`
- `hybrid_support_1_2x`
- `race_build`

Existing related metadata:

- `supported_weekly_sessions`
- `training_style`
- `tags`

Guidance:

Weekly structure explains how the running load is distributed.

Two templates can both be 3x/week and still differ heavily:

- easy base 3x
- interval + easy 3x
- 5K performance 3x
- half-marathon base 3x

Weekly count alone is not identity. It is arithmetic. Barely.

### 6. Session role structure

Describes which session types appear and why.

Recommended role categories:

- `easy`
- `base`
- `long_run`
- `interval`
- `tempo`
- `recovery`
- `run_walk`
- `test_or_time_trial`

Potential future field:

- `session_roles`

Guidance:

Session role structure should make it clear whether a template contains:

- only easy/base work
- one quality day
- two quality days
- long-run development
- race-specific preparation

This matters for fatigue, scheduling, and strength coordination.

### 7. Progression model

Describes how running load advances.

Recommended categories:

- `run_walk_reduction`
- `duration_first`
- `distance_first`
- `pace_progression`
- `interval_density_progression`
- `long_run_extension`
- `race_build_progression`
- `maintenance_progression`
- `reentry_conservative`

Existing related metadata:

- `progression_model`

Guidance:

Running progression should specify what changes first.

Examples:

- `run_walk_reduction`: reduce walking and increase continuous running
- `duration_first`: extend time before caring about pace
- `distance_first`: build target distance coverage
- `pace_progression`: improve speed after base tolerance exists
- `interval_density_progression`: more work or less rest over time
- `race_build_progression`: structure toward a distance/event
- `reentry_conservative`: protect consistency and tissue tolerance

### 8. Impact profile

Describes mechanical impact and tissue load.

Recommended categories:

- `low`
- `moderate`
- `moderate_high`
- `high`
- `reentry_protective`

Potential future field:

- `impact_profile`

Guidance:

Impact profile should influence matching when the user has:

- reentry status
- ankle/calf/knee/hip protection
- poor recent consistency
- high bodyweight or low running tolerance
- concurrent lower-body strength
- high weekly running ambition with low history

Impact is not moral. It is load. Sadly, tendons do not care about motivation.

### 9. Fatigue profile

Describes systemic recovery cost.

Recommended categories:

- `low`
- `moderate`
- `high`
- `reentry_protective`
- `hybrid_sensitive`

Existing related metadata:

- `fatigue_profile`

Guidance:

Fatigue profile should not be based only on session count.

A 2x plan with hard intervals may be more disruptive than a 3x easy base plan.

### 10. Re-entry sensitivity

Describes how conservatively the template should behave after a break or instability.

Recommended categories:

- `none`
- `soft`
- `strong`

Potential future field:

- `reentry_sensitivity`

Existing related metadata:

- `recommended_levels`
- `tags`
- `progression_model`
- `fatigue_profile`

Guidance:

Strong re-entry sensitivity means the template should:

- start easy
- progress slowly
- avoid aggressive pace targets
- prefer run-walk or short easy sessions
- downshift quickly under fatigue or local protection

A re-entry running plan should not be a normal beginner plan with a sadder name. That is not design. That is labeling.

### 11. Quality-session role

Describes whether hard or structured running is part of the plan.

Recommended categories:

- `none`
- `optional`
- `one_per_week`
- `two_per_week`
- `race_specific`

Potential future field:

- `quality_session_role`

Guidance:

Quality sessions include:

- intervals
- tempo
- threshold-style work
- race-pace work
- time trials

Quality-session role should drive recovery sensitivity and strength coordination.

### 12. Long-run role

Describes whether long-run development is central.

Recommended categories:

- `none`
- `optional`
- `supportive`
- `central`
- `race_specific`

Potential future field:

- `long_run_role`

Guidance:

Long-run role matters most for 10K and half-marathon templates.

A half-marathon plan without a long-run concept is not a half-marathon plan. It is cardio fan fiction.

### 13. Strength coordination sensitivity

Describes how much the running template must coordinate with strength work.

Recommended categories:

- `low`
- `moderate`
- `high`

Potential future field:

- `strength_coordination_sensitivity`

Existing related metadata:

- `kind`
- `tags`
- `equipment_profiles`
- future `hybrid_profile`

Guidance:

High sensitivity means strength sessions should avoid compromising key runs.

This is especially relevant when the template includes:

- intervals
- tempo sessions
- long runs
- race-specific progression
- re-entry impact constraints

### 14. Hybrid compatibility

Describes whether the running template can coexist with strength.

Recommended categories:

- `strong`
- `good`
- `limited`
- `poor`

Potential future field:

- `hybrid_compatibility`

Guidance:

Hybrid compatibility depends on:

- weekly running frequency
- intensity distribution
- impact profile
- long-run role
- lower-body fatigue interaction
- recovery sensitivity

Examples:

- `strong`: easy base 1-2x, reentry run-walk, hybrid-support running
- `good`: base run 2-3x
- `limited`: performance 5K/10K with quality sessions
- `poor`: high-volume performance block with hard lower-body strength

### 15. Race orientation

Describes how event-specific the template is.

Recommended categories:

- `none`
- `optional`
- `strong`

Potential future field:

- `race_orientation`

Guidance:

Race orientation should be used when the template’s structure depends on distance, event date, or race-specific demands.

A generic base template should usually be `none` or `optional`.

### 16. Taper support capability

Describes whether the template can support tapering toward an event.

Recommended categories:

- `none`
- `basic`
- `structured`

Potential future field:

- `taper_support`

Guidance:

Taper support should only exist when the plan can meaningfully reduce volume/intensity toward a target date.

Do not put “taper-aware” on a generic running plan because it sounds clever. That is how metadata becomes marketing.

### 17. Adaptive tolerance

Describes how much the template can change without losing identity.

Recommended categories:

- `low`
- `moderate`
- `high`

Potential future field:

- `adaptive_tolerance`

Guidance:

Easy base templates can often tolerate more substitution and downshifting.

Race-specific or performance templates tolerate less arbitrary change because session roles and timing matter more.

## Running template identity rule

A running template should be considered meaningfully distinct if it differs in one or more of these dimensions:

- primary running goal
- completion vs performance intent
- distance orientation
- weekly structure
- session role structure
- progression model
- impact profile
- fatigue profile
- re-entry sensitivity
- quality-session role
- long-run role
- strength coordination sensitivity
- hybrid compatibility
- race orientation
- taper support capability

Weak distinctions:

- same plan with a different distance label but no progression difference
- same easy runs with different wording
- same weekly count with cosmetic session names
- “performance” template without quality-session structure
- “half marathon” template without long-run development
- “hybrid support” template that ignores strength coordination

If a running template cannot explain how it differs from a sibling template in plain language, it probably should not exist as a separate template.

## Differentiation examples

### Run Start 2x

Likely identity:

- level: beginner
- goal: habit / general health
- intent: completion
- weekly structure: run-walk or easy base
- progression: duration-first or run-walk reduction
- impact: low to moderate
- fatigue: low
- re-entry sensitivity: soft
- hybrid compatibility: strong

Plain explanation:

> A low-barrier running template for building consistency without aggressive pace or distance demands.

### Base Run 2-3x

Likely identity:

- level: beginner/novice
- goal: aerobic base
- intent: base building
- weekly structure: easy base
- progression: duration-first
- impact: moderate
- fatigue: low to moderate
- hybrid compatibility: good

Plain explanation:

> A base-running template for building repeatable aerobic work without race-specific pressure.

### Re-entry Run 2x

Likely identity:

- level: reentry/beginner
- goal: return to running
- intent: reentry
- weekly structure: run-walk or short easy runs
- progression: reentry conservative
- impact: reentry protective
- fatigue: low
- re-entry sensitivity: strong
- hybrid compatibility: strong

Plain explanation:

> A conservative return-to-running template that prioritizes tolerance and consistency before progression.

### 5K Finish 2-3x

Likely identity:

- level: beginner/novice
- goal: 5K finish
- intent: completion
- distance orientation: 5K
- weekly structure: easy base with distance build
- progression: distance-first or duration-first
- impact: moderate
- race orientation: strong
- taper support: basic

Plain explanation:

> A completion-focused 5K template built to reach the distance safely rather than chase pace.

### 5K Performance 3x

Likely identity:

- level: novice/intermediate
- goal: 5K performance
- intent: performance
- distance orientation: 5K
- weekly structure: interval plus easy
- progression: interval density or pace progression
- quality-session role: one per week
- fatigue: moderate to high
- race orientation: strong

Plain explanation:

> A 5K-focused template using structured quality work to improve speed while preserving enough easy running.

### Hybrid Run Support 1-2x

Likely identity:

- level: beginner/novice/intermediate
- goal: hybrid support
- intent: maintenance or base support
- weekly structure: easy base
- progression: maintenance or duration-first
- impact: low to moderate
- strength coordination sensitivity: high
- hybrid compatibility: strong

Plain explanation:

> A low-interference running template designed to support mixed training without competing with strength recovery.

### 10K Performance 3x

Likely identity:

- level: novice/intermediate
- goal: 10K performance
- intent: performance
- distance orientation: 10K
- weekly structure: interval/tempo/easy
- progression: race-build progression
- quality-session role: one to two per week
- long-run role: supportive
- fatigue: moderate to high
- race orientation: strong
- taper support: structured

Plain explanation:

> A 10K-focused template balancing quality work and longer aerobic development.

### Half Marathon Base / Performance 3-4x

Likely identity:

- level: novice/intermediate
- goal: half marathon base or performance
- intent: base building or performance
- distance orientation: half marathon
- weekly structure: long-run focused
- progression: long-run extension or race-build progression
- long-run role: central
- fatigue: high
- strength coordination sensitivity: high
- race orientation: strong
- taper support: structured

Plain explanation:

> A longer-distance template where long-run development and weekly fatigue management become central.

## Matching guidance

When selecting a running template, prefer conservative matching if signals conflict.

Example conflicts:

- user wants performance but has low running history
- user wants 10K or half marathon but has low weekly tolerance
- user wants intervals but recent fatigue is high
- user wants hybrid training but lower-body fatigue is elevated
- user wants running after a break but local ankle/calf/knee signals are protective

Guidance:

- impact tolerance beats ambition
- consistency beats pace work
- easy running beats quality work when recovery is unclear
- re-entry protection beats distance progression after a break
- hybrid coordination beats isolated running purity when strength is active
- long-run development should not be added before the weekly base can tolerate it

The app should not reward the user for writing checks their calves cannot cash.

## Explanation examples

Good:

> Selected because you are returning to running and need a low-impact 2x structure before building distance.

> Selected because your goal is base running, your weekly target supports three runs, and the template progresses duration before pace.

> Not selected because the 5K performance template includes quality work that conflicts with your current fatigue and strength load.

> Selected because this run template is hybrid-compatible and should not compete heavily with lower-body strength.

Bad:

> Selected because it is a running program.

> Selected because it matches your goal.

> Selected because you want performance.

That is not explanation. That is a chatbot shrug with running shoes.

## Recommended near-term metadata mapping

Existing fields already cover part of this taxonomy:

- `kind` → domain
- `recommended_levels` → target level
- `supported_goals` → primary/secondary goal candidates
- `supported_weekly_sessions` → weekly structure
- `training_style` → weekly/session structure
- `program_family` → template family
- `progression_model` → progression model
- `fatigue_profile` → fatigue profile
- `complexity` → complexity
- `tags` → secondary descriptors
- `program_role` → event or transition role where relevant
- `expected_use_window_weeks` → race/build window proxy
- `transition_type` → transition or phase role
- `exit_criteria` → progression/phase completion logic

Future fields should only be added when matching or explanation needs them:

- `running_intent`
- `distance_orientation`
- `session_roles`
- `impact_profile`
- `reentry_sensitivity`
- `quality_session_role`
- `long_run_role`
- `strength_coordination_sensitivity`
- `hybrid_compatibility`
- `race_orientation`
- `taper_support`
- `adaptive_tolerance`

Do not add fields because the taxonomy looks lonely. Metadata should work for a living.

## Review checklist for future running templates

Before adding a running template, check:

- What target level is it for?
- What primary running goal does it serve?
- Is it completion, base, performance, maintenance, or re-entry oriented?
- Does it have a distance orientation?
- What weekly structure does it use?
- What session roles does it contain?
- What progression model does it follow?
- What impact profile does it carry?
- What fatigue profile does it carry?
- How re-entry sensitive is it?
- Does it contain quality sessions?
- Does it depend on long-run development?
- How sensitive is it to strength coordination?
- How hybrid-compatible is it?
- Is it race-oriented?
- Can it support tapering?
- How is it meaningfully different from existing running templates?
- Can the difference be explained in one or two plain sentences?

## Implementation guidance

Near-term work should:

1. Use this document to audit existing running templates.
2. Add missing run metadata only when it improves matching or explanation.
3. Keep starter, base, re-entry, performance, hybrid-support, and race-aware templates distinct.
4. Avoid creating distance-specific templates without distance-specific progression logic.
5. Avoid adding quality-session templates without recovery and strength-coordination rules.
6. Add future fields only when runtime matching or explanation needs them.
7. Keep running templates conservative when current history, local protection, or fatigue is unclear.

The running library should become a coherent set of training intents, not a suspiciously large menu of “run more” variants.
