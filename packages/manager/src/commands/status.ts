import chalk from "chalk";
import Table from "cli-table3";
import ora from "ora";
import type { Registry } from "../lib/registry.js";
import { listServers } from "../lib/registry.js";
import { checkServer } from "../lib/health.js";
import { writeLog } from "../lib/logger.js";

export async function statusCommand(
  registry: Registry,
  opts: { log?: boolean }
): Promise<void> {
  const servers = listServers(registry);
  if (servers.length === 0) {
    console.log(chalk.yellow("No servers in registry."));
    return;
  }

  console.log(chalk.bold("\nMCP Server Status\n"));

  const table = new Table({
    head: [chalk.bold("Name"), chalk.bold("Enabled"), chalk.bold("Health"), chalk.bold("Output / Error")],
    colWidths: [18, 10, 12, 48],
    wordWrap: true,
    style: { head: [], border: [] },
  });

  const logLines: string[] = [];

  for (const { name, entry } of servers) {
    const spinner = ora({ text: `Checking ${name}...`, spinner: "dots" }).start();
    const result = checkServer(name, entry);
    spinner.stop();

    const enabledLabel = entry.enabled ? chalk.green("yes") : chalk.gray("no");
    let healthLabel: string;
    let detail: string;

    switch (result.status) {
      case "ok":
        healthLabel = chalk.green("✓ ok");
        detail = chalk.dim((result.output ?? "").slice(0, 80));
        break;
      case "fail":
        healthLabel = chalk.red("✗ fail");
        detail = chalk.red((result.error ?? "").slice(0, 80));
        break;
      case "skip":
        healthLabel = chalk.dim("– skip");
        detail = chalk.dim(result.output ?? "");
        break;
    }

    table.push([chalk.white(name), enabledLabel, healthLabel, detail]);
    logLines.push(`[${name}] status=${result.status} duration=${result.durationMs ?? "—"}ms ${result.error ? "error=" + result.error : result.output ?? ""}`);
  }

  console.log(table.toString());

  if (opts.log) {
    const logFile = writeLog(logLines.join("\n"), "status");
    console.log(chalk.dim(`\nLogged to: ${logFile}`));
  }
}
