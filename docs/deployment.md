# Deployment

## Overview

SovereignStrength is documented as a self-hosted local-first application with:

- static frontend files
- Flask API backend
- local JSON storage
- Gunicorn
- systemd
- unix socket communication

## Host paths

### Frontend
`/var/www/sovereign-strength/`

Expected files:
- `index.html`
- `app.js`
- `i18n/da.json`
- `i18n/en.json`

### Backend runtime
Gunicorn runs from:

`/opt/sovereign-strength-api/app/backend/`

Runtime entry point used by the service:
- `/opt/sovereign-strength-api/app/backend/app.py`

Python virtual environment:
- `/opt/sovereign-strength-api/.venv/`

### Backend seed data used by runtime
Backend catalog reset endpoints read seed files from:

`/opt/sovereign-strength-api/app/data/seed/`

Runtime seed files:
- `/opt/sovereign-strength-api/app/data/seed/exercises.json`
- `/opt/sovereign-strength-api/app/data/seed/programs.json`

### Data
`/var/www/sovereign-strength/data/`

## Runtime data safety

Runtime JSON data lives under:

`/var/www/sovereign-strength/data/`

This path is operationally sensitive.

It contains live application state such as:

- check-ins
- workouts
- session results
- user settings
- adaptation state

That means frontend deploy workflow must not treat the live web root as a disposable static-output directory.

### Forbidden deploy pattern

Do not run a frontend deploy like this against the live root:

`rsync -av --delete app/frontend/ /var/www/sovereign-strength/`

Why this is dangerous:

- `app/frontend/` is only the frontend source subtree
- `/var/www/sovereign-strength/` is not a frontend-only target
- the live root may also coexist with runtime-sensitive paths and files
- `--delete` can therefore remove data or other live files that are not present in the frontend source tree

### Safe frontend deploy

Deploy frontend files explicitly and without destructive delete semantics against the live root.

Documented safe path:
- use `scripts/deploy_frontend_safe.sh`

This script intentionally:
- deploys only repo-managed frontend files
- avoids broad destructive sync against the live root
- checks that runtime-sensitive live directories such as `assets/` and `data/` still exist after deploy

Current managed frontend file list in the safe script:
- `index.html`
- `app.js`
- `i18n/da.json`
- `i18n/en.json`

If additional frontend-managed files are added later, update the script in the same change.
Do not use broad `--delete` sync against `/var/www/sovereign-strength/`.

### Safe backend deploy

Backend deploy must target the runtime path actually used by the systemd service.

Source files in repo:
- `app/backend/app.py`
- `app/data/seed/exercises.json`
- `app/data/seed/programs.json` (when changed)

Runtime targets:
- `/opt/sovereign-strength-api/app/backend/app.py`
- `/opt/sovereign-strength-api/app/data/seed/exercises.json`
- `/opt/sovereign-strength-api/app/data/seed/programs.json`

Minimum backend deploy steps:
- sync `app/backend/app.py` to `/opt/sovereign-strength-api/app/backend/app.py`
- sync changed seed catalog files to `/opt/sovereign-strength-api/app/data/seed/`
- restart `sovereign-strength-api.service`

Important operational rule:
Frontend deploy does not deploy backend seed catalog files.
If exercise or program metadata changes in seed files, those seed files must be deployed explicitly to backend runtime paths.

### Minimum post-deploy checks

After deploy, verify at minimum:

- frontend files are present in the expected live locations
- i18n files are present under `/var/www/sovereign-strength/i18n/`
- runtime data still exists under `/var/www/sovereign-strength/data/`
- backend service is active
- `GET /api/health` returns healthy
- at least one core user flow still works

### Restore reality

A bad frontend deploy can require runtime data restore.

A known restore source used in practice was:

`/home/jakob/backups/sovereign-strength-deploy-20260320-055123/data/`

The operational lesson is simple:

- static frontend deploy is not allowed to casually touch runtime data
- restore is recovery, not a normal deploy step

## Backend runtime

The documented backend runtime consists of:

- Flask application
- Gunicorn process manager
- systemd unit
- unix socket

Documented service name:

`sovereign-strength-api.service`

Documented socket path:

`/home/jakob/nextcloud/nginx/html/strength-api.sock`

## Authentication

The documented login endpoint is:

`POST /auth/login`

Session handling is cookie-based.

Authenticated users can:

- fetch plan data
- register workouts
- fetch progression data

## Primary application endpoint

The documented planning endpoint is:

`GET /plan/today`

Documented decision mode:

`fatigue_primary_v1`

Documented inputs include:

- readiness
- fatigue
- days since last strength session
- time budget

## Plan variants

The current documented plan variants are:

- `short_20`
- `short_30`
- `light_strength`

Example documented rule:

- if `fatigue_score >= 2`, use `light_strength`

## Operational expectations

A healthy deployment should allow the following:

- frontend loads correctly
- authenticated session works
- `GET /plan/today` responds as expected
- workout data can be written to JSON
- progression decisions are explainable
- no external APIs are required for core behavior

## Documentation rule

This file should describe actual deployment, not desired deployment.

If the socket path, service name, reverse proxy path, or file locations change, update this document in the same commit.

This document must describe the real systemd WorkingDirectory and runtime import path.
Do not document `/opt/sovereign-strength-api/app.py` as the live backend entry point unless the service is changed accordingly.
Because future-you is not a mystical being with telepathic access to old server states.
