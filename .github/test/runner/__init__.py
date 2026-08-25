"""Local GitHub Actions runner utilities.

This package contains helpers used by `.github/test/runner.py` to run workflows
locally via `gh act`.
"""

from .cli import main

__all__ = ["main"]
