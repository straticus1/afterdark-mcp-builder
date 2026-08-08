import { execSync } from "node:child_process";
import type { ServerEntry } from "./registry.js";

export type HealthStatus = "ok" | "fail" | "skip";

export interface HealthResult {
  name: string;
  status: HealthStatus;
  output?: string;
  error?: string;
  durationMs?: number;
}

function interpolateEnv(template: string): string {
  return template.replace(/\$\{([^}]+)\}/g, (_, key: string) => {
    return process.env[key] ?? `\${${key}}`;
  });
}

export function checkServer(name: string, entry: ServerEntry): HealthResult {
  if (!entry.enabled) {
    return { name, status: "skip", output: "disabled" };
  }
  if (!entry.health) {
    return { name, status: "skip", output: "no health check defined" };
  }

  const cmd = interpolateEnv(entry.health.command);
  const timeout = entry.health.timeout ?? 5000;
  const start = Date.now();

  try {
    const output = execSync(cmd, {
      timeout,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
    }).trim();
    return { name, status: "ok", output, durationMs: Date.now() - start };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      name,
      status: "fail",
      error: msg.split("\n")[0] ?? msg,
      durationMs: Date.now() - start,
    };
  }
}

export async function checkAll(
  servers: Array<{ name: string; entry: ServerEntry }>,
  onResult?: (result: HealthResult) => void
): Promise<HealthResult[]> {
  const results: HealthResult[] = [];
  for (const { name, entry } of servers) {
    const result = checkServer(name, entry);
    results.push(result);
    onResult?.(result);
  }
  return results;
}
