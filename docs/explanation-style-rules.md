# Explanation Style Rules

## Purpose

This document defines style rules for user-facing explanation output in SovereignStrength.

It applies to explanations for:

- program recommendations
- template fit
- adaptive session changes
- reduced-day behavior
- hybrid coordination
- race-aware planning
- recovery-driven changes
- local-protection substitutions

The goal is to keep explanations concrete, short, product-driven, and tied to real planning signals.

Correct logic can still feel untrustworthy if the app explains itself like a generic AI coach trapped in a motivational calendar.

## Core rule

Every explanation should answer at least one of these questions:

- Why was this template selected?
- Why was this session changed?
- What signal caused the change?
- What was preserved?
- What should the user do differently today?

If an explanation answers none of those, delete it.

## Voice principles

Explanations should be:

1. **Concrete**
   - refer to actual user signals, template roles, recovery state, event proximity, equipment, or schedule constraints

2. **Short**
   - usually one sentence
   - rarely more than two sentences

3. **Specific**
   - name the relevant training domain or session role when useful

4. **Calm**
   - avoid drama, hype, shame, or faux inspiration

5. **Product-driven**
   - explain the plan logic, not general fitness philosophy

6. **Distinct**
   - different templates should not all sound the same

7. **Actionable**
   - tell the user what changed or what the session is meant to accomplish

## What to avoid

Avoid:

- generic motivation
- wellness filler
- vague readiness language
- pseudo-medical claims
- overexplaining obvious things
- apologizing for adaptations
- sounding like a chatbot
- explaining every tiny internal detail
- turning deterministic decisions into mystical coaching wisdom

Bad patterns:

- “This plan supports your journey.”
- “Today is about honoring your body.”
- “Your workout was optimized.”
- “This session was adjusted based on your readiness.”
- “Listen to your body and do your best.”
- “You are doing great.”
- “This program aligns with your goals.”

These are not explanations. They are scented candles with variables.

## Required ingredients

A strong explanation should include two or three of these ingredients:

- selected template
- user goal
- user level
- weekly availability
- equipment context
- recovery signal
- local irritation signal
- fatigue pressure
- session role
- domain priority
- event proximity
- event priority
- adaptation action
- preserved identity

Do not include all of them. This is UI copy, not a police report.

## Length rules

### Preferred length

Most explanations should be:

- 12 to 25 words
- one sentence
- direct and readable

Example:

> Chosen because you want 5K completion and still need a gradual distance build.

### Maximum normal length

Two short sentences are acceptable when explaining a meaningful adaptation.

Example:

> The interval session was reduced because recent recovery is low. The quality-run role is still preserved.

### Avoid

Avoid paragraph-length explanations in normal UI.

Longer explanations belong in expandable detail, debug output, or documentation.

## Signal-based wording

Use actual planning signals.

Good:

> Chosen because your current running tolerance fits a run-walk start.

> Lower-body volume was reduced to protect tomorrow’s key run.

> The long run was shortened because recent recovery did not support another increase.

Bad:

> Chosen because it is right for you.

> Lower-body work was adjusted for balance.

> The run was optimized for performance.

If the explanation cannot name a signal, the decision may not be explainable enough.

## Recommendation explanations

Recommendation explanations should say why a template fits better than nearby alternatives.

They should usually mention:

- goal
- level or tolerance
- weekly frequency
- recovery or re-entry context if relevant
- domain priority if hybrid
- event intent if relevant

### Good recommendation examples

> Chosen because you want general strength with two weekly sessions and simple progression.

> Chosen because you are returning after a break and need lower-fatigue strength work first.

> Chosen because your goal is 5K completion, not pace improvement.

> Chosen because running is secondary and the week needs to protect strength recovery.

> Chosen because your event is soon enough that race-specific work now matters.

### Bad recommendation examples

> This program matches your goals.

> This is a balanced plan for you.

> This is a smart choice.

> This template is suitable and effective.

Those say almost nothing. Impressively efficient in their uselessness.

