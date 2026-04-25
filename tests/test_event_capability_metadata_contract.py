import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROGRAMS = ROOT / "app/data/seed/programs.json"
DATA_MODEL = ROOT / "docs/data-model.md"

REQUIRED_EVENT_METADATA = [
    "supports_event_target",
    "supported_event_types",
    "event_date_required_for_full_behavior",
    "supports_phase_shift",
    "supports_taper",
    "supports_strength_adjustment_around_event",
    "supports_hybrid_event_coordination",
    "event_priority_behavior",
    "race_specificity_level",
]

VALID_EVENT_TYPES = {
    "5k",
    "10k",
    "half_marathon",
}

VALID_EVENT_PRIORITY_BEHAVIOR = {
    "ignore_event",
    "base_support_optional",
    "event_target_optional",
    "event_target_required",
}

VALID_RACE_SPECIFICITY_LEVEL = {
    "none",
    "optional",
    "strong",
}


def _programs():
    return json.loads(PROGRAMS.read_text())


def _event_capability_targets():
    return [
        item
        for item in _programs()
        if isinstance(item, dict)
        and str(item.get("kind", "")).strip().lower() in {"run", "hybrid", "mixed"}
    ]


def test_run_hybrid_and_mixed_templates_declare_event_capability():
    programs = _event_capability_targets()
    assert programs, "No event-capability templates found"

    for program in programs:
        program_id = str(program.get("id", "")).strip()

        for field in REQUIRED_EVENT_METADATA:
            assert field in program, (program_id, field)

        assert isinstance(program["supports_event_target"], bool), program_id
        assert isinstance(program["supported_event_types"], list), program_id
        assert isinstance(program["event_date_required_for_full_behavior"], bool), program_id
        assert isinstance(program["supports_phase_shift"], bool), program_id
        assert isinstance(program["supports_taper"], bool), program_id
        assert isinstance(program["supports_strength_adjustment_around_event"], bool), program_id
        assert isinstance(program["supports_hybrid_event_coordination"], bool), program_id

        for event_type in program["supported_event_types"]:
            assert event_type in VALID_EVENT_TYPES, (program_id, event_type)

        assert program["event_priority_behavior"] in VALID_EVENT_PRIORITY_BEHAVIOR, program_id
        assert program["race_specificity_level"] in VALID_RACE_SPECIFICITY_LEVEL, program_id


def test_non_event_templates_do_not_claim_taper_or_phase_behavior():
    programs = _event_capability_targets()

    for program in programs:
        program_id = str(program.get("id", "")).strip()
        if program["race_specificity_level"] == "none":
            assert program["supports_event_target"] is False, program_id
            assert program["supported_event_types"] == [], program_id
            assert program["supports_phase_shift"] is False, program_id
            assert program["supports_taper"] is False, program_id
            assert program["event_priority_behavior"] == "ignore_event", program_id


def test_base_support_templates_are_event_optional_and_non_tapering():
    programs = _event_capability_targets()

    for program in programs:
        program_id = str(program.get("id", "")).strip()
        if program["race_specificity_level"] == "optional":
            assert program["supports_event_target"] is True, program_id
            assert program["supported_event_types"], program_id
            assert program["event_date_required_for_full_behavior"] is False, program_id
            assert program["supports_taper"] is False, program_id
            assert program["event_priority_behavior"] == "base_support_optional", program_id


def test_event_capability_schema_is_documented():
    text = DATA_MODEL.read_text()

    for field in REQUIRED_EVENT_METADATA:
        assert f"`{field}`" in text, field

    assert "These event-capability fields are intentionally additive." in text
    assert "without leaking taper or event logic into general-purpose templates" in text


if __name__ == "__main__":
    test_run_hybrid_and_mixed_templates_declare_event_capability()
    test_non_event_templates_do_not_claim_taper_or_phase_behavior()
    test_base_support_templates_are_event_optional_and_non_tapering()
    test_event_capability_schema_is_documented()
    print("Event capability metadata contract tests passed")
