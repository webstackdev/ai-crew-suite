#!/usr/bin/env python3
"""GitHub Action Python Script: Require Playwright Success.

This script acts as a deployment gate by verifying that a specified Playwright
E2E testing workflow has completed successfully for a given Git commit SHA.
It fetches recent completed workflow runs from the GitHub REST API and checks
the most recent match against the expected target SHA. If no successful run is
found, it blocks execution and exits with a non-zero status code.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any


def get_env(name: str, default: str | None = None) -> str:
    """Retrieves an environment variable's value, stripped of whitespace.

    Args:
        name: The name of the environment variable.
        default: The fallback value if the environment variable is empty or unset.

    Returns:
        The stripped string value of the environment variable, or the default.
    """
    value = (os.environ.get(name) or "").strip()
    if value:
        return value
    return default or ""


def get_required_input(name: str) -> str:
    """Retrieves a required GitHub Action input variable.

    GitHub Actions maps inputs to prefixed environment variables (e.g., INPUT_MY_VAR).

    Args:
        name: The case-insensitive name of the action input parameter.

    Returns:
        The cleaned input string value.

    Raises:
        ValueError: If the input is missing or evaluates to an empty string.
    """
    value = get_env(f"INPUT_{name.upper()}")
    if not value:
        raise ValueError(f"Missing required input: {name}")
    return value


def find_success_for_sha(runs: list[dict[str, Any]], expected_sha: str) -> bool:
    """Evaluates a list of workflow runs to check if the latest run for a target SHA succeeded.

    Args:
        runs: A list of workflow run payload dictionaries from the GitHub API.
        expected_sha: The Git commit SHA to evaluate.

    Returns:
        True if the most recent matching run has a conclusion of 'success', otherwise False.
    """
    for workflow_run in runs:
        if (workflow_run or {}).get("head_sha") != expected_sha:
            continue
        return (workflow_run or {}).get("conclusion") == "success"
    return False


def fetch_workflow_runs(
    *,
    api_url: str,
    repository: str,
    workflow_file: str,
    token: str,
    per_page: int,
) -> list[dict[str, Any]]:
    """Queries the GitHub REST API for completed runs of a specific workflow file.

    Args:
        api_url: The base URL for the GitHub API (e.g., https://api.github.com).
        repository: The target repository in 'owner/repo' format.
        workflow_file: The filename of the workflow (e.g., 'playwright.yml').
        token: The GitHub token (Bearer/PAT) used for authentication.
        per_page: The number of run records to request per API page.

    Returns:
        A list of dictionaries representing individual workflow run records.

    Raises:
        RuntimeError: If the HTTP request fails or a connection/URL issue occurs.
    """
    url = (
        f"{api_url}/repos/{repository}/actions/workflows/{workflow_file}/runs"
        f"?status=completed&per_page={per_page}"
    )

    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "webstackbuilders-require-playwright-success",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.load(resp)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"GitHub API GET {url} failed ({exc.code}): {detail}"
        ) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"GitHub API GET {url} failed: {exc}") from exc

    runs = (data or {}).get("workflow_runs") or []
    return list(runs)


def run() -> None:
    """The main entrypoint execution loop for the GitHub Action.

    Gathers required and optional parameters, queries the GitHub API for targeted
    workflow metrics, verifies the status of the requested SHA, and controls the
    system lifecycle exit state.

    Raises:
        ValueError: If critical runtime infrastructure configuration is corrupted.
        SystemExit: Exits with status code 1 if the workflow requirements are unmet.
    """
    token = get_required_input("github_token")
    expected_sha = get_required_input("expected_sha")
    workflow_file = get_env("INPUT_WORKFLOW_FILE", "playwright.yml")

    try:
        per_page = int(get_env("INPUT_PER_PAGE", "50"))
    except ValueError:
        per_page = 50

    api_url = get_env("GITHUB_API_URL", "https://api.github.com")
    repository = get_env("GITHUB_REPOSITORY")
    if "/" not in repository:
        raise ValueError("GITHUB_REPOSITORY is not in 'owner/repo' format")

    runs = fetch_workflow_runs(
        api_url=api_url,
        repository=repository,
        workflow_file=workflow_file,
        token=token,
        per_page=per_page,
    )

    if find_success_for_sha(runs, expected_sha):
        print("✅ Playwright succeeded for this SHA")
        return

    # Check for early development bypass mode
    if get_env("INPUT_PRE_RELEASE_BYPASS", "false").lower() == "true":
        print(
            "⚠️  WARNING: Playwright has not completed successfully for this SHA!",
            file=sys.stderr,
        )
        print(
            "⚠️  [EARLY DEVELOPMENT BYPASS] Allowing deployment anyway. Remember to enforce this check later.",
            file=sys.stderr,
        )
        return

    print(
        "❌ Playwright has not completed successfully for this SHA; aborting deploy.",
        file=sys.stderr,
    )
    raise SystemExit(1)


if __name__ == "__main__":
    run()
