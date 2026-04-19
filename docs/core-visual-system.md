# SovereignStrength core visual system

## Purpose

This document defines the minimum visual system for SovereignStrength so future interface work can become more consistent without turning into a screen-by-screen redesign.

It is meant to support calm, mobile-first, low-noise product work.

---

## Current implementation reality

SovereignStrength already has a partial visual vocabulary in the frontend:

- cards
- pills
- small supporting text
- button rows
- utility navigation
- wizard navigation
- section-based layout

However, visual decisions are still partly spread across inline styles and local one-off adjustments.

This document defines the core system that should gradually replace that drift.

---

## Design goals

The visual system should support:

- calm hierarchy
- consistency across screens
- clear next actions
- mobile-first readability
- restrained emphasis
- low visual noise

---

## Color roles

Color should be defined by role, not by screen-specific taste.

### 1. Background
Primary app background.

### 2. Surface
Default card and panel surface.

### 3. Elevated surface
Used sparingly for important sections that need stronger separation.

### 4. Border subtle
Default low-contrast separation line.

### 5. Text primary
Main readable text.

### 6. Text muted
Supporting information, timestamps, explanations, secondary metadata.

### 7. Accent
Used for current focus, primary emphasis, and active state.

### 8. Success
Used for confirmed completion or saved state.

### 9. Warning
Used for caution, incomplete setup, or blocked action.

### 10. Danger
Used only for destructive actions or serious errors.

---

## Typography roles

Typography should be role-based and stable.

### 1. Screen title
Main section heading.

### 2. Card title
Primary heading inside a card or panel.

### 3. Metric / hero value
Large focal information such as today type, readiness score, or key state.

### 4. Body text
Default readable content.

### 5. Supporting text
Equivalent to current `.small` usage.

### 6. Label text
Form labels and compact interface labels.

### 7. Status text
Inline success/warning/error feedback.

The product should use fewer text roles consistently rather than inventing new ones per screen.

---

## Spacing scale

Spacing should come from a small repeated scale.

Suggested base scale:

- 4
- 8
- 12
- 16
- 24
- 32

Usage principle:

- 4 to 8: tight internal spacing
- 12 to 16: standard control and card spacing
- 24 to 32: section separation

Avoid ad hoc spacing unless there is a clear structural reason.

---

## Surface rules

### Cards
Cards are the default content container.

Cards should have:
- stable padding
- stable border radius
- stable surface color
- low-noise borders
- clear internal spacing

### Elevated cards
Should only be used for especially important or primary guidance surfaces.

### Inline panels
Used inside cards when a smaller grouped block is needed.

Do not create fake hierarchy by layering too many nested surfaces.

---

## Button hierarchy

### Primary button
Used for the one main next action on a screen or state.

Examples:
- go to check-in
- start workout
- save workout

### Secondary button
Used for valid supporting actions that are less important than the primary action.

### Tertiary / quiet button
Used for lightweight utilities and non-critical actions.

### Destructive button
Reserved for delete or remove actions.

Buttons should communicate hierarchy consistently through treatment, not only position.

---

## Pills / badges / chips

Pills should be used for:

- category labels
- path labels
- state tags
- compact metadata

Pills should stay visually restrained.
They should not become colorful novelty stickers.

They should communicate classification, not excitement.

---

## Divider and section rules

Use dividers when they improve grouping clarity.
Do not add separators where whitespace already solves the problem.

Sections should be visually separated through:

- spacing first
- border second
- background shift only when necessary

---

## Inline style reduction rule

When the same inline visual pattern appears multiple times, it should be moved into a named class.

Typical candidates include:

- repeated `margin-top`
- repeated small status spacing
- repeated card-like inner panels
- repeated action rows
- repeated metadata blocks

The goal is not zero inline styles immediately.
The goal is less visual drift over time.

---

## First implementation targets

The first implementation work following this document should prioritize:

1. button hierarchy
2. card / panel consistency
3. repeated spacing cleanup
4. pill consistency
5. status / helper text consistency

---

## Anti-drift rule

Do not introduce new visual treatments unless they answer one of these:

- does this improve hierarchy?
- does this improve clarity?
- does this improve state recognition?
- does this reduce cognitive load?

If not, it is probably visual drift.
