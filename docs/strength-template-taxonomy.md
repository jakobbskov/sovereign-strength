# Strength Template Taxonomy

## Purpose

This document defines the strength-specific taxonomy layer for SovereignStrength program templates.

It builds on `docs/program-template-taxonomy.md`.

- The shared taxonomy defines cross-domain template identity.
- This document defines the dimensions that make one strength template meaningfully different from another.

The goal is to prevent the strength library from becoming a pile of vaguely different full-body programs wearing different names and pretending that counts as product strategy.

## Why strength needs its own layer

Strength templates can differ by more than:

- weekly frequency
- exercise selection
- equipment
- session labels

A meaningful strength template also differs by:

- user readiness
- training age
- progression style
- session density
- fatigue tolerance
- goal emphasis
- acceptable complexity
- accessory dependence
- lower-body fatigue cost
- suitability for concurrent running or hybrid planning
- re-entry protection

If these distinctions are not explicit, recommendation logic becomes arbitrary and explainability becomes vague.

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
- equipment profile
- complexity
- hybrid profile
- event capability

This strength taxonomy narrows those dimensions for strength templates.

It should guide future strength program metadata, recommendation rules, and template audits without forcing an immediate migration of `programs.json`.

## Strength-specific dimensions

### 1. Training age and readiness

Describes how much training structure the user can realistically tolerate.

Recommended categories:

- `reentry`
- `beginner`
- `novice`
- `intermediate`

Interpretation:

- `reentry`: returning after interruption, low capacity, low confidence, or recent instability
- `beginner`: needs simple structure and low decision burden
- `novice`: can tolerate repeated progression and more stable weekly rhythm
- `intermediate`: needs more structure, volume management, or specialization

Existing related metadata:

- `recommended_levels`
- `good_for_reentry`
- `complexity`
- `fatigue_profile`

Guidance:

Do not infer readiness from strength alone.

A user may be strong enough for heavier training but not recovered enough, consistent enough, or technically prepared enough for a higher-fatigue template. Human bodies, inconveniently, are not spreadsheets with biceps.

### 2. Primary strength goal

Describes the main reason the strength template exists.

Recommended categories:

- `general_strength`
- `general_health`
- `hypertrophy`
- `reentry`
- `maintenance`
- `minimal_effective_dose`
- `strength_hypertrophy`
- `hybrid_support`

Existing related metadata:

- `supported_goals`
- `tags`
- `program_family`

Guidance:

The primary goal should shape volume, exercise selection, fatigue cost, and progression.

Examples:

- A `reentry` template should prioritize low barrier and low fatigue.
- A `hypertrophy` template may tolerate more volume and accessory work.
- A `maintenance` template should preserve strength with minimal recovery cost.
- A `hybrid_support` template should avoid interfering with running quality.

### 3. Session structure

Describes how strength work is organized inside the week.

Recommended categories:

- `full_body_foundation`
- `full_body_base`
- `reentry_full_body`
- `minimalist`
- `upper_lower_split`
- `primary_lift_emphasis`
- `tiered_strength`
- `hypertrophy_split`

Existing field:

- `training_style`

Guidance:

Session structure is one of the strongest signals that two strength templates are meaningfully different.

Examples:

- `full_body_foundation`: simple full-body training for beginners
- `full_body_base`: repeated full-body exposure with moderate structure
- `reentry_full_body`: low-demand full-body structure with conservative progression
- `minimalist`: few exercises, short duration, low decision burden
- `upper_lower_split`: separates upper and lower emphasis across more weekly slots
- `tiered_strength`: primary lift plus secondary and accessory tiers

### 4. Progression model

Describes how the template expects strength work to advance.

Recommended categories:

- `beginner_linear`
- `linear_load_then_reps`
- `double_progression`
- `linear_split_progression`
- `reentry_conservative`
- `minimal_dose_linear`
- `intermediate_upper_lower_linear`
- `intermediate_hypertrophy_volume`
- `maintenance_progression`
- `wave_or_block_progression`

Existing field:

- `progression_model`

Guidance:

Template-level progression does not replace exercise-level progression.

Template-level progression answers:

