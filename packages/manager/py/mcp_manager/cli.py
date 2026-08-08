"""
mcp-manager Python CLI wrapper.

A thin Typer front-end that delegates every command to the Node.js
mcp-manager binary. This lets Python-native workflows (scripts,
Makefile, CI) use `mcpm-py` without knowing about Node.

Install the Node CLI first:
  npm install -g mcp-manager

Then install this package:
  pip install -e py/
"""

from __future__ import annotations

from typing import Annotated, Optional
import typer
from rich.console import Console
from rich.panel import Panel

from .bridge import run, find_cli, run_capture

app = typer.Typer(
    name="mcpm-py",
    help="Python wrapper for mcp-manager. Delegates to the Node.js CLI.",
    no_args_is_help=True,
    rich_markup_mode="rich",
)

console = Console()


def _check_cli() -> None:
    try:
        find_cli()
    except RuntimeError as e:
        console.print(Panel(str(e), title="[red]mcp-manager not found[/red]", border_style="red"))
        raise typer.Exit(1)


# ─── list ─────────────────────────────────────────────────────────────────────

@app.command("list")
def list_servers(
    tag: Annotated[Optional[str], typer.Option("--tag", "-t", help="Filter by tag")] = None,
    enabled: Annotated[bool, typer.Option("--enabled", "-e", help="Show only enabled")] = False,
    registry: Annotated[Optional[str], typer.Option("--registry", "-r")] = None,
) -> None:
    """List all MCP servers in the registry."""
    _check_cli()
    args = ["list"]
    if tag:
        args += ["--tag", tag]
    if enabled:
        args.append("--enabled")
    if registry:
        args = ["--registry", registry] + args
    run(args)


# ─── add ──────────────────────────────────────────────────────────────────────

@app.command("add")
def add_server(
    name: Annotated[str, typer.Argument(help="Server name (e.g. postgres, redis, github)")],
    enable: Annotated[bool, typer.Option("--enable", help="Enable immediately")] = False,
    yes: Annotated[bool, typer.Option("--yes", "-y", help="Non-interactive")] = False,
    registry: Annotated[Optional[str], typer.Option("--registry", "-r")] = None,
) -> None:
    """Add a server from a built-in template or as a custom entry."""
    _check_cli()
    args = ["add", name]
    if enable:
        args.append("--enable")
    if yes:
        args.append("--yes")
    if registry:
        args = ["--registry", registry] + args
    run(args)


# ─── remove ───────────────────────────────────────────────────────────────────

@app.command("remove")
def remove_server(
    name: Annotated[str, typer.Argument(help="Server name to remove")],
    force: Annotated[bool, typer.Option("--force", "-f", help="Skip confirmation")] = False,
    registry: Annotated[Optional[str], typer.Option("--registry", "-r")] = None,
) -> None:
    """Remove a server from the registry."""
    _check_cli()
    args = ["remove", name]
    if force:
        args.append("--force")
    if registry:
        args = ["--registry", registry] + args
    run(args)


# ─── enable ───────────────────────────────────────────────────────────────────

@app.command("enable")
def enable_server(
    name: Annotated[str, typer.Argument(help="Server name to enable")],
    registry: Annotated[Optional[str], typer.Option("--registry", "-r")] = None,
) -> None:
    """Enable a server."""
    _check_cli()
    args = ["enable", name]
    if registry:
        args = ["--registry", registry] + args
    run(args)


# ─── disable ──────────────────────────────────────────────────────────────────

@app.command("disable")
def disable_server(
    name: Annotated[str, typer.Argument(help="Server name to disable")],
    registry: Annotated[Optional[str], typer.Option("--registry", "-r")] = None,
) -> None:
    """Disable a server."""
    _check_cli()
    args = ["disable", name]
    if registry:
        args = ["--registry", registry] + args
    run(args)


# ─── status ───────────────────────────────────────────────────────────────────

@app.command("status")
def status(
    log: Annotated[bool, typer.Option("--log", help="Write results to .agent/logs/")] = False,
    registry: Annotated[Optional[str], typer.Option("--registry", "-r")] = None,
) -> None:
    """Run health checks on all servers and show a live status table."""
    _check_cli()
    args = ["status"]
    if log:
        args.append("--log")
    if registry:
        args = ["--registry", registry] + args
    run(args)


