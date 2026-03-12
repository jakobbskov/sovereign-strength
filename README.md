# Sovereign Strength

Sovereign Strength is a local-first, self-hosted web application for strength training, physical development, and structured exercise planning.

The application is designed to support practical, explainable, and sustainable training decisions. The goal is not motivational theater or fitness-platform noise, but a calm and reliable system for managing training with readable logic and user-controlled data.

## Purpose

Sovereign Strength helps the user:

- track training sessions and exercise performance
- structure progression over time
- support training decisions with understandable logic
- adapt training load and planning to real conditions
- use a self-hosted solution with controlled data and development direction

## Design principles

- local-first
- self-hosted
- no tracking
- readable and explainable logic
- practical rather than bloated
- structured progression support
- long-term maintainability

## Operational overview

**Current host:** `Beelink`  
**Application family:** `Sovereign` self-hosted tools

## Architecture

Sovereign Strength is intended as a lightweight self-hosted training application with understandable state, rule-based logic, and user-controlled data.

### Frontend

The frontend contains the user-facing interface and exercise interaction logic.

### Backend

The backend and runtime structure should be documented further as the repository is expanded.

### Data

The application uses structured training data, progression state, and exercise-related logic. The exact live data model should be documented in more detail in `docs/data-model.md`.

## Expected functional scope

The application is intended to support, among other things:

- exercise tracking
- rep and load registration
- progression monitoring
- session planning
- training adjustment logic
- self-hosted data control

## Repository scope

This repository is intended to document:

- application code
- architecture
- deployment
- data model
- version history

Production data, private health-related records, secrets, and environment-specific runtime files must not be stored in the repository.

## Documentation

Additional documentation is stored in `docs/`:

- `docs/architecture.md`
- `docs/deployment.md`
- `docs/data-model.md`

## Status

Sovereign Strength is under active development as part of the Sovereign family of self-hosted tools.

The repository currently serves as the initial documentation and structure baseline for the application.
