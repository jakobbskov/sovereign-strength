#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    ROOT / "app/frontend/app.js",
    ROOT / "app/frontend/index.html",
]

SUSPICIOUS_PATTERNS = [
    (r'setText\([^)]*,\s*"[^"]*[A-Za-zÆØÅæøå][^"]*"\s*(?:\+|\))', "Hardcoded string in setText(...)"),
    (r'textContent\s*=\s*"[^"]*[A-Za-zÆØÅæøå][^"]*"', "Hardcoded textContent assignment"),
    (r'innerHTML\s*=\s*`[\s\S]*?[A-Za-zÆØÅæøå]{3,}[\s\S]*?`', "Template literal with visible hardcoded text"),
    (r'placeholder="[^"]*[A-Za-zÆØÅæøå][^"]*"', "Hardcoded placeholder in HTML"),
    (r'data-i18n="[^"]+"\>[^<]*[A-Za-zÆØÅæøå]{3,}[^<]*\<', "HTML contains both data-i18n and visible fallback text"),
    (r'\?\s*`?$', 'Literal "?" fallback in visible rendering'),
]

ALLOW_SUBSTRINGS = [
    'document.title = tr("app.title")',
    'toggleSystemInfo.textContent = tr("button.hide")',
    'data-i18n=',
    'data-i18n-placeholder=',
]

def should_skip(line: str) -> bool:
    return any(token in line for token in ALLOW_SUBSTRINGS)

def audit_file(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    findings: list[str] = []
    lines = text.splitlines()

    for idx, line in enumerate(lines, start=1):
        if should_skip(line):
            continue
        for pattern, label in SUSPICIOUS_PATTERNS:
            if re.search(pattern, line):
                findings.append(f"{path.relative_to(ROOT)}:{idx}: {label}: {line.strip()}")
                break

    return findings

def main() -> int:
    all_findings: list[str] = []

    for path in FILES:
        if not path.exists():
            print(f"Missing file: {path}", file=sys.stderr)
            return 2
        all_findings.extend(audit_file(path))

    if all_findings:
        print("i18n guardrail audit found suspicious UI strings:\n")
        for item in all_findings:
            print(item)
        print("\nReview these manually before merge.")
        return 1

    print("i18n guardrail audit passed: no obvious suspicious UI strings found.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
