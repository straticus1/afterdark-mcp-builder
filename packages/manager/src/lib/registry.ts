import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

// ─── Schema ──────────────────────────────────────────────────────────────────

const HealthCheckSchema = z.object({
  command: z.string(),
  timeout: z.number().default(5000),
});

const EnvVarSchema = z.object({
  key: z.string(),
  description: z.string(),
  example: z.string(),
});

export const ServerEntrySchema = z.object({
  enabled: z.boolean().default(false),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  config: z.record(z.unknown()).default({}),
  envVars: z.array(EnvVarSchema).default([]),
  health: HealthCheckSchema.optional(),
  install: z.string().optional(),
  docs: z.string().optional(),
});

export const RegistrySchema = z.object({
  $schema: z.string().optional(),
  version: z.string().default("2.0.0"),
  project: z
    .object({
      name: z.string().optional(),
      root: z.string().default("."),
      created: z.string().optional(),
    })
    .default({}),
  servers: z.record(ServerEntrySchema).default({}),
});

export type ServerEntry = z.infer<typeof ServerEntrySchema>;
export type Registry = z.infer<typeof RegistrySchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function resolveRegistryPath(cwd = process.cwd()): string {
  return path.join(cwd, ".agent", "mcp-registry.json");
}

export function loadRegistry(registryPath?: string): Registry {
  const filePath = registryPath ?? resolveRegistryPath();
  if (!fs.existsSync(filePath)) {
    return RegistrySchema.parse({});
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  return RegistrySchema.parse(raw);
}

export function saveRegistry(registry: Registry, registryPath?: string): void {
  const filePath = registryPath ?? resolveRegistryPath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(registry, null, 2) + "\n", "utf8");
}

export function getServer(
  registry: Registry,
  name: string
): ServerEntry | undefined {
  return registry.servers[name];
}

export function setServer(
  registry: Registry,
  name: string,
  entry: ServerEntry
): Registry {
  return { ...registry, servers: { ...registry.servers, [name]: entry } };
}

export function removeServer(registry: Registry, name: string): Registry {
  const servers = { ...registry.servers };
  delete servers[name];
  return { ...registry, servers };
}

export function enableServer(registry: Registry, name: string): Registry {
  const entry = registry.servers[name];
  if (!entry) throw new Error(`Server "${name}" not found in registry.`);
  return setServer(registry, name, { ...entry, enabled: true });
}

export function disableServer(registry: Registry, name: string): Registry {
  const entry = registry.servers[name];
  if (!entry) throw new Error(`Server "${name}" not found in registry.`);
  return setServer(registry, name, { ...entry, enabled: false });
}

export function listServers(
  registry: Registry
): Array<{ name: string; entry: ServerEntry }> {
  return Object.entries(registry.servers).map(([name, entry]) => ({
    name,
    entry,
  }));
}

export function enabledServers(
  registry: Registry
): Array<{ name: string; entry: ServerEntry }> {
  return listServers(registry).filter(({ entry }) => entry.enabled);
}
