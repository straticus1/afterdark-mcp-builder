import chalk from "chalk";
import Table from "cli-table3";
import { confirm } from "@inquirer/prompts";
import { scanProject } from "../lib/scanner.js";
import type { Registry } from "../lib/registry.js";
import { getServer, setServer, saveRegistry } from "../lib/registry.js";
import type { ServerTemplate } from "../templates/index.js";

export async function scanCommand(
  dir: string,
  registry: Registry,
  registryPath: string,
  opts: { apply?: boolean; nonInteractive?: boolean }
): Promise<Registry> {
  console.log(chalk.bold(`\nScanning project: ${dir}\n`));

  const result = scanProject(dir);

  if (result.signals.length === 0) {
    console.log(chalk.yellow("No project signals detected."));
    return registry;
  }

  // Show detected signals
  console.log(chalk.underline("Detected signals:"));
  for (const signal of result.signals) {
    console.log(`  ${chalk.cyan("→")} ${signal.reason}`);
    console.log(chalk.dim(`    file: ${signal.file}`));
  }

  console.log();

  // Show suggested servers
  console.log(chalk.underline("Suggested MCP servers:"));
  const table = new Table({
    head: [chalk.bold("Server"), chalk.bold("Tags"), chalk.bold("Description"), chalk.bold("In Registry")],
    colWidths: [16, 22, 36, 14],
    wordWrap: true,
    style: { head: [], border: [] },
  });

  for (const t of result.suggestedTemplates) {
    const inRegistry = getServer(registry, t.name) ? chalk.green("yes") : chalk.dim("no");
    table.push([
      chalk.white(t.name),
      t.tags.map((tag) => chalk.cyan(tag)).join(", "),
      t.description,
      inRegistry,
    ]);
  }
  console.log(table.toString());

  // New servers not yet in registry
  const newServers = result.suggestedTemplates.filter(
    (t) => !getServer(registry, t.name)
  );

  if (newServers.length === 0) {
    console.log(chalk.green("\n✓ All suggested servers are already in your registry."));
    return registry;
  }

  console.log(chalk.yellow(`\n${newServers.length} server(s) not yet in registry: ${newServers.map((t) => t.name).join(", ")}`));

  let shouldApply = opts.apply ?? false;
  if (!opts.nonInteractive && !opts.apply) {
    shouldApply = await confirm({
      message: "Add suggested servers to registry (disabled by default)?",
      default: false,
    });
  }

  if (!shouldApply) {
    console.log(chalk.dim("\nRun `mcp-builder add <name>` to add individual servers."));
    return registry;
  }

  let updated = registry;
  for (const template of newServers) {
    updated = setServer(updated, template.name, {
      enabled: false,
      description: template.description,
      tags: template.tags,
      command: template.command,
      args: template.args,
      env: template.env,
      config: template.config,
      envVars: template.envVars,
      health: template.health,
      install: template.install,
      docs: template.docs,
    });
    console.log(chalk.green(`  + Added "${template.name}" (disabled)`));
  }

  saveRegistry(updated, registryPath);
  console.log(chalk.dim("\nEnable servers with `mcp-builder enable <name>`, then run `mcp-builder sync`."));
  return updated;
}
