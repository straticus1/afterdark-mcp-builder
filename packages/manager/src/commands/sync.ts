import chalk from "chalk";
import { confirm } from "@inquirer/prompts";
import type { Registry } from "../lib/registry.js";
import { syncToClaudeCode, previewSync } from "../lib/claude-sync.js";

export async function syncCommand(
  registry: Registry,
  opts: {
    scope?: "global" | "local";
    dryRun?: boolean;
    force?: boolean;
    settingsPath?: string;
  }
): Promise<void> {
  const scope = opts.scope ?? "local";
  const preview = previewSync(registry);
  const serverNames = Object.keys(preview);

  if (serverNames.length === 0) {
    console.log(chalk.yellow("No enabled servers with a `command` field to sync."));
    console.log(chalk.dim("Enable servers with `mcp-builder enable <name>` first."));
    return;
  }

  console.log(chalk.bold(`\nSync preview (${scope} settings):\n`));
  console.log(chalk.dim("  Servers to write into mcpServers:"));
  for (const name of serverNames) {
    const entry = preview[name];
    if (!entry) continue;
    console.log(`    ${chalk.green("+")} ${chalk.white(name)}`);
    console.log(chalk.dim(`        command: ${entry.command} ${(entry.args ?? []).join(" ")}`));
  }

  if (opts.dryRun) {
    console.log(chalk.yellow("\n(dry-run) No changes written."));
    return;
  }

  if (!opts.force) {
    const ok = await confirm({
      message: `Write ${serverNames.length} server(s) to Claude Code settings (${scope})?`,
      default: true,
    });
    if (!ok) {
      console.log(chalk.dim("Aborted."));
      return;
    }
  }

  const result = syncToClaudeCode(registry, scope, opts.settingsPath);

  console.log(chalk.green(`\n✓ Synced to: ${result.settingsPath}`));
  if (result.added.length > 0) {
    console.log(chalk.green(`  Added:   ${result.added.join(", ")}`));
  }
  if (result.removed.length > 0) {
    console.log(chalk.yellow(`  Removed: ${result.removed.join(", ")}`));
  }
  if (result.skipped.length > 0) {
    console.log(chalk.dim(`  Skipped: ${result.skipped.join(", ")}`));
  }
  console.log(chalk.dim("\nRestart Claude Code to pick up the new MCP servers."));
}
