# SovereignStrength v1.0.0-beta.1 Release Plan

Status date: 2026-05-03  
Issue: #783  
Target tag: v1.0.0-beta.1  
Release type: Controlled beta  
Distribution: Existing web/PWA-style deployment  
APK/native app status: Deferred

## Release decision

SovereignStrength v1.0.0-beta.1 should be released as a controlled web/PWA-style beta first.

The project should not start by packaging the system as an APK or native app.

The current goal is to validate the product loop with real users before adding distribution and packaging complexity.

## Why not APK first

The deployed web system already supports the beta test target:

- login
- check-in
- plan generation
- workout execution
- review
- session history
- backend persistence
- rollback
- deploy verification

Packaging as an APK before beta validation would add avoidable complexity:

- Android signing
- build pipeline
- install/update behavior
- authentication/session edge cases
- storage/cache behavior
- device-specific support
- release distribution overhead
- a false sense of product maturity

APK/native packaging should be treated as a separate decision after beta feedback.

## Beta goal

The beta goal is to test whether the v1.0 loop is understandable, stable, and useful in real use:

forecast → check-in → plan → workout → review → history → next plan

The beta is not meant to prove that the system is feature-complete for all future training scenarios.

## Beta audience

Recommended beta size:

- 5-20 trusted users

Recommended tester profile:

- users willing to report rough edges
- users who can complete both strength and cardio/running sessions
- users who understand this is a controlled beta
- users who will not treat missing v1.1 features as v1.0 defects

## Release prerequisites

Before tagging v1.0.0-beta.1:

- main is up to date
- working tree is clean
- docs/v1-beta-readiness.md exists on main
- docs/v1-beta-release-plan.md exists on main
- targeted regression suite is green
- backend is live and active
- backend import map is verified
- manual smoke test has been completed
- rollback notes are documented

## Targeted regression command

Run:

    .venv/bin/python -m pytest \
      tests/test_running_template_identity_v1_contract.py \
      tests/test_time_based_progression_analysis.py \
      tests/test_safe_backend_deploy_script_contract.py \
      tests/test_cardio_session_history_metrics_contract.py \
      tests/test_cardio_edit_duration_contract.py \
      tests/test_cardio_review_save_running_alias_contract.py \
      -q

Expected result:

    18 passed

## Live backend verification

Run from the deployed backend directory:

    cd /opt/sovereign-strength-api/app/backend

    ../../.venv/bin/python3 - <<'PY'
    import app
    import progression_engine
    import storage
    import db
    from pathlib import Path

    for mod in (app, progression_engine, storage, db):
        print(f"{mod.__name__}: {Path(mod.__file__).resolve()}")

    text = Path(app.__file__).read_text(encoding="utf-8")
    print("identity_guard=", "running template identity preserved" in text)
    print("selected_id_plumbed=", "selected_endurance_program_id=selected_endurance_program_id" in text)
    print("starter_guard=", 'starter_run_2x", "reentry_run_2x' in text)
    print("hybrid_guard=", "hybrid_run_strength_" in text)
    PY

Expected result:

    app: /opt/sovereign-strength-api/app/backend/app.py
    progression_engine: /opt/sovereign-strength-api/app/backend/progression_engine.py
    storage: /opt/sovereign-strength-api/app/backend/storage.py
    db: /opt/sovereign-strength-api/app/backend/db.py
    identity_guard= True
    selected_id_plumbed= True
    starter_guard= True
    hybrid_guard= True

Check service:

    sudo systemctl status sovereign-strength-api.service --no-pager -l

Expected result:

    Active: active (running)

## Manual smoke test

Complete this manually before tagging:

1. Log in.
2. Complete check-in.
3. Generate today plan.
4. Confirm selected program context is visible or preserved.
5. Complete a strength workout.
6. Save strength review.
7. Confirm strength session appears in history.
8. Complete a running/cardio workout.
9. Save cardio review with distance, duration, RPE, and note.
10. Confirm cardio history shows cardio metrics, not strength totals.
11. Edit saved cardio session.
12. Confirm duration, pace, RPE, and notes are preserved.
13. Confirm weekly goal guidance updates from completed sessions.
14. Confirm a starter/re-entry/hybrid run does not drift into obviously inappropriate hard cardio.
15. Confirm rest/recovery guidance is understandable.

## Tag command

After all checks pass:

    git checkout main
    git pull
    git status --short
    git tag -a v1.0.0-beta.1 -m "SovereignStrength v1.0.0-beta.1"
    git push origin v1.0.0-beta.1

## Release notes draft

Title:

    SovereignStrength v1.0.0-beta.1

Summary:

    First controlled beta release of SovereignStrength.

Highlights:

    - Strength training flow ready for controlled beta
    - Running/cardio flow hardened across review, edit, history, and progression
    - Running aliases handled consistently
    - Running template identity preserved in v1.0 scope
    - Time-based hold progression fixed
    - Backend deploy now updates all runtime modules
    - Beta readiness and rollback documentation added

Known deferred areas:

    - APK/native app packaging
    - race/event planning
    - taper logic
    - full 5K/10K/half marathon preparation logic
    - advanced hybrid periodization
    - wearable import
    - broader program library expansion
    - advanced analytics

## Rollback

Frontend rollback:

    git checkout main
    git pull
    ./scripts/deploy_frontend_safe.sh

Backend rollback:

    git checkout main
    git pull
    ./scripts/deploy_backend_safe.sh

Backend backup restore:

    sudo cp /opt/sovereign-strength-api/app/backend/app.py.bak.<timestamp> /opt/sovereign-strength-api/app/backend/app.py
    sudo cp /opt/sovereign-strength-api/app/backend/progression_engine.py.bak.<timestamp> /opt/sovereign-strength-api/app/backend/progression_engine.py
    sudo cp /opt/sovereign-strength-api/app/backend/storage.py.bak.<timestamp> /opt/sovereign-strength-api/app/backend/storage.py
    sudo cp /opt/sovereign-strength-api/app/backend/db.py.bak.<timestamp> /opt/sovereign-strength-api/app/backend/db.py
    sudo systemctl restart sovereign-strength-api.service
    sudo systemctl status sovereign-strength-api.service --no-pager -l

## Out of scope for this release

- APK build
- Play Store distribution
- iOS packaging
- native authentication changes
- offline install/update system
- new v1.1 running features
- new program families
- UI redesign
