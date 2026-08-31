from __future__ import annotations

import email.message
import io
import json
from pathlib import Path
import urllib.error
import urllib.request

import pytest


def load_module():
    """Dynamically loads the main.py module to bypass scope pathing issues."""
    action_root = Path(__file__).resolve().parents[1]
    module_path = action_root / "src" / "main.py"

    import importlib.util
    import sys

    spec = importlib.util.spec_from_file_location(
        "require_playwright_success", module_path
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_find_success_for_sha() -> None:
    module = load_module()

    runs = [
        {"head_sha": "aaa", "conclusion": "success"},
        {"head_sha": "bbb", "conclusion": "failure"},
    ]

    assert module.find_success_for_sha(runs, "aaa") is True
    assert module.find_success_for_sha(runs, "bbb") is False
    assert module.find_success_for_sha(runs, "ccc") is False


def test_fetch_workflow_runs_success(monkeypatch: pytest.MonkeyPatch) -> None:
    module = load_module()

    class FakeResponse(io.BytesIO):
        """Simulates a network response stream matching the interface of urlopen."""

        pass  # io.BytesIO already natively provides type-compliant __enter__ and __exit__ methods

    def fake_urlopen(_req: urllib.request.Request, timeout: int):
        assert timeout == 30
        payload = {"workflow_runs": [{"head_sha": "x", "conclusion": "success"}]}
        return FakeResponse(json.dumps(payload).encode("utf-8"))

    monkeypatch.setattr(module.urllib.request, "urlopen", fake_urlopen)

    runs = module.fetch_workflow_runs(
        api_url="https://github.com",
        repository="webstackdev/://webstackbuilders.com",
        workflow_file="playwright.yml",
        token="t",
        per_page=50,
    )
    assert runs == [{"head_sha": "x", "conclusion": "success"}]


def test_fetch_workflow_runs_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    module = load_module()

    def fake_urlopen(_req: urllib.request.Request, timeout: int):
        # Create a valid message container to resolve Pyright's strict structure rule
        blank_headers = email.message.Message()

        raise urllib.error.HTTPError(
            url="https://github.com/x",
            code=500,
            msg="no",
            hdrs=blank_headers,
            fp=io.BytesIO(b"boom"),
        )

    monkeypatch.setattr(module.urllib.request, "urlopen", fake_urlopen)

    with pytest.raises(RuntimeError, match=r"\(500\)"):
        module.fetch_workflow_runs(
            api_url="https://github.com",
            repository="webstackdev/://webstackbuilders.com",
            workflow_file="playwright.yml",
            token="t",
            per_page=50,
        )
