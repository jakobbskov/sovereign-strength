# Recommendation Fallback Rules

## Purpose

This document defines fallback rules for SovereignStrength recommendations when a user profile does not cleanly match one ideal template.

It complements:

- `docs/program-template-taxonomy.md`
- `docs/template-identity-rules.md`
- `docs/adaptive-plan-builder-contract.md`
- `docs/explanation-style-rules.md`

The recommendation layer should select the most coherent conservative fit when the ideal match is blocked by recovery, schedule, equipment, tolerance, mixed goals, or incomplete profile data.

Not every user fits a neat bucket. Humans, in their usual commitment to product inconvenience, keep arriving with mixed goals, limited time, old irritation, ambitious event plans, and one dumbbell under the sofa.

## Core principle

When no perfect template fit exists, recommend the safest coherent plan that still serves the user's most important confirmed intent.

Fallback should prioritize:

1. safety and recovery
2. adherence
3. simple structure
4. conservative progression
5. template coherence
6. explanation clarity
7. ambition only when supported by tolerance and schedule

The system should prefer a conservative good fit over an ambitious fragile fit.

## What fallback is

Fallback is a controlled recommendation behavior used when the ideal template is not appropriate.

Fallback may:

- choose a simpler template
- choose a lower-fatigue template
- choose a lower-frequency template
- choose a support template instead of a performance template
- delay race-specific work
- prioritize re-entry over ambition
- preserve the primary goal while reducing secondary goals
- recommend a template switch later when constraints improve

Fallback is not random downgrade.

Fallback must be explainable.

## What fallback is not

Fallback is not:

- silently ignoring the user goal
- picking the closest name match
- choosing the most advanced possible plan
- flattening all edge cases into beginner full-body or easy running
- switching templates every week
- treating missing data as permission to guess aggressively
- hiding uncertainty from the explanation layer

If fallback cannot be explained in one or two clear sentences, the recommendation logic is probably too clever for its own good. A tragic genre.

## Required fallback inputs

Recommendation fallback should consider:

- primary goal
- secondary goal
- domain preference
- user level
- training history
- re-entry status
- recovery context
- fatigue pressure
- local irritation signals
- available weekly sessions
- available session duration
- equipment profile
- current running tolerance
- strength training tolerance
- hybrid intent
- event type
- event priority
- event proximity
- confidence or preference signals where available

Missing inputs should push the recommendation toward conservative defaults.

## Fallback decision order

When profile inputs conflict, use this order:

1. Safety and recovery
2. Re-entry / current tolerance
3. Local irritation or tissue-specific load concerns
4. Available weekly sessions
5. Primary goal
6. Event priority and proximity
7. Domain priority
8. Equipment constraints
9. Complexity tolerance
10. Secondary goals
11. Preference polish

This order should later align with `docs/planner-conflict-priorities.md`.

Until that exists, this document is the recommendation fallback reference.

## Fallback output requirements

Fallback recommendations should expose:

- selected template
- blocked ideal template, if relevant
- fallback reason code
- primary preserved intent
- sacrificed or delayed intent
- whether the fallback is temporary
- whether reassessment is expected
- explanation bits for UI

Example internal fields:

- `selected_template_id`
- `ideal_template_id`
- `fallback_applied`
- `fallback_reason`
- `preserved_intent`
- `deferred_intent`
- `fallback_duration_hint`
- `reassess_after`
- `explanation_bits`

Do not bury fallback in vague prose. Vague prose is where product logic goes to avoid accountability.

## Common fallback reason codes

Suggested stable reason codes:

- `low_recovery`
- `high_fatigue_pressure`
- `reentry_context`
- `insufficient_weekly_sessions`
- `limited_equipment`
- `low_running_tolerance`
- `local_irritation`
- `event_priority_low`
- `event_too_close`
- `event_too_far`
- `mixed_goals`
- `unclear_primary_goal`
- `hybrid_capacity_mismatch`
- `complexity_too_high`
- `duration_too_short`
- `template_not_available`

Reason codes should be stable enough for tests and explanation output.

## Mixed goals with no strong primary

Problem:

The user selects multiple goals without a clear priority.

Examples:

