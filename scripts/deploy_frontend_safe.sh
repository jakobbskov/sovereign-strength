#!/usr/bin/env bash
set -euo pipefail

SRC_ROOT="app/frontend"
TARGET_ROOT="/var/www/sovereign-strength"

FILES=(
  "index.html"
  "app.js"
  "i18n/da.json"
  "i18n/en.json"
)

echo "Safe frontend deploy"
echo "Source: ${SRC_ROOT}"
echo "Target: ${TARGET_ROOT}"
echo

if [[ ! -d "${SRC_ROOT}" ]]; then
  echo "ERROR: Source root not found: ${SRC_ROOT}" >&2
  exit 1
fi

if [[ ! -d "${TARGET_ROOT}" ]]; then
  echo "ERROR: Target root not found: ${TARGET_ROOT}" >&2
  exit 1
fi

for rel in "${FILES[@]}"; do
  if [[ ! -f "${SRC_ROOT}/${rel}" ]]; then
    echo "ERROR: Missing source file: ${SRC_ROOT}/${rel}" >&2
    exit 1
  fi
done

echo "Deploying managed frontend files only..."
for rel in "${FILES[@]}"; do
  echo "-> ${rel}"
  sudo mkdir -p "$(dirname "${TARGET_ROOT}/${rel}")"
  sudo rsync -av "${SRC_ROOT}/${rel}" "${TARGET_ROOT}/${rel}"
done

echo
echo "Post-deploy safety checks..."

if [[ ! -d "${TARGET_ROOT}/assets" ]]; then
  echo "ERROR: assets directory missing after deploy: ${TARGET_ROOT}/assets" >&2
  exit 1
fi

if [[ ! -d "${TARGET_ROOT}/data" ]]; then
  echo "ERROR: data directory missing after deploy: ${TARGET_ROOT}/data" >&2
  exit 1
fi

echo "OK: assets directory still present"
echo "OK: data directory still present"
echo "Frontend deploy completed safely."
