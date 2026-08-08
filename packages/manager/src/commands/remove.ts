import chalk from "chalk";
import { confirm } from "@inquirer/prompts";
import type { Registry } from "../lib/registry.js";
import { getServer, removeServer, saveRegistry } from "../lib/registry.js";

export async function removeCommand(
  name: string,
  registry: Registry,
  registryPath: string,
  opts: { force?: boolean }
): Promise<Registry> {
  if (!getServer(registry, name)) {
    console.log(chalk.yellow(`Server "${name}" not found in registry.`));
    return registry;
  }

  if (!opts.force) {
    const ok = await confirm({
      message: `Remove "${name}" from registry?`,
      default: false,
    });
    if (!ok) {
      console.log(chalk.dim("Aborted."));
      return registry;
    }
  }

  const updated = removeServer(registry, name);
  saveRegistry(updated, registryPath);
  console.log(chalk.green(`✓ Removed "${name}"`));
  return updated;
}
