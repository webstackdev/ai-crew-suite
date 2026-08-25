from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any


def get_env(name: str, default: str | None = None) -> str:
    value = (os.environ.get(name) or "").strip()
    if value:
        return value
    return default or ""


def get_required_input(name: str) -> str:
    value = get_env(f"INPUT_{name.upper()}")
    if not value:
        raise ValueError(f"Missing required input: {name}")
    return value


def find_success_for_sha(runs: list[dict[str, Any]], expected_sha: str) -> bool:
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
        raise RuntimeError(f"GitHub API GET {url} failed ({exc.code}): {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"GitHub API GET {url} failed: {exc}") from exc

    runs = (data or {}).get("workflow_runs") or []
    return list(runs)


def run() -> None:
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

    print("❌ Playwright has not completed successfully for this SHA; aborting deploy.", file=sys.stderr)
    raise SystemExit(1)


if __name__ == "__main__":
    run()
