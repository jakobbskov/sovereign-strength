# Exercise Content Standard

## Purpose

This document defines the content architecture and writing standard for SovereignStrength exercise content.

It complements `docs/exercise-model-contract.md`.

- The model contract defines stable exercise metadata.
- This document defines how exercise content should be structured, written, reviewed, and expanded.

The goal is not to copy existing exercise sites. The goal is to learn from what works structurally while avoiding generic, bloated, or mechanically templated training content.

Exercise content in SovereignStrength must support the product’s core principles:

- deterministic planning
- calm guidance
- clear user action
- no fake expertise
- no filler
- no pseudo-technical noise
- no content that sounds generated for search engines rather than written for a person about to train

## Design principles

Exercise content should be:

1. **Short enough to use during training**
2. **Concrete enough to act on**
3. **Structured enough to scan**
4. **Specific enough to build trust**
5. **Flexible enough to avoid forced template sections**
6. **Consistent enough to scale the exercise library**

The user should be able to answer four questions quickly:

1. What is this exercise for?
2. How do I do it safely enough today?
3. What should I pay attention to?
4. Why did the system choose this exercise or variation?

## Relationship to the exercise model

The content standard builds on existing metadata fields such as:

- `id`
- `name`
- `name_en`
- `category`
- `movement_pattern`
- `difficulty_tier`
- `equipment_type`
- `input_kind`
- `local_load_targets`
- `progression_style`
- `progression_ladder`
- `form_cues`
- `form_cues_en`
- `notes`
- `notes_en`

Content should not invent new runtime logic casually.

If content needs a field that does not exist, that should become a separate model-contract issue rather than being smuggled into random exercise entries like a raccoon in a trench coat.

## Exercise content architecture

Exercise detail cards or future exercise pages should use the following architecture.

Not every exercise needs every section. Simple exercises should stay simple.

### 1. Identity

Purpose: make it immediately clear what the exercise is.

Recommended content:

- exercise name
- category
- equipment
- input type
- primary movement pattern

Example:

> Push-ups  
> Bodyweight horizontal push  
> Focus: controlled upper-body pressing with full-body tension.

### 2. Best for

Purpose: explain why the exercise exists in the system.

Use one to three short lines.

Good:

> Good for building basic pressing strength without equipment.  
> Useful when bench press is not available or when a lighter push variation is needed.

Bad:

> This exercise is a great way to activate your upper body and improve functional strength through a dynamic movement pattern that challenges multiple muscle groups.

That sentence walked into a gym and immediately asked where the content strategy meeting was.

### 3. Primary focus cue

Purpose: give the user one thing to prioritize.

Good:

> Keep the body in one line from shoulders to heels.

Bad:

> Engage your core and maintain optimal posture throughout the movement.

If the phrase could appear on any exercise page, it is probably too generic.

### 4. How to perform it

Purpose: provide usable step-by-step instruction.

Rules:

- one action per line
- preferably three to five steps
- no long paragraphs
- no decorative coaching language
- no unnecessary anatomy unless it improves execution

Good:

> Place your hands under your shoulders.  
> Keep your body in one line.  
> Lower your chest under control.  
> Press back up without letting the hips drop.

Bad:

> Begin in a strong and stable position, ensuring your body is properly aligned, then lower yourself with control while maintaining tension and return to the starting position.

That is not instruction. That is fog wearing gym shorts.

### 5. Good rep standard

Purpose: define when the rep counts.

Good:

> A good rep keeps the body line stable and reaches a controlled bottom position.

For timed holds:

> A good hold keeps the target position without collapsing or compensating.

### 6. Stop or regress condition

Purpose: tell the user when to stop or choose an easier version.

Good:

> Stop or choose an easier version if the hips sag, the shoulders pinch, or the movement becomes uncontrolled.

Timed hold example:

> End the set when you can no longer hold the position without shifting into the lower back.

This is especially important for local protection and fatigue-aware planning.

### 7. Common mistake

Purpose: name one likely failure mode.

Good:

> Letting the hips drop before the chest reaches the bottom position.

Bad:

> Poor form.

Useful. Like a map that says “somewhere”.

### 8. Easier version

Purpose: help the user regress safely.

This should not just list an exercise. It should explain when to use it.

Good:

> Use incline push-ups if floor push-ups make the body line break or the shoulders feel overloaded.

### 9. Harder version

Purpose: help the user progress without implying program-level replacement.

