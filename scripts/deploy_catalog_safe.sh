#!/usr/bin/env bash
set -euo pipefail

SRC_ROOT="app/data/seed"
TARGET_ROOT="/var/www/sovereign-strength/data"
BACKUP_TS="$(date +%Y%m%d-%H%M%S)"

FILES=(
  "programs.json"
  "exercises.json"
)

echo "Safe catalog deploy"
echo "Source: ${SRC_ROOT}"
echo "Target: ${TARGET_ROOT}"
echo

if [[ ! -d "${SRC_ROOT}" ]]; then
  echo "ERROR: Source root not found: ${SRC_ROOT}" >&2
  exit 1
fi

if [[ ! -d "${TARGET_ROOT}" ]]; then
  echo "ERROR: Target data root not found: ${TARGET_ROOT}" >&2
  exit 1
fi

for rel in "${FILES[@]}"; do
  if [[ ! -f "${SRC_ROOT}/${rel}" ]]; then
    echo "ERROR: Missing source catalog file: ${SRC_ROOT}/${rel}" >&2
    exit 1
  fi
done

echo "Validating local catalog JSON..."
python3 -m json.tool "${SRC_ROOT}/programs.json" >/dev/null
python3 -m json.tool "${SRC_ROOT}/exercises.json" >/dev/null

echo "Validating catalog integrity..."
python3 scripts/validate_catalog_integrity.py

echo
echo "Creating live catalog backups..."
for rel in "${FILES[@]}"; do
  if [[ ! -f "${TARGET_ROOT}/${rel}" ]]; then
    echo "ERROR: Missing live catalog file: ${TARGET_ROOT}/${rel}" >&2
    exit 1
  fi
  backup_path="${TARGET_ROOT}/${rel}.bak.${BACKUP_TS}"
  echo "-> ${backup_path}"
  sudo cp "${TARGET_ROOT}/${rel}" "${backup_path}"
done

echo
echo "Deploying managed catalog files only..."
for rel in "${FILES[@]}"; do
  echo "-> ${rel}"
  sudo cp "${SRC_ROOT}/${rel}" "${TARGET_ROOT}/${rel}"
  sudo chown root:root "${TARGET_ROOT}/${rel}"
  sudo chmod 644 "${TARGET_ROOT}/${rel}"
done

echo
echo "Post-deploy safety checks..."
for rel in "${FILES[@]}"; do
  if [[ ! -s "${TARGET_ROOT}/${rel}" ]]; then
    echo "ERROR: Deployed catalog file missing or empty: ${TARGET_ROOT}/${rel}" >&2
    exit 1
  fi
  python3 -m json.tool "${TARGET_ROOT}/${rel}" >/dev/null
  echo "OK: ${TARGET_ROOT}/${rel}"
done

echo "Catalog deploy completed safely."
