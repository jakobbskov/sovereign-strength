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