- strength + fat loss + 5K + mobility
- hypertrophy + running base + general health
- race completion + strength progress + limited sessions

Fallback rule:

- Prefer the simplest template that supports the broadest confirmed goal without overcommitting.
- If one goal creates high risk or high complexity, treat it as secondary until confirmed.
- Ask future UI or profile flow to clarify priority where needed, but do not block planning.

Preferred fallback:

- general strength + base running
- Hybrid Base only if weekly sessions and recovery support it
- low-fatigue strength or base run if profile is unclear and recovery is limited

Avoid:

- performance templates
- race-specific plans
- high-volume hypertrophy
- aggressive hybrid progression

Explanation pattern:

> Chosen because your goals are mixed, so the plan keeps a conservative structure while preserving general strength and aerobic work.

## Too few weekly sessions for hybrid intent

Problem:

The user wants both strength and running, but available weekly sessions are too low.

Examples:

- wants Hybrid Base 2+2 but has 2 sessions
- wants 5K hybrid performance but has 3 sessions and poor recovery
- wants strength progress and running improvement with inconsistent availability

Fallback rule:

- Preserve the primary domain.
- Add the secondary domain only as support if possible.
- Do not pretend a true hybrid template fits if both domains cannot remain meaningful.

Preferred fallback:

- strength-first template + optional low-dose run support
- Base Run + minimal strength support if running is primary
- lower-frequency hybrid only if both domains still have identity

Avoid:

- balanced hybrid templates that lose one domain immediately
- overstuffed sessions that hide weekly mismatch
- rotating random domain priority week to week

Explanation pattern:

> Chosen because four sessions are needed for balanced hybrid work, so this plan preserves your primary goal and keeps the second domain lower-dose.

## Race goal present but tolerance too low

Problem:

The user has a race goal but current running tolerance does not support the ideal race template.

Examples:

- wants 5K Performance but cannot yet complete 5K
- wants 10K but has low continuous-running tolerance
- wants half marathon but is in re-entry context
- race is close but current base is too low

Fallback rule:

- Match current tolerance before race ambition.
- Use completion or re-entry templates before performance templates.
- Preserve race intent as a future direction, not as current training load.

Preferred fallback:

- Run Start
- Re-entry Run
- 5K Finish
- Base Run
- event-aware explanation that race specificity is delayed

Avoid:

- performance templates
- sudden mileage increases
- taper logic before the user has built the relevant base
- pretending event intent overrides physiology

Explanation pattern:

> Chosen because the race goal is noted, but current running tolerance fits a safer completion-first build.

## Hypertrophy goal with limited equipment

Problem:

The user wants hypertrophy but equipment does not support the preferred split or loading model.

Examples:

- hypertrophy-first goal with minimal home equipment
- wants upper/lower hypertrophy but only has bodyweight or light dumbbells
- wants high volume but short session duration

Fallback rule:

- Choose the best available muscle-building structure within equipment limits.
- Prefer consistency and volume exposure over pretending full-gym hypertrophy is possible.
- Explain equipment as the limiting signal.

Preferred fallback:

- dumbbell/home hypertrophy variant if available
- full-body strength/hypertrophy support template
- general strength template with hypertrophy-support tags

Avoid:

- full-gym split templates
- unsupported exercise assumptions
- labeling general strength as hypertrophy-first without enough stimulus

Explanation pattern:

> Chosen because your equipment limits the preferred hypertrophy split, so the plan uses a simpler structure that still supports muscle-building work.

## Re-entry context plus high ambition

Problem:

The user wants aggressive progress while current context suggests reduced tolerance.

Examples:

- returning after illness but wants performance running
- low recovery and wants 5/3/1-style strength
- long break and wants 4-day hypertrophy
- recent irritation and wants half marathon build

Fallback rule:

- Re-entry wins first.
- Preserve ambition as a future progression path.
- Use a bridge template with reassessment.

Preferred fallback:

- Re-entry Strength
- Re-entry Run
- Low Fatigue / Easy Strength
- Run Start if running tolerance is very low

Avoid:

- normal-volume novice templates too early
- race-performance templates
- high-frequency hypertrophy
- intermediate strength structures

Explanation pattern:

