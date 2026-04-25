# Adaptive Plan-Builder Contract

## Purpose

This document defines the architectural contract for SovereignStrength's adaptive plan builder.

It explains what the builder must preserve when it modifies sessions or weeks because of fatigue, recovery, irritation, reduced time, schedule pressure, hybrid conflicts, or event proximity.

It complements:

- `docs/program-template-taxonomy.md`
- `docs/template-identity-rules.md`
- `docs/strength-template-taxonomy.md`
- `docs/running-template-taxonomy.md`

The taxonomy defines template identity.

The identity rules define what must remain true for a template to still count as itself.

This contract defines the builder's responsibilities when turning that identity into an actual week or session.

## Core contract

The adaptive builder must produce plans that are:

1. **Valid**
   - safe enough for the current constraints
   - structurally complete enough to execute
   - compatible with available time, equipment, and recovery context

2. **Faithful**
   - still recognizably based on the selected template
   - aligned with the template's primary goal
   - preserving essential session roles where possible

3. **Explainable**
   - able to say what changed and why
   - able to say what was preserved
   - able to say when repeated adaptation suggests a poor template fit

A valid plan that erases template identity is not good enough.

That is not adaptation. That is a polite randomizer in training shoes.

## Builder responsibilities

The builder is responsible for preserving:

- template identity
- primary goal
- domain priority
- key session roles
- progression intent
- role hierarchy
- fatigue logic
- local-protection intent
- hybrid coordination
- event priority where relevant
- user-facing explanation consistency

The builder is also responsible for refusing to pretend a template still fits when repeated adaptation destroys its purpose.

## What the builder may change

The builder may change:

- session duration
- load
- reps
- sets
- run duration
- interval count
- pace or intensity target
- exercise variation
- optional accessories
- optional conditioning
- secondary volume
- weekly session order
- non-key session emphasis
- support-session content

The builder may also defer or replace sessions when constraints make the original version inappropriate.

## What the builder must not change casually

The builder must not casually change:

- the selected template family
- the primary training goal
- the intended domain priority
- key session roles
- progression model
- event priority
- hybrid balance
- essential role hierarchy
- long-run centrality in longer-distance templates
- quality-session identity in performance running templates
- low-dose identity in re-entry or hybrid-support templates

Changing these requires either:

- a clear temporary adaptation reason, or
- a template switch recommendation.

## Validity versus fidelity

The builder must distinguish between:

- **validity**: can this plan be executed today?
- **fidelity**: does this plan still represent the selected template?

A session can be valid and still be wrong.

Example:

- Replacing a 5K Performance quality session with an easy run may be valid.
- Doing that repeatedly means the 5K Performance template is no longer being preserved.

Example:

- Removing lower-body strength before a key race week may be valid and faithful for a run-priority hybrid plan.
- Removing all running from a balanced hybrid plan is not faithful unless explicitly temporary.

The builder should optimize for both validity and fidelity.

When they conflict, the builder must degrade intentionally and explain the tradeoff.

## Adaptation order

When constraints appear, the builder should adapt in this order:

1. Preserve safety and recovery.
2. Preserve the selected template's essential markers.
3. Preserve key session roles.
4. Reduce optional work.
5. Reduce volume.
6. Reduce intensity.
7. Replace content with role-equivalent alternatives.
8. Defer non-key sessions.
9. Defer key sessions only when necessary.
10. Recommend template switch if fidelity repeatedly fails.

This order is not a mechanical algorithm. It is a review standard.

If implementation violates it, the code should explain why. Preferably before it becomes archaeology.

## Adaptation actions

### Reduce

Use when the session role is still appropriate, but the planned dose is too high.

Examples:

- fewer strength sets
- lower load
- fewer intervals
- shorter easy run
- shorter long run
- less accessory volume
- lower pace demand
- lower density

Reduce should preserve the role.

### Replace

Use when the original content is unsuitable, but a role-equivalent substitute exists.

Examples:

- barbell squat to goblet squat
- deadlift to lower-stress hinge
- interval run to controlled fartlek
- tempo run to steady aerobic work
- high-impact run to lower-impact aerobic substitute

Replace should preserve the reason the session exists.

### Defer

Use when the session role is important but poorly timed.

Examples:

- key run too close to heavy lower-body work
- long run during unusually poor readiness
- heavy strength session during acute local irritation
- race-specific work during a compressed week

Deferral should keep the week coherent.

### Switch template

