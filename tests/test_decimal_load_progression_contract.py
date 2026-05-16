import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "app/backend"))

from progression_engine import normalize_load_value


def test_normalize_load_value_preserves_decimal_loads():
    assert normalize_load_value(52.5) == 52.5
    assert normalize_load_value("52.5") == 52.5


def test_normalize_load_value_formats_integer_like_values_as_ints():
    assert normalize_load_value(52.0) == 52
    assert normalize_load_value("52.0") == 52
    assert normalize_load_value(52) == 52


def test_progression_engine_no_longer_truncates_actual_possible_next_load():
    source = (ROOT / "app/backend/progression_engine.py").read_text(encoding="utf-8")

    assert "next_load = int(actual_possible_next_load)" not in source
    assert "next_load = normalize_load_value(actual_possible_next_load)" in source
    assert "def normalize_load_value" in source