> Chosen because your current re-entry context needs lower fatigue first; the more ambitious template can fit later if tolerance improves.

## Strength-first plus low-priority race target

Problem:

The user primarily wants strength but has a casual or low-priority race target.

Examples:

- strength-first user signed up for a local 5K
- race is secondary or social
- user does not want running to interfere with strength

Fallback rule:

- Preserve strength-first identity.
- Treat race support as secondary conditioning.
- Do not shift into a race-specific plan unless event priority changes.

Preferred fallback:

- strength template + Hybrid Run Support
- strength-first hybrid support
- low-dose running support

Avoid:

- 5K Performance
- balanced hybrid if strength should remain primary
- event-aware plan that dominates the week

Explanation pattern:

> Chosen because strength is the primary goal, while the race target is low priority and only needs support running.

## Run-first plus strength maintenance

Problem:

The user wants running progress but still wants strength work.

Examples:

- 5K performance with strength maintenance
- 10K goal with two strength sessions
- race goal plus desire not to lose strength

Fallback rule:

- Preserve key running sessions first.
- Keep strength meaningful but secondary.
- Reduce lower-body strength stress when needed.

Preferred fallback:

- 5K Hybrid Performance
- run template + strength maintenance support
- run-first hybrid if frequency allows

Avoid:

- strength-first templates
- balanced hybrid when event priority is high
- lower-body strength progression that compromises key runs

Explanation pattern:

> Chosen because running is the primary goal, while strength stays in a supporting role.

## Low recovery or high external fatigue

Problem:

The user has poor recovery, high stress, manual work, poor sleep, or repeated low readiness.

Fallback rule:

- Reduce fatigue profile.
- Prefer lower-complexity templates.
- Avoid simultaneous progression across domains.
- Preserve habit and key intent before ambition.

Preferred fallback:

- low-fatigue strength
- re-entry strength
- base run easy-dominant
- hybrid with one-domain-at-a-time progression
- reduced week mode

Avoid:

- high-frequency hypertrophy
- aggressive race-performance templates
- progressing both strength and running in the same week
- high complexity plans

Explanation pattern:

> Chosen because recent recovery signals favor a lower-fatigue structure before adding more progression pressure.

## Local irritation or tissue-specific load concern

Problem:

User reports local irritation or the system detects repeated local load risk.

Fallback rule:

- Avoid templates that depend heavily on the irritated area.
- Prefer templates with substitution flexibility.
- Preserve movement habit when safe and appropriate.
- Do not use medical certainty.

Preferred fallback:

- lower-impact running
- re-entry running
- strength templates with flexible movement substitutions
- reduced lower-body volume if lower-leg or hip irritation is present

Avoid:

- high-impact run templates
- aggressive lower-body strength templates
- long-run progression during unresolved lower-leg irritation
- claims that a plan prevents injury

Explanation pattern:

> Chosen because the reported irritation makes a lower-impact, more flexible plan a better fit right now.

## Incomplete profile data

Problem:

The system lacks important user profile fields.

Examples:

- missing training level
- missing equipment
- missing weekly session target
- missing running tolerance
- missing goal priority

Fallback rule:

- Use conservative defaults.
- Avoid specialized templates.
- Prefer templates that tolerate adaptation.
- Surface missing-field explanation where useful.

Preferred fallback:

- beginner/general strength
- base run only if running tolerance is known
- low-complexity templates
- low-fatigue options

Avoid:

- intermediate templates
- race-specific templates
- high-volume splits
- aggressive hybrid plans

Explanation pattern:

> Chosen as a conservative default because some profile details are missing.

## Equipment mismatch

Problem:

The user goal suggests a template that requires unavailable equipment.

Fallback rule:

- Select a template that fits actual equipment.
- Prefer lower-complexity substitution-friendly templates.
- Do not select templates that require impossible movements.

Preferred fallback:

- minimal-home strength
- dumbbell-home strength
- run-only template if running goal is primary
- mobility/recovery support where appropriate

Avoid:

- full-gym strength templates
- equipment-heavy hypertrophy splits
- templates that require unavailable machines or barbell loading

Explanation pattern:

> Chosen because it fits your available equipment while preserving the main training goal.

