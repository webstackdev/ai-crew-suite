from __future__ import annotations

from pathlib import Path
import sys

import pytest


def _import_exec():
  test_root = Path(__file__).resolve().parents[1]
  sys.path.insert(0, str(test_root))
  from runner.exec import create_empty_docker_auth_env, run_invocations
  from runner.temp_paths import TempPaths

  return create_empty_docker_auth_env, run_invocations, TempPaths


def test_create_empty_docker_auth_env_creates_files(tmp_path: Path) -> None:
  create_empty_docker_auth_env, _, TempPaths = _import_exec()

  temp_paths = TempPaths()
  env = create_empty_docker_auth_env(temp_paths=temp_paths)

  assert "DOCKER_CONFIG" in env
  assert "REGISTRY_AUTH_FILE" in env

  docker_config_dir = Path(env["DOCKER_CONFIG"])
  assert (docker_config_dir / "config.json").exists()

  registry_auth_file = Path(env["REGISTRY_AUTH_FILE"])
  assert registry_auth_file.exists()


def test_run_invocations_stops_on_failure(monkeypatch: pytest.MonkeyPatch) -> None:
  _, run_invocations, TempPaths = _import_exec()

  calls: list[list[str]] = []

  class Result:
    def __init__(self, code: int):
      self.returncode = code

  def fake_run(cmd, check, env):
    assert check is False
    assert "DOCKER_CONFIG" in env
    assert "REGISTRY_AUTH_FILE" in env
    calls.append(cmd)
    if cmd[-1] == "fail":
      return Result(2)
    return Result(0)

  invocations = [["echo", "ok"], ["echo", "fail"], ["echo", "after"]]
  exit_code = run_invocations(invocations, runner=fake_run, base_environ={"X": "1"}, temp_paths=TempPaths())

  assert exit_code == 2
  assert calls == [["echo", "ok"], ["echo", "fail"]]
