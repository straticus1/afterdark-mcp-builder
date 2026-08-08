#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import path from "node:path";
import { loadRegistry, resolveRegistryPath } from "./lib/registry.js";
import { listCommand } from "./commands/list.js";
import { addCommand } from "./commands/add.js";
import { removeCommand } from "./commands/remove.js";
import { enableCommand } from "./commands/enable.js";
import { disableCommand } from "./commands/disable.js";
import { statusCommand } from "./commands/status.js";
import { verifyCommand } from "./commands/verify.js";
import { scanCommand } from "./commands/scan.js";
import { initCommand } from "./commands/init.js";
import { logsCommand } from "./commands/logs.js";
import { syncCommand } from "./commands/sync.js";
import { catalogCommand } from "./commands/catalog.js";
import { serveCommand } from "./commands/serve.js";
import { daemonStatus, startDaemon, stopDaemon } from "./commands/daemon.js";
import { ALL_TEMPLATES } from "./templates/index.js";

const program = new Command();

program
  .name("mcp-builder")
  .aliases(["mcpm"])
  .description(
    chalk.bold("mcp-builder") +
      " — Universal CLI for MCP server registry management\n" +
      chalk.dim("  Manage, verify, scan, and sync MCP servers for Claude Code and AI agents.")
  )
  .version("2.0.0")
  .option("-r, --registry <path>", "Path to mcp-registry.json", undefined)
  .hook("preAction", (thisCommand) => {
    // Resolve registry path from global option
    const opts = thisCommand.opts() as { registry?: string };
    if (opts.registry) {
      process.env["MCP_REGISTRY_PATH"] = path.resolve(opts.registry);
    }
  });

function getRegistryPath(): string {
  return process.env["MCP_REGISTRY_PATH"] ?? resolveRegistryPath();
}

// ─── catalog ────────────────────────────────────────────────────────────────

program
  .command("catalog [query]")
  .alias("search")
  .description("Search the curated MCP plugin catalog")
  .action((query?: string) => catalogCommand(query));

// ─── list ────────────────────────────────────────────────────────────────────

program
  .command("list")
  .alias("ls")
  .description("List all MCP servers in the registry")
  .option("-t, --tag <tag>", "Filter by tag")
  .option("-e, --enabled", "Show only enabled servers")
  .action((opts: { tag?: string; enabled?: boolean }) => {
    const registry = loadRegistry(getRegistryPath());
    listCommand(registry, opts);
  });

// ─── add ─────────────────────────────────────────────────────────────────────

program
  .command("add <name>")
  .description("Add a server to the registry (from built-in template or custom)")
  .option("--enable", "Enable the server immediately after adding")
  .option("-y, --yes", "Non-interactive mode — accept defaults")
  .action(async (name: string, opts: { enable?: boolean; yes?: boolean }) => {
    const regPath = getRegistryPath();
    const registry = loadRegistry(regPath);
    await addCommand(name, registry, regPath, {
      enable: opts.enable ?? false,
      nonInteractive: opts.yes ?? false,
    });
  });

// ─── remove ──────────────────────────────────────────────────────────────────

program
  .command("remove <name>")
  .alias("rm")
  .description("Remove a server from the registry")
  .option("-f, --force", "Skip confirmation prompt")
  .action(async (name: string, opts: { force?: boolean }) => {
    const regPath = getRegistryPath();
    const registry = loadRegistry(regPath);
    await removeCommand(name, registry, regPath, opts);
  });

// ─── enable ──────────────────────────────────────────────────────────────────

program
  .command("enable <name>")
  .description("Enable a server in the registry")
  .action((name: string) => {
    const regPath = getRegistryPath();
    const registry = loadRegistry(regPath);
    enableCommand(name, registry, regPath);
  });

// ─── disable ─────────────────────────────────────────────────────────────────

program
  .command("disable <name>")
  .description("Disable a server in the registry")
  .action((name: string) => {
    const regPath = getRegistryPath();
    const registry = loadRegistry(regPath);
    disableCommand(name, registry, regPath);
  });

// ─── status ──────────────────────────────────────────────────────────────────

program
  .command("status")
  .description("Run health checks on all servers and show a live status table")
  .option("--log", "Write results to .agent/logs/")
  .action(async (opts: { log?: boolean }) => {
    const registry = loadRegistry(getRegistryPath());
    await statusCommand(registry, opts);
  });

// ─── verify ──────────────────────────────────────────────────────────────────

program
  .command("verify [name]")
  .description("Run health checks and write detailed logs (all enabled servers, or one by name)")
  .action(async (name?: string) => {
    const registry = loadRegistry(getRegistryPath());
    await verifyCommand(registry, name);
  });

// ─── scan ────────────────────────────────────────────────────────────────────

program
  .command("scan [dir]")
  .description("Scan a project directory and suggest MCP servers based on detected signals")
  .option("--apply", "Automatically add suggested servers to the registry")
  .option("-y, --yes", "Non-interactive mode")
  .action(async (dir: string | undefined, opts: { apply?: boolean; yes?: boolean }) => {
    const targetDir = dir ? path.resolve(dir) : process.cwd();
    const regPath = getRegistryPath();
    const registry = loadRegistry(regPath);
    await scanCommand(targetDir, registry, regPath, {
      apply: opts.apply ?? false,
      nonInteractive: opts.yes ?? false,
    });
  });

