# Template Identity Regression Scenarios

## Purpose

This document defines scenario-based regression cases for template identity preservation in SovereignStrength.

It complements:

- `docs/program-template-taxonomy.md`
- `docs/template-identity-rules.md`
- `docs/adaptive-plan-builder-contract.md`
- `docs/planner-conflict-priorities.md`
- `docs/recommendation-fallback-rules.md`
- `docs/explanation-style-rules.md`

The goal is to make future builder changes testable against concrete scenarios.

A planner can generate a technically valid week while quietly erasing the point of the selected template. This document exists to catch that kind of slow, beige disaster.

## How to use this document

Each scenario defines:

- starting template
- user context
- stressors
- required preserved identity markers
- acceptable outputs
- unacceptable outputs
- expected explanation bits
- future automation target

These scenarios may initially be used for manual review.

Later they should become automated or semi-automated regression tests.

## Regression principles

Scenario validation should verify more than existence.

A passing scenario should show that:

- the selected template remains recognizable
- essential session roles are preserved where possible
- adaptation follows the conflict-priority model
- optional work is reduced before essential work
- the system explains meaningful changes
- repeated weak fidelity can trigger switch recommendation

A scenario should not pass merely because:

- some plan was generated
- the session count is correct
- no exception was thrown
- the output looks plausible if nobody thinks too hard

“No crash” is not product quality. It is just software breathing.

## Scenario format

Use this structure for future test cases:

- **Template**
- **Context**
- **Stressors**
- **Must preserve**
- **Acceptable**
- **Unacceptable**
- **Expected explanation bits**
- **Automation target**

## Strength scenarios

### S1: Beginner full-body under low readiness

Template:

- beginner full-body strength 2x or 3x

Context:

- beginner or novice user
- general strength goal
- normal equipment access
- low readiness today

Stressors:

- low readiness
- recent fatigue signal

Must preserve:

- full-body pattern coverage
- simple progression identity
- main movement roles

Acceptable:

- reduce sets
- hold load progression
- reduce accessories
- keep squat/hinge/push/pull exposure at lower dose
- explain recovery-driven reduction

Unacceptable:

- delete lower-body entirely
- keep accessories while removing main patterns
- progress load despite high fatigue pressure
- turn session into random mobility only without reduced-mode explanation

Expected explanation bits:

- `low_recovery`
- `volume_reduced`
- `main_patterns_preserved`

Automation target:

- assert main movement roles remain present
- assert optional volume is reduced before main roles
- assert progression is held or conservative

### S2: Novice linear progression with repeated poor recovery

Template:

- novice linear strength template
- Greyskull-style or similar linear progression

Context:

- novice user
- repeated successful performance trend
- repeated poor recovery check-ins

Stressors:

- positive performance trend
- high multi-session fatigue pressure

Must preserve:

- linear progression identity
- main lift exposure
- conservative recovery override

Acceptable:

- hold load progression
- keep main lift practice
- reduce accessory volume
- explain recovery overruled progression

Unacceptable:

- increase load despite high fatigue pressure
- delete main lift instead of holding progression
- silently hold without explanation

Expected explanation bits:

- `high_fatigue_pressure`
- `progression_held`
- `main_lift_preserved`

Automation target:

- assert `progression_decision == hold`
- assert main lift role remains
- assert explanation references recovery/fatigue signal

### S3: Intermediate strength preserves role hierarchy

Template:

- 5/3/1-style strength
- GZCL-style full-body

Context:

- intermediate user
- structured strength template selected
- normal weekly availability

Stressors:

- reduced session duration
- moderate fatigue

Must preserve:

- primary lift or tier hierarchy
- template-specific role structure
- support work as secondary

Acceptable:

- reduce assistance volume
- reduce backoff work
- keep primary lift-of-day or T1 role
- preserve T1/T2/T3 distinction where relevant

Unacceptable:

- remove primary lift while keeping accessories
- flatten tiered structure into generic full-body
- replace structured progression with random exercises

Expected explanation bits:

- `reduced_time`
- `assistance_reduced`
- `primary_lift_preserved`

Automation target:

- assert primary/tier role remains
- assert assistance is reduced before primary role
- assert template role metadata survives

### S4: Shoulder irritation on pressing day

Template:

- strength template with push/press role

Context:

- strength goal
- pressing session planned

Stressors:

- shoulder irritation reported