## Session duration too short

Problem:

The user has enough weekly sessions but too little time per session for the ideal template.

Fallback rule:

- Prefer templates with shorter session identity.
- Reduce optional work before changing the goal.
- Avoid templates whose key sessions cannot fit.

Preferred fallback:

- minimalist strength
- low-dose strength
- shorter base run
- Hybrid Run Support
- reduced accessory version

Avoid:

- hypertrophy splits
- long-run-dependent templates
- intermediate strength templates with complex session structure

Explanation pattern:

> Chosen because your session duration favors a shorter structure that still preserves the main goal.

## Event too close

Problem:

The user enters an event goal too close to build the ideal template safely.

Fallback rule:

- Avoid pretending a full build is possible.
- Use conservative event-week or readiness-focused support.
- Preserve freshness and confidence over forced progression.

Preferred fallback:

- event-week support
- taper-aware reduced plan
- conservative completion support
- maintain current template with minor event accommodation

Avoid:

- aggressive race build
- sudden mileage or intensity spike
- new high-complexity template right before event

Explanation pattern:

> Chosen because the event is too close for a full build, so the plan favors freshness and realistic support.

## Event too far

Problem:

The user has an event far in the future.

Fallback rule:

- Do not over-specialize too early.
- Use base-building or general preparation.
- Shift to race-specific templates later.

Preferred fallback:

- Base Run
- Hybrid Base
- general strength + base running
- 5K Finish only if completion tolerance is the current issue

Avoid:

- long taper logic
- race-specific intensity too early
- event-dominant planning before it matters

Explanation pattern:

> Chosen because the event is still far away, so the plan builds general capacity before race-specific work.

## Template switching stability

Fallback must avoid unnecessary template churn.

Do not switch templates because of one bad day.

Consider template switch when:

- fallback is applied repeatedly
- weak template fidelity persists
- the user’s goal priority changes
- recovery profile changes for multiple check-ins
- weekly availability changes materially
- event priority changes
- current template repeatedly cannot preserve its key identity

Suggested switch threshold:

- two to three repeated weeks of broken or weak fidelity
- repeated mismatch between user intent and generated plan
- repeated inability to complete key session roles

Explanation pattern:

> Recent weeks repeatedly changed the selected template, so a lower-fatigue plan may now fit better.

## Explanation requirements

Fallback explanation should say:

- what ideal fit was blocked, if relevant
- why the fallback was chosen
- what primary intent is preserved
- what ambition was reduced or delayed
- whether reassessment is expected

Good:

> 5K Performance was delayed because current tolerance fits completion work first.

> Balanced hybrid needs four sessions, so this plan keeps strength primary and running lower-dose.

> The race goal is noted, but recovery signals favor a lower-fatigue base phase first.

Bad:

> Your plan was adjusted.

> This is a better fit.

> Your goals were balanced.

> Recommendation optimized.

The last one should be illegal in at least three jurisdictions.

## Review checklist

Before implementing recommendation fallback, ask:

- What was the ideal template?
- What blocked the ideal template?
- What was preserved?
- What was reduced or delayed?
- Is the fallback conservative but still useful?
- Is the selected template coherent?
- Is the fallback stable enough to avoid churn?
- Can the explanation name the actual signal?
- Does this avoid overfitting one user input?
- Does this avoid flattening everyone into the same safe default?

## Non-goals

This document does not:

- implement recommendation logic
- define exact scoring weights
- define every fallback combination
- replace the recommendation engine
- replace template taxonomy
- replace builder contract
- replace conflict-priority rules
- replace UI copy review
- define final translation strings

## Implementation guidance

Near-term recommendation work should:

1. Add explicit fallback reason codes.
2. Return ideal template and selected fallback where relevant.
3. Prefer conservative good fit over ambitious fragile fit.
4. Avoid switching templates too frequently.
5. Keep fallback explanations short and signal-based.
6. Add contract tests for mixed goals, low recovery, insufficient sessions, event mismatch, equipment mismatch, and re-entry ambition.
7. Treat fallback as a product behavior, not an error state.

The recommendation layer should not panic when a user is complicated.

It should calmly pick the least stupid coherent option and explain why.
