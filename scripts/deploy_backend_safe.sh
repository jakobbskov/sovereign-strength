#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="app/backend"
TARGET_DIR="/opt/sovereign-strength-api/app/backend"
SERVICE_NAME="sovereign-strength-api.service"
BACKUP_TS="$(date +%Y%m%d-%H%M%S)"
BACKEND_MODULES=(
  "app.py"
  "progression_engine.py"
  "storage.py"
  "db.py"
)

echo "Safe backend deploy"
echo "Source dir: ${SRC_DIR}"
echo "Target dir: ${TARGET_DIR}"
echo "Service: ${SERVICE_NAME}"
echo

echo "Verifying source and target files..."
for module in "${BACKEND_MODULES[@]}"; do
  if [[ ! -f "${SRC_DIR}/${module}" ]]; then
    echo "ERROR: Source backend file not found: ${SRC_DIR}/${module}" >&2
    exit 1
  fi

  if [[ ! -f "${TARGET_DIR}/${module}" ]]; then
    echo "ERROR: Target backend file not found: ${TARGET_DIR}/${module}" >&2
    exit 1
  fi
done

echo
echo "Validating Python syntax..."
for module in "${BACKEND_MODULES[@]}"; do
  python3 -m py_compile "${SRC_DIR}/${module}"
done

echo
echo "Verifying active systemd backend path..."
if ! systemctl cat "${SERVICE_NAME}" --no-pager -l | grep -q "WorkingDirectory=${TARGET_DIR}"; then
  echo "ERROR: Service WorkingDirectory does not match expected active backend path." >&2
  systemctl cat "${SERVICE_NAME}" --no-pager -l >&2
  exit 1
fi

if ! systemctl cat "${SERVICE_NAME}" --no-pager -l | grep -q "app:app"; then
  echo "ERROR: Service does not appear to run gunicorn app:app." >&2
  systemctl cat "${SERVICE_NAME}" --no-pager -l >&2
  exit 1
fi

echo
echo "Creating backups..."
for module in "${BACKEND_MODULES[@]}"; do
  backup_file="${TARGET_DIR}/${module}.bak.${BACKUP_TS}"
  echo "-> ${backup_file}"
  sudo cp "${TARGET_DIR}/${module}" "${backup_file}"
done

echo
echo "Deploying backend modules..."
for module in "${BACKEND_MODULES[@]}"; do
  sudo cp "${SRC_DIR}/${module}" "${TARGET_DIR}/${module}"
  sudo chown jakob:jakob "${TARGET_DIR}/${module}"
  sudo chmod 644 "${TARGET_DIR}/${module}"
done

echo
echo "Post-copy verification..."
if ! grep -q "def get_today_plan" "${TARGET_DIR}/app.py"; then
  echo "ERROR: Deployed app.py does not look like the expected Flask app." >&2
  exit 1
fi

for module in "${BACKEND_MODULES[@]}"; do
  python3 -m py_compile "${TARGET_DIR}/${module}"
done

echo
echo "Verifying runtime import map..."
(
  cd "${TARGET_DIR}"
  python3 - <<'PY'
import app
import progression_engine
import storage
import db
from pathlib import Path

expected_root = Path("/opt/sovereign-strength-api/app/backend").resolve()
for mod in (app, progression_engine, storage, db):
    path = Path(mod.__file__).resolve()
    print(f"{mod.__name__}: {path}")
    if expected_root not in path.parents and path.parent != expected_root:
        raise SystemExit(f"ERROR: {mod.__name__} imported from unexpected path: {path}")
PY
)

echo
echo "Restarting service..."
sudo systemctl restart "${SERVICE_NAME}"

echo
echo "Checking service status..."
sudo systemctl status "${SERVICE_NAME}" --no-pager -l

echo
echo "Backend deploy completed safely."
echo "Backup timestamp: ${BACKUP_TS}"
