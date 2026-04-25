# Template Identity Rules

## Purpose

This document defines how SovereignStrength should preserve program template identity when sessions are adapted because of fatigue, recovery, irritation, schedule pressure, reduced time, hybrid conflicts, or event proximity.

It complements:

- `docs/program-template-taxonomy.md`
- `docs/strength-template-taxonomy.md`
- `docs/running-template-taxonomy.md`

The taxonomy explains how templates differ.

This document explains what must remain true when the planner modifies them.

A valid workout is not automatically a faithful workout. That distinction matters unless the goal is to build a very confident randomizer wearing a coaching hoodie.

## Core principle

A template remains itself only if its primary training intent, key session roles, and progression identity are still visible after adaptation.

Adaptation may change:

- load
- volume
- duration
- exercise selection
- session order
- intensity density
- weekly emphasis

Adaptation should not erase:

- the template family
- the primary goal
- the key session roles
- the domain priority
- the progression logic
- the user-facing reason for why the template was selected

If the system cannot preserve the template’s identity under current constraints, it should recommend a different template or enter a temporary reduced mode rather than silently pretending nothing changed.

## Identity layers

Template identity has three layers.

### 1. Essential markers

These define what the template is.

If these disappear, the template no longer fits.

Examples:

- 5/3/1-style strength keeps a primary lift-of-the-day structure
- GZCL-style strength keeps tiered T1/T2/T3 roles
- Run Start keeps run-walk on-ramp logic
- 5K Performance keeps at least one quality-session role
- Half Marathon keeps long-run centrality
- Hybrid Base keeps both strength and running as meaningful domains

### 2. Flexible elements

These may change while preserving identity.

Examples:

- load
- reps
- sets
- accessory choice
- session duration
- easy-run duration
- interval count
- exercise variation
- order within a session
- whether a session is slightly easier or shorter

### 3. Removable elements

These should be removed before essential markers are broken.

Examples:

- optional accessories
- extra conditioning
- secondary hypertrophy volume
- optional strides
- optional easy mileage
- non-key assistance work
- low-priority finishers
- redundant core work

## Downgrade-before-remove rule

When adapting a template, the system should downgrade before removing.

Preferred order:

1. Reduce optional work.
2. Reduce volume.
3. Reduce intensity.
4. Swap to a lower-stress variation.
5. Shorten the session.
6. Defer a non-key session.
7. Replace a session with a fallback that preserves the same role.
8. Recommend a different template if the core role cannot be preserved.

Do not immediately delete the session role because the week is inconvenient. Software already has enough ways to disappoint people.

## Adaptation actions

### Reduce

Use when the session role still fits, but the stress dose is too high.

Examples:

- fewer sets
- lower load
- fewer intervals
- shorter run
- less dense assistance work
- lower RPE target

### Replace

Use when the original content is inappropriate, but a role-equivalent substitute exists.

Examples:

- barbell squat to goblet squat
- interval run to controlled fartlek
- tempo run to steady aerobic progression
- deadlift variation to hinge pattern with lower load
- push movement to shoulder-friendlier push variation

Replacement should preserve the role, not just fill the slot.

### Defer

Use when the session is important but poorly timed.

Examples:

- key run too close to heavy lower-body fatigue
- long run blocked by low readiness
- high-priority lift after poor recovery
- race-specific session during acute irritation

Defer only when the weekly structure can still remain coherent.

### Switch template

Use when the user’s constraints repeatedly prevent the selected template from functioning.

Examples:

- 5K Performance repeatedly becomes easy running
- Half Marathon cannot preserve long-run progression
- Hybrid Base repeatedly loses one domain
- intermediate strength repeatedly degrades to beginner re-entry work
- high-fatigue template repeatedly conflicts with recovery context

When this happens, the problem is not one bad day. The template no longer fits reality. Reality is annoying like that.

## Strength template identity rules

### Foundational full-body strength

Examples:

- beginner full-body
- base strength 2x
- general strength 3x

Essential markers:

- full-body pattern coverage
- simple progression
- manageable fatigue
- clear main movements
- repeatable weekly structure

Flexible elements:

- specific exercise variation
- accessory choice
- set count
- load
- rep target
- session duration