Must preserve:

- upper-body push role where possible
- local protection priority
- pattern-level replacement

Acceptable:

- reduce pressing volume
- replace overhead press with shoulder-friendlier press
- reduce range/stress if supported
- keep pull/lower/core roles if appropriate
- explain shoulder signal

Unacceptable:

- force planned pressing unchanged
- delete all upper-body work
- claim the change prevents injury
- replace pressing role with unrelated conditioning only

Expected explanation bits:

- `local_irritation`
- `push_role_modified`
- `role_preserved`

Automation target:

- assert push role is modified or reduced
- assert no unsupported medical wording
- assert role-equivalent replacement where available

## Running scenarios

### R1: Run Start under poor readiness

Template:

- Run Start 2x

Context:

- true beginner
- low continuous-running tolerance

Stressors:

- low readiness
- low confidence or high fatigue

Must preserve:

- run-walk identity
- low-barrier entry
- habit/tolerance focus

Acceptable:

- increase walking ratio
- shorten total duration
- repeat week
- keep low-pressure session

Unacceptable:

- replace with performance intervals
- progress continuous running aggressively
- remove run-walk identity
- treat repeat week as failure

Expected explanation bits:

- `low_recovery`
- `run_walk_preserved`
- `duration_reduced`

Automation target:

- assert run-walk structure remains
- assert no pace-performance emphasis
- assert conservative progression

### R2: Base Run becomes easy-only under fatigue

Template:

- Base Run 2-3x

Context:

- beginner/novice runner
- general aerobic base goal

Stressors:

- high fatigue week

Must preserve:

- easy-dominant aerobic base
- general running habit
- non-race identity

Acceptable:

- make all runs easy
- reduce optional light quality
- reduce duration
- preserve base-building role

Unacceptable:

- turn into race-specific intervals
- remove all running exposure
- increase duration despite fatigue
- call it 5K prep without event intent

Expected explanation bits:

- `high_fatigue_pressure`
- `easy_only_week`
- `base_identity_preserved`

Automation target:

- assert no hard quality session
- assert at least one aerobic exposure remains
- assert explanation references fatigue and base preservation

### R3: Re-entry Run under irritation signal

Template:

- Re-entry Run 2x

Context:

- returning after break
- prior running ability exists

Stressors:

- lower-leg irritation
- reduced recovery

Must preserve:

- re-entry protection
- tolerance rebuild
- easy intensity

Acceptable:

- regress toward walk-heavy session
- reduce duration
- hold progression
- recommend low-impact substitute if running is not suitable
- explain irritation signal

Unacceptable:

- progress run duration
- add intervals
- treat user as normal Base Run
- ignore irritation signal

Expected explanation bits:

- `local_irritation`
- `reentry_context`
- `progression_held`

Automation target:

- assert progression held or reduced
- assert easy/run-walk fallback
- assert no performance session role

### R4: 5K Finish preserves completion identity

Template:

- 5K Finish 2-3x

Context:

- user wants to complete 5K
- cannot yet comfortably run continuous 5K

Stressors:

- poor recovery
- one missed session

Must preserve:

- completion goal
- continuous-running tolerance path
- distance-first progression

Acceptable:

- repeat week
- fallback to run-walk
- reduce pace demand
- keep one completion-oriented session

Unacceptable:

- switch to 5K Performance
- prioritize speed work
- drop completion session for generic easy running every time
- increase both duration and intensity

Expected explanation bits:

- `completion_goal_preserved`
- `week_repeated`
- `pace_not_prioritized`

Automation target:

- assert completion marker remains
- assert performance marker absent
- assert conservative adaptation

### R5: 5K Performance quality session under low recovery

Template:

- 5K Performance 3x

Context:

- user can already run 5K
- goal is pace improvement

Stressors:

- low readiness
- fatigue pressure

Must preserve:

- quality-session identity if possible
- pace-improvement intent
- easy support run

Acceptable:

- reduce interval count
- reduce pace demand
- convert intervals to controlled fartlek
- keep quality role at lower dose
- explain density reduction

Unacceptable:

- replace quality session with generic easy run repeatedly
- increase pace and volume together
- lose all quality-session identity without warning
- switch to Base Run after one weak day

Expected explanation bits:

- `low_recovery`
- `quality_density_reduced`
- `quality_role_preserved`

Automation target:

