from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "deploy_backend_safe.sh"


def test_safe_backend_deploy_script_targets_active_backend_runtime_dir():
    text = SCRIPT.read_text(encoding="utf-8")

    assert 'SRC_DIR="app/backend"' in text
    assert 'TARGET_DIR="/opt/sovereign-strength-api/app/backend"' in text
    assert 'SERVICE_NAME="sovereign-strength-api.service"' in text
    assert '"app.py"' in text
    assert '"progression_engine.py"' in text
    assert '"storage.py"' in text
    assert '"db.py"' in text


def test_safe_backend_deploy_script_validates_all_runtime_modules_before_deploy():
    text = SCRIPT.read_text(encoding="utf-8")

    assert 'for module in "${BACKEND_MODULES[@]}"' in text
    assert 'python3 -m py_compile "${SRC_DIR}/${module}"' in text
    assert 'WorkingDirectory=${TARGET_DIR}' in text
    assert 'app:app' in text


def test_safe_backend_deploy_script_backs_up_and_deploys_all_runtime_modules():
    text = SCRIPT.read_text(encoding="utf-8")

    assert 'sudo cp "${TARGET_DIR}/${module}" "${backup_file}"' in text
    assert 'sudo cp "${SRC_DIR}/${module}" "${TARGET_DIR}/${module}"' in text
    assert 'sudo chown jakob:jakob "${TARGET_DIR}/${module}"' in text
    assert 'sudo chmod 644 "${TARGET_DIR}/${module}"' in text


def test_safe_backend_deploy_script_verifies_runtime_import_map_and_restarts_service():
    text = SCRIPT.read_text(encoding="utf-8")

    assert 'grep -q "def get_today_plan" "${TARGET_DIR}/app.py"' in text
    assert 'python3 -m py_compile "${TARGET_DIR}/${module}"' in text
    assert "import progression_engine" in text
    assert 'expected_root = Path("/opt/sovereign-strength-api/app/backend").resolve()' in text
    assert 'sudo systemctl restart "${SERVICE_NAME}"' in text
    assert 'sudo systemctl status "${SERVICE_NAME}" --no-pager -l' in text
