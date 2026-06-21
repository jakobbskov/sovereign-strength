# SovereignStrength agent rules

This repository must be changed carefully, one scoped change at a time.

## 1. Classify the change first

Before editing, classify the requested change as one or more of:

- frontend
- backend
- data
- proxy

Also state:

- which function or feature is affected
- whether the change affects the flow: forecast -> check-in -> plan -> workout -> review

If the scope is unclear, stop and ask for clarification.

## 2. Git first

Never edit directly on main.

Expected workflow:

- git checkout main
- git pull --ff-only
- git checkout -b fix/descriptive-branch-name

Do not deploy from a feature branch unless explicitly instructed.

## 3. One change at a time

Do not bundle unrelated fixes.

Avoid mixing:

- frontend and backend changes unless required
- copy changes and logic changes unless the issue requires both
- data changes and deploy changes
- refactoring and feature work unless the refactor is necessary for the fix

## 4. Output is truth

Do not guess system state.

Use actual output from:

- commands
- tests
- logs
- HTTP responses
- git diff

Stop if command output contradicts expectations.

## 5. Do not make structure worse

Avoid:

- new global variables
- expanding large state objects
- copy-paste logic
- hardcoded debug strings
- broad quick fixes without explanation

Before editing, consider:

- Can the change stay inside an existing function?
- Is the same logic already implemented elsewhere?
- Does this make an already-large file worse?

If a file is already large, keep the patch minimal and isolated.

## 6. Known risk areas

Be careful with:

- STATE
- CURRENT_STEP
- AUTH_USER
- repeated document.getElementById calls
- async calls without timeout or fallback
- event listeners that can be registered multiple times
- forms without validation before submit

Do not add duplicate event listeners.

Do not add uncontrolled Promise.all chains.

## 7. Required local checks

Run relevant checks before commit.

For JavaScript:

- node --check path/to/file.js

For Python:

- python3 -m py_compile path/to/file.py

For JSON:

- python3 -m json.tool path/to/file.json >/dev/null

Also run:

- git diff --check

If pytest is unavailable, run targeted tests directly only when that is safe and explicit.

## 8. Commit discipline

Commit messages must explain what changed and why.

Format:

- git commit -m "Fix X because Y"

## 9. Diff review before PR

Before opening a PR, show:

- git diff main..HEAD --stat
- git diff main..HEAD

Check for:

- unintended files
- debug code
- unrelated copy changes
- accidental data changes

## 10. Deploy discipline

Live is the target, not the workbench.

Use existing deploy scripts where available.

Frontend deploy should use the safe frontend deploy script.

Backend deploy should use the safe backend deploy script.

Do not manually copy files to live if a deploy script exists.

## 11. Live validation

After deploy, validate with actual HTTP responses.

Examples:

- curl -I https://strength.innosocia.dk/
- curl -I https://strength.innosocia.dk/app.js
- curl -i https://strength.innosocia.dk/api/health

Test affected user flow when relevant.

## 12. Rollback principle

If live validation fails, stop.

Prefer rollback before further debugging.

Use git history and deploy scripts to restore known-good state.

## Core rule

Git first.
One change.
Validate.
PR.
Merge only after review.
Deploy only after merge.
Test live.
Rollback if needed.

Do not make the code worse than it was yesterday.
