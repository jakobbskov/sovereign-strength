# Planner Conflict Priorities

## Purpose

This document defines conflict-resolution priorities for SovereignStrength planning.

It explains what should usually win when multiple adaptive constraints apply at the same time.

It complements:

- `docs/program-template-taxonomy.md`
- `docs/template-identity-rules.md`
- `docs/adaptive-plan-builder-contract.md`
- `docs/recommendation-fallback-rules.md`
- `docs/explanation-style-rules.md`

The adaptive builder contract defines what the builder must preserve.

This document defines how to choose when not everything can be preserved at once.

Without this, the planner becomes a courtroom where fatigue, race goals, local irritation, hybrid balance, and calendar constraints all shout at the judge while the session builder eats crayons.

## Core principle

When constraints conflict, the planner should preserve the highest-priority safety and meaning signals first, then degrade lower-priority elements intentionally.

The planner should not:

- satisfy every signal superficially
- erase template identity without explanation
- overreact to one weak signal
- ignore repeated strong signals
- switch templates too quickly
- preserve ambition at the expense of recovery
- preserve schedule convenience at the expense of training meaning

Conflict resolution must be:

- deterministic
- conservative
- explainable
- stable across similar cases

## Default priority order

Use this default order unless a specific product rule or explicit user priority overrides it.

1. Safety and recovery
2. Local irritation or pain-related protection
3. Acute readiness and recent fatigue pressure
4. Explicit event priority and proximity
5. Template fidelity
6. Primary domain priority
7. Key session usefulness
8. Hybrid balance
9. Weekly schedule feasibility
10. Equipment constraints
11. Secondary goals
12. Optional volume
13. Cosmetic preference

This order is not an excuse to delete everything below safety.

It is a decision ladder. Not a bonfire.

## Priority 1: Safety and recovery

Safety and recovery override all other concerns.

This includes:

- repeated poor recovery
- very low readiness
- high fatigue pressure
- clear overload signals
- inability to complete planned work safely enough
- repeated failure or breakdown signals where relevant

Planner behavior:

- reduce load, volume, intensity, or duration
- avoid forcing progression
- choose lower-fatigue variants
- preserve habit where possible
- avoid aggressive catch-up logic

Safety and recovery should override:

- template ambition
- race specificity
- hybrid balance
- performance goals
- optional volume
- schedule catch-up

Example:

A 5K Performance plan shows repeated poor recovery. The planner should reduce interval density or hold progression, not force quality work because the template “says so.”

Bad behavior:

- progressing both strength and running under high fatigue
- adding missed sessions later in the week as punishment
- treating recovery warnings as decorative metadata

## Priority 2: Local irritation or pain-related protection

Local irritation and pain-related protection override normal template fidelity when the affected region is directly involved.

This includes:

- knee irritation before knee-dominant work
- hip irritation before heavy lower-body or running load
- shoulder irritation before pressing
- calf/Achilles irritation before higher-impact running
- elbow irritation before high-volume pulling or pressing

Planner behavior:

- reduce affected movement load
- substitute lower-stress variations
- reduce impact or density
- preserve the role with a safer substitute where possible
- avoid unsupported medical claims

Local protection should override:

- exercise preference
- progression target
- optional template details
- performance ambition

But it should not automatically erase the whole template.

Example:

Hip irritation affects heavy squats. Replace the squat role with a lower-stress pattern before deleting lower-body work entirely.

Bad behavior:

- removing all lower-body and core work without replacement
- replacing a key run with unrelated upper-body accessories
- saying the plan “prevents injury”

## Priority 3: Acute readiness and recent fatigue pressure

Acute readiness and multi-session fatigue pressure should modify the day or week before deeper template identity is abandoned.

This includes:

- poor sleep
- high perceived fatigue
- poor readiness score
- repeated low recovery check-ins
- fatigue accumulation across recent sessions

Planner behavior:

- reduce the current session
- hold progression
- preserve role at lower dose
- downgrade intensity before deleting the session role
- avoid progressing both domains at once

Readiness should usually override:

- normal progression
- optional quality
- accessory volume
- aggressive weekly increases

But readiness should not automatically cause permanent template switch.

Example:

A quality run becomes lower density, but remains the week’s quality role.

Bad behavior:

- one low-readiness day switching the whole program
- replacing every hard session with generic easy work for weeks without reassessment

## Priority 4: Explicit event priority and proximity

Event logic matters most when:

- the event has high priority
- the event is close enough to affect training
- the selected template supports event-aware behavior
- event-specific freshness or key-session protection is relevant

Planner behavior:

- protect key event-specific sessions
- preserve taper where relevant
- reduce conflicting strength or support work near event
- prioritize event freshness when event priority is high
- avoid over-specializing too early when event is far away

Event priority should override:

- secondary goals
- optional strength volume
- normal non-event progression
- low-priority support work

Event priority should not override:

- safety and recovery
- local irritation
- clear inability to tolerate the event-specific load

Example:

A high-priority 10K event is close. Lower-body strength volume should reduce before the key race-specific run is compromised.

Bad behavior:

