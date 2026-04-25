import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROGRAMS = ROOT / "app/data/seed/programs.json"
DATA_MODEL = ROOT / "docs/data-model.md"

REQUIRED_HYBRID_METADATA = [
    "hybrid_enabled",
    "primary_domain",
    "secondary_domain",
    "cross_domain_fatigue_sensitivity",
    "key_session_protection_needs",
    "lower_body_conflict_sensitivity",
    "hybrid_progression_model",
    "supports_cross_domain_schedule_protection",
    "supports_cross_domain_reduced_day_logic",
]

VALID_PRIMARY_DOMAINS = {
    "strength",
    "run",
    "balanced",
    "recovery",
}

VALID_SECONDARY_DOMAINS = {
    "strength",
    "run",
    "balanced",
    "strength_run",
}

VALID_SENSITIVITY = {
    "low",
    "moderate",
    "high",
}


def _programs():
    return json.loads(PROGRAMS.read_text())


def _hybrid_metadata_targets():
    return [
        item
        for item in _programs()
        if isinstance(item, dict)
        and str(item.get("kind", "")).strip().lower() not in {"mobility", "recovery"}
        and (
            str(item.get("hybrid_profile", "")).strip()
            or str(item.get("kind", "")).strip().lower() in {"hybrid", "mixed"}
        )
    ]


def test_hybrid_relevant_templates_have_cross_domain_metadata():
    programs = _hybrid_metadata_targets()
    assert programs, "No hybrid metadata targets found"

    for program in programs:
        program_id = str(program.get("id", "")).strip()

        for field in REQUIRED_HYBRID_METADATA:
            value = program.get(field)
            assert value not in (None, "", []), (program_id, field)

        assert program["hybrid_enabled"] is True, program_id
        assert program["supports_cross_domain_schedule_protection"] is True, program_id
        assert program["supports_cross_domain_reduced_day_logic"] is True, program_id
        assert program["primary_domain"] in VALID_PRIMARY_DOMAINS, program_id
        assert program["secondary_domain"] in VALID_SECONDARY_DOMAINS, program_id
        assert program["cross_domain_fatigue_sensitivity"] in VALID_SENSITIVITY, program_id
        assert program["lower_body_conflict_sensitivity"] in VALID_SENSITIVITY, program_id
        assert isinstance(program["key_session_protection_needs"], list), program_id
        assert all(str(x).strip() for x in program["key_session_protection_needs"]), program_id


def test_mobility_and_recovery_are_not_forced_into_hybrid_schema():
    support_templates = [
        item
        for item in _programs()
        if isinstance(item, dict)
        and str(item.get("kind", "")).strip().lower() in {"mobility", "recovery"}
    ]

    assert support_templates, "No mobility or recovery support templates found"

    for program in support_templates:
        program_id = str(program.get("id", "")).strip()
        for field in REQUIRED_HYBRID_METADATA:
            assert field not in program, (program_id, field)


def test_hybrid_metadata_schema_is_documented():
    text = DATA_MODEL.read_text()

    for field in REQUIRED_HYBRID_METADATA:
        assert f"`{field}`" in text, field

    assert "intentionally additive" in text
    assert "without changing current runtime behavior" in text


if __name__ == "__main__":
    test_hybrid_relevant_templates_have_cross_domain_metadata()
    test_mobility_and_recovery_are_not_forced_into_hybrid_schema()
    test_hybrid_metadata_schema_is_documented()
    print("Hybrid profile metadata contract tests passed")