Removable elements:

- optional accessories
- finishers
- redundant isolation work
- extra core volume

Downgrade before removing:

- reduce accessory volume before removing main patterns
- reduce load before removing the movement role
- replace a painful variation with a similar movement pattern before dropping the pattern

Switch template when:

- the user repeatedly cannot tolerate full-body loading
- local protection removes too many major patterns
- recovery context repeatedly forces minimal-dose work

### Novice linear strength templates

Examples:

- Greyskull-style LP
- beginner/novice linear progression

Essential markers:

- repeated practice of primary lifts or movement patterns
- simple load or rep progression
- clear progression feedback
- moderate technical consistency

Flexible elements:

- exact accessory selection
- small load jumps
- rep target ranges
- secondary movement choices

Removable elements:

- optional accessories
- additional conditioning
- non-essential hypertrophy work

Downgrade before removing:

- reduce jump size before holding progression completely
- reduce accessory fatigue before changing main lift progression
- use role-equivalent substitutions before deleting primary movement patterns

Switch template when:

- recovery repeatedly blocks linear progression
- local irritation prevents repeated exposure to key patterns
- the user needs lower complexity or lower fatigue

### Intermediate strength templates

Examples:

- 5/3/1-style strength
- GZCL-style full-body
- more structured strength templates

Essential markers:

- clear primary lift or tier roles
- planned intensity distribution
- support work that serves the main lift structure
- progression model distinct from beginner linear progression

Flexible elements:

- assistance volume
- secondary variations
- training max adjustments
- backoff work
- session duration

Removable elements:

- low-priority assistance
- finishers
- extra hypertrophy accessories
- optional conditioning

Downgrade before removing:

- reduce assistance before changing the primary lift role
- reduce backoff volume before deleting the main lift
- preserve T1/T2/T3 hierarchy in GZCL-style templates
- preserve lift-of-the-day identity in 5/3/1-style templates

Switch template when:

- the structure repeatedly collapses into generic full-body work
- recovery cannot support the intensity model
- the user cannot maintain the required session frequency or tracking demand

### Hypertrophy templates

Essential markers:

- sufficient volume for target muscle groups
- clear split or role structure
- manageable proximity-to-failure logic
- repeated exposure for growth-oriented work

Flexible elements:

- exercise variation
- isolation choices
- set count
- rep ranges
- session order

Removable elements:

- redundant isolation
- optional finishers
- extra pump work
- low-priority accessories

Downgrade before removing:

- reduce low-priority isolation before removing core volume
- replace painful exercises with same-muscle alternatives
- reduce intensity density before abandoning the split structure

Switch template when:

- available weekly frequency is too low
- recovery repeatedly prevents sufficient volume
- local irritation removes too many target-region options

### Low-fatigue / re-entry strength templates

Essential markers:

- low recovery cost
- conservative progression
- confidence-building structure
- movement exposure without aggressive loading
- easy repeatability

Flexible elements:

- load
- movement variation
- total volume
- session duration
- progression pace

Removable elements:

- optional accessories
- advanced progressions
- conditioning add-ons

Downgrade before removing:

- keep the movement habit before chasing progression
- reduce load and volume before dropping the session
- repeat weeks without treating it as failure

Switch template when:

- the user consistently tolerates more load and wants progression
- the template no longer provides enough training stimulus

## Running template identity rules

### Run Start 2x

Essential markers:

- low-barrier entry
- run-walk structure
- habit and tolerance focus
- no performance pressure
- conservative progression

Flexible elements:

- walk/run ratio
- total duration
- number of intervals
- pace guidance
- repeat-week behavior

Removable elements:

- optional faster segments
- optional extra walking volume
- non-essential cues

Downgrade before removing:

- increase walking before removing the session
- shorten total time before removing run-walk exposure
- repeat the week before progressing

Switch template when:

- the user can consistently run continuously
- the user wants a 5K completion structure
- the template becomes too easy for too long

### Base Run 2-3x

Essential markers:

- easy-dominant aerobic development
- general habit formation
- sustainable progression
- no strong race-specific identity

Flexible elements:

- run duration
- weekly frequency within range
- optional light fartlek
- easy-only weeks
- distance versus duration emphasis

