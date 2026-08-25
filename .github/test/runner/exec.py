from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path

from .temp_paths import TempPaths, default_temp_paths


def create_empty_docker_auth_env(*, temp_paths: TempPaths | None = None) -> dict[str, str]:
  """Return env vars that prevent act from sending stale registry credentials."""

  temp_paths = temp_paths or default_temp_paths()
  docker_config_dir = Path(tempfile.mkdtemp(prefix="gh-act-docker-config-"))
  temp_paths.track(docker_config_dir)

  (docker_config_dir / "config.json").write_text('{"auths":{}}\n', encoding="utf-8")

  registry_auth_file = docker_config_dir / "auth.json"
  registry_auth_file.write_text("{}\n", encoding="utf-8")

  return {
    "DOCKER_CONFIG": str(docker_config_dir),
    "REGISTRY_AUTH_FILE": str(registry_auth_file),
  }


def run_invocations(
  invocations: list[list[str]],
  *,
  base_environ: dict[str, str] | None = None,
  runner=subprocess.run,
  temp_paths: TempPaths | None = None,
) -> int:
  temp_paths = temp_paths or default_temp_paths()

  docker_env = create_empty_docker_auth_env(temp_paths=temp_paths)
  env = dict(base_environ or os.environ)
  env.update(docker_env)

  for cmd in invocations:
    print("\n" + " ".join(cmd))
    completed = runner(cmd, check=False, env=env)
    if completed.returncode != 0:
      return completed.returncode

  return 0
