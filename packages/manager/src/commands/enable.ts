import chalk from "chalk";
import type { Registry } from "../lib/registry.js";
import { enableServer, saveRegistry } from "../lib/registry.js";

export function enableCommand(
  name: string,
  registry: Registry,
  registryPath: string
): Registry {
  try {
    const updated = enableServer(registry, name);
    saveRegistry(updated, registryPath);
    console.log(chalk.green(`✓ Enabled "${name}"`));
    return updated;
  } catch (err: unknown) {
    console.error(chalk.red((err instanceof Error ? err.message : String(err))));
    process.exit(1);
  }
}