## Adaptation explanations

Adaptation explanations should say:

- what changed
- why it changed
- what role or identity was preserved

### Good adaptation examples

> Reduced interval density because recent recovery is low, while keeping the 5K quality-run role.

> Swapped heavy hinging for lower-stress posterior-chain work because hip irritation was reported.

> Shortened the long run because recovery did not support another distance increase.

> Made this an easy-only week because fatigue signals are high, but kept the base-building structure.

### Bad adaptation examples

> Adjusted based on recovery.

> Changed to fit today.

> Modified for safety.

> Your session has been optimized.

These are fog machines with buttons.

## Fit explanations versus daily explanations

Do not mix template-fit explanations with daily-adjustment explanations unless the UI clearly needs both.

### Fit explanation

Explains why the user got the template.

Example:

> Chosen because you want steady aerobic development without race-specific pressure.

### Daily explanation

Explains why today’s session changed.

Example:

> Today’s run was shortened because recent recovery did not support the planned duration.

### Combined explanation

Use only when necessary.

Example:

> This remains a 5K Finish week, but today’s run uses run-walk because your tolerance signal is low.

## Strength explanation rules

Strength explanations should refer to:

- training goal
- level
- weekly sessions
- equipment
- progression model
- fatigue profile
- movement role
- local protection signal when relevant

### Good strength examples

> Chosen because you want simple full-body strength twice per week.

> Load progression was held because repeated poor recovery outweighed the positive trend.

> Squat work was replaced with a lower-stress pattern because hip irritation was reported.

> Accessories were reduced before changing the main lift role.

### Bad strength examples

> This workout builds strength.

> Your muscles need recovery.

> The plan was adjusted to support performance.

> This is a good full-body option.

A label is not an explanation. Humanity continues to struggle with this.

## Running explanation rules

Running explanations should refer to:

- current running tolerance
- goal: base, completion, performance, re-entry, event prep
- session role: easy, run-walk, quality, threshold, long run
- impact or fatigue signal
- event timing where relevant

### Good running examples

> Chosen because your current tolerance fits a run-walk starting point.

> Chosen because your goal is 5K completion rather than pace improvement.

> Reduced pace demand to keep the quality session without overloading recovery.

> The long run was preserved but shortened because recovery is low.

### Bad running examples

> This run improves cardio.

> Run at a comfortable pace and enjoy.

> The session was tailored to your fitness.

> This supports your endurance journey.

No. Absolutely not. We are building software, not writing the back of a herbal tea box.

## Hybrid explanation rules

Hybrid explanations should make domain priority clear.

They should say whether the plan is:

- strength-first
- run-first
- balanced
- support-focused
- event-priority

### Good hybrid examples

> Chosen because you want both strength and running and can train four times per week.

> Lower-body strength volume was reduced to protect the key run.

> Running stays low-dose here because strength is the primary goal.

> This week progresses running while holding strength because recovery is limited.

### Bad hybrid examples

> This plan balances strength and cardio.

> Your training was adjusted across domains.

> The week supports overall fitness.

> Strength and running were optimized together.

“Optimized together” is what software says when it has no idea what tradeoff it made.

## Race-aware explanation rules

Race-aware explanations should mention:

- event type
- event priority
- event proximity or phase
- key session protection
- taper or freshness logic
- strength reduction when relevant

### Good race-aware examples

> Lower-body strength was reduced because your 5K event is close and freshness matters more this week.

> This week protects the long run because the half marathon goal is primary.

> Event priority is low, so the plan keeps your broader strength balance.

> The taper reduces workload while preserving race-specific sharpness.

### Bad race-aware examples

> Your race plan was optimized.

> The plan now focuses on performance.

> Training was adjusted for your event.

> This week prepares you for race day.

These sound like a brochure written by a treadmill.

## Reduced-day explanation rules

Reduced-day explanations should say what was preserved and what was dropped.

Good:

> The week keeps both domains but drops optional accessories because only three sessions are available.

> The key run was kept, while secondary strength volume was reduced.

