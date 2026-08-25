from __future__ import annotations

from pathlib import Path
import sys


def _import_parser():
  test_root = Path(__file__).resolve().parents[1]
  sys.path.insert(0, str(test_root))
  from runner.yaml_parser import parse_workflow_yaml

  return parse_workflow_yaml


def test_parse_workflow_yaml_inline_on_array(tmp_path: Path) -> None:
  parse_workflow_yaml = _import_parser()

  wf = tmp_path / "wf.yml"
  wf.write_text(
    """name: Test
on: [push, workflow_dispatch]
jobs:
  build:
    runs-on: ubuntu-latest
""",
    encoding="utf-8",
  )

  parsed = parse_workflow_yaml(wf)
  assert "push" in parsed.events
  assert "workflow_dispatch" in parsed.events
  assert parsed.has_workflow_dispatch_inputs is False
  assert parsed.jobs_to_environment == {"build": None}


def test_parse_workflow_yaml_on_block_and_dispatch_inputs(tmp_path: Path) -> None:
  parse_workflow_yaml = _import_parser()

  wf = tmp_path / "wf.yml"
  wf.write_text(
    """name: Test
on:
  workflow_dispatch:
    inputs:
      foo:
        required: false
  pull_request:
    branches: [main]
jobs:
  job-1:
    environment: production
    runs-on: ubuntu-latest
""",
    encoding="utf-8",
  )

  parsed = parse_workflow_yaml(wf)
  assert parsed.events == {"workflow_dispatch", "pull_request"}
  assert parsed.has_workflow_dispatch_inputs is True
  assert parsed.jobs_to_environment == {"job-1": "production"}


def test_parse_workflow_yaml_ignores_comments(tmp_path: Path) -> None:
  parse_workflow_yaml = _import_parser()

  wf = tmp_path / "wf.yml"
  wf.write_text(
    """name: Test
on:
  push: # comment
    branches: [main]
# jobs below
jobs:
  build:
    runs-on: ubuntu-latest
""",
    encoding="utf-8",
  )

  parsed = parse_workflow_yaml(wf)
  assert parsed.events == {"push"}
  assert parsed.jobs_to_environment == {"build": None}
