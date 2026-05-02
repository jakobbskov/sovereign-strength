from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "deploy_backend_safe.sh"


def test_safe_backend_deploy_script_targets_active_backend_path():
    text = SCRIPT.read_text(encoding="utf-8")

    assert 'SRC_FILE="app/backend/app.py"' in text
    assert 'TARGET_FILE="/opt/sovereign-strength-api/app/backend/app.py"' in text
    assert 'SERVICE_NAME="sovereign-strength-api.service"' in text


def test_safe_backend_deploy_script_validates_before_deploy_and_restarts_service():
    text = SCRIPT.read_text(encoding="utf-8")

    assert 'python3 -m py_compile "${SRC_FILE}"' in text
    assert 'WorkingDirectory=/opt/sovereign-strength-api/app/backend' in text
    assert 'sudo cp "${TARGET_FILE}" "${BACKUP_FILE}"' in text
    assert 'sudo cp "${SRC_FILE}" "${TARGET_FILE}"' in text
    assert 'sudo systemctl restart "${SERVICE_NAME}"' in text
    assert 'sudo systemctl status "${SERVICE_NAME}" --no-pager -l' in text


def test_safe_backend_deploy_script_verifies_deployed_file():
    text = SCRIPT.read_text(encoding="utf-8")

    assert 'grep -q "def get_today_plan" "${TARGET_FILE}"' in text
    assert 'python3 -m py_compile "${TARGET_FILE}"' in text
