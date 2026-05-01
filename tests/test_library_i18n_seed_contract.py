import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROGRAMS = ROOT / "app" / "data" / "seed" / "programs.json"
EXERCISES = ROOT / "app" / "data" / "seed" / "exercises.json"
APP_JS = ROOT / "app" / "frontend" / "app.js"


def load_by_id(path):
    items = json.loads(path.read_text(encoding="utf-8"))
    return {item["id"]: item for item in items}


def test_observed_program_names_are_danish_with_english_fallback():
    programs = load_by_id(PROGRAMS)

    starter = programs["starter_strength_2x"]
    base = programs["base_strength_a"]

    assert starter["name"] == "Kom godt i gang (2 dage/uge)"
    assert starter["name_en"] == "Getting started (2 days/week)"

    assert base["name"] == "Basis (2 dage/uge)"
    assert base["name_en"] == "Base (2 days/week)"


def test_program_day_labels_are_danish_with_label_en_fallback():
    programs = json.loads(PROGRAMS.read_text(encoding="utf-8"))

    for program in programs:
        for day in program.get("days", []):
            label = str(day.get("label", ""))
            if label.startswith("Dag "):
                assert day.get("label_en", "").startswith("Day ")


def test_observed_exercise_names_and_notes_are_danish_where_expected():
    exercises = load_by_id(EXERCISES)

    assert exercises["hollow_body_hold"]["notes"] == "Forside-core og kropsspænding."
    assert exercises["mountain_climbers"]["notes"] == "Core og puls i én øvelse."

    assert exercises["jumping_jacks"]["name"] == "Sprællemænd"
    assert exercises["jumping_jacks"]["notes"] == "Enkel kropsvægt-cardio."

    assert exercises["burpees"]["notes"] == "Højintensiv cardio og helkrop."

    assert exercises["high_knees"]["name"] == "Høje knæløft"
    assert exercises["high_knees"]["notes"] == "Puls og koordination."


def test_program_day_display_uses_display_helper_without_changing_saved_payload():
    js = APP_JS.read_text(encoding="utf-8")

    assert "setText(\"programLoadStatus\", `${getProgramDayDisplayLabel(day)} indlæst med ${STATE.pendingEntries.length} øvelse(r).`);" in js
    assert "label: getProgramDayDisplayLabel(day)," in js
    assert "program_day_label: selectedDay?.label || \"\"," in js
