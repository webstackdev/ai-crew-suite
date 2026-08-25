from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

from .env_parsing import looks_like_github_token, parse_key_value_file
from .paths import (
  env_secret_file,
  env_var_file,
  events_file,
  generic_inputs_file,
  inputs_file,
  ensure_event_file_exists,
  shared_secrets_file,
  workflow_path,
)
from .temp_paths import TempPaths, default_temp_paths
from .yaml_parser import parse_workflow_yaml


def choose_event(events: set[str]) -> str:
  preferred = [
    "workflow_dispatch",
    "pull_request",
    "push",
    "workflow_run",
    "schedule",
  ]
  for item in preferred:
    if item in events:
      return item
  return "push"


def _is_debug_enabled(*, environ: dict[str, str], variables: dict[str, str]) -> bool:
  def _is_one(value: str) -> bool:
    return value.strip() == "1"

  if _is_one(environ.get("DEBUG", "")):
    return True
  if _is_one(variables.get("DEBUG", "")):
    return True
  return False


def write_temp_secrets_file(secrets: dict[str, str], *, temp_paths: TempPaths | None = None) -> Path:
  temp_paths = temp_paths or default_temp_paths()
  fd, file_path = tempfile.mkstemp(prefix="gh-act-secrets-", suffix=".env")
  os.close(fd)
  path = Path(file_path)

  lines: list[str] = []
  for key in sorted(secrets.keys()):
    lines.append(f"{key}={secrets[key]}")

  path.write_text("\n".join(lines) + "\n", encoding="utf-8")
  temp_paths.track(path)
  return path


def _resolve_token_from_shared_env_file(*, repo_root: Path) -> str | None:
  shared = parse_key_value_file(shared_secrets_file(repo_root))
  for key in ("GITHUB_TOKEN", "GH_TOKEN"):
    candidate = (shared.get(key) or "").strip()
    if not candidate:
      continue
    if looks_like_github_token(candidate):
      return candidate

    # If the user has a placeholder/invalid token in the shared file, don't
    # pass it to act since it forces authenticated clones and will fail.
    print(
      f"Warning: {key} in {shared_secrets_file(repo_root)} does not look like a GitHub token; ignoring it.",
      file=sys.stderr,
    )
    return None
  return None


def build_act_invocations(
  *,
  repo_root: Path,
  workflow_name: str,
  environ: dict[str, str] | None = None,
  temp_paths: TempPaths | None = None,
) -> list[list[str]]:
  temp_paths = temp_paths or default_temp_paths()
  environ = environ or dict(os.environ)

  workflow_file = workflow_path(repo_root, workflow_name)
  if not workflow_file.exists():
    raise ValueError(f"Workflow not found: {workflow_file}")

  parsed = parse_workflow_yaml(workflow_file)
  event_name = choose_event(parsed.events)

  event_payload: Path | None = None
  if event_name == "workflow_dispatch":
    if parsed.has_workflow_dispatch_inputs:
      candidate = inputs_file(repo_root, workflow_name)
      if candidate.exists():
        event_payload = candidate
      else:
        generic = generic_inputs_file(repo_root)
        if generic.exists():
          print(
            f"Warning: {candidate} missing; using generic inputs file {generic}.",
            file=sys.stderr,
          )
          event_payload = generic
        else:
          print(
            f"Warning: workflow has workflow_dispatch inputs but no inputs file exists at {candidate}.",
            file=sys.stderr,
          )
    else:
      candidate = events_file(repo_root, "workflow_dispatch")
      ensure_event_file_exists(candidate)
      event_payload = candidate
  else:
    candidate = events_file(repo_root, event_name)
    ensure_event_file_exists(candidate)
    event_payload = candidate

  jobs_to_environment = parsed.jobs_to_environment
  environments: dict[str, list[str]] = {}
  if jobs_to_environment:
    for job_id, environment in jobs_to_environment.items():
      env_name = environment or "testing"
      environments.setdefault(env_name, []).append(job_id)

  invocations: list[list[str]] = []

  secret_file_by_environment: dict[str, Path] = {}
  shared = parse_key_value_file(shared_secrets_file(repo_root))
  token_from_shared_file = _resolve_token_from_shared_env_file(repo_root=repo_root)

  for environment, job_ids in sorted(environments.items()):
    var_file = env_var_file(repo_root, environment)
    if not var_file.exists():
      raise ValueError(f"Missing variables file for environment '{environment}': {var_file}")

    variables = parse_key_value_file(var_file)
    debug_enabled = _is_debug_enabled(environ=environ, variables=variables)

    combined_secrets: dict[str, str] = {}
    combined_secrets.update(shared)
    combined_secrets.update(parse_key_value_file(env_secret_file(repo_root, environment)))

    # Enforce: use token ONLY from `.github/test/env/.env` (shared secrets file).
    # Do not pull tokens from process environment, and do not allow per-env
    # secrets files to override it.
    if token_from_shared_file:
      combined_secrets["GITHUB_TOKEN"] = token_from_shared_file
      combined_secrets["GH_TOKEN"] = token_from_shared_file
    else:
      # If no valid token in the shared file, avoid sending empty/invalid token.
      combined_secrets.pop("GITHUB_TOKEN", None)
      combined_secrets.pop("GH_TOKEN", None)

    if combined_secrets:
      secret_file_by_environment[environment] = write_temp_secrets_file(combined_secrets, temp_paths=temp_paths)

    for job_id in job_ids:
      cmd: list[str] = [
        "gh",
        "act",
        event_name,
      ]
      if debug_enabled:
        cmd.append("--verbose")
        # `--var-file` controls the `vars.*` context, not process env.
        # Also pass DEBUG into the container env so action code can detect it.
        cmd.extend(["--env", "DEBUG=1"])

      cmd.extend([
        "--pull=false",
        "--var-file",
        str(var_file),
      ])

      secret_file_to_use = secret_file_by_environment.get(environment)
      if secret_file_to_use is not None:
        cmd.extend(["--secret-file", str(secret_file_to_use)])
      else:
        print(
          f"Note: no secrets found for environment '{environment}'. "
          "If checkout needs auth, add GITHUB_TOKEN to .github/test/env/.env",
          file=sys.stderr,
        )

      cmd.extend(["-W", str(workflow_file)])
      if event_payload is not None:
        cmd.extend(["-e", str(event_payload)])

      cmd.extend(["-j", job_id])
      invocations.append(cmd)

  if not invocations:
    cmd = ["gh", "act", event_name]
    if _is_debug_enabled(environ=environ, variables={}):
      cmd.append("--verbose")
      cmd.extend(["--env", "DEBUG=1"])
    cmd.extend(["--pull=false", "-W", str(workflow_file)])
    if event_payload is not None:
      cmd.extend(["-e", str(event_payload)])
    invocations.append(cmd)

  return invocations
