import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROGRAMS = ROOT / "app/data/seed/programs.json"
DATA_MODEL = ROOT / "docs/data-model.md"

REQUIRED_CORE_METADATA = [
    "training_style",
    "program_family",
    "progression_model",
    "fatigue_profile",
    "complexity",
    "tags",
]

REQUIRED_RUNNING_METADATA = [
    "primary_goals",
    "secondary_goals",
    "run_structure_type",
    "impact_profile",
    "hybrid_profile",
    "race_distance_support",
    "event_capability",
    "taper_support",
    "long_run_support",
    "recommended_use_cases",
    "excluded_use_cases",
]

VALID_IMPACT_PROFILES = {
    "low",
    "moderate",
    "moderate_high",
    "high",
    "reentry_protective",
}

VALID_EVENT_CAPABILITY = {
    "none",
    "base_support",
    "race_preparation",
    "event_week_only",
}

VALID_TAPER_SUPPORT = {
    "none",
    "basic",
    "structured",
}

VALID_LONG_RUN_SUPPORT = {
    "none",
    "optional",
    "supportive",
    "central",
}

VALID_HYBRID_PROFILES = {
    "hybrid_compatible",
    "balanced_run_strength",
    "recovery_preserving",
    "run_first",
}


def _run_or_hybrid_programs():
    programs = json.loads(PROGRAMS.read_text())
    return [
        item
        for item in programs
        if isinstance(item, dict)
        and str(item.get("kind", "")).strip().lower() in {"run", "hybrid"}
    ]


def test_run_and_hybrid_templates_have_core_metadata():
    programs = _run_or_hybrid_programs()
    assert programs, "No run or hybrid programs found"

    for program in programs:
        program_id = str(program.get("id", "")).strip()

        for field in REQUIRED_CORE_METADATA:
            value = program.get(field)
            assert value not in (None, "", []), (program_id, field)

        assert isinstance(program["tags"], list), program_id
        assert all(str(x).strip() for x in program["tags"]), program_id


def test_run_and_hybrid_templates_have_running_identity_metadata():
    programs = _run_or_hybrid_programs()

    for program in programs:
        program_id = str(program.get("id", "")).strip()

        for field in REQUIRED_RUNNING_METADATA:
            value = program.get(field)
            assert value not in (None, "", []), (program_id, field)

        for field in [
            "primary_goals",
            "secondary_goals",
            "race_distance_support",
            "recommended_use_cases",
            "excluded_use_cases",
        ]:
            assert isinstance(program[field], list), (program_id, field)
            assert all(str(x).strip() for x in program[field]), (program_id, field)

        assert program["impact_profile"] in VALID_IMPACT_PROFILES, program_id
        assert program["event_capability"] in VALID_EVENT_CAPABILITY, program_id
        assert program["taper_support"] in VALID_TAPER_SUPPORT, program_id
        assert program["long_run_support"] in VALID_LONG_RUN_SUPPORT, program_id
        assert program["hybrid_profile"] in VALID_HYBRID_PROFILES, program_id


def test_running_metadata_schema_is_documented():
    text = DATA_MODEL.read_text()

    for field in REQUIRED_RUNNING_METADATA:
        assert f"`{field}`" in text, field

    assert "intentionally additive" in text
    assert "race-aware planning" in text


if __name__ == "__main__":
    test_run_and_hybrid_templates_have_core_metadata()
    test_run_and_hybrid_templates_have_running_identity_metadata()
    test_running_metadata_schema_is_documented()
    print("Running template metadata schema contract tests passed")
