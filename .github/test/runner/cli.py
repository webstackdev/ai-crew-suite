from __future__ import annotations

import sys
from pathlib import Path

from .act_invocations import build_act_invocations
from .exec import run_invocations
from .paths import repo_root_from


def list_workflow_names(repo_root: Path) -> list[str]:
  workflows_dir = repo_root / ".github" / "workflows"
  workflow_files = sorted(workflows_dir.glob("*.yml"))
  return [path.stem for path in workflow_files]


def main(argv: list[str]) -> int:
  repo_root = repo_root_from(Path(__file__))
  workflow_name = argv[1].strip() if len(argv) >= 2 else ""

  if workflow_name:
    invocations = build_act_invocations(repo_root=repo_root, workflow_name=workflow_name)
    return run_invocations(invocations)

  workflow_names = list_workflow_names(repo_root)
  if not workflow_names:
    print("No workflows found in .github/workflows", file=sys.stderr)
    return 2

  print("No workflow name provided; running all workflows.", file=sys.stderr)
  for name in workflow_names:
    print(f"\n=== Workflow: {name} ===", file=sys.stderr)
    exit_code = run_invocations(build_act_invocations(repo_root=repo_root, workflow_name=name))
    if exit_code != 0:
      return exit_code

  return 0