Good:

> Use pause push-ups when regular push-ups are controlled and the goal is more time under tension.

Important distinction:

- local harder/easier = adjustment of today’s exercise
- program-level change = handled through active program selection or program recommendation

Do not imply that pressing “harder” on incline push-ups automatically means switching to bench press. That is a different decision layer.

### 10. Related alternative

Purpose: offer a lateral option when useful.

Use this for:

- different equipment
- lower irritation
- lower fatigue
- same movement family
- different training goal

Good:

> Bench press is a loaded alternative when the current program uses gym equipment and pressing strength is the main goal.

### 11. Why selected today

Purpose: explain system choice in product language.

This section should be short and generated from plan context where possible.

Good examples:

> Selected because today calls for a lighter push variation.  
> Selected because shoulder/wrist load should stay lower today.  
> Selected because the current program uses bodyweight progression.

Bad:

> This exercise was chosen because it is beneficial for your goals.

Thank you, horoscope with dumbbells.

## Writing principles

### Write like a coach standing next to the user

Content should sound like:

> Keep the ribs down. Move slowly. Stop if the position collapses.

Not like:

> This movement enhances stability and develops neuromuscular coordination across multiple planes.

SovereignStrength should be precise, not pompous.

### Prefer visible cues

Good cues refer to something the user can feel, see, or control.

Good:

- “Keep the hips level.”
- “Stop before the lower back takes over.”
- “Lower until the chest is close to the surface.”
- “Press evenly through both hands.”

Weak:

- “Activate your core.”
- “Maintain optimal alignment.”
- “Use proper form.”
- “Stay engaged.”

### Avoid generic filler

Banned or strongly discouraged phrases:

- “tips and tricks”
- “unlock your potential”
- “activate your muscles”
- “perfect for all fitness levels”
- “this is the key”
- “engage your core” unless followed by a visible cue
- “proper form” without saying what proper means
- “functional strength” unless the function is named

### No SEO-padding

Exercise pages are not blog posts. They do not need long introductions.

Bad:

> In today’s fast-paced world, many people are looking for effective exercises that can help them build strength...

No. The user is trying to train, not read a municipal strategy document wearing Lycra.

### No fake certainty

Avoid medical or biomechanical claims that the app cannot support.

Bad:

> This exercise prevents back pain.

Better:

> This can train trunk control with low movement demand when performed calmly.

### No forced sections

If an exercise does not need a long explanation, do not add one.

A simple exercise may only need:

- best for
- primary cue
- how to perform
- common mistake
- easier/harder option

## Variation decision logic

Variation content should help users choose, not merely list exercises.

### Variation types

Use these categories:

1. **Easier**
   - less load
   - simpler position
   - shorter range
   - more support
   - lower coordination demand

2. **Harder**
   - more load
   - harder leverage
   - slower tempo
   - longer hold
   - less support
   - greater range

3. **Lower-fatigue alternative**
   - useful when the user can train but should reduce total cost

4. **Lower-irritation alternative**
   - useful when local protection or discomfort suggests avoiding a loaded region

5. **Different-equipment alternative**
   - same pattern, different available equipment

6. **Different-goal alternative**
   - same broad family, but different training emphasis

### Variation copy format

Use this format:

> Use [variation] when [condition] because [practical reason].

Examples:

> Use incline push-ups when floor push-ups break your body line because the raised hand position reduces the pressing demand.

> Use glute bridge instead of squat when knee load should stay lower because it keeps the work more hip-dominant.

> Use bench press when the program is gym-based and the goal is loaded horizontal pressing.

Bad:

> Variations include incline push-ups, diamond push-ups, and bench press.

That is a list. It does not help the user decide anything. A vending machine has more guidance.

## Instruction quality rules

Each exercise instruction set should pass these checks.

### Required quality checks

1. **Actionable**
   - Does each line tell the user what to do?

2. **Observable**
   - Can the user notice whether they are doing it?

3. **Specific**
   - Does it refer to the actual exercise, not generic movement fluff?

4. **Short**
   - Can it be read quickly during training?

5. **Controlled**
   - Does it include at least one cue for control, range, or stopping?

6. **Non-medical**
   - Does it avoid unsupported claims about injury prevention or treatment?

7. **Not template-forced**
   - Are all sections actually useful for this exercise?

### Stop condition requirement

Every exercise should have a stop or regress condition.

Examples:

