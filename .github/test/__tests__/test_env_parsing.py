from __future__ import annotations

from pathlib import Path
import sys

import pytest


def _import_runner_module():
  test_root = Path(__file__).resolve().parents[1]
  sys.path.insert(0, str(test_root))
  from runner.env_parsing import looks_like_github_token, parse_key_value_file

  return looks_like_github_token, parse_key_value_file


def test_parse_key_value_file_parses_common_env_syntax(tmp_path: Path) -> None:
  _, parse_key_value_file = _import_runner_module()

  file_path = tmp_path / ".env"
  file_path.write_text(
    "\n".join(
      [
        "# comment",
        "",
        "FOO=bar",
        "export HELLO=world",
        "QUOTED=\"a b\"",
        "SINGLE='x y'",
        "INLINE=hi # there",
        "KEEP_HASH=\"a#b\"",
        "NO_EQUALS",
        "=missing_key",
      ]
    )
    + "\n",
    encoding="utf-8",
  )

  parsed = parse_key_value_file(file_path)
  assert parsed["FOO"] == "bar"
  assert parsed["HELLO"] == "world"
  assert parsed["QUOTED"] == "a b"
  assert parsed["SINGLE"] == "x y"
  assert parsed["INLINE"] == "hi"
  assert parsed["KEEP_HASH"] == "a#b"
  assert "NO_EQUALS" not in parsed
  assert "" not in parsed


def test_parse_key_value_file_tolerates_double_equals(tmp_path: Path) -> None:
  _, parse_key_value_file = _import_runner_module()

  file_path = tmp_path / ".env"
  file_path.write_text(
    "\n".join(
      [
        'GITHUB_TOKEN=="github_pat_1234567890123456789012345678901234567890"',
        "X==y",
      ]
    )
    + "\n",
    encoding="utf-8",
  )

  parsed = parse_key_value_file(file_path)
  assert parsed["GITHUB_TOKEN"].startswith("github_pat_")
  assert parsed["X"] == "y"


@pytest.mark.parametrize(
  "token",
  [
    "github_pat_1234567890123456789012345678901234567890",
    "ghp_abcdefghijklmnopqrstuvwxyzABCDE1234567890_",
    "gho_abcdefghijklmnopqrstuvwxyzABCDE1234567890_",
    "a" * 40,
    "abc.DEF-ghi_jkl.mnoPQR-stuVWX-1234567890",
  ],
)
def test_looks_like_github_token_accepts_common_tokens(token: str) -> None:
  looks_like_github_token, _ = _import_runner_module()
  assert looks_like_github_token(token) is True


@pytest.mark.parametrize(
  "token",
  [
    "",
    "short",
    "   ",
    "bad token with spaces",
    "line1\nline2",
  ],
)
def test_looks_like_github_token_rejects_invalid(token: str) -> None:
  looks_like_github_token, _ = _import_runner_module()
  assert looks_like_github_token(token) is False