- assert quality role remains or weak fidelity is flagged
- assert dose reduction
- assert no aggressive progression

### R6: Half Marathon protects long-run centrality

Template:

- Half Marathon Base / Performance 3-4x

Context:

- established running base
- half marathon goal
- long run planned

Stressors:

- moderate poor readiness
- compressed week

Must preserve:

- long-run centrality
- endurance development
- event/distance intent

Acceptable:

- shorten long run
- reduce quality work
- drop optional fourth run
- keep long-run role
- explain long-run preservation

Unacceptable:

- drop long run while keeping optional quality
- turn week into generic Base Run
- erase event-distance intent
- keep full long run despite strong recovery warning

Expected explanation bits:

- `long_run_preserved`
- `duration_reduced`
- `event_intent_preserved`

Automation target:

- assert long-run role remains unless safety overrides
- assert optional work dropped first
- assert explanation references long-run role

## Hybrid scenarios

### H1: Hybrid Base 2+2 under reduced availability

Template:

- Hybrid Base 2+2

Context:

- balanced strength and running goal
- normally four weekly sessions

Stressors:

- only three sessions available

Must preserve:

- both-domain identity if possible
- balanced intent
- coherent weekly structure

Acceptable:

- keep one strength and one run minimum
- reduce optional accessories
- progress only one domain
- explain reduced-week tradeoff
- flag weak fidelity if one domain is lost

Unacceptable:

- delete all running and still call it balanced hybrid
- delete all strength and still call it balanced hybrid
- cram four sessions into unsafe schedule
- silently lose one domain

Expected explanation bits:

- `reduced_week`
- `both_domains_preserved`
- `optional_work_dropped`

Automation target:

- assert both domains present or weak fidelity warning
- assert no unsafe cramming
- assert explanation names tradeoff

### H2: Run-first hybrid protects key run

Template:

- 5K Hybrid Performance

Context:

- running performance primary
- strength meaningful but secondary

Stressors:

- lower-body fatigue
- key run planned

Must preserve:

- run-primary identity
- key run protection
- meaningful strength support

Acceptable:

- reduce lower-body strength volume
- keep upper-body/trunk strength
- reduce run density if recovery is poor
- keep key run role if safe
- explain domain tradeoff

Unacceptable:

- preserve heavy lower-body strength and compromise key run
- delete all strength work without explanation
- treat week as balanced hybrid
- ignore lower-body fatigue

Expected explanation bits:

- `run_first`
- `lower_body_fatigue`
- `key_run_protected`

Automation target:

- assert lower-body strength reduced before key run when appropriate
- assert strength still meaningful if possible
- assert domain priority explanation

### H3: Strength-first hybrid keeps running low-dose

Template:

- Hybrid Run Support 1-2x or strength-first hybrid

Context:

- strength primary
- running secondary

Stressors:

- user requests more running
- recovery is limited

Must preserve:

- strength-first identity
- low-dose running support
- recovery protection

Acceptable:

- keep running easy/short
- avoid adding extra hard run
- preserve strength key sessions
- explain running remains secondary

Unacceptable:

- shift into race-style run plan
- add hard running that compromises strength recovery
- erase running entirely without reason

Expected explanation bits:

- `strength_first`
- `running_low_dose`
- `recovery_limited`

Automation target:

- assert running remains support role
- assert strength key session preserved
- assert explanation names priority

## Race-aware scenarios

### E1: Race week plus calf irritation

Template:

- race-aware 5K or 10K plan

Context:

- high-priority event close
- key quality session planned

Stressors:

- calf irritation

Must preserve:

- local protection priority
- event intent where possible
- freshness

Acceptable:

- reduce impact
- replace intervals with lower-stress sharpness or easy session
- preserve event-week explanation
- reduce lower-body strength

Unacceptable:

- force high-impact intervals
- ignore calf irritation
- erase event intent entirely without explanation
- claim injury prevention

Expected explanation bits:

- `local_irritation`
- `event_proximity`
- `impact_reduced`

Automation target:

- assert local protection wins over intensity
- assert event intent still visible
- assert no medical-certainty wording

### E2: Event too close for full build

Template:

- ideal race plan blocked by timing

Context:

- user enters event soon
- current tolerance below ideal

Stressors:

- event proximity
- insufficient base

Must preserve:

- realistic support
- safety/recovery
- event acknowledgement

Acceptable:

