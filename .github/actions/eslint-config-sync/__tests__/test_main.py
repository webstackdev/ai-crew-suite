from __future__ import annotations

import io
import json
from pathlib import Path
import sys
import urllib.request
import pytest


def load_module():
    """Dynamically registers main.py to cleanly handle relative workspace file actions."""
    action_root = Path(__file__).resolve().parents[1]
    module_path = action_root / "src" / "main.py"

    import importlib.util

    spec = importlib.util.spec_from_file_location("eslint_sync_main", module_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class FakeNetworkStream(io.BytesIO):
    """Simulates an active network response context with file-like structures."""

    pass


def test_fetch_url_success(monkeypatch: pytest.MonkeyPatch) -> None:
    module = load_module()

    def fake_urlopen(_req: str | urllib.request.Request):
        return FakeNetworkStream(b"module.exports = { rules: { 'no-eval': 'error' } };")

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

    result = module.fetch_url("https://github.com")
    assert "no-eval" in result


def test_ask_github_llm_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    module = load_module()

    def fake_urlopen(req: urllib.request.Request):
        url = req.full_url

        # Handle Step 1: Token request mock
        if "copilot_internal/v2/token" in url:
            assert req.get_header("Authorization") == "Bearer mock-token"
            return FakeNetworkStream(b'{"token": "mock-exchanged-copilot-token"}')

        # Handle Step 2: Chat Completion payload mock
        if "api.githubcopilot.com/chat/completions" in url:
            assert (
                req.get_header("Authorization") == "Bearer mock-exchanged-copilot-token"
            )
            response_data = {
                "choices": [
                    {
                        "message": {
                            "content": "### Analysis\n- Upstream added a new core rule."
                        }
                    }
                ]
            }
            return FakeNetworkStream(json.dumps(response_data).encode("utf-8"))

        return FakeNetworkStream(b"{}")

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

    analysis = module.ask_github_llm("mock-token", "Compare these rules.")
    assert "Upstream added a new core rule" in analysis


def test_main_workflow_loop(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Simulates a complete synchronization run inside a mock workspace workspace."""
    module = load_module()

    # Move current execution working context into temporary directory spaces
    monkeypatch.chdir(tmp_path)

    # 1. Mock workspace dependency configurations
    mock_pkg = {"devDependencies": {"@backstage/cli": "^1.24.0"}}
    (tmp_path / "package.json").write_text(json.dumps(mock_pkg))

    # 2. Mock local source file config target
    local_dir = tmp_path / "packages" / "config-eslint" / "src"
    local_dir.mkdir(parents=True)
    (local_dir / "index.ts").write_text("export const config = {};")

    # 3. Establish environmental targets matching active runner layers
    mock_event = {"pull_request": {"comments_url": "https://github.com"}}
    event_file = tmp_path / "event.json"
    event_file.write_text(json.dumps(mock_event))

    monkeypatch.setenv("GITHUB_TOKEN", "mock-token")
    monkeypatch.setenv("GITHUB_EVENT_PATH", str(event_file))

    # 4. Catch all outgoing network loops to mimic raw source targets and comment postings
    network_calls: list[dict[str, str]] = []

    def fake_urlopen(req: str | urllib.request.Request):
        if isinstance(req, str):
            url = req
        else:
            url = req.full_url
            # Type narrowing check for Pyright static analysis compliance
            if req.data is not None and isinstance(req.data, bytes):
                network_calls.append(json.loads(req.data.decode("utf-8")))

        if "://githubusercontent.com" in url:
            return FakeNetworkStream(b"module.exports = { upstream: true };")
        if "api.github.com" in url:
            return FakeNetworkStream(b'{"status": "created"}')

        return FakeNetworkStream(b"")

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

    # 5. Catch internal inferencing systems to isolate prompt loops
    def fake_llm(token: str, prompt: str) -> str:
        return "AI analysis: Config files are drifting apart."

    monkeypatch.setattr(module, "ask_github_llm", fake_llm)

    # Prevent potential program sys.exit codes from shutting down the pytest harness
    try:
        module.main()
    except SystemExit as e:
        assert e.code == 0

    # Verify an automated analysis comment was formatted and submitted
    assert len(network_calls) == 1
    assert "Config files are drifting apart" in network_calls[0]["body"]
