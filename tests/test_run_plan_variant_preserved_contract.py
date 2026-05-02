import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "app" / "backend"
APP_PATH = BACKEND_DIR / "app.py"

sys.path.insert(0, str(BACKEND_DIR))

spec = importlib.util.spec_from_file_location("backend_app", APP_PATH)
backend_app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backend_app)


def test_run_session_type_preserves_plan_variant():
    assert backend_app.normalize_session_type("løb") == "cardio"
    assert backend_app.should_preserve_plan_variant("løb") is True
    assert backend_app.should_preserve_plan_variant("run") is True
    assert backend_app.should_preserve_plan_variant("cardio") is True


def test_unknown_session_type_does_not_preserve_plan_variant():
    assert backend_app.should_preserve_plan_variant("weird") is False
