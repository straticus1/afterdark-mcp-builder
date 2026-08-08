import Table from "cli-table3";
import chalk from "chalk";
import type { Registry } from "../lib/registry.js";
import { listServers } from "../lib/registry.js";

export function listCommand(registry: Registry, opts: { tag?: string; enabled?: boolean }): void {
  let servers = listServers(registry);

  if (opts.tag) {
    servers = servers.filter(({ entry }) => entry.tags.includes(opts.tag!));
  }
  if (opts.enabled) {
    servers = servers.filter(({ entry }) => entry.enabled);
  }

  if (servers.length === 0) {
    console.log(chalk.yellow("No servers in registry. Run `mcp-builder init` or `mcp-builder add <name>`."));
    return;
  }

  const table = new Table({
    head: [
      chalk.bold("Name"),
      chalk.bold("Status"),
      chalk.bold("Tags"),
      chalk.bold("Description"),
    ],
    colWidths: [18, 10, 24, 42],
    wordWrap: true,
    style: { head: [], border: [] },
  });

  for (const { name, entry } of servers) {
    const status = entry.enabled
      ? chalk.green("● enabled")
      : chalk.gray("○ disabled");
    const tags = entry.tags.map((t) => chalk.cyan(t)).join(", ") || chalk.dim("—");
    const desc = entry.description ?? chalk.dim("—");
    table.push([chalk.white(name), status, tags, desc]);
  }

  console.log(table.toString());
  const enabledCount = servers.filter(({ entry }) => entry.enabled).length;
  console.log(chalk.dim(`\n${servers.length} server(s) | ${enabledCount} enabled`));
}
