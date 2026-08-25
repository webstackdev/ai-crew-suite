from __future__ import annotations

from pathlib import Path


def repo_root_from(path_in_repo: Path) -> Path:
  """Find the repository root directory.

  Historically the runner lived at `.github/test/runner.py`, but it now also
  calls this function from modules under `.github/test/runner/`.

  We avoid fixed parent offsets and instead walk up until we find a directory
  that looks like the repo root.
  """

  current = path_in_repo.resolve()
  if current.is_file():
    current = current.parent

  for _ in range(25):
    if (current / ".git").exists():
      return current
    current = current.parent

  raise ValueError(f"Unable to determine repo root from: {path_in_repo}")


def workflow_path(repo_root: Path, workflow_name: str) -> Path:
  workflow_file_name = f"{workflow_name}.yml"
  return repo_root / ".github" / "workflows" / workflow_file_name


def events_file(repo_root: Path, event_name: str) -> Path:
  return repo_root / ".github" / "test" / "events" / f"{event_name}.events.json"


def inputs_file(repo_root: Path, workflow_name: str) -> Path:
  return repo_root / ".github" / "test" / "inputs" / f"{workflow_name}.json"


def generic_inputs_file(repo_root: Path) -> Path:
  return repo_root / ".github" / "test" / "inputs" / "generic.json"


def env_var_file(repo_root: Path, environment: str) -> Path:
  return repo_root / ".github" / "test" / "env" / f".env.github.{environment}.variables"


def env_secret_file(repo_root: Path, environment: str) -> Path:
  return repo_root / ".github" / "test" / "env" / f".env.github.{environment}.secrets"


def shared_secrets_file(repo_root: Path) -> Path:
  return repo_root / ".github" / "test" / "env" / ".env"


def ensure_event_file_exists(path: Path) -> None:
  if path.exists():
    return
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_text("{}\n", encoding="utf-8")


def read_lines(path: Path) -> list[str]:
  return path.read_text(encoding="utf-8").splitlines()
