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
- `styles.css`

### Backend
`/opt/sovereign-strength-api/`

Expected entry point:
- `app.py`

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

Backend deploy should update the live backend entry point directly:

- source: `app/backend/app.py`
- target: `/opt/sovereign-strength-api/app.py`

Then restart:

- `sovereign-strength-api.service`

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
Because future-you is not a mystical being with telepathic access to old server states.
