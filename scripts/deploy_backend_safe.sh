#!/usr/bin/env bash
set -euo pipefail

SRC_FILE="app/backend/app.py"
TARGET_FILE="/opt/sovereign-strength-api/app/backend/app.py"
SERVICE_NAME="sovereign-strength-api.service"
BACKUP_TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${TARGET_FILE}.bak.${BACKUP_TS}"

echo "Safe backend deploy"
echo "Source: ${SRC_FILE}"
echo "Target: ${TARGET_FILE}"
echo "Service: ${SERVICE_NAME}"
echo

if [[ ! -f "${SRC_FILE}" ]]; then
  echo "ERROR: Source backend file not found: ${SRC_FILE}" >&2
  exit 1
fi

if [[ ! -f "${TARGET_FILE}" ]]; then
  echo "ERROR: Target backend file not found: ${TARGET_FILE}" >&2
  exit 1
fi

echo "Validating Python syntax..."
python3 -m py_compile "${SRC_FILE}"

echo
echo "Verifying active systemd backend path..."
if ! systemctl cat "${SERVICE_NAME}" --no-pager -l | grep -q "WorkingDirectory=/opt/sovereign-strength-api/app/backend"; then
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
echo "Creating backup..."
echo "-> ${BACKUP_FILE}"
sudo cp "${TARGET_FILE}" "${BACKUP_FILE}"

echo
echo "Deploying backend..."
sudo cp "${SRC_FILE}" "${TARGET_FILE}"
sudo chown jakob:jakob "${TARGET_FILE}"
sudo chmod 644 "${TARGET_FILE}"

echo
echo "Restarting service..."
sudo systemctl restart "${SERVICE_NAME}"

echo
echo "Checking service status..."
sudo systemctl status "${SERVICE_NAME}" --no-pager -l

echo
echo "Post-deploy verification..."
if ! grep -q "def get_today_plan" "${TARGET_FILE}"; then
  echo "ERROR: Deployed backend file does not look like the expected Flask app." >&2
  exit 1
fi

python3 -m py_compile "${TARGET_FILE}"

echo
echo "Backend deploy completed safely."
echo "Backup: ${BACKUP_FILE}"