Use when the current template repeatedly cannot function under real constraints.

Examples:

- balanced hybrid repeatedly loses one domain
- 5K Performance repeatedly becomes easy-only running
- Half Marathon repeatedly loses long-run progression
- intermediate strength repeatedly collapses into re-entry work
- low-frequency availability cannot support the selected structure

A switch is not failure. It is the system noticing reality. We should encourage that rare behavior.

## Required builder inputs

Before adapting a plan, the builder should know:

- selected template id
- template family
- template domain
- primary goal
- supported weekly structure
- session roles
- progression model
- fatigue profile
- complexity
- recovery sensitivity
- adaptive tolerance
- hybrid profile where relevant
- event capability where relevant
- user recovery context
- local protection signals
- available weekly sessions
- available session duration
- equipment profile
- event priority and proximity where relevant

If a required input is missing, the builder should degrade conservatively and expose that limitation in metadata or explanation output.

## Required builder outputs

The builder should return enough information for review, UI, and tests to understand the decision.

At minimum, adaptive outputs should expose:

- selected template id
- generated session roles
- preserved essential markers
- changed elements
- adaptation action
- adaptation reason code
- user-facing explanation text or explanation bits
- whether template fidelity was preserved
- whether the change is temporary
- whether a template switch should be considered
- warnings when fidelity is weak

Do not hide adaptive decisions inside vague text. That is how bugs become vibes.

## Template fidelity levels

The builder should classify fidelity after adaptation.

### Full fidelity

The plan preserves essential markers and normal progression identity.

Example:

- 5K Performance keeps quality-session role and easy support run.
- GZCL keeps tier structure.
- Hybrid Base keeps both strength and running.

### Reduced fidelity

The plan preserves essential markers but reduces dose or ambition.

Example:

- fewer intervals but still a quality session
- shorter long run but still long-run role
- reduced accessories but primary lift remains
- balanced hybrid preserves both domains but only progresses one

### Weak fidelity

The plan barely preserves identity and should warn or explain clearly.

Example:

- performance running becomes mostly easy running for one week
- hybrid plan loses one domain for a temporary reason
- intermediate strength loses most structured support work

### Broken fidelity

The plan no longer represents the selected template.

Example:

- Run Start loses run-walk identity
- Half Marathon loses long-run centrality repeatedly
- Hybrid Base becomes pure strength or pure running
- 5K Performance has no quality-session role
- 5/3/1-style plan loses lift-of-the-day identity

Broken fidelity should trigger a switch recommendation or explicit reduced-mode state.

## Strength builder contract

For strength templates, the builder must preserve:

- main movement roles
- template-specific hierarchy
- progression model
- fatigue profile
- recovery-sensitive downgrade behavior
- meaningful pattern coverage

### Strength may change

- exercise variation
- load
- rep targets
- accessory volume
- order of secondary work
- assistance exercises

### Strength should not casually change

- main lift role
- full-body versus split identity
- tier hierarchy
- primary progression model
- re-entry versus normal progression behavior

### Strength degradation examples

Good:

- reduce accessories before removing squat/hinge/push/pull roles
- swap painful squat variation for a lower-stress squat pattern
- hold load progression when recovery pressure is high

Bad:

- delete all lower-body work without replacement
- turn structured intermediate work into random full-body exercises
- preserve exercise names while erasing progression logic

## Running builder contract

For running templates, the builder must preserve:

- session role
- easy versus quality distribution
- impact and tolerance logic
- distance or event intent
- run-walk identity where relevant
- long-run centrality where relevant
- quality-session identity where relevant

### Running may change

- duration
- distance
- interval count
- intensity target
- pace target
- run-walk ratio
- session order
- optional extra easy volume

### Running should not casually change

- completion versus performance intent
- long-run role
- quality-session role
- run-walk on-ramp role
- re-entry protection
- hybrid-support low-dose identity

### Running degradation examples

Good:

- reduce interval density before removing quality role
- shorten long run while preserving long-run role
- make Base Run easy-only under fatigue
- regress Re-entry Run toward walk-heavy structure

Bad:

- turn 5K Performance into generic easy running without explanation
- turn Base Run into accidental race prep
- progress both pace and volume aggressively under poor recovery
- erase long-run centrality in Half Marathon without switch warning

## Hybrid builder contract

For hybrid templates, the builder must preserve:

- domain priority
- both-domain identity where applicable
- lower-body fatigue coordination
- key session protection
- recovery-aware progression
- explanation of cross-domain tradeoffs

