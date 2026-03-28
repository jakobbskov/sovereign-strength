# SovereignStrength backup and restore procedure

## Purpose

This document defines a practical backup and restore procedure for SovereignStrength data.

The goal is to protect user history and configuration in case of:

- accidental deletion
- bad deployment
- corrupted JSON files
- permission mistakes
- host-level failure

## Runtime data location

Live runtime data is stored under the webroot data directory:

`/var/www/sovereign-strength/data/`

Typical files include:

- `workouts.json`
- `checkins.json`
- `session_results.json`
- `user_settings.json`
- `programs.json`
- `exercises.json`
- `recovery.json`

## Backup scope

### Must be backed up

These files contain meaningful user state and should be included in backups:

- workout history
- check-in history
- session result history
- user settings
- active program data if edited live
- active exercise data if edited live
- recovery data

### Can be recreated or re-seeded more easily

These are lower-priority than user history and should be treated separately when relevant:

- seed data files under source-controlled paths
- rebuildable static frontend files
- generated traces that are useful for debugging but not core user history

## Recommended backup style

Prefer simple versioned snapshots over destructive sync.

Recommended pattern:

- timestamped backup directory
- recursive copy of runtime data
- preserve permissions and timestamps
- optional compressed archive for long-term storage

## Example backup command

    mkdir -p /opt/_backup/sovereign-strength
    ts=$(date +%F_%H%M%S)
    sudo rsync -a /var/www/sovereign-strength/data/ "/opt/_backup/sovereign-strength/data_$ts/"

Optional archive:

    sudo tar -czf "/opt/_backup/sovereign-strength/data_$ts.tar.gz" -C /var/www/sovereign-strength data

## Minimum backup frequency

Recommended minimum:

- before deploys that touch live structure or runtime paths
- before bulk catalog resets
- before permission/ownership changes
- daily or weekly depending on actual usage and tolerance for data loss

## Restore procedure

### 1. Stop making the situation worse

Before restore:

- stop further destructive deploy actions
- confirm which files are missing, corrupted, or wrong
- identify the most recent trustworthy backup

### 2. Restore to a temporary location first

Do not overwrite live data blindly.

    mkdir -p /tmp/sovereign-strength-restore
    sudo rsync -a "/opt/_backup/sovereign-strength/data_YYYY-MM-DD_HHMMSS/" /tmp/sovereign-strength-restore/

Or for an archive:

    mkdir -p /tmp/sovereign-strength-restore
    sudo tar -xzf /opt/_backup/sovereign-strength/data_YYYY-MM-DD_HHMMSS.tar.gz -C /tmp/sovereign-strength-restore

### 3. Validate restored JSON before replacing live files

Example validation:

    python3 -m json.tool /tmp/sovereign-strength-restore/data/workouts.json >/dev/null
    python3 -m json.tool /tmp/sovereign-strength-restore/data/checkins.json >/dev/null
    python3 -m json.tool /tmp/sovereign-strength-restore/data/session_results.json >/dev/null
    python3 -m json.tool /tmp/sovereign-strength-restore/data/user_settings.json >/dev/null

Repeat for any other restored JSON files.

### 4. Restore into live path

After validation:

    sudo rsync -a /tmp/sovereign-strength-restore/data/ /var/www/sovereign-strength/data/

### 5. Fix ownership and permissions if needed

If files were restored with incorrect ownership, backend writes may fail.

Example:

    sudo chown -R www-data:www-data /var/www/sovereign-strength/data

Adjust owner/group to match the actual live service expectations.

### 6. Validate live health after restore

Check that:

- JSON files are still parseable
- the app can read profile/settings data
- check-in can be saved
- workout/session result writes still work
- no permission errors appear in backend logs

## Partial recovery guidance

If only some files are recoverable:

### Prioritize first

1. `user_settings.json`
2. `checkins.json`
3. `workouts.json`
4. `session_results.json`

These are the most important for continuity and recommendation quality.

### Use caution with mixed restore states

Do not assume all files are equally safe to mix across dates.

Examples:

- restoring `user_settings.json` from one date and `session_results.json` from a much older date may create a coherent but stale system state
- restoring only seed-like catalog files is safer than restoring mismatched user history blindly

### When in doubt

Prefer:

- preserving validated user history
- restoring catalog/seed files separately
- documenting what was partially recovered

## Operational warning

Frontend-only deploys must not be treated as if the live webroot contains only static frontend assets.

For the current structure, destructive sync patterns such as:

    rsync -av --delete app/frontend/ /var/www/sovereign-strength/

can remove runtime data paths the app still depends on.

Safer temporary pattern:

    sudo rsync -av /home/jakob/github/sovereign-strength/app/frontend/ /var/www/sovereign-strength/

## Recovery checklist

- identify failure type
- locate latest trustworthy backup
- restore to temp location first
- validate JSON before overwrite
- restore live files
- correct ownership/permissions
- test read + write flows
- document what was restored and what was lost