- “Stop when the lower back starts to arch.”
- “Choose an easier version if the knees cave in repeatedly.”
- “End the hold when the target position collapses.”
- “Reduce load if the final reps become uncontrolled.”

## Scope by exercise type

### Simple bodyweight exercises

Examples:

- dead bug
- bird dog
- glute bridge
- incline push-ups

Content depth:

- very short
- practical
- no long theory
- one primary cue
- one common mistake
- one easier/harder path if useful

### Complex loaded lifts

Examples:

- squat
- bench press
- Romanian deadlift
- barbell row

Content depth:

- moderate
- include setup
- include execution
- include stop condition
- include load/progression caution
- include related alternatives

Do not turn this into a powerlifting textbook unless the product scope changes. The barbell already has enough mythology attached to it.

### Timed holds

Examples:

- plank
- side plank
- superman hold

Content depth:

- short
- define position
- define what counts as a good hold
- define stop condition
- distinguish target time from quality

Timed holds must not be written as if they are rep exercises wearing a fake moustache.

### Mobility or recovery movements

Content depth:

- calm and minimal
- focus on range, comfort, breathing only when relevant
- avoid therapeutic claims

Good:

> Move slowly through a comfortable range. Stop before the movement becomes forced.

Bad:

> This mobility drill releases tension and restores optimal movement.

No it does not. It moves a joint. Let’s all calm down.

### Machine exercises

Content depth:

- setup matters
- mention seat/handle position if relevant
- explain range and control
- avoid overexplaining muscle anatomy

### Cardio entries

Content depth:

- mostly purpose and intensity
- explain intended effort
- avoid pretending a generic cardio session is a technical exercise page

## Examples

### Dead bug

Good:

> **Best for:** trunk control with low load.  
> **Focus cue:** keep the lower back quiet while the arms or legs move.  
> **How:**  
> Lie on your back with arms up and knees bent.  
> Move one arm or leg slowly away.  
> Stop before the lower back lifts or the ribs flare.  
> Return with control.  
> **Common mistake:** moving too far and losing the back position.

Bad:

> Dead bug is an excellent core exercise that activates the abdominal muscles and improves stability, coordination, and functional strength. Keep your core engaged throughout the movement and focus on proper form.

This says almost nothing the user can actually do.

### Push-ups

Good:

> **Best for:** bodyweight horizontal pressing.  
> **Focus cue:** keep shoulders, hips, and heels moving as one line.  
> **How:**  
> Place your hands under your shoulders.  
> Lower the chest under control.  
> Press back up without letting the hips sag.  
> **Easier:** use incline push-ups if the body line breaks.  
> **Harder:** use pause push-ups when regular reps are controlled.

Bad:

> Push-ups are a classic and versatile exercise that can be performed anywhere and targets the chest, shoulders, triceps, and core while improving overall fitness.

Again: technically not false, practically close to useless.

### Plank

Good:

> **Best for:** holding trunk position under low movement.  
> **Focus cue:** hold the same shape from start to finish.  
> **How:**  
> Set elbows under shoulders.  
> Keep ribs and hips from dropping.  
> Breathe calmly if you can keep the position.  
> Stop the set when the lower back takes over.  
> **Good hold:** the position stays stable for the full target time.

Bad:

> Plank strengthens the core and improves stability. Engage your core and hold as long as possible.

“Hold as long as possible” is how people turn training into a quiet argument with their lumbar spine.

## Review checklist for new exercise content

Before adding or accepting exercise content, check:

- Does the exercise have a clear purpose?
- Is the primary cue specific and visible?
- Are instructions short enough to use during training?
- Is there a stop or regress condition?
- Are easier/harder variations explained by condition?
- Are alternatives decision-oriented rather than just listed?
- Is the language natural in Danish and English?
- Is the content free of generic AI-like phrasing?
- Does the content avoid unsupported medical claims?
- Does the content match the existing exercise model?
- Is the content proportionate to exercise complexity?

## Implementation guidance

Near-term implementation should prefer:

1. Improve exercise viewer copy using existing fields.
2. Audit `notes`, `notes_en`, `form_cues`, and `form_cues_en`.
3. Add missing content only where it improves user decisions.
4. Keep simple exercises short.
5. Use future issues for new schema fields if needed.

Do not expand exercise pages before the existing catalog can meet this writing standard. Scaling bad content only makes the app more confidently mediocre, which is apparently the internet’s main export.
