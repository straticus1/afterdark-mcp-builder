"""Bridge: locate and invoke the mcp-manager Node.js CLI from Python."""

from __future__ import annotations

import shutil
import subprocess
import sys
from typing import Sequence


def find_cli() -> str:
    """Return the path to the mcp-manager binary, or raise."""
    cli = shutil.which("mcp-manager") or shutil.which("mcpm")
    if cli:
        return cli
    raise RuntimeError(
        "mcp-manager CLI not found. Install it with:\n"
        "  npm install -g mcp-manager\n"
        "or run `npm run build` inside the TypeScript package."
    )


def run(args: Sequence[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    """Run mcp-manager <args> and return the completed process."""
    cli = find_cli()
    cmd = [cli, *args]
    result = subprocess.run(
        cmd,
        text=True,
        capture_output=False,  # inherit stdio so colours render
    )
    if check and result.returncode != 0:
        sys.exit(result.returncode)
    return result


def run_capture(args: Sequence[str]) -> tuple[str, str, int]:
    """Run mcp-manager <args> capturing stdout/stderr. Returns (stdout, stderr, returncode)."""
    cli = find_cli()
    result = subprocess.run([cli, *args], text=True, capture_output=True)
    return result.stdout, result.stderr, result.returncode
