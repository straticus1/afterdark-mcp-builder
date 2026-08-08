import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const NpmInstallSchema = z.object({
  type: z.literal("npm"),
  package: z.string().min(1),
  version: z.string().min(1),
  bin: z.string().min(1),
  integrity: z.string().startsWith("sha512-"),
});

const LaunchSchema = z.object({
  transport: z.literal("stdio"),
  args: z.array(z.string()).default([]),
});

export const CatalogEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  status: z.enum(["candidate", "supported", "deprecated"]),
  description: z.string().min(1),
  tags: z.array(z.string()),
  source: z.object({
    type: z.literal("git"),
    url: z.string().url(),
    revision: z.string().regex(/^[0-9a-f]{40}$/),
  }),
  requirements: z.object({
    executables: z.array(z.string()).optional(),
    macosCask: z.string().optional(),
    node: z.string().optional(),
  }).optional(),
  permissions: z.array(z.string()).optional(),
  install: NpmInstallSchema.optional(),
  launch: LaunchSchema.optional(),
}).superRefine((entry, ctx) => {
  if (entry.status === "supported" && (!entry.install || !entry.launch)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "supported entries require install and launch definitions",
    });
  }
});

const CatalogSchema = z.object({
  schemaVersion: z.literal(1),
  servers: z.array(CatalogEntrySchema),
});

export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;
export type Catalog = z.infer<typeof CatalogSchema>;

export function resolveCatalogPath(override?: string): string {
  const candidates = [
    override,
    process.env["MCP_CATALOG_PATH"],
    path.resolve(process.cwd(), "catalog", "servers.json"),
    path.resolve(process.cwd(), "..", "..", "catalog", "servers.json"),
    fileURLToPath(new URL("../catalog/servers.json", import.meta.url)),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error("MCP catalog not found. Set MCP_CATALOG_PATH to catalog/servers.json.");
  }
  return found;
}

export function loadCatalog(catalogPath?: string): Catalog {
  const resolved = resolveCatalogPath(catalogPath);
  const raw = JSON.parse(fs.readFileSync(resolved, "utf8")) as unknown;
  const catalog = CatalogSchema.parse(raw);
  const ids = new Set<string>();
  for (const entry of catalog.servers) {
    if (ids.has(entry.id)) throw new Error(`Duplicate catalog ID: ${entry.id}`);
    ids.add(entry.id);
  }
  return catalog;
}

export function findCatalogEntry(catalog: Catalog, id: string): CatalogEntry | undefined {
  return catalog.servers.find((entry) => entry.id === id);
}

export function searchCatalog(catalog: Catalog, query?: string): CatalogEntry[] {
  if (!query) return catalog.servers;
  const normalized = query.toLowerCase();
  return catalog.servers.filter((entry) =>
    entry.id.includes(normalized) ||
    entry.name.toLowerCase().includes(normalized) ||
    entry.description.toLowerCase().includes(normalized) ||
    entry.tags.some((tag) => tag.includes(normalized))
  );
}