Removable elements:

- optional faster segments
- optional third run
- non-key mileage

Downgrade before removing:

- make the week easy-only before dropping runs
- reduce duration before removing aerobic exposure
- preserve the base-building role

Switch template when:

- the user wants a concrete completion goal
- performance or race specificity becomes primary
- recovery requires re-entry logic

### Re-entry Run 2x

Essential markers:

- return-to-running logic
- tolerance rebuild
- easy intensity
- conservative ramp
- protection from load spikes

Flexible elements:

- run-walk ratio
- session duration
- progression speed
- repeated weeks

Removable elements:

- optional continuous segments
- optional second-session progression
- any pace-focused work

Downgrade before removing:

- regress toward walk-heavy sessions
- repeat weeks freely
- reduce volume before removing consistency

Switch template when:

- readiness stabilizes
- irritation is no longer active
- the user is ready for Base Run or 5K Finish

### 5K Finish 2-3x

Essential markers:

- completion-oriented 5K goal
- continuous-running tolerance
- distance-first progression
- confidence and pacing control
- accessible event-like structure

Flexible elements:

- run-walk fallback
- session duration
- weekly frequency
- simple event-week reduction
- interval fragments

Removable elements:

- optional pace work
- optional third session
- non-essential faster segments

Downgrade before removing:

- preserve completion path before adding speed
- reduce intensity before reducing distance exposure
- use run-walk fallback before abandoning the goal session

Switch template when:

- the user can already complete 5K comfortably and wants speed
- the user has no completion intent and wants general base running
- recovery requires re-entry

### 5K Performance 3x

Essential markers:

- 5K pace-improvement intent
- distance competence assumed
- quality session identity
- controlled interval or threshold work
- easy support run

Flexible elements:

- interval count
- pace target
- density
- tempo duration
- session order

Removable elements:

- optional extra volume
- optional strides
- non-key easy mileage

Downgrade before removing:

- reduce interval density before replacing quality work
- reduce pace demand before deleting the session role
- preserve at least one quality-session role when possible

Switch template when:

- quality work repeatedly becomes generic easy running
- the user cannot tolerate 3 weekly run sessions
- completion, not performance, is the actual goal

### 10K Performance 3x

Essential markers:

- 10K-specific endurance and pacing
- sustained work
- meaningful longer easy run
- balance of quality and endurance

Flexible elements:

- sustained interval length
- threshold duration
- long-run duration
- easy-run volume

Removable elements:

- optional speed work
- optional extra mileage
- non-key pace segments

Downgrade before removing:

- preserve sustained-work role before adding speed
- protect the longer easy run when possible
- reduce load growth before deleting endurance structure

Switch template when:

- the user’s goal is actually 5K speed
- long-run progression cannot be preserved
- the user needs base or re-entry running

### Half Marathon Base / Performance 3-4x

Essential markers:

- long-run centrality
- longer-distance endurance development
- event or distance-specific preparation
- fatigue management around long sessions

Flexible elements:

- long-run duration
- easy-run count
- threshold emphasis
- base versus performance flavor
- taper timing

Removable elements:

- optional fourth run
- optional light quality work
- non-key easy mileage

Downgrade before removing:

- protect long-run role unless recovery clearly overrides it
- reduce quality work before deleting long-run progression
- reduce optional mileage before changing the template family

Switch template when:

- long-run centrality cannot be preserved
- the user cannot tolerate 3-4 run sessions
- the goal is better served by 10K, Base Run, or Re-entry Run

### Hybrid Run Support 1-2x

Essential markers:

- running is secondary but meaningful
- strength recovery is protected
- low-dose conditioning role
- low interference with lower-body strength

Flexible elements:

- 1 or 2 sessions
- easy versus controlled faster support
- duration
- impact dose

Removable elements:

- optional second run
- optional faster segments
- extra conditioning

Downgrade before removing:

- downgrade to easy conditioning before deleting running entirely
- reduce impact before removing the run role
- protect strength-first identity

Switch template when:

- running becomes a primary goal
- the user wants 5K or 10K progression
- strength no longer needs priority protection

## Hybrid template identity rules

### Hybrid Base 2+2

