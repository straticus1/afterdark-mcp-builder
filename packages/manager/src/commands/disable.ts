import chalk from "chalk";
import type { Registry } from "../lib/registry.js";
import { disableServer, saveRegistry } from "../lib/registry.js";

export function disableCommand(
  name: string,
  registry: Registry,
  registryPath: string
): Registry {
  try {
    const updated = disableServer(registry, name);
    saveRegistry(updated, registryPath);
    console.log(chalk.green(`✓ Disabled "${name}"`));
    return updated;
  } catch (err: unknown) {
    console.error(chalk.red((err instanceof Error ? err.message : String(err))));
    process.exit(1);
  }
}
