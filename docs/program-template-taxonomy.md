# Program Template Taxonomy

## Purpose

This document defines the shared taxonomy used to describe SovereignStrength program templates.

It complements `docs/data-model.md`.

- `docs/data-model.md` describes the current JSON structure.
- This document describes the training identity model behind program templates.

The goal is to keep program matching, adaptation, and explanation consistent across strength, running, hybrid, recovery, mobility, and future race-aware templates.

A template is not just a list of sessions. It is a structured training intent.

## Why this taxonomy exists

Without a shared template taxonomy, the program library can drift into superficial variation:

- the same plan with a different name
- the same structure with slightly different wording
- weekly slot count pretending to be training identity
- templates that cannot explain why they were selected
- hybrid templates that cannot build cleanly on strength and running logic
- adaptation rules that collapse different templates into the same generic plan

The taxonomy should make it clear what kind of training problem a template solves.

## Design principles

The taxonomy must be:

1. **Shared**
   - usable across strength, running, hybrid, recovery, mobility, and event-aware templates

2. **Compact**
   - practical enough for a local-first JSON system

3. **Explicit**
   - clear enough to support deterministic matching and explanation

4. **Stable**
   - not dependent on small wording differences in template names

5. **Domain-aware**
   - able to describe strength and running differences without pretending they are identical

6. **Not an ontology cosplay event**
   - if a field does not improve matching, adaptation, or explanation, it probably does not belong here

## Existing metadata foundation

Current program definitions already include lightweight selector metadata such as:

- `kind`
- `recommended_levels`
- `supported_goals`
- `supported_weekly_sessions`
- `equipment_profiles`
- `training_style`
- `session_duration_min`
- `session_duration_max`
- `fatigue_profile`
- `complexity`
- `good_for_reentry`
- `good_for_concurrent_running`
- `program_family`
- `progression_model`
- `tags`
- `program_role`
- `expected_use_window_weeks`
- `transition_type`
- `exit_criteria`

This taxonomy should guide future use and refinement of those fields. It should not force a full migration just to sound clever in a markdown file.

## Top-level taxonomy dimensions

Every template should be describable using the following dimensions.

Not every dimension must become a required JSON field immediately. Some are conceptual dimensions that can map to existing compact metadata.

### 1. Domain

Describes the primary training domain.

Examples:

- `strength`
- `run`
- `mobility`
- `recovery`
- `hybrid`
- `mixed`

Existing field:

- `kind`

Guidance:

Use domain to answer: what type of training does this template primarily organize?

Do not use domain to describe every session inside the template. A hybrid template may include both strength and running, but its domain is still `hybrid` if the combined structure is the point.

### 2. Target level

Describes who the template is appropriate for.

Examples:

- `beginner`
- `novice`
- `intermediate`
- `reentry`
- `detrained`
- `returning`

Existing field:

- `recommended_levels`

Guidance:

Target level should reflect expected training tolerance, technical demand, and progression readiness.

It should not be inferred only from exercise difficulty. A simple-looking template can still be too demanding if weekly frequency, volume, or fatigue profile is high.

### 3. Primary goal

Describes the main outcome the template is built around.

Examples:

- `general_strength`
- `hypertrophy`
- `base_running`
- `run_consistency`
- `reentry`
- `mobility`
- `recovery`
- `hybrid_base`
- `race_preparation`

Existing field:

- `supported_goals`

Guidance:

Primary goal should explain why the template exists.

Bad distinction:

- “Program A has squats”
- “Program B has lunges”

Better distinction:

- “This is a low-fatigue reentry strength template”
- “This is a moderate-fatigue beginner strength template”
- “This is a run-first hybrid template”

### 4. Secondary goal

Describes useful but non-primary outcomes.

Examples:

- `concurrent_running_support`
- `joint_tolerance`
- `movement_confidence`
- `aerobic_base`
- `minimum_effective_dose`
- `technique_practice`

Existing fields that may express this:

- `tags`
- `good_for_concurrent_running`
- `good_for_reentry`

Guidance:

Secondary goals should not compete with the primary goal.

If every template is tagged as good for everything, the tags become motivational confetti. The app does not need confetti. It needs decisions.

### 5. Weekly structure

Describes the expected weekly training shape.

Examples:

- `1x`
- `2x`
- `3x`
- `4x`
- `run_2x_strength_2x`
- `strength_2x_run_2x`
- `daily_mobility`

Existing field:

- `supported_weekly_sessions`

Guidance:

Weekly structure is not training identity by itself. It describes fit and capacity.

Two templates can both be 3x/week and still differ meaningfully by goal, fatigue profile, progression model, equipment, or hybrid role.

