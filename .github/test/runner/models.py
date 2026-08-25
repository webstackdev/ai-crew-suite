from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class WorkflowParseResult:
  events: set[str]
  has_workflow_dispatch_inputs: bool
  jobs_to_environment: dict[str, str | None]