// ─── init ────────────────────────────────────────────────────────────────────

program
  .command("init [dir]")
  .description("Bootstrap .agent/ directory with registry, .env.example, and project hints")
  .option("-y, --yes", "Non-interactive mode")
  .action(async (dir: string | undefined, opts: { yes?: boolean }) => {
    const targetDir = dir ? path.resolve(dir) : process.cwd();
    await initCommand(targetDir, { nonInteractive: opts.yes ?? false });
  });

// ─── logs ────────────────────────────────────────────────────────────────────

program
  .command("logs [server]")
  .description("View log files generated by verify/status commands")
  .option("-d, --date <YYYY-MM-DD>", "Show logs for a specific date")
  .option("-a, --all", "List all available log dates and files")
  .option("-n, --lines <number>", "Number of tail lines to show", "50")
  .action((server: string | undefined, opts: { date?: string; all?: boolean; lines?: string }) => {
    logsCommand(server, {
      ...(opts.date !== undefined ? { date: opts.date } : {}),
      all: opts.all ?? false,
      lines: opts.lines ? parseInt(opts.lines, 10) : 50,
    });
  });

// ─── sync ────────────────────────────────────────────────────────────────────

program
  .command("sync")
  .description("Push enabled servers from mcp-registry.json into Claude Code settings.json")
  .option("--global", "Write to global ~/.claude/settings.json (default: local .claude/settings.json)")
  .option("--dry-run", "Preview changes without writing")
  .option("-f, --force", "Skip confirmation prompt")
  .option("--settings-path <path>", "Override Claude Code settings.json path")
  .action(async (opts: { global?: boolean; dryRun?: boolean; force?: boolean; settingsPath?: string }) => {
    const registry = loadRegistry(getRegistryPath());
    await syncCommand(registry, {
      scope: opts.global ? "global" : "local",
      dryRun: opts.dryRun ?? false,
      force: opts.force ?? false,
      ...(opts.settingsPath !== undefined ? { settingsPath: opts.settingsPath } : {}),
    });
  });

// ─── templates ───────────────────────────────────────────────────────────────

program
  .command("templates")
  .alias("tpl")
  .description("List all built-in server templates")
  .option("-t, --tag <tag>", "Filter by tag")
  .action(async (opts: { tag?: string }) => {
    const { default: Table } = await import("cli-table3") as { default: typeof import("cli-table3") };
    const filtered = opts.tag
      ? ALL_TEMPLATES.filter((t) => t.tags.includes(opts.tag!))
      : ALL_TEMPLATES;
    const table = new Table({
      head: [chalk.bold("Name"), chalk.bold("Tags"), chalk.bold("Description")],
      colWidths: [18, 28, 44],
      wordWrap: true,
      style: { head: [], border: [] },
    });
    for (const t of filtered) {
      table.push([chalk.cyan(t.name), t.tags.join(", "), t.description]);
    }
    console.log(table.toString());
    console.log(chalk.dim(`\n${filtered.length} template(s). Add with: mcp-builder add <name>`));
  });

// ─── serve ──────────────────────────────────────────────────────────────────

program
  .command("serve")
  .description("Run the unified MCP proxy for all enabled registry plugins")
  .option("--http", "Expose Streamable HTTP instead of stdio")
  .option("--host <host>", "HTTP bind address", "127.0.0.1")
  .option("--port <port>", "HTTP port", "3737")
  .action(async (opts: { http?: boolean; host?: string; port?: string }) => {
    const registry = loadRegistry(getRegistryPath());
    await serveCommand(registry, {
      http: opts.http ?? false,
      host: opts.host ?? "127.0.0.1",
      port: Number.parseInt(opts.port ?? "3737", 10),
    });
  });

// ─── daemon ─────────────────────────────────────────────────────────────────

const daemon = program.command("daemon").description("Manage the local HTTP gateway daemon");
daemon.command("start")
  .option("--host <host>", "HTTP bind address", "127.0.0.1")
  .option("--port <port>", "HTTP port", "3737")
  .action((opts: { host?: string; port?: string }) => {
    const record = startDaemon(
      getRegistryPath(),
      opts.host ?? "127.0.0.1",
      Number.parseInt(opts.port ?? "3737", 10),
    );
    console.log(`Gateway daemon started (PID ${record.pid}) at http://${record.host}:${record.port}/mcp`);
  });
daemon.command("stop").action(() => {
  console.log(stopDaemon(getRegistryPath()) ? "Gateway daemon stopped" : "Gateway daemon is not running");
});
daemon.command("status").action(() => {
  const record = daemonStatus(getRegistryPath());
  console.log(record
    ? `Gateway daemon running (PID ${record.pid}) at http://${record.host}:${record.port}/mcp`
    : "Gateway daemon is not running");
});

program.parse(process.argv);
