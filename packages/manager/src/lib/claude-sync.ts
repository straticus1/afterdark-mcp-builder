import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Registry } from "./registry.js";

interface ClaudeMcpEntry {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface ClaudeSettings {
  mcpServers?: Record<string, ClaudeMcpEntry>;
  [key: string]: unknown;
}

function resolveClaudeSettingsPath(scope: "global" | "local"): string {
  if (scope === "local") {
    return path.join(process.cwd(), ".claude", "settings.json");
  }
  return path.join(os.homedir(), ".claude", "settings.json");
}

function loadClaudeSettings(settingsPath: string): ClaudeSettings {
  if (!fs.existsSync(settingsPath)) return {};
  return JSON.parse(fs.readFileSync(settingsPath, "utf8")) as ClaudeSettings;
}

function saveClaudeSettings(settingsPath: string, settings: ClaudeSettings): void {
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf8");
}

export interface SyncResult {
  added: string[];
  removed: string[];
  skipped: string[];
  settingsPath: string;
}

export function syncToClaudeCode(
  registry: Registry,
  scope: "global" | "local" = "local",
  settingsPathOverride?: string
): SyncResult {
  const settingsPath = settingsPathOverride ?? resolveClaudeSettingsPath(scope);
  const settings = loadClaudeSettings(settingsPath);
  const existing = settings.mcpServers ?? {};
  const result: SyncResult = {
    added: [],
    removed: [],
    skipped: [],
    settingsPath,
  };

  const newMcpServers: Record<string, ClaudeMcpEntry> = {};

  // Add all enabled servers
  for (const [name, entry] of Object.entries(registry.servers)) {
    if (!entry.enabled) {
      result.skipped.push(name);
      continue;
    }
    if (!entry.command) {
      result.skipped.push(name);
      continue;
    }

    newMcpServers[name] = {
      command: entry.command,
      ...(entry.args && entry.args.length > 0 ? { args: entry.args } : {}),
      ...(entry.env && Object.keys(entry.env).length > 0 ? { env: entry.env } : {}),
    };

    if (name in existing) {
      // already present — still update
    } else {
      result.added.push(name);
    }
  }

  // Track removed (were in Claude settings, no longer enabled)
  for (const name of Object.keys(existing)) {
    if (!(name in newMcpServers)) {
      result.removed.push(name);
    }
  }

  settings.mcpServers = newMcpServers;
  saveClaudeSettings(settingsPath, settings);
  return result;
}

export function previewSync(
  registry: Registry
): Record<string, ClaudeMcpEntry> {
  const preview: Record<string, ClaudeMcpEntry> = {};
  for (const [name, entry] of Object.entries(registry.servers)) {
    if (!entry.enabled || !entry.command) continue;
    preview[name] = {
      command: entry.command,
      ...(entry.args && entry.args.length > 0 ? { args: entry.args } : {}),
      ...(entry.env && Object.keys(entry.env).length > 0 ? { env: entry.env } : {}),
    };
  }
  return preview;
}