- recommend event-week support
- choose conservative completion focus
- avoid aggressive build
- explain full build is not realistic

Unacceptable:

- prescribe full race build
- spike mileage
- ignore event entirely
- overpromise performance improvement

Expected explanation bits:

- `event_too_close`
- `conservative_support`
- `full_build_not_selected`

Automation target:

- assert no aggressive progression
- assert event is acknowledged
- assert fallback reason present

### E3: Event far away stays base-focused

Template:

- future event target

Context:

- event far in future
- user wants race eventually

Stressors:

- event not close enough for specificity

Must preserve:

- general capacity build
- future event direction
- no premature taper/specificity

Acceptable:

- choose Base Run or Hybrid Base
- explain base phase
- defer race-specific work

Unacceptable:

- start taper logic
- over-specialize too early
- ignore event metadata entirely

Expected explanation bits:

- `event_too_far`
- `base_phase`
- `race_specificity_deferred`

Automation target:

- assert no taper logic
- assert base template selected
- assert future event direction preserved

## Reduced-week scenarios

### W1: Reduced week preserves key roles

Template:

- any structured template

Context:

- normally 4 sessions
- only 2 sessions available

Stressors:

- reduced available days

Must preserve:

- highest-priority session roles
- primary goal
- template fidelity where possible

Acceptable:

- drop optional work
- keep key sessions
- flag reduced fidelity if identity cannot fully survive
- explain what was dropped

Unacceptable:

- randomly select two sessions
- preserve accessories over key sessions
- pretend full fidelity when essential roles were lost

Expected explanation bits:

- `reduced_week`
- `key_roles_preserved`
- `optional_work_dropped`

Automation target:

- assert key roles prioritized
- assert fidelity level reported
- assert explanation names dropped work

## Switch recommendation scenarios

### X1: Repeated weak fidelity triggers template switch suggestion

Template:

- any performance or hybrid template

Context:

- selected template repeatedly adapted over multiple weeks

Stressors:

- repeated poor recovery
- repeated reduced availability
- repeated local irritation

Must preserve:

- honest fit assessment
- user goal where possible
- conservative fallback

Acceptable:

- mark weak fidelity repeatedly
- suggest lower-fatigue or lower-frequency template
- explain repeated mismatch
- preserve current week as reduced-mode

Unacceptable:

- continue pretending template fits
- switch after one bad day
- silently flatten template identity
- hide repeated weak fidelity

Expected explanation bits:

- `template_switch_suggested`
- `repeated_weak_fidelity`
- `lower_fatigue_recommended`

Automation target:

- assert switch suggestion only after repeated weak/broken fidelity
- assert current plan remains coherent
- assert explanation references repeated pattern

## Minimum future automated coverage

The first automated regression suite should cover:

1. Beginner strength under low readiness
2. Novice progression with repeated poor recovery
3. Shoulder irritation on pressing day
4. Run Start under poor readiness
5. 5K Performance under low recovery
6. Half Marathon long-run preservation
7. Hybrid Base reduced week
8. Run-first hybrid lower-body fatigue conflict
9. Race week plus calf irritation
10. Repeated weak fidelity triggers switch suggestion

This is the minimum useful set.

Anything less risks testing only the happy path, which is where bugs go to put on sunglasses.

## Manual review checklist

For any adaptive planner PR, ask:

- Which scenario family does this affect?
- Does it preserve essential markers?
- Does it reduce optional work first?
- Does it report fidelity level?
- Does it emit reason bits?
- Does the user explanation name the real signal?
- Does it avoid generic fallback?
- Does it avoid template churn?
- Does it preserve domain priority?
- Does it avoid unsafe catch-up behavior?

## Non-goals

This document does not:

- implement automated tests
- define exact fixtures
- define final API response shape
- define all possible scenario combinations
- replace builder contract
- replace conflict priorities
- replace fallback rules
- replace explanation style rules

## Implementation guidance

Near-term work should:

1. Convert these scenarios into focused backend tests once builder contracts expose enough metadata.
2. Start with contract tests before UI tests.
3. Test fidelity and reason bits, not only returned session count.
4. Keep fixtures small and deterministic.
5. Add new scenarios when new template families are introduced.
6. Treat repeated weak fidelity as a first-class regression signal.

The goal is not to test that the planner can make something.

The goal is to test that it can make the right kind of something.
