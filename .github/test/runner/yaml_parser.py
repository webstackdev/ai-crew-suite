from __future__ import annotations

import re

from .models import WorkflowParseResult
from .paths import read_lines


def _indent_of(line: str) -> int:
  return len(line) - len(line.lstrip(" "))


def _strip_yaml_comment(value: str) -> str:
  if "#" not in value:
    return value
  # Best-effort: if the comment is inside quotes, keep it.
  if value.count("\"") % 2 == 1 or value.count("'") % 2 == 1:
    return value
  return value.split("#", 1)[0]


def _parse_on_inline_array(line: str) -> set[str]:
  # Supports: on: [push, workflow_dispatch]
  match = re.match(r"^\s*on:\s*\[(.*)\]\s*$", line)
  if not match:
    return set()
  inner = match.group(1)
  raw_items = [item.strip() for item in inner.split(",")]
  return {item for item in raw_items if item}


def parse_workflow_yaml(path) -> WorkflowParseResult:
  lines = read_lines(path)

  events: set[str] = set()
  jobs_to_environment: dict[str, str | None] = {}
  has_workflow_dispatch_inputs = False

  in_on_block = False
  on_indent: int | None = None

  in_jobs_block = False
  jobs_indent: int | None = None
  current_job_id: str | None = None
  current_job_indent: int | None = None

  in_workflow_dispatch_block = False
  workflow_dispatch_indent: int | None = None

  for raw_line in lines:
    line = _strip_yaml_comment(raw_line).rstrip("\n")
    if not line.strip():
      continue

    # Leaving blocks based on indentation should be evaluated before we process
    # new top-level blocks like `jobs:`. Otherwise, `jobs:` can appear while we
    # still consider ourselves inside the `on:` block.
    if in_on_block and on_indent is not None and _indent_of(line) <= on_indent:
      in_on_block = False
      on_indent = None
      in_workflow_dispatch_block = False
      workflow_dispatch_indent = None

    if in_jobs_block and jobs_indent is not None and _indent_of(line) <= jobs_indent:
      in_jobs_block = False
      jobs_indent = None
      current_job_id = None
      current_job_indent = None

    inline_events = _parse_on_inline_array(line)
    if inline_events:
      events |= inline_events
      in_on_block = False
      on_indent = None

    if re.match(r"^\s*on:\s*$", line):
      in_on_block = True
      on_indent = _indent_of(line)
      continue

    if re.match(r"^\s*jobs:\s*$", line):
      in_jobs_block = True
      jobs_indent = _indent_of(line)
      current_job_id = None
      current_job_indent = None
      continue

    if in_on_block and on_indent is not None:
      if _indent_of(line) == on_indent + 2:
        key_match = re.match(r"^\s*([a-zA-Z0-9_]+)\s*:\s*(.*)$", line)
        if key_match:
          event_name = key_match.group(1)
          events.add(event_name)
          if event_name == "workflow_dispatch":
            in_workflow_dispatch_block = True
            workflow_dispatch_indent = _indent_of(line)
            # Avoid treating this same line as "leaving" the dispatch block.
            continue
          else:
            in_workflow_dispatch_block = False
            workflow_dispatch_indent = None

      if in_workflow_dispatch_block and workflow_dispatch_indent is not None:
        if _indent_of(line) <= workflow_dispatch_indent:
          in_workflow_dispatch_block = False
          workflow_dispatch_indent = None
        else:
          if re.match(r"^\s*inputs\s*:\s*$", line):
            has_workflow_dispatch_inputs = True

    if in_jobs_block and jobs_indent is not None:
      if _indent_of(line) == jobs_indent + 2:
        match = re.match(r"^\s*([a-zA-Z0-9_-]+)\s*:\s*$", line)
        if match:
          current_job_id = match.group(1)
          current_job_indent = _indent_of(line)
          jobs_to_environment.setdefault(current_job_id, None)
          continue

      if current_job_id and current_job_indent is not None:
        env_match = re.match(r"^\s*environment\s*:\s*([^\s{\[]+)\s*$", line)
        if env_match and _indent_of(line) >= current_job_indent + 2:
          jobs_to_environment[current_job_id] = env_match.group(1).strip().strip("\"'")

  return WorkflowParseResult(
    events=events,
    has_workflow_dispatch_inputs=has_workflow_dispatch_inputs,
    jobs_to_environment=jobs_to_environment,
  )
