# Data model

## Overview

SovereignStrength uses local JSON files as its primary persistence model.

This is a deliberate design choice:

- simple to inspect
- easy to back up
- easy to repair
- no hidden state in external services

## Core documented files

### `user_settings.json`

Stores user-specific equipment increments and related profile settings.

Example structure:

```json
{
  "user_id": 1,
  "equipment_increments": {
    "barbell": 10,
    "dumbbell": 5,
    "machine": 5,
    "cable": 5,
    "bodyweight": 0
  }
}