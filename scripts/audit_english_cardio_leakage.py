#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app/frontend/app.js"

if not APP.exists():
    print("Missing app/frontend/app.js", file=sys.stderr)
    raise SystemExit(2)

text = APP.read_text(encoding="utf-8")

needles = [
    "snakketempo",
    "roligt løb",
    "god søvn",
    "lav ømhed",
    "belastning er",
    "Hvorfor:",
    "Forsigtig",
    "Belastningsflag",
    "Valgt som rolig cardio i dag",
    "Løb roligt i dag",
]

hits = []
for needle in needles:
    for i, line in enumerate(text.splitlines(), start=1):
        if needle in line:
            hits.append((i, needle, line.strip()))

if hits:
    print("Possible Danish leakage candidates in app/frontend/app.js:\\n")
    for line_no, needle, line in hits:
        print(f"{line_no}: [{needle}] {line}")
    raise SystemExit(1)

print("No obvious Danish leakage candidates found in app/frontend/app.js")