### Hybrid may change

- which domain progresses first
- lower-body accessory volume
- run intensity density
- optional support work
- weekly session order
- secondary domain dose

### Hybrid should not casually change

- balanced hybrid into pure strength
- balanced hybrid into pure running
- run-priority hybrid into strength-first planning
- strength-first hybrid into race plan
- key run or key lift protection without explanation

### Hybrid degradation examples

Good:

- reduce lower-body strength stress before a key run
- reduce run density after high lower-body fatigue
- progress one domain while holding the other
- preserve both domains at lower dose

Bad:

- delete running from Hybrid Base repeatedly
- delete strength from 5K Hybrid Performance entirely
- ignore lower-body fatigue conflict
- treat hybrid as two unrelated plans glued together with optimism

## Event-aware builder contract

For event-aware templates, the builder must preserve:

- event priority
- event phase
- key session protection
- taper behavior when relevant
- race-specific emphasis
- freshness tradeoffs near event day

### Event-aware may change

- strength volume near event
- quality density
- long-run timing
- support session dose
- accessory work
- taper shape

### Event-aware should not casually change

- event priority
- race-specific intent
- taper reason
- protected key sessions
- long-run or event-specific session roles

### Event-aware degradation examples

Good:

- reduce lower-body strength before race week
- protect the key run when event priority is high
- shorten support work while keeping race-specific role
- explain why taper reduced workload

Bad:

- keep normal high-fatigue lifting into race week without explanation
- erase taper because the generic builder wants volume
- ignore event priority
- treat primary and secondary events the same

## Conflict handling

When constraints conflict, the builder should use this priority order unless product rules explicitly override it:

1. Safety and recovery
2. Local irritation or pain-related protection
3. Explicit event priority
4. Template fidelity
5. Primary domain priority
6. Key session usefulness
7. Weekly schedule feasibility
8. Secondary goals
9. Optional volume
10. Cosmetic preference

This priority order should later align with `docs/planner-conflict-priorities.md`.

Until that document exists, this contract is the temporary reference.

## Explanation contract

The builder should emit explanation bits when it changes a plan.

A useful explanation should say:

- what changed
- why it changed
- what was preserved
- whether the change is temporary
- whether repeated changes suggest another template

Good examples:

- Reduced interval density to preserve the 5K quality-session role while respecting poor recovery.
- Shortened the long run but preserved the half-marathon long-run role.
- Reduced lower-body strength volume to protect the key run in a run-priority hybrid week.
- Held strength progression because recent recovery signals suggest repeated fatigue pressure.

Bad examples:

- Adjusted plan.
- Recovery considered.
- Changed because of readiness.
- Optimized your session.

Those are not explanations. They are software clearing its throat.

## Review requirements for implementation

Every future builder change should answer:

- Which template family is affected?
- Which session role is affected?
- Which identity marker is preserved?
- Which element is reduced, replaced, deferred, or removed?
- Which user signal triggered the adaptation?
- Does the output remain faithful to the selected template?
- Is the reason visible in metadata or user-facing explanation?
- Should repeated occurrence trigger a template switch?

If a PR cannot answer those questions, it is probably not a builder improvement. It is a plan blender with commit access.

## Regression requirements

Future tests should include scenarios where the builder must preserve fidelity under pressure.

Required scenario types:

- low readiness
- recent poor recovery
- local irritation
- compressed week
- reduced session duration
- hybrid lower-body conflict
- event proximity
- taper week
- repeated adaptation across weeks
- template switch threshold

The tests should verify not only that a plan exists, but that the right identity was preserved.

“Generated something” is not a test. It is a shrug with assertions.

## Non-goals

This document does not:

- implement the builder
- define exact algorithms
- define exact substitution maps
- define exact taper formulas
- replace local protection logic
- replace recommendation logic
- replace scenario regression tests
- decide every future template field

## Implementation guidance

Near-term implementation should:

1. Add or expose session roles before adapting sessions.
2. Use template metadata before applying generic fallback logic.
3. Apply downgrade-before-remove behavior.
4. Preserve template fidelity classification in internal metadata.
5. Emit reason codes for key adaptations.
6. Treat repeated weak fidelity as a signal for template switch.
7. Add tests that verify fidelity, not just validity.

The adaptive builder's job is not to make any plan.

It is to make the selected plan survive contact with reality without losing the reason it was selected.
