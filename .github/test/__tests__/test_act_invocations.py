from __future__ import annotations

from pathlib import Path
import sys

import pytest


def _import_act_invocations():
  test_root = Path(__file__).resolve().parents[1]
  sys.path.insert(0, str(test_root))

  from runner.act_invocations import build_act_invocations, choose_event
  from runner.temp_paths import TempPaths

  return build_act_invocations, choose_event, TempPaths


def _write(path: Path, content: str) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_text(content, encoding="utf-8")


def test_choose_event_prefers_workflow_dispatch() -> None:
  _, choose_event, _ = _import_act_invocations()
  assert choose_event({"push", "workflow_dispatch"}) == "workflow_dispatch"
  assert choose_event({"push"}) == "push"
  assert choose_event(set()) == "push"


def test_build_act_invocations_groups_jobs_by_environment(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
  build_act_invocations, _, TempPaths = _import_act_invocations()

  repo_root = tmp_path
  _write(
    repo_root / ".github" / "workflows" / "cron.yml",
    """name: Cron
on:
  push:
jobs:
  a:
    runs-on: ubuntu-latest
    environment: production
  b:
    runs-on: ubuntu-latest
""",
  )

  _write(repo_root / ".github" / "test" / "events" / "push.events.json", "{}\n")
  _write(repo_root / ".github" / "test" / "env" / ".env.github.production.variables", "FOO=bar\nDEBUG=1\n")
  _write(repo_root / ".github" / "test" / "env" / ".env.github.testing.variables", "BAZ=qux\nDEBUG=1\n")
  _write(repo_root / ".github" / "test" / "env" / ".env", "# shared\n")

  temp_paths = TempPaths()
  invocations = build_act_invocations(repo_root=repo_root, workflow_name="cron", temp_paths=temp_paths)

  assert len(invocations) == 2
  all_cmds = "\n".join(" ".join(cmd) for cmd in invocations)
  assert "gh act push" in all_cmds
  assert "--verbose" in all_cmds
  assert "--env DEBUG=1" in all_cmds
  assert "--pull=false" in all_cmds
  assert "-W" in all_cmds
  assert str(repo_root / ".github" / "workflows" / "cron.yml") in all_cmds
  assert "-e" in all_cmds
  assert str(repo_root / ".github" / "test" / "events" / "push.events.json") in all_cmds

  # One job uses production vars, the other defaults to testing vars.
  assert str(repo_root / ".github" / "test" / "env" / ".env.github.production.variables") in all_cmds
  assert str(repo_root / ".github" / "test" / "env" / ".env.github.testing.variables") in all_cmds

  # No secrets were provided, so no secrets file is generated.
  assert "--secret-file" not in all_cmds


def test_build_act_invocations_ignores_process_env_token(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
  build_act_invocations, _, TempPaths = _import_act_invocations()

  repo_root = tmp_path
  _write(
    repo_root / ".github" / "workflows" / "cron.yml",
    """name: Cron
on:
  push:
jobs:
  a:
    runs-on: ubuntu-latest
""",
  )

  # Shared secrets file token should be used.
  _write(
    repo_root / ".github" / "test" / "env" / ".env",
    'GITHUB_TOKEN="github_pat_' + ("a" * 50) + '"\n',
  )
  _write(repo_root / ".github" / "test" / "env" / ".env.github.testing.variables", "X=1\n")
  _write(repo_root / ".github" / "test" / "events" / "push.events.json", "{}\n")

  # Process env token should be ignored even if set.
  monkeypatch.setenv("GITHUB_TOKEN", "not-a-real-token")
  monkeypatch.setenv("GH_TOKEN", "also-not-a-real-token")

  invocations = build_act_invocations(repo_root=repo_root, workflow_name="cron", temp_paths=TempPaths())
  assert len(invocations) == 1

  joined = " ".join(invocations[0])
  assert "--secret-file" in joined


def test_build_act_invocations_uses_inputs_file_for_dispatch_with_inputs(tmp_path: Path) -> None:
  build_act_invocations, _, TempPaths = _import_act_invocations()

  repo_root = tmp_path
  _write(
    repo_root / ".github" / "workflows" / "manual.yml",
    """name: Manual
on:
  workflow_dispatch:
    inputs:
      thing:
        required: true
jobs:
  run:
    runs-on: ubuntu-latest
""",
  )

  _write(repo_root / ".github" / "test" / "inputs" / "manual.json", "{\"inputs\": {\"thing\": \"x\"}}\n")

  # jobs_to_environment is {run: None} so environment defaults to testing
  _write(repo_root / ".github" / "test" / "env" / ".env.github.testing.variables", "X=1\nDEBUG=1\n")

  invocations = build_act_invocations(repo_root=repo_root, workflow_name="manual", temp_paths=TempPaths())
  assert len(invocations) == 1

  cmd = invocations[0]
  joined = " ".join(cmd)
  assert "gh act workflow_dispatch" in joined
  assert "--verbose" in joined
  assert "--env DEBUG=1" in joined
  assert "-e" in joined
  assert str(repo_root / ".github" / "test" / "inputs" / "manual.json") in joined


def test_build_act_invocations_creates_event_payload_file_if_missing(tmp_path: Path) -> None:
  build_act_invocations, _, TempPaths = _import_act_invocations()

  repo_root = tmp_path
  _write(
    repo_root / ".github" / "workflows" / "push_only.yml",
    """name: PushOnly
on:
  push:
jobs:
  run:
    runs-on: ubuntu-latest
""",
  )
  _write(repo_root / ".github" / "test" / "env" / ".env.github.testing.variables", "X=1\nDEBUG=1\n")

  event_payload_path = repo_root / ".github" / "test" / "events" / "push.events.json"
  assert event_payload_path.exists() is False

  invocations = build_act_invocations(repo_root=repo_root, workflow_name="push_only", temp_paths=TempPaths())
  assert event_payload_path.exists() is True

  cmd = " ".join(invocations[0])
  assert "--verbose" in cmd
  assert "--env DEBUG=1" in cmd
  assert str(event_payload_path) in cmd


def test_build_act_invocations_no_verbose_without_debug(tmp_path: Path) -> None:
  build_act_invocations, _, TempPaths = _import_act_invocations()

  repo_root = tmp_path
  _write(
    repo_root / ".github" / "workflows" / "push_only.yml",
    """name: PushOnly
on:
  push:
jobs:
  run:
    runs-on: ubuntu-latest
""",
  )
  _write(repo_root / ".github" / "test" / "env" / ".env.github.testing.variables", "X=1\n")
  _write(repo_root / ".github" / "test" / "events" / "push.events.json", "{}\n")

  invocations = build_act_invocations(repo_root=repo_root, workflow_name="push_only", temp_paths=TempPaths())
  assert len(invocations) == 1
  assert "--verbose" not in " ".join(invocations[0])
  assert "--env DEBUG=1" not in " ".join(invocations[0])


def test_build_act_invocations_verbose_from_shell_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
  build_act_invocations, _, TempPaths = _import_act_invocations()

  repo_root = tmp_path
  _write(
    repo_root / ".github" / "workflows" / "push_only.yml",
    """name: PushOnly
on:
  push:
jobs:
  run:
    runs-on: ubuntu-latest
""",
  )
  _write(repo_root / ".github" / "test" / "env" / ".env.github.testing.variables", "X=1\n")
  _write(repo_root / ".github" / "test" / "events" / "push.events.json", "{}\n")
  monkeypatch.setenv("DEBUG", "1")

  invocations = build_act_invocations(repo_root=repo_root, workflow_name="push_only", temp_paths=TempPaths())
  assert len(invocations) == 1
  joined = " ".join(invocations[0])
  assert "--verbose" in joined
  assert "--env DEBUG=1" in joined
