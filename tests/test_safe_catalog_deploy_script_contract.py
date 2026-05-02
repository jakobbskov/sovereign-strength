from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "deploy_catalog_safe.sh"


def test_safe_catalog_deploy_script_exists_and_is_catalog_only():
    text = SCRIPT.read_text(encoding="utf-8")

    assert 'SRC_ROOT="app/data/seed"' in text
    assert 'TARGET_ROOT="/var/www/sovereign-strength/data"' in text
    assert '"programs.json"' in text
    assert '"exercises.json"' in text

    assert "rsync" not in text
    assert "rm -rf" not in text
    assert "workouts.json" not in text
    assert "user_settings.json" not in text
    assert "checkins.json" not in text


def test_safe_catalog_deploy_script_validates_and_backs_up_before_copy():
    text = SCRIPT.read_text(encoding="utf-8")

    assert 'python3 -m json.tool "${SRC_ROOT}/programs.json" >/dev/null' in text
    assert 'python3 -m json.tool "${SRC_ROOT}/exercises.json" >/dev/null' in text
    assert "python3 scripts/validate_catalog_integrity.py" in text
    assert 'backup_path="${TARGET_ROOT}/${rel}.bak.${BACKUP_TS}"' in text
    assert 'sudo cp "${TARGET_ROOT}/${rel}" "${backup_path}"' in text
    assert 'sudo cp "${SRC_ROOT}/${rel}" "${TARGET_ROOT}/${rel}"' in text
    assert 'sudo chmod 644 "${TARGET_ROOT}/${rel}"' in text