# ─── verify ───────────────────────────────────────────────────────────────────

@app.command("verify")
def verify(
    name: Annotated[Optional[str], typer.Argument(help="Specific server to verify")] = None,
    registry: Annotated[Optional[str], typer.Option("--registry", "-r")] = None,
) -> None:
    """Run health checks and write logs for all enabled servers (or one by name)."""
    _check_cli()
    args = ["verify"]
    if name:
        args.append(name)
    if registry:
        args = ["--registry", registry] + args
    run(args)


# ─── scan ─────────────────────────────────────────────────────────────────────

@app.command("scan")
def scan(
    directory: Annotated[Optional[str], typer.Argument(help="Directory to scan (default: cwd)")] = None,
    apply: Annotated[bool, typer.Option("--apply", help="Auto-add suggested servers")] = False,
    yes: Annotated[bool, typer.Option("--yes", "-y", help="Non-interactive")] = False,
    registry: Annotated[Optional[str], typer.Option("--registry", "-r")] = None,
) -> None:
    """Scan a project and suggest MCP servers based on detected signals."""
    _check_cli()
    args = ["scan"]
    if directory:
        args.append(directory)
    if apply:
        args.append("--apply")
    if yes:
        args.append("--yes")
    if registry:
        args = ["--registry", registry] + args
    run(args)


# ─── init ─────────────────────────────────────────────────────────────────────

@app.command("init")
def init(
    directory: Annotated[Optional[str], typer.Argument(help="Directory to init (default: cwd)")] = None,
    yes: Annotated[bool, typer.Option("--yes", "-y", help="Non-interactive")] = False,
) -> None:
    """Bootstrap .agent/ directory with registry, .env.example, and project hints."""
    _check_cli()
    args = ["init"]
    if directory:
        args.append(directory)
    if yes:
        args.append("--yes")
    run(args)


# ─── logs ─────────────────────────────────────────────────────────────────────

@app.command("logs")
def logs(
    server: Annotated[Optional[str], typer.Argument(help="Filter logs by server name")] = None,
    date: Annotated[Optional[str], typer.Option("--date", "-d", help="YYYY-MM-DD")] = None,
    all_dates: Annotated[bool, typer.Option("--all", "-a", help="List all log dates")] = False,
    lines: Annotated[int, typer.Option("--lines", "-n", help="Tail lines")] = 50,
) -> None:
    """View log files generated by verify/status commands."""
    _check_cli()
    args = ["logs"]
    if server:
        args.append(server)
    if date:
        args += ["--date", date]
    if all_dates:
        args.append("--all")
    args += ["--lines", str(lines)]
    run(args)


# ─── sync ─────────────────────────────────────────────────────────────────────

@app.command("sync")
def sync(
    global_scope: Annotated[bool, typer.Option("--global", help="Write to ~/.claude/settings.json")] = False,
    dry_run: Annotated[bool, typer.Option("--dry-run", help="Preview without writing")] = False,
    force: Annotated[bool, typer.Option("--force", "-f", help="Skip confirmation")] = False,
    settings_path: Annotated[Optional[str], typer.Option("--settings-path")] = None,
    registry: Annotated[Optional[str], typer.Option("--registry", "-r")] = None,
) -> None:
    """Push enabled servers into Claude Code settings.json."""
    _check_cli()
    args = ["sync"]
    if global_scope:
        args.append("--global")
    if dry_run:
        args.append("--dry-run")
    if force:
        args.append("--force")
    if settings_path:
        args += ["--settings-path", settings_path]
    if registry:
        args = ["--registry", registry] + args
    run(args)


# ─── templates ────────────────────────────────────────────────────────────────

@app.command("templates")
def templates(
    tag: Annotated[Optional[str], typer.Option("--tag", "-t", help="Filter by tag")] = None,
) -> None:
    """List all built-in server templates."""
    _check_cli()
    args = ["templates"]
    if tag:
        args += ["--tag", tag]
    run(args)


if __name__ == "__main__":
    app()
