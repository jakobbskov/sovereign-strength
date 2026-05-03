# SovereignStrength v1.0 Beta Readiness

Status date: 2026-05-03  
Status: Ready for controlled beta after targeted running/cardio hardening

## Summary

SovereignStrength is now ready for controlled beta testing with a small group of real users.

The recent work focused on stabilizing the running/cardio layer, session result persistence, progression analysis, and backend deployment safety.

The goal was not to add new features, but to make the existing v1.0 flow trustworthy enough for real use.

## Confirmed v1.0 areas

### Strength flow

The strength flow is considered functionally ready for beta:

- forecast
- check-in
- plan generation
- workout execution
- review
- session history
- progression summary

Recent supporting fixes include time-based progression handling for hold-style exercises, so values such as `20 sec`, `20s`, `20 sek`, and `20 seconds` are parsed as time-based work instead of being ignored.

### Running/cardio flow

The running/cardio layer has been hardened across the full user flow:

- cardio review summary no longer shows strength metrics
- cardio metrics are preserved on save
- cardio notes are preserved
- cardio duration and pace are preserved on edit
- cardio history shows distance, duration, pace, kind, and RPE
- running aliases are handled consistently: `løb`, `cardio`, `run`, `running`
- running template identity is preserved in a v1.0-small form

Running template identity currently means:

- `starter_run_2x` and `reentry_run_2x` stay easy/base instead of drifting into tempo or interval sessions
- `hybrid_run_strength_*` stays supportive instead of drifting into high-intensity cardio
- `base_run_*` avoids direct interval drift
- unknown running programs keep the existing generic cardio behavior
- local protection still runs after the identity guard and can override it

This is not a full race, taper, or event-aware running engine. That belongs to v1.1.

### Deployment

Backend deployment has been hardened.

The backend deploy script now deploys all runtime modules used by the service:

- `app.py`
- `progression_engine.py`
- `storage.py`
- `db.py`

The script also:

- backs up each runtime module
- validates Python syntax before and after copy
- verifies the systemd working directory
- verifies the runtime import map
- restarts the backend service
- prints service status

This closes the previous risk where a deploy could update `app.py` but leave imported backend modules stale.

## Recent merged PRs

- #774 fixed cardio review summary showing strength metrics for running aliases
- #775 preserved cardio review metrics when the running alias was used
- #776 preserved single cardio entry notes as session notes
- #777 preserved cardio edit duration and pace
- #778 showed cardio metrics correctly in history
- #779 fixed time-based progression analysis for hold seconds
- #780 fixed backend deploy so imported runtime modules are deployed
- #781 preserved running template identity during cardio adaptation

## Validation run

Targeted regression suite:

    .venv/bin/python -m pytest \
      tests/test_running_template_identity_v1_contract.py \
      tests/test_time_based_progression_analysis.py \
      tests/test_safe_backend_deploy_script_contract.py \
      tests/test_cardio_session_history_metrics_contract.py \
      tests/test_cardio_edit_duration_contract.py \
      tests/test_cardio_review_save_running_alias_contract.py \
      -q

Result:

    18 passed in 1.00s

Live backend verification after #781:

    identity_guard= True
    selected_id_plumbed= True
    starter_guard= True
    hybrid_guard= True
    Active: active (running)

## Manual beta test checklist

Beta testers should focus on the actual v1.0 flow:

1. Log in.
2. Complete check-in.
3. Generate today plan.
4. Complete a strength workout.
5. Complete a running/cardio workout.
6. Save review data.
7. Edit a saved cardio session.
8. Confirm that cardio metrics remain visible in history.
9. Confirm that notes are preserved.
10. Confirm that weekly goal guidance feels reasonable.
11. Confirm that running plans do not feel like they randomly change purpose.
12. Confirm that rest/recovery guidance is understandable.

## Known v1.1 / deferred areas

The following are intentionally not v1.0 blockers:

- race/event planning
- taper logic
- full 5K/10K/half marathon preparation logic
- advanced hybrid periodization
- external wearable import
- broader program library expansion
- advanced analytics
- public multi-user onboarding polish
- deeper explanation of all rejected program alternatives

## Rollback notes

Frontend rollback:

    git checkout main
    git pull
    ./scripts/deploy_frontend_safe.sh

Backend rollback:

    git checkout main
    git pull
    ./scripts/deploy_backend_safe.sh

If a specific backend deploy breaks runtime behavior, restore from the backup timestamp printed by `deploy_backend_safe.sh`, then restart:

    sudo cp /opt/sovereign-strength-api/app/backend/app.py.bak.<timestamp> /opt/sovereign-strength-api/app/backend/app.py
    sudo cp /opt/sovereign-strength-api/app/backend/progression_engine.py.bak.<timestamp> /opt/sovereign-strength-api/app/backend/progression_engine.py
    sudo cp /opt/sovereign-strength-api/app/backend/storage.py.bak.<timestamp> /opt/sovereign-strength-api/app/backend/storage.py
    sudo cp /opt/sovereign-strength-api/app/backend/db.py.bak.<timestamp> /opt/sovereign-strength-api/app/backend/db.py
    sudo systemctl restart sovereign-strength-api.service
    sudo systemctl status sovereign-strength-api.service --no-pager -l

## Beta recommendation

Proceed with a controlled beta of 5-20 trusted users.

The goal of beta is not to prove that the system is perfect. It is to test whether the v1.0 loop is understandable, stable, and useful in real use:

forecast → check-in → plan → workout → review → history → next plan
