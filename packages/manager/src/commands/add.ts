import chalk from "chalk";
import { input, confirm, checkbox } from "@inquirer/prompts";
import type { Registry, ServerEntry } from "../lib/registry.js";
import { getServer, setServer, saveRegistry } from "../lib/registry.js";
import { getTemplate, ALL_TEMPLATES } from "../templates/index.js";
import { findCatalogEntry, loadCatalog } from "../lib/catalog.js";
import { installCatalogPlugin } from "../lib/installer.js";

export async function addCommand(
  name: string,
  registry: Registry,
  registryPath: string,
  opts: { enable?: boolean; nonInteractive?: boolean }
): Promise<Registry> {
  if (getServer(registry, name)) {
    console.log(chalk.yellow(`Server "${name}" already exists. Use \`mcp-builder enable ${name}\` or edit the registry directly.`));
    return registry;
  }

  const catalogEntry = findCatalogEntry(loadCatalog(), name);
  const template = getTemplate(name);
  let entry: ServerEntry;

  if (catalogEntry) {
    if (catalogEntry.status !== "supported") {
      throw new Error(
        `Catalog entry '${name}' is ${catalogEntry.status}; it has no tested installer yet.`,
      );
    }
    console.log(chalk.green(`✓ Found supported catalog plugin: ${chalk.bold(name)}`));
    console.log(chalk.dim(`  ${catalogEntry.description}`));
    if (!opts.nonInteractive) {
      const approved = await confirm({
        message: `Install pinned ${catalogEntry.install?.package}@${catalogEntry.install?.version}?`,
        default: true,
      });
      if (!approved) return registry;
      if ((catalogEntry.permissions?.length ?? 0) > 0) {
        const permissionsApproved = await confirm({
          message: `Approve permissions: ${catalogEntry.permissions?.join(", ")}?`,
          default: false,
        });
        if (!permissionsApproved) return registry;
      }
    }
    const installed = installCatalogPlugin(catalogEntry, registryPath);
    entry = {
      enabled: opts.enable ?? false,
      description: catalogEntry.description,
      tags: catalogEntry.tags,
      command: installed.command,
      args: installed.args,
      config: {
        catalogId: catalogEntry.id,
        package: installed.package,
        version: installed.version,
        integrity: installed.integrity,
      },
      envVars: [],
      docs: catalogEntry.source.url,
    };
    console.log(chalk.dim(`  Installed in ${installed.root}`));
    if (!opts.nonInteractive) {
      const shouldEnable = await confirm({
        message: `Enable "${name}" now?`,
        default: opts.enable ?? true,
      });
      entry = { ...entry, enabled: shouldEnable };
    }
  } else if (template) {
    console.log(chalk.green(`✓ Found built-in template: ${chalk.bold(name)}`));
    console.log(chalk.dim(`  ${template.description}`));
    console.log(chalk.dim(`  Tags: ${template.tags.join(", ")}`));
    if (template.install) {
      console.log(chalk.dim(`  Install: ${template.install}`));
    }

    entry = {
      enabled: opts.enable ?? false,
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
    };

    if (!opts.nonInteractive) {
      const shouldEnable = await confirm({
        message: `Enable "${name}" now?`,
        default: opts.enable ?? false,
      });
      entry = { ...entry, enabled: shouldEnable };
    }
  } else {
    // Unknown server — scaffold a custom entry
    console.log(chalk.yellow(`No built-in template for "${name}". Creating custom entry.`));
    console.log(chalk.dim(`Available templates: ${ALL_TEMPLATES.map((t) => t.name).join(", ")}`));

    if (opts.nonInteractive) {
      entry = {
        enabled: opts.enable ?? false,
        description: `Custom MCP server: ${name}`,
        tags: [],
        config: {},
        envVars: [],
      };
    } else {
      const description = await input({ message: "Description:", default: `Custom MCP server: ${name}` });
      const commandStr = await input({ message: "Command to run (e.g. npx):", default: "npx" });
      const argsStr = await input({ message: "Args (space-separated):", default: "" });
      const tagChoices = ["core", "data", "vector", "devops", "cloud", "api", "search", "orchestration"];
      const tags = await checkbox({ message: "Tags:", choices: tagChoices.map((t) => ({ name: t, value: t })) });
      const shouldEnable = await confirm({ message: `Enable "${name}" now?`, default: false });

      entry = {
        enabled: shouldEnable,
        description,
        tags,
        command: commandStr || undefined,
        args: argsStr ? argsStr.split(" ").filter(Boolean) : undefined,
        config: {},
        envVars: [],
      };
    }
  }

  const updated = setServer(registry, name, entry);
  saveRegistry(updated, registryPath);

  const status = entry.enabled ? chalk.green("enabled") : chalk.gray("disabled");
  console.log(chalk.green(`\n✓ Added "${name}" (${status})`));
  if (template?.envVars && template.envVars.length > 0) {
    console.log(chalk.yellow("\n  Required env vars:"));
    for (const ev of template.envVars) {
      console.log(chalk.dim(`    ${ev.key}  # ${ev.description}  (e.g. ${ev.example})`));
    }
  }

  return updated;
}
