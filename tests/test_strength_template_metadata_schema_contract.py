import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROGRAMS = ROOT / "app/data/seed/programs.json"
DATA_MODEL = ROOT / "docs/data-model.md"

REQUIRED_STRENGTH_METADATA = [
    "primary_goals",
    "secondary_goals",
    "recovery_sensitivity",
    "hybrid_profile",
    "recommended_use_cases",
    "excluded_use_cases",
]

VALID_RECOVERY_SENSITIVITY = {
    "low",
    "moderate",
    "high",
}

VALID_HYBRID_PROFILES = {
    "strength_first",
    "balanced_mixed_training",
    "strength_supports_mixed_training",
    "recovery_preserving",
}


def _strength_programs():
    programs = json.loads(PROGRAMS.read_text())
    return [
        item
        for item in programs
        if isinstance(item, dict)
        and str(item.get("kind", "")).strip().lower() == "strength"
    ]


def test_strength_templates_have_richer_identity_metadata():
    programs = _strength_programs()
    assert programs, "No strength programs found"

    for program in programs:
        program_id = str(program.get("id", "")).strip()

        for field in REQUIRED_STRENGTH_METADATA:
            value = program.get(field)
            assert value not in (None, "", []), (program_id, field)

        for field in [
            "primary_goals",
            "secondary_goals",
            "recommended_use_cases",
            "excluded_use_cases",
        ]:
            assert isinstance(program[field], list), (program_id, field)
            assert all(str(x).strip() for x in program[field]), (program_id, field)

        assert program["recovery_sensitivity"] in VALID_RECOVERY_SENSITIVITY, program_id
        assert program["hybrid_profile"] in VALID_HYBRID_PROFILES, program_id


def test_strength_template_metadata_preserves_existing_selector_fields():
    programs = _strength_programs()

    preserved = [
        "recommended_levels",
        "supported_goals",
        "supported_weekly_sessions",
        "equipment_profiles",
        "training_style",
        "program_family",
        "progression_model",
        "fatigue_profile",
        "complexity",
        "good_for_reentry",
        "good_for_concurrent_running",
        "session_duration_min",
        "session_duration_max",
        "tags",
    ]

    for program in programs:
        program_id = str(program.get("id", "")).strip()
        for field in preserved:
            assert program.get(field) not in (None, "", []), (program_id, field)


def test_strength_metadata_schema_is_documented():
    text = DATA_MODEL.read_text()

    for field in REQUIRED_STRENGTH_METADATA:
        assert f"`{field}`" in text, field

    assert "intentionally additive" in text


if __name__ == "__main__":
    test_strength_templates_have_richer_identity_metadata()
    test_strength_template_metadata_preserves_existing_selector_fields()
    test_strength_metadata_schema_is_documented()
    print("Strength template metadata schema contract tests passed")
