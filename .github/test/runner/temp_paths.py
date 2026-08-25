from __future__ import annotations

import atexit
import shutil
from pathlib import Path


class TempPaths:
  def __init__(self) -> None:
    self._paths_to_cleanup: list[Path] = []

  def track(self, path: Path) -> Path:
    self._paths_to_cleanup.append(path)
    return path

  def cleanup(self) -> None:
    for path in self._paths_to_cleanup:
      try:
        if path.is_dir():
          shutil.rmtree(path, ignore_errors=True)
        else:
          path.unlink(missing_ok=True)
      except Exception:
        pass


_default_temp_paths = TempPaths()
atexit.register(_default_temp_paths.cleanup)


def default_temp_paths() -> TempPaths:
  return _default_temp_paths
