#!/usr/bin/env python3
"""Monorepo Architecture Linter and Package Validator.

This script enforces naming and directory structure conventions across a Turborepo
monorepo workspace. It scans the `plugins/` directory for `package.json` files and
validates that their internal npm package names match their physical path layout
according to defined category patterns (`core`, `agents`, and `tools`).
"""

import json
import sys
from pathlib import Path

# The expected organizational npm scope prefix for validation
SCOPE = "@ai-crew-suite"


def validate_package(package_json_path: Path) -> tuple[bool, str | None]:
    """Validates a single package.json against monorepo directory structure rules.

    This function matches the physical folder path segments against explicit naming
    conventions for defined categories under the `plugins/` directory.

    Args:
        package_json_path: A Path object pointing to the target package.json file.

    Returns:
        A tuple of (is_valid, detail), where:
          - is_valid: A boolean indicating if the file conforms to the layout rules.
          - detail: The expected package name string if invalid, an error message
            if a file exception occurs, or None if valid/ignored.
    """
    try:
        with open(package_json_path, "r", encoding="utf-8") as f:
            pkg = json.load(f)

        pkg_name = pkg.get("name")
        if not pkg_name or not pkg_name.startswith(f"{SCOPE}/"):
            return True, None

        try:
            rel_path = package_json_path.parent.relative_to(Path.cwd())
        except ValueError:
            return (
                False,
                f"Package file {package_json_path} is outside working directory.",
            )

        segments = list(rel_path.parts)
        if len(segments) < 2 or segments[0] != "plugins":
            return True, None

        expected_name = None
        category = segments[1]

        if category == "core":
            if len(segments) < 3:
                return True, None
            if segments[2] != "infra":
                tier = segments[2]
                expected_name = f"{SCOPE}/core-{tier}"
            else:
                if len(segments) >= 5:
                    domain = segments[3]
                    provider = segments[4]
                    expected_name = f"{SCOPE}/infra-{domain}-{provider}"

        elif category == "agents":
            if len(segments) >= 3:
                if segments[2] == "core-frontend":
                    expected_name = f"{SCOPE}/agent-core-frontend"
                elif len(segments) >= 4:
                    domain = segments[2]
                    tier = segments[3]
                    expected_name = f"{SCOPE}/agent-{domain}-{tier}"

        elif category == "tools":
            if len(segments) >= 4:
                domain = segments[2]
                provider = segments[3]
                expected_name = f"{SCOPE}/tool-{domain}-{provider}"

        if expected_name and pkg_name != expected_name:
            return False, expected_name

        return True, None

    except Exception as e:
        return False, f"Failed to read or parse file: {str(e)}"


def run_scanner() -> int:
    """Discovers and orchestrates the scanning sequence for all package manifests.

    Traverses the workspace starting at `plugins/`, discarding build and runtime
    artifacts like `node_modules`, `dist`, or `.turbo`. It evaluates each manifest
    and logs detailed violation summaries to standard output.

    Returns:
        An exit status integer where 0 indicates complete alignment with the
        structural rules and 1 indicates one or more architecture violations or
        critical configuration failures.
    """
    exit_code = 0
    root_plugins = Path.cwd() / "plugins"

    if not root_plugins.exists():
        print(
            "❌ Error: Must run this script from the root of your turbo monorepo.",
            file=sys.stderr,
        )
        return 1

    print(f"Checking architecture constraints for scope: {SCOPE}...\n")

    for p_json in root_plugins.glob("**/package.json"):
        if (
            "node_modules" in p_json.parts
            or "dist" in p_json.parts
            or ".turbo" in p_json.parts
        ):
            continue

        is_valid, result = validate_package(p_json)
        if not is_valid:
            exit_code = 1
            rel_location = p_json.parent.relative_to(Path.cwd())
            print("❌ Architecture Violation Found!")
            print(f"  Location: {rel_location}")

            if result and result.startswith(SCOPE):
                try:
                    with open(p_json, "r", encoding="utf-8") as f:
                        found_name = json.load(f).get("name")
                except Exception:
                    found_name = "Unknown"
                print(f'  Found   : "{found_name}"')
                print(f'  Expected: "{result}"\n')
            else:
                print(f"  Error   : {result}\n")

    if exit_code == 0:
        print(
            "✅ Success: All internal workspace names perfectly match the structural layout rules."
        )

    return exit_code


if __name__ == "__main__":
    sys.exit(run_scanner())