- treating low-priority social 5K as if it dominates the whole plan
- ignoring calf irritation because race day is near
- tapering for an event so far away that specificity is silly

## Priority 5: Template fidelity

Template fidelity means the generated plan still represents the selected template.

Planner behavior:

- preserve essential template markers
- preserve session roles
- preserve progression philosophy
- reduce before replacing
- replace with role-equivalent alternatives
- warn when fidelity is weak
- recommend switch when fidelity repeatedly breaks

Template fidelity should override:

- cosmetic preferences
- optional volume
- secondary goals
- casual schedule convenience

Template fidelity should not override:

- safety
- local irritation
- high-priority event freshness
- repeated recovery failure

Example:

5K Performance should preserve a quality-session role when possible, even if interval density is reduced.

Bad behavior:

- 5K Performance becoming generic easy running without explanation
- Half Marathon losing long-run centrality repeatedly
- Hybrid Base repeatedly losing either strength or running

## Priority 6: Primary domain priority

Primary domain priority matters when domains conflict.

Examples:

- strength-first hybrid
- run-first hybrid
- balanced hybrid
- race-priority hybrid
- maintenance-strength during run focus

Planner behavior:

- preserve the primary domain’s key sessions first
- reduce secondary domain load before primary domain role
- make domain tradeoffs explicit
- avoid pretending both domains progressed when one was clearly held back

Primary domain priority should override:

- secondary domain ambition
- optional work
- non-key support sessions

It should not override:

- safety
- local irritation
- high-priority event logic

Example:

In run-first 5K hybrid, lower-body strength volume should reduce before the key run is compromised.

Bad behavior:

- strength-first user receiving race-dominant planning because a casual event exists
- balanced hybrid silently becoming run-first for several weeks

## Priority 7: Key session usefulness

A key session should remain useful, not merely present.

Examples:

- main lift day
- quality run
- long run
- re-entry exposure session
- run-walk on-ramp session
- event-specific session
- hybrid coordination anchor

Planner behavior:

- preserve the session role
- reduce stress dose while keeping purpose
- defer if timing makes it useless or harmful
- replace with role-equivalent fallback

Key session usefulness should override:

- optional volume
- cosmetic session order
- less important support work

Example:

A long run shortened from 70 to 50 minutes may preserve usefulness. A 10-minute shuffle probably does not, unless explicitly marked as reduced-mode.

Bad behavior:

- keeping a “quality session” label when all quality work was removed
- keeping a “long run” that is no longer meaningfully long

## Priority 8: Hybrid balance

Hybrid balance matters when the template is explicitly balanced or dual-domain.

Planner behavior:

- preserve both domains where possible
- progress one domain at a time under limited recovery
- reduce optional work before deleting a domain
- protect lower-body conflict logic
- explain domain tradeoffs

Hybrid balance should override:

- optional single-domain volume
- support work
- cosmetic preferences

Hybrid balance should not override:

- safety and recovery
- local irritation
- explicit user-chosen primary domain
- high-priority event logic

Example:

Hybrid Base 2+2 under reduced recovery may hold strength progression while preserving both strength and running sessions.

Bad behavior:

- deleting all running from Hybrid Base for convenience
- adding both hard lower-body strength and key run back-to-back because the calendar had a blank spot

## Priority 9: Weekly schedule feasibility

Schedule constraints matter, but they should not automatically erase plan meaning.

Planner behavior:

- reduce optional sessions
- preserve key sessions first
- use reduced-week logic
- avoid unsafe session stacking
- avoid cramming missed work into later days

Schedule should override:

- optional volume
- secondary sessions
- cosmetic weekly structure

Schedule should not override:

- safety
- local irritation
- template fidelity without explanation
- event-critical sessions when event priority is high

Example:

A three-day week preserves key strength and one run while dropping accessories.

Bad behavior:

- compressing four demanding sessions into two days
- making a balanced hybrid week look complete while one domain effectively disappeared

## Priority 10: Equipment constraints

Equipment constraints should prevent impossible or inappropriate template content.

Planner behavior:

- use available-equipment templates
- substitute compatible movements
- avoid selecting templates that require unavailable equipment
- preserve movement role where possible

Equipment constraints should override:

- exact exercise preference
- template variants requiring unavailable tools
- ideal hypertrophy split when equipment cannot support it

Equipment constraints should not override:

- user safety
- the need for coherent template selection

Example:

Full-gym hypertrophy should not be selected for minimal-home equipment unless a real home variant exists.

Bad behavior:

- recommending barbell progression without barbell access
- selecting machine-based accessories for home-only users

## Priority 11: Secondary goals

Secondary goals are useful, but they should not destabilize the plan.

Examples:

- mobility support
- body composition
- general health
- casual event target
- conditioning support
- strength maintenance during running focus

Planner behavior:

- include secondary goals when they fit
- reduce them first under constraint
- do not let them steal priority from confirmed primary goal

Secondary goals should override:

- optional polish only

They should not override:

- primary goal
- template fidelity
- recovery
- schedule feasibility

Example:

A strength-first user with a casual 5K target gets low-dose run support, not a race plan.

Bad behavior:

