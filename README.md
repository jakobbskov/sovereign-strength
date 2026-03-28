# SovereignStrength

SovereignStrength is a local-first, deterministic training system for strength work and simple cardio-aware planning.

It is designed to help a single user plan training, log sessions, and receive explainable feedback without relying on external platforms, cloud AI, or opaque recommendation systems.

## Why it exists

Most training apps are built to increase engagement, collect data, and push generic motivation loops.

SovereignStrength is built for the opposite:

- local data ownership
- deterministic logic
- explainable decisions
- low technical complexity
- repairable architecture

## Training paradigm

SovereignStrength is not built around gamified fitness tracking, fixed motivational loops, or opaque "smart coaching".

Its training logic is closest to:

- autoregulated strength training
- fatigue- and readiness-aware session adjustment
- conservative exercise-level progression
- movement-family-aware planning
- system-oriented load management

In practical terms, this means the system asks:

- what is realistic today?
- what does recent training history suggest?
- should the user progress, hold, simplify, or shift variation?
- what can actually be loaded with the available equipment?
- is a related movement family already showing fatigue signals?

The goal is not maximal novelty or entertainment.

The goal is sustainable training guidance that remains:

- explainable
- repeatable
- calm
- realistic

Philosophically, the system has more in common with regulated adaptation and practical load management than with conventional fitness-app design.

It is closer to a decision-support layer for training than to a workout-content platform.

## Current documented state

The currently documented system includes:

- daily plan generation
- readiness and fatigue-aware decision logic
- progression logic per exercise
- equipment-aware load recommendations
- movement-pattern-aware exercise metadata
- family-based fatigue interpretation
- controlled variation and substitution logic
- forecast output
- authenticated access
- workout logging
- review-oriented feedback

The documented user flow is:

`Forecast -> Check-in -> Plan -> Workout -> Review`

## Core principles

### 1. Local-first
Data is stored locally in JSON files.

### 2. Explainable logic
The system should always be able to explain why it recommends a load, a hold, a lighter session, or a changed variation.

### 3. Deterministic behavior
The same inputs should produce the same outputs.

### 4. Low complexity
The project aims to stay readable and maintainable:

- HTML
- CSS
- Vanilla JavaScript
- Python
- JSON

No unnecessary framework pile-up. Humanity has suffered enough.

## High-level architecture

### Frontend
Static PWA-style frontend served from:

`/var/www/sovereign-strength/`

Primary files:

- `index.html`
- `app.js`
- `styles.css`

### Backend
Python Flask API served via Gunicorn and systemd from:

`/opt/sovereign-strength-api/app.py`

### Data
JSON-based local storage in:

`/var/www/sovereign-strength/data/`

Seed exercise definitions in the repository include movement metadata used by the training engine, including movement patterns, categories, progression modes, and input configuration.

## Documentation

- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [Deployment](docs/deployment.md)
- [Changelog](CHANGELOG.md)

## Planned 1.0 target

Version 1.0 should be considered complete when the system can:

- display the training program
- log sets
- save a workout
- generate a session summary

Not before.

## Repository status

This repository should be the authoritative source for:

- current implementation
- deployment setup
- data contracts
- operating logic
- release history

## License

See [LICENSE](LICENSE).

## UI text and i18n guardrails

Visible frontend text should resolve through the i18n layer wherever practical.

Guardrails:
- avoid shipping hardcoded user-facing strings in render paths when a translation key should exist
- avoid mixed-language UI output in the same screen
- review suspicious `innerHTML`, `setText(...)`, and `textContent` changes carefully
- run `python3 scripts/audit_i18n_guardrails.py` before merging frontend text/rendering changes

This is a lightweight guardrail, not a heavy framework rule.