> What overall progression philosophy does this program follow?

Exercise-level progression answers:

> What should happen to this exercise next time?

Examples:

- `beginner_linear`: simple repeated increases when execution is acceptable
- `linear_load_then_reps`: progress load and reps within stable exercise roles
- `reentry_conservative`: hold or progress slowly unless consistency and recovery improve
- `intermediate_hypertrophy_volume`: use volume as a meaningful progression driver
- `maintenance_progression`: preserve capacity with minimal load escalation

### 5. Fatigue profile

Describes expected recovery cost from the template.

Recommended categories:

- `low`
- `low_to_moderate`
- `moderate`
- `moderate_to_high`
- `high`
- `reentry_protective`

Existing field:

- `fatigue_profile`

Guidance:

Fatigue profile should influence matching when the user has:

- low readiness
- inconsistent training history
- concurrent running
- local protection signals
- short session windows
- poor recent recovery
- high work/life load, because apparently humans insist on having lives outside training

Examples:

- `low`: short, simple, easy to recover from
- `moderate`: normal beginner/novice training demand
- `moderate_to_high`: more weekly work or more demanding structure
- `high`: substantial volume or frequency
- `reentry_protective`: explicitly designed to avoid early overload

### 6. Session density

Describes how much work is packed into each session.

Recommended categories:

- `low`
- `moderate`
- `high`

Potential future field:

- `session_density`

Existing related metadata:

- `session_duration_min`
- `session_duration_max`
- `days`
- `complexity`
- `fatigue_profile`

Guidance:

Session density is not the same as weekly frequency.

A 2x program can be high density if each session is long and demanding.
A 4x program can be moderate density if work is spread out.

Session density matters for:

- time budget
- adherence
- fatigue
- beginner usability
- reentry suitability

### 7. Complexity

Describes cognitive and logistical demand.

Recommended categories:

- `low`
- `moderate`
- `high`

Existing field:

- `complexity`

Strength-specific complexity includes:

- number of exercises
- need to track loads
- need to manage accessories
- technical lift demands
- split structure
- weekly planning burden
- progression rules

Guidance:

Low complexity should be favored for:

- reentry users
- beginners
- low motivation days
- limited session windows
- mixed training priorities

High complexity should only exist when the added structure improves the training result. Complexity for its own sake is just bureaucracy in gym clothes.

### 8. Accessory dependence

Describes how much the template relies on non-primary lifts to work as intended.

Recommended categories:

- `low`
- `moderate`
- `high`

Potential future field:

- `accessory_dependence`

Guidance:

Accessory dependence matters for:

- session duration
- hypertrophy emphasis
- equipment needs
- fatigue cost
- user overwhelm
- substitution tolerance

Examples:

- `low`: primary movements carry the program
- `moderate`: accessories support balance and volume
- `high`: accessories are central to the goal, often hypertrophy-oriented

### 9. Lower-body fatigue cost

Describes how much the template is likely to interfere with running or recovery through leg fatigue.

Recommended categories:

- `low`
- `moderate`
- `high`

Potential future field:

- `lower_body_fatigue_cost`

Existing related metadata:

- `good_for_concurrent_running`
- `fatigue_profile`
- `training_style`
- `supported_weekly_sessions`

Guidance:

This dimension is especially important for hybrid planning.

A strength template can be fine in isolation but poor next to running if it repeatedly produces lower-body fatigue near key runs.

Examples:

- low: minimalist strength, reentry strength, low-volume full body
- moderate: standard full-body novice training
- high: upper/lower 4x with demanding lower sessions or hypertrophy volume

### 10. Hybrid suitability

Describes how well the strength template coordinates with running or other endurance work.

Recommended categories:

- `poor`
- `limited`
- `good`
- `strong`

Existing related metadata:

- `good_for_concurrent_running`
- `supported_goals`
- `tags`
- `fatigue_profile`

Guidance:

Hybrid suitability should consider:

- lower-body fatigue cost
- weekly frequency
- session density
- progression aggressiveness
- recovery sensitivity
- exercise selection

Examples:

- `strong`: minimalist/reentry strength, 2x full-body with low fatigue
- `good`: beginner full-body 2x or 3x with controlled progression
- `limited`: moderate gym strength where running is secondary
- `poor`: high-volume hypertrophy or high-fatigue lower-body emphasis

### 11. Re-entry protection

Describes whether the template is intentionally safe for return-to-training phases.

Recommended categories:

- `none`
- `soft`
- `strong`

Existing related metadata:

- `good_for_reentry`
- `progression_model`
- `fatigue_profile`
- `complexity`
- `session_duration_min`
- `session_duration_max`

Guidance:

Re-entry protection should be explicit when the template is meant for:

- low recent training exposure
- post-break return
- low confidence
- fatigue-sensitive users
- users who need the first win more than the optimal stimulus

A re-entry template should not merely be a normal beginner program with fewer exercises. That is not protection. That is a haircut.

### 12. Maintenance suitability

Describes whether the template can preserve strength with low time and recovery cost.

Recommended categories:

- `none`
- `secondary`
- `primary`

Potential future field:

- `maintenance_suitability`

Existing related metadata:

- `tags`
- `session_duration_min`
- `session_duration_max`
- `fatigue_profile`
- `progression_model`

Guidance:

Maintenance templates should:

- keep frequency realistic
- keep fatigue manageable
- retain major movement patterns
- avoid unnecessary accessories
- support running, life stress, or other primary goals

## Strength template identity rule

A strength template should be considered meaningfully distinct if it differs in one or more of these dimensions:

- training age/readiness
- primary goal
- session structure
- progression model
- fatigue profile
- session density
- complexity
- accessory dependence
- lower-body fatigue cost
- hybrid suitability
- re-entry protection
- maintenance suitability

Weak distinctions:

- same full-body template with one exercise swapped
- same template with a different name
- same weekly frequency but no different training intent
- same progression model and fatigue profile with cosmetic day labels
- “home” and “gym” versions that are otherwise identical and not equipment-meaningful

If a strength template cannot explain how it differs from a sibling template in plain language, it probably should not exist as a separate template.

## Differentiation examples

### Getting Started Strength 2x

Likely identity:

- level: beginner
- goal: general strength / general health
- structure: full-body foundation
- progression: beginner linear
- fatigue: low to moderate
- complexity: low
- hybrid suitability: strong
- re-entry protection: soft to strong

Plain explanation:

> A low-barrier beginner template for building consistency and basic strength without high weekly fatigue.

### Base Full Body 2x

Likely identity:

- level: novice/intermediate
- goal: strength / general health
- structure: full-body base
- progression: linear load then reps
- fatigue: moderate
- complexity: moderate
- hybrid suitability: limited to moderate
- re-entry protection: none

Plain explanation:

> A basic strength template for users who can tolerate heavier full-body work twice per week.

### Re-entry Strength 2x

Likely identity:

- level: beginner/novice returning
- goal: reentry / general health
- structure: reentry full-body
- progression: conservative
- fatigue: low
- complexity: low
- hybrid suitability: strong
- re-entry protection: strong

Plain explanation:

> A low-fatigue return-to-training template built to restart consistency before chasing progression.

### Greyskull-style LP 3x

Likely identity:

- level: novice
- goal: strength
- structure: primary-lift full-body
- progression: linear progression with repeated exposure
- fatigue: moderate to high
- complexity: moderate
- hybrid suitability: limited
- re-entry protection: none

Plain explanation:

> A novice strength template centered on frequent primary-lift practice and steady progression.

### GZCL-style Full Body 3x

Likely identity:

- level: novice/intermediate
- goal: strength with structured volume
- structure: tiered strength
- progression: tiered progression
- fatigue: moderate to high
- complexity: high
- accessory dependence: moderate
- hybrid suitability: limited

Plain explanation:

> A structured strength template using primary, secondary, and accessory tiers for users ready for more complexity.

### 5/3/1-style Strength 3-4x

Likely identity:

- level: intermediate
- goal: strength
- structure: primary-lift emphasis
- progression: wave/block progression
- fatigue: moderate to high
- complexity: moderate to high
- hybrid suitability: limited unless carefully configured

Plain explanation:

> An intermediate strength template using slower progression waves rather than simple session-to-session increases.

### Upper / Lower Hypertrophy 4x

Likely identity:

- level: intermediate
- goal: hypertrophy / strength-hypertrophy
- structure: upper/lower split
- progression: volume-oriented
- fatigue: high
- complexity: moderate
- accessory dependence: high
- lower-body fatigue cost: high
- hybrid suitability: poor to limited

Plain explanation:

> A higher-volume template for muscle growth where accessories and weekly volume are part of the core design.

### Low Fatigue / Easy Strength

Likely identity:

- level: beginner to intermediate
- goal: maintenance / consistency / general strength
- structure: minimalist or low-density full body
- progression: conservative or maintenance progression
- fatigue: low
- complexity: low
- hybrid suitability: strong
- maintenance suitability: primary

Plain explanation:

> A low-cost strength template for maintaining or rebuilding capacity without competing with recovery or running.

## Matching guidance

When selecting a strength template, prefer conservative matching if signals conflict.

Example conflicts:

- user wants strength but readiness is low
- user wants 4x but recent consistency is poor
- user wants hypertrophy but time budget is short
- user wants running and strength but lower-body fatigue is high
- user has gym access but beginner complexity tolerance is low

Guidance:

- readiness beats ambition
- recovery beats theoretical optimality
- consistency beats complexity
- hybrid support beats isolated strength purity when running is active
- reentry protection beats progression speed after a break

Yes, this is less glamorous than pretending every user is one spreadsheet away from elite training. It is also more likely to work.

## Explanation examples

Good:

> Selected because you are returning to training, prefer two weekly sessions, and need a low-fatigue full-body structure.

> Selected because your current goal is strength, you have gym access, and your weekly target supports a moderate full-body base plan.

> Selected because you are combining running and strength, so the system chose a lower-fatigue template with better hybrid suitability.

> Not selected because the 4x upper/lower hypertrophy template carries too much weekly fatigue for your current recovery and running profile.

Bad:

> Selected because it is a strength program.

> Selected because it matches your level.

> Selected because it is optimal.

Optimal for what, exactly? Vague confidence is not explainability. It is just a sales pitch wearing a lab coat.

## Recommended near-term metadata mapping

Existing fields already cover much of this taxonomy:

- `recommended_levels` → training age/readiness
- `supported_goals` → primary and secondary goal candidates
- `training_style` → session structure
- `progression_model` → progression model
- `fatigue_profile` → fatigue profile
- `complexity` → complexity
- `good_for_reentry` → re-entry protection signal
- `good_for_concurrent_running` → hybrid suitability signal
- `session_duration_min/max` → session density proxy
- `tags` → secondary descriptors

Future fields should only be added when runtime matching or explanation needs them:

- `session_density`
- `accessory_dependence`
- `lower_body_fatigue_cost`
- `hybrid_suitability`
- `reentry_protection`
- `maintenance_suitability`

Do not add these fields just because a taxonomy document exists. Documentation is not a permission slip for schema sprawl.

## Review checklist for future strength templates

Before adding a strength template, check:

- What training age/readiness is it for?
- What primary strength goal does it serve?
- What session structure does it use?
- What progression model does it follow?
- What fatigue profile does it carry?
- What is the session density?
- How complex is it for the user?
- How dependent is it on accessories?
- What is its lower-body fatigue cost?
- How suitable is it for hybrid coordination?
- Does it have re-entry protection?
- Can it serve maintenance?
- How is it meaningfully different from existing strength templates?
- Can the difference be explained in one or two plain sentences?

## Implementation guidance

Near-term work should:

1. Use this document to audit existing strength templates.
2. Avoid adding new beginner or novice templates that only differ cosmetically.
3. Prefer clearer metadata over more templates.
4. Keep re-entry, beginner, novice, intermediate, hypertrophy, and maintenance templates distinct.
5. Keep hybrid suitability explicit when running is part of the user profile.
6. Add new fields only after matching or explanation logic needs them.
7. Keep template identity tied to training intent, not exercise-list decoration.

The strength library should feel like a coherent set of choices, not a drawer full of almost identical full-body plans having an identity crisis.