- secondary hypertrophy volume compromising re-entry recovery
- casual running target overriding strength-first identity

## Priority 12: Optional volume

Optional volume is the first thing to cut.

Examples:

- finishers
- extra accessories
- optional easy mileage
- optional strides
- extra core work
- pump work
- extra conditioning

Planner behavior:

- remove optional volume before essential roles
- reduce optional volume under low time or recovery
- do not hide essential work as optional

Optional volume should almost never win a conflict.

Bad behavior:

- deleting the main lift while keeping accessories
- dropping the key run while keeping optional conditioning
- preserving “fun extras” while template identity collapses

## Priority 13: Cosmetic preference

Cosmetic preference is lowest priority.

Examples:

- preferred order when not meaningful
- preferred wording
- favorite accessory
- preferred session label
- non-essential UI grouping

Planner behavior:

- respect preferences when cheap
- ignore them when they conflict with plan coherence

Bad behavior:

- preserving cosmetic layout while breaking session logic
- treating label preference as training priority

## Multi-constraint examples

### Race week plus calf irritation

Signals:

- high-priority event close
- calf irritation
- running quality session planned

Resolution:

1. local irritation limits impact
2. event priority still matters
3. preserve race freshness
4. reduce or replace high-impact quality work
5. explain that event intent remains, but calf signal changed the session

Bad resolution:

- force intervals because race is close
- delete all event-specific work without explanation

### Hybrid week plus lower-body fatigue

Signals:

- balanced hybrid template
- elevated lower-body fatigue
- key run and lower-body strength both planned

Resolution:

1. recovery/fatigue wins
2. preserve hybrid identity if possible
3. reduce lower-body strength volume or run density
4. progress only one domain
5. explain the tradeoff

Bad resolution:

- progress both domains anyway
- delete running entirely and call it hybrid

### Reduced days plus event priority

Signals:

- fewer available sessions
- event priority high
- strength and running sessions planned

Resolution:

1. keep event-critical session
2. preserve safety and freshness
3. reduce secondary strength or accessories
4. explain what was preserved and dropped

Bad resolution:

- keep generic strength and drop event-specific work
- cram all sessions into fewer days

### Re-entry plus ambitious goals

Signals:

- re-entry status
- user wants performance template

Resolution:

1. re-entry/tolerance wins
2. choose conservative bridge template
3. preserve ambition as future direction
4. explain why ambition is delayed

Bad resolution:

- prescribe performance plan immediately
- ignore user ambition entirely with no explanation

### Shoulder irritation plus main-lift day

Signals:

- shoulder irritation
- pressing role planned
- strength template selected

Resolution:

1. local irritation constrains pressing
2. preserve movement role with lower-stress variation if possible
3. reduce volume or intensity
4. explain substitution

Bad resolution:

- delete all upper-body work
- keep heavy pressing because template says so

## Explanation requirements

Conflict-driven changes should explain:

- which signal won
- what changed
- what was preserved
- what was reduced or delayed
- whether the change is temporary

Good:

> Lower-body strength volume was reduced because recovery and tomorrow’s key run conflicted.

> The interval session was changed because calf irritation outweighed race-specific intensity today.

> The event session was kept, while optional accessories were dropped because this is a reduced week.

Bad:

> Adjusted because of multiple factors.

> The plan was optimized.

> Your schedule was balanced.

Those are not explanations. They are fog wearing a blazer.

## Review checklist

Before implementing conflict logic, ask:

- What signals are in conflict?
- Which priority wins?
- Which template identity marker must be preserved?
- What gets reduced first?
- What gets deferred?
- What gets replaced?
- What should trigger a template switch?
- What reason code is emitted?
- Can the user-facing explanation name the winning signal?
- Would the same inputs produce the same decision next time?

## Regression scenario requirements

Future tests should include multi-constraint cases:

- race week plus calf irritation
- hybrid week plus lower-body fatigue
- reduced days plus high event priority
- re-entry plus ambitious goals
- shoulder irritation plus main-lift day
- low recovery plus 5K Performance quality session
- equipment mismatch plus hypertrophy goal
- balanced hybrid plus only three available sessions
- half marathon long run plus poor readiness

Tests should assert:

- winning priority
- preserved identity marker
- adaptation action
- fallback reason
- explanation bits
- whether template switch is suggested

Do not merely assert that a plan was generated. That is not a test. That is a software shrug.

## Non-goals

This document does not:

- implement planner logic
- define exact scoring weights
- define exact substitution maps
- define exact taper formulas
- replace local protection rules
- replace recommendation fallback rules
- replace adaptive builder contract
- replace explanation style rules
- define final UI strings

## Implementation guidance

Near-term implementation should:

1. Encode conflict reason codes before adding more adaptive branches.
2. Preserve priority order in tests.
3. Avoid one-off conditionals that bypass the priority model.
4. Emit explanation bits for conflict-driven decisions.
5. Treat repeated conflicts as possible template mismatch.
6. Keep schedule convenience below safety, fidelity, and primary intent.
7. Make multi-constraint behavior deterministic.

The planner is allowed to simplify.

It is not allowed to become inconsistent with confidence.
