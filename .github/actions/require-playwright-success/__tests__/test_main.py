from __future__ import annotations

import io
import json
from pathlib import Path
import urllib.error

import pytest


def load_module():
    action_root = Path(__file__).resolve().parents[1]
    module_path = action_root / "src" / "main.py"

    import importlib.util
    import sys

    spec = importlib.util.spec_from_file_location("require_playwright_success", module_path)
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

    class FakeResponse:
        def __init__(self, payload: dict):
            self._raw = json.dumps(payload).encode("utf-8")

        def read(self) -> bytes:
            return self._raw

        def __enter__(self):
            return io.BytesIO(self._raw)

        def __exit__(self, _exc_type, _exc, _tb):
            return False

    def fake_urlopen(_req, timeout: int):
        assert timeout == 30
        return FakeResponse({"workflow_runs": [{"head_sha": "x", "conclusion": "success"}]})

    monkeypatch.setattr(module.urllib.request, "urlopen", fake_urlopen)

    runs = module.fetch_workflow_runs(
        api_url="https://api.github.com",
        repository="webstackdev/astro.webstackbuilders.com",
        workflow_file="playwright.yml",
        token="t",
        per_page=50,
    )
    assert runs == [{"head_sha": "x", "conclusion": "success"}]


def test_fetch_workflow_runs_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    module = load_module()

    def fake_urlopen(_req, timeout: int):
        raise urllib.error.HTTPError(
            url="https://api.github.com/x",
            code=500,
            msg="no",
            hdrs=None,
            fp=io.BytesIO(b"boom"),
        )

    monkeypatch.setattr(module.urllib.request, "urlopen", fake_urlopen)

    with pytest.raises(RuntimeError, match=r"\(500\)"):
        module.fetch_workflow_runs(
            api_url="https://api.github.com",
            repository="webstackdev/astro.webstackbuilders.com",
            workflow_file="playwright.yml",
            token="t",
            per_page=50,
        )
