import subprocess
import sys


def test_seed_catalog_integrity_validator_passes():
    result = subprocess.run(
        [sys.executable, "scripts/validate_catalog_integrity.py"],
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    assert "OK: catalog integrity validated" in result.stdout
