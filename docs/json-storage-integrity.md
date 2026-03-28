# JSON storage integrity rules

## Purpose

This document defines the current integrity contract for SovereignStrength's JSON-backed storage paths.

It exists to make storage behavior explicit when files are:

- missing
- malformed
- parseable but structurally invalid
- partially trustworthy
- in need of recovery

This is a documentation issue, not a database migration fantasy.

## Scope

This document describes the current practical behavior of the JSON persistence layer and the operational rules that should govern it.

It applies to JSON-backed runtime files such as:

- `workouts.json`
- `checkins.json`
- `session_results.json`
- `user_settings.json`
- `programs.json`
- `exercises.json`
- related JSON-backed files used by planning, review, and diagnostics

## Current storage behavior

### 1. Missing JSON file

Current behavior in both `storage.py` and helper readers in `app.py` is fallback-based:

- missing list-like file -> `[]`
- missing object-like file -> `{}`

This means the current system does not generally fail hard on missing JSON files.

### 2. Malformed JSON or unreadable file

Current behavior is also fallback-based:

- malformed JSON logs an error or exception
- the reader returns an empty fallback structure
- storage-backed paths may also set `last_error`

Typical current fallbacks:

- list reader -> `[]`
- object reader -> `{}`

### 3. Parseable but structurally invalid JSON

If a file can be parsed as JSON but the top-level type is wrong:

- expected list but got dict -> fallback to `[]`
- expected dict but got list -> fallback to `{}`

This is treated as a storage failure condition, not valid data.

### 4. Diagnostic visibility

The current implementation is only partially explicit in how storage failures surface.

Observed current behavior:

- storage-layer reads in `storage.py` can set `last_error`
- some higher-level routes inspect `get_storage_last_error()`
- `today-plan` explicitly escalates `checkins` storage errors
- many other JSON reads still use direct empty fallback without route-level escalation

This means the current system is not uniformly fail-fast.
It is a mixed model:
- fallback-first for many file reads
- explicit error surfacing for some critical paths

## Integrity rules

### Rule 1: Top-level type is part of the contract

A JSON file is only considered structurally valid if its top-level type matches the expected contract.

Examples:

- list files must contain a JSON list
- object files must contain a JSON object

A parseable file with the wrong top-level type is invalid.

### Rule 2: Missing does not automatically mean healthy

A missing file may currently degrade to an empty structure, but that should be interpreted carefully.

There is an important difference between:

- acceptable recreation of low-risk defaults
- silent disappearance of meaningful user history

### Rule 3: Recovery behavior must depend on file category

Not all JSON files are equal.

#### Files that may degrade more safely to empty defaults

These are closer to catalog or rebuildable support data, depending on actual deployment state:

- some seed-derived or rebuildable metadata files
- low-risk optional support files where empty fallback is operationally tolerable

#### Files that must be treated as meaningful user history

These should never be casually treated as "empty means fine":

- `checkins.json`
- `workouts.json`
- `session_results.json`
- `user_settings.json`

If these are unreadable, corrupted, or unexpectedly empty after prior use, the correct operational assumption is possible data loss or corruption, not a normal clean slate.

## Fail-fast vs graceful fallback

### Current reality

The implementation currently leans toward graceful fallback.

That is acceptable as an implementation fact, but it must be documented honestly.

### Required interpretation

Graceful fallback must not be confused with trustworthy recovery.

Use this distinction:

- fallback = runtime survival behavior
- recovery = operational process to restore trusted state

A route surviving with `[]` is not proof that the underlying data is healthy.

### Recommended handling principle

- fail gracefully when needed to keep the app readable
- fail explicitly when user-history integrity is at risk
- log storage failures clearly
- surface critical storage errors in routes where silent fallback would be misleading

## Per-file interpretation guidance

### `checkins.json`

Importance:
- core readiness history
- influences daily plan quality
- used in explicit storage error escalation today

Operational rule:
- corruption or structural invalidity should be treated as a real storage problem
- route-level error surfacing is appropriate

### `workouts.json`

Importance:
- training history
- planning continuity
- progression context

Operational rule:
- empty fallback may keep the app running
- but unexpected loss should be treated as trust-impacting history loss

### `session_results.json`

Importance:
- review history
- progression signals
- fatigue signals
- adaptation continuity

Operational rule:
- corruption should be treated as significant history degradation

### `user_settings.json`

Importance:
- equipment increments
- available equipment
- profile and preference continuity

Operational rule:
- empty fallback may permit runtime continuation
- but silent reset changes decision quality and expected outputs

### `programs.json` and `exercises.json`

Importance:
- planning and rendering support
- exercise metadata
- progression metadata
- substitution logic

Operational rule:
- empty fallback can keep some code paths alive
- but the resulting planning quality may become invalid or misleading
- these files should be considered operationally important even when not user-history files

## Current observability contract

### What exists now

- storage failures are logged
- some reads set `last_error`
- some endpoints inspect `last_error` and escalate
- backup and restore procedure is documented separately

### What does not yet exist uniformly

- a single consistent storage error policy across all JSON reads
- uniform route-level escalation for all critical files
- schema-version contract for persisted JSON structures

## Recovery rule

If a meaningful runtime JSON file is:

- malformed
- unreadable
- wrong top-level type
- unexpectedly empty after prior use

the correct next step is not to assume the empty fallback is acceptable.

The correct next step is:

1. inspect logs
2. identify affected file
3. confirm whether fallback behavior occurred
4. restore from known-good backup if needed
5. validate JSON before returning the system to normal use

See:
- `docs/backup-restore.md`

## Compatibility rule

The current system does not rely on a formal schema-version marker for JSON runtime files.

That is acceptable for now only if:

- structural expectations remain documented
- changes to persisted shape are made carefully
- future schema evolution is documented in the same commit as the code change

If persisted JSON shapes become more complex, a lightweight version marker may become justified.
That should be introduced only when the real need exists, not as decorative architecture.

## Practical summary

The current JSON integrity contract is:

- missing file -> empty fallback
- malformed file -> empty fallback + logging
- wrong top-level type -> empty fallback + logging
- some storage-backed reads also set `last_error`
- critical user-history files must still be treated as trust-sensitive
- fallback behavior is not the same as healthy state
- recovery must use explicit operational judgment, not blind trust in empty defaults