> This reduced week preserves the full-body pattern but lowers total volume.

Bad:

> Your week was adjusted because you have less time.

> The plan was shortened.

> We optimized your weekly schedule.

A calendar conflict is not a personality trait. Say what changed.

## Local protection explanation rules

When adapting for irritation or local load, explain:

- the affected area
- the changed movement/session
- the preserved role

Good:

> Knee-dominant work was reduced because knee irritation was reported, while keeping a lower-body role.

> Push volume was reduced because shoulder irritation was reported.

> The run was changed to lower-impact conditioning because lower-leg irritation was reported.

Bad:

> Adjusted for discomfort.

> Changed to protect you.

> Your body needs care.

Also avoid unsupported medical claims.

Do not say:

- prevents injury
- treats pain
- fixes back pain
- protects joints completely
- safe for everyone

Use planning language, not medical certainty.

## Template identity explanation rules

When adaptation changes a meaningful session role, explain what identity remains.

Good:

> The interval count was reduced, but this remains the week’s 5K quality session.

> The long run was shortened, but the half-marathon long-run role is preserved.

> Accessories were dropped so the main strength pattern could stay.

Bad:

> Session adjusted.

> Role preserved.

> Template maintained.

Do not name internal concepts unless the wording is useful to the user.

## Reason codes and explanation bits

Internal reason codes should be short and stable.

Examples:

- `low_recovery`
- `high_fatigue_pressure`
- `local_irritation`
- `reduced_time`
- `compressed_week`
- `event_proximity`
- `domain_conflict`
- `equipment_limit`
- `template_switch_suggested`

User-facing explanation should be generated from stable reason bits, not hand-written one-off strings scattered through the code like breadcrumbs for future suffering.

## Tone constraints

Use:

- plain language
- short sentences
- concrete nouns
- actual training terms when useful
- calm confidence

Avoid:

- hype
- shame
- therapy-speak
- pseudo-medicine
- unexplained jargon
- marketing language
- “AI coach” personality
- emotional padding

The app should sound like a clear training tool, not a motivational intern.

## Good versus bad table

| Context | Good | Bad |
|---|---|---|
| Strength fit | Chosen because you want simple full-body strength twice per week. | This plan supports your strength journey. |
| Re-entry | Chosen because recent training has been limited and the plan keeps fatigue low. | This plan gently honors where you are. |
| Running fit | Chosen because your goal is 5K completion, not pace improvement. | This plan helps you become a better runner. |
| Hybrid | Running stays low-dose because strength is the primary goal. | This plan balances your fitness. |
| Race-aware | Lower-body strength was reduced because your event is close. | Your training was optimized for race day. |
| Reduced week | The key run stays; optional accessories were dropped. | Your week was adjusted to fit your schedule. |
| Local protection | Squat work was replaced because knee irritation was reported. | This protects your knees. |

## Review checklist

Before adding or changing explanation output, ask:

- Does it name the actual signal?
- Does it name what changed?
- Does it name what was preserved, if relevant?
- Is it shorter than it wants to be?
- Could the same sentence apply to five unrelated templates?
- Does it avoid vague wellness language?
- Does it avoid unsupported medical claims?
- Does it match the product logic?
- Does it help the user trust the decision?

If the sentence could be pasted into any fitness app, it is probably not specific enough.

## Non-goals

This document does not:

- implement UI copy
- define every final user-facing string
- define translation keys
- replace i18n review
- define exact reason-code schema
- replace clinical or safety guidance
- replace template identity rules
- replace adaptive builder contract

## Implementation guidance

Near-term implementation should:

1. Use stable reason codes.
2. Generate short explanation bits from product signals.
3. Keep fit explanations separate from daily adaptation explanations.
4. Make hybrid and event tradeoffs explicit.
5. Avoid generic “optimized for you” wording.
6. Test explanations for specificity.
7. Review copy when adding new template families.

The goal is not to make the app chatty.

The goal is to make the app understandable without sounding like it has joined a productivity cult.