### 6. Session structure

Describes the internal organization of sessions.

Examples:

- `full_body`
- `upper_lower`
- `push_pull_legs`
- `base_run_progression`
- `interval_progression`
- `mobility_flow`
- `recovery_session`
- `hybrid_run_first`

Existing field:

- `training_style`

Guidance:

Session structure explains what a week feels like in practice.

This field should prevent “same template, renamed” drift by making structural differences explicit.

### 7. Progression model

Describes how the template expects training to advance.

Examples:

- `beginner_linear`
- `linear_load_then_reps`
- `linear_split_progression`
- `duration_plus_quality`
- `reentry_conservative`
- `minimal_dose_linear`
- `hybrid_beginner_balanced`
- `intermediate_hypertrophy_volume`

Existing field:

- `progression_model`

Guidance:

Progression model should describe the intended progression pattern at template level.

It should not replace exercise-level progression. Exercise-level progression still handles specific load, reps, time, and variation decisions.

Template-level progression answers: what kind of progression philosophy does this program follow?

### 8. Fatigue profile

Describes expected recovery cost.

Examples:

- `low`
- `low_to_moderate`
- `moderate`
- `moderate_to_high`
- `high`

Existing field:

- `fatigue_profile`

Guidance:

Fatigue profile should influence matching, especially when the user has:

- low readiness
- recent fatigue
- concurrent running
- reentry status
- local protection signals
- limited training history

Fatigue profile is not a moral judgment. A high-fatigue template is not “better”. It is just more expensive. Apparently training, like everything else, has a cost. Shocking.

### 9. Impact profile

Describes mechanical impact or joint/tissue cost where relevant.

Examples:

- `low_impact`
- `moderate_impact`
- `high_impact`
- `mixed_impact`
- `not_applicable`

Potential future field:

- `impact_profile`

Guidance:

This matters most for running, plyometrics, jumping, and high-impact conditioning.

Strength templates may often use `not_applicable` unless they contain high-impact conditioning or jumping elements.

### 10. Recovery sensitivity

Describes how easily the template should downshift under fatigue or local protection.

Examples:

- `low`
- `moderate`
- `high`

Potential future field:

- `recovery_sensitivity`

Existing related fields:

- `good_for_reentry`
- `fatigue_profile`
- `complexity`

Guidance:

High recovery sensitivity means the template should adapt conservatively when recovery signals are poor.

This is especially relevant for reentry, hybrid, older beginner, or low-capacity templates.

### 11. Adaptive tolerance

Describes how much the template can be modified without losing identity.

Examples:

- `low`
- `moderate`
- `high`

Potential future field:

- `adaptive_tolerance`

Guidance:

A simple full-body beginner template may tolerate exercise substitution well.

A race-specific running template may tolerate fewer arbitrary changes because session order and intensity distribution matter more.

Adaptive tolerance answers: how much can the system bend this template before it becomes a different template wearing a fake moustache?

### 12. Hybrid profile

Describes how strength and running interact.

Examples:

- `none`
- `strength_first`
- `run_first`
- `balanced`
- `maintenance_strength`
- `recovery_preserving`
- `race_support`

Potential future field:

- `hybrid_profile`

Existing related fields:

- `kind`
- `training_style`
- `good_for_concurrent_running`
- `tags`

Guidance:

Hybrid profile should not simply mean “contains strength and running”.

It should explain priority and conflict management.

Examples:

- `run_first`: strength supports running and should not compromise key runs
- `strength_first`: running is secondary and lower interference
- `balanced`: both domains progress conservatively
- `maintenance_strength`: strength preserves capacity while running carries the main adaptation load

### 13. Event capability

Describes whether a template can support an event/race-specific planning layer.

Examples:

- `none`
- `base_support`
- `race_preparation`
- `taper_aware`
- `event_week_only`

Potential future field:

- `event_capability`

Guidance:

This is mainly relevant for running and hybrid templates.

Do not pretend a generic strength template is race-aware because it contains legs. That is how taxonomy becomes fan fiction.

### 14. Equipment profile

Describes which equipment context the template expects.

Examples:

- `minimal_home`
- `dumbbell_home`
- `hybrid_home`
- `gym_basic`
- `full_gym`
- `run_only`

Existing field:

- `equipment_profiles`

Guidance:

Equipment profile should support matching and substitution.

It should not be used as the only distinction between otherwise identical templates unless equipment is actually the meaningful difference.

### 15. Complexity

Describes cognitive and logistical demand.

Examples:

- `low`
- `moderate`
- `high`

Existing field:

- `complexity`

Guidance:

Complexity includes:

- number of moving parts
- technical demand
- session organization
- need for load tracking
- need for pacing awareness
- need for weekly planning

Complexity should affect matching for beginners, reentry users, and users with low capacity.

## Template identity rule

A template should be considered meaningfully distinct only if it differs on at least one meaningful taxonomy dimension.

Meaningful differences include:

- different primary goal
- different target level
- different progression model
- different fatigue profile
- different session structure
- different hybrid profile
- different event capability
- different equipment profile when equipment changes the training logic
- different weekly structure when weekly frequency changes the adaptation strategy

Weak differences include:

- different exercise names with same movement role and same progression
- slightly different wording
- cosmetic session labels
- same template with one accessory swapped
- a 2x and 3x version with no real difference in fatigue or progression logic

If two templates cannot be explained differently in one or two plain sentences, they probably should not be separate templates.

## Recommended minimal metadata set

For near-term program templates, the practical minimum is:

- `kind`
- `recommended_levels`
- `supported_goals`
- `supported_weekly_sessions`
- `equipment_profiles`
- `training_style`
- `program_family`
- `progression_model`
- `fatigue_profile`
- `complexity`

Optional but useful:

- `good_for_reentry`
- `good_for_concurrent_running`
- `tags`
- `program_role`
- `expected_use_window_weeks`
- `transition_type`
- `exit_criteria`

Future fields should only be added when they improve matching, explanation, or adaptation.

Potential future fields:

- `impact_profile`
- `recovery_sensitivity`
- `adaptive_tolerance`
- `hybrid_profile`
- `event_capability`

## Domain-specific interpretation

### Strength templates

Important dimensions:

- target level
- primary goal
- equipment profile
- weekly structure
- session structure
- progression model
- fatigue profile
- complexity
- recovery sensitivity

Strength examples:

- beginner full-body 2x, low/moderate fatigue, linear progression
- gym upper/lower 4x, moderate/high fatigue, split progression
- reentry full-body 2x, low fatigue, conservative progression

### Running templates

Important dimensions:

- target level
- primary goal
- weekly structure
- progression model
- fatigue profile
- impact profile
- event capability
- recovery sensitivity

Running examples:

- base running 2x, low impact/moderate progression
- interval progression, higher intensity, higher recovery sensitivity
- race-aware plan, event capability enabled, taper-aware progression

### Hybrid templates

Important dimensions:

- hybrid profile
- domain priority
- weekly structure
- fatigue profile
- recovery sensitivity
- adaptive tolerance
- progression model
- equipment profile

Hybrid examples:

- run-first hybrid with strength maintenance
- balanced beginner hybrid
- race-support hybrid where strength must not compromise key runs

### Recovery and mobility templates

Important dimensions:

- primary goal
- recovery sensitivity
- complexity
- session structure
- impact profile
- adaptive tolerance

Recovery and mobility templates should stay simple. If they become complicated, they have already failed their job. Beautifully human, but still failed.

## Explanation examples

Good explanations:

> Selected because you wanted three weekly sessions, have gym access, and the template matches beginner linear strength progression.

> Selected because current recovery signals favor a lower-fatigue reentry template.

> Selected because this is a run-first hybrid structure and strength work should support, not compete with, the running plan.

Weak explanations:

> Selected because it matches your goals.

> Selected because it is suitable.

> Selected because this is a good program.

These are not explanations. They are polite shrugs in JSON clothing.

## Non-goals

This taxonomy does not:

- redesign every existing program
- require immediate migration of all templates
- replace the current program JSON structure
- create a general ontology
- decide exercise-level progression
- replace recovery or local protection logic
- define race planning in full detail

## Review checklist for future templates

Before adding a new template, check:

- What is the primary domain?
- What target level is it for?
- What primary goal does it serve?
- What secondary goal does it support, if any?
- What weekly structure does it expect?
- What session structure does it use?
- What progression model does it follow?
- What fatigue profile does it carry?
- What equipment context does it require?
- What makes it meaningfully different from existing templates?
- Can its selection be explained in one or two plain sentences?
- Does it avoid being a duplicate template with different packaging?
- Does it remain compact enough for local JSON maintenance?

## Implementation guidance

Near-term work should:

1. Use this taxonomy to audit existing program templates.
2. Avoid adding new templates unless they differ meaningfully.
3. Keep metadata compact and stable.
4. Prefer enriching existing templates over adding near-duplicates.
5. Add future fields only when runtime matching or explanation actually needs them.
6. Keep `docs/data-model.md` focused on actual stored JSON fields.
7. Use this document for conceptual taxonomy and template identity rules.

The aim is not to make the program library sound sophisticated. The aim is to stop it from becoming a pile of nearly identical templates wearing different hats.