Essential markers:

- two meaningful strength sessions
- two meaningful running sessions
- balanced domain priority
- moderate total fatigue
- coordinated lower-body stress

Flexible elements:

- exact session order
- run intensity distribution
- strength exercise variation
- volume per domain
- which domain progresses first in a constrained week

Removable elements:

- optional accessories
- optional extra run intensity
- finishers
- redundant core work

Downgrade before removing:

- reduce optional strength and run work before removing a domain
- reduce one domain’s progression pressure before deleting the domain
- preserve both-domain identity whenever possible

Switch template when:

- one domain is repeatedly removed
- the user is clearly strength-first or run-first
- four weekly sessions are not realistic

### 5K Hybrid Performance

Essential markers:

- running performance is primary
- strength remains meaningful but secondary
- key running sessions are protected
- lower-body strength fatigue is controlled
- event-aware behavior can fit naturally

Flexible elements:

- lower-body strength volume
- upper-body strength emphasis
- optional easy run
- quality-run density
- taper timing

Removable elements:

- lower-priority leg assistance
- optional hypertrophy volume
- optional easy mileage
- finishers

Downgrade before removing:

- reduce lower-body strength stress before compromising key runs
- preserve at least minimal strength identity
- reduce run quality density before deleting quality role entirely

Switch template when:

- race/performance intent is not primary
- strength-first identity matters more
- key run protection cannot be preserved

## Race-aware template identity rules

Essential markers:

- event intent remains visible
- event priority influences planning
- phase affects emphasis
- taper or event-week behavior is possible where relevant
- key sessions are protected based on event goal

Flexible elements:

- exact taper length
- session duration
- intensity density
- strength volume near event
- support-session order

Removable elements:

- optional accessories
- low-priority mileage
- secondary quality
- non-essential strength volume

Downgrade before removing:

- reduce support work before key event-specific work
- reduce lower-body strength before race-critical sessions
- preserve event phase explanation

Switch template when:

- event priority is too low to drive planning
- the user cannot support the event demands
- the event date makes the selected template unrealistic

## Cross-domain conflict rules

When two identities conflict, prioritize in this order unless the user explicitly chose otherwise:

1. Safety and recovery
2. Current local irritation or pain-related protection
3. Explicit event priority
4. Template identity
5. Primary domain priority
6. Weekly schedule feasibility
7. Secondary goals
8. Optional volume

This is not permission to erase a template every time the week gets awkward.

It means conflict resolution should be intentional and explainable.

## Explanation requirements

Any adaptation that changes a key session role should produce a reason that says:

- what changed
- why it changed
- what identity was preserved
- whether the change is temporary or suggests a poor template fit

Good examples:

> Reduced interval density to preserve the 5K quality-session role while respecting poor recovery.

> Replaced heavy hinge work with lower-stress posterior-chain work to preserve the strength role without adding excessive lower-body fatigue before the key run.

> Kept the long-run role but shortened the duration because recovery did not support the planned increase.

Bad examples:

> Adjusted workout.

> Recovery considered.

> Session changed to match your readiness.

Those are not explanations. They are fog machines with buttons.

## Review checklist

Before implementing adaptive builder logic, ask:

- What is the selected template?
- What are its essential markers?
- Which elements are flexible?
- Which elements are removable?
- Is this a reduce, replace, defer, or switch case?
- What identity is being preserved?
- What identity is being sacrificed?
- Is the reason visible to the user?
- Would this template still be recognizable after several weeks of similar adaptations?

## Non-goals

This document does not:

- implement builder logic
- implement recommendation logic
- implement scheduling logic
- define exact taper formulas
- define exact substitution maps
- replace local protection rules
- replace progression rules
- replace scenario-based regression tests

## Implementation guidance

Near-term builder work should:

1. Load template metadata before adapting sessions.
2. Identify the session role before changing content.
3. Remove optional work before essential work.
4. Preserve domain priority in hybrid templates.
5. Preserve long-run and quality-session roles in race templates unless recovery clearly overrides them.
6. Emit reason codes for changes that affect key roles.
7. Recommend template switch when repeated adaptation erases template identity.

The goal is simple: adapt the plan without deleting the reason the plan existed.
