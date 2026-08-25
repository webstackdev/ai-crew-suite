from __future__ import annotations

import re
from pathlib import Path


def parse_key_value_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue

        # Tolerate common typo: KEY==VALUE (produces value starting with '=')
        # Example: GITHUB_TOKEN=="github_pat_..."
        if value.startswith("="):
            value = value[1:].lstrip()

        # Strip inline comments for unquoted values: KEY=value # comment
        if value and value[0] not in ('"', "'") and "#" in value:
            value = value.split("#", 1)[0].rstrip()

        # Strip wrapping quotes (common in .env files)
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
            value = value[1:-1]

        values[key] = value

    return values


def looks_like_github_token(value: str) -> bool:
    token = (value or "").strip()
    if len(token) < 20:
        return False
    if any(ch.isspace() for ch in token):
        return False

    if token.startswith("github_pat_"):
        return True

    # Common GitHub token prefixes: classic PATs, fine-grained PATs, app/user tokens.
    if re.match(r"^gh[pousr]_[A-Za-z0-9_]+$", token):
        return True

    # Best-effort fallback: allow long URL-safe tokens.
    return re.match(r"^[A-Za-z0-9_.-]+$", token) is not None
