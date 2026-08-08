import fs from "node:fs";
import path from "node:path";
import type { ServerTemplate } from "../templates/index.js";
import { ALL_TEMPLATES } from "../templates/index.js";

interface ScanSignal {
  file: string;
  tags: string[];
  servers: string[];
  reason: string;
}

const SIGNAL_RULES: Array<{
  patterns: string[];
  servers: string[];
  tags: string[];
  reason: string;
}> = [
  {
    patterns: ["package.json", ".nvmrc", ".node-version"],
    servers: ["fs", "git", "process", "http"],
    tags: ["core"],
    reason: "Node.js project — core MCP servers recommended",
  },
  {
    patterns: ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile"],
    servers: ["fs", "git", "process", "http"],
    tags: ["core"],
    reason: "Python project — core MCP servers recommended",
  },
  {
    patterns: ["go.mod"],
    servers: ["fs", "git", "process"],
    tags: ["core"],
    reason: "Go project detected",
  },
  {
    patterns: ["Dockerfile", "docker-compose.yml", "docker-compose.yaml"],
    servers: ["docker"],
    tags: ["devops"],
    reason: "Docker configuration found",
  },
  {
    patterns: ["terraform/", "infra/", "*.tf"],
    servers: ["aws", "docker"],
    tags: ["infra"],
    reason: "Infrastructure-as-code detected",
  },
  {
    patterns: ["supabase/", "supabase.json"],
    servers: ["supabase"],
    tags: ["data"],
    reason: "Supabase project directory found",
  },
  {
    patterns: ["*.sqlite", "*.sqlite3", "database/*.sqlite"],
    servers: ["sqlite"],
    tags: ["data"],
    reason: "SQLite database file detected",
  },
  {
    patterns: ["migrations/", "schema.sql", "*.sql"],
    servers: ["postgres", "sqlite"],
    tags: ["data"],
    reason: "SQL/migration files detected",
  },
  {
    patterns: ["qdrant/", "pinecone/", "rag/", "embeddings/", "vectorstore/"],
    servers: ["qdrant", "pinecone"],
    tags: ["vector", "rag"],
    reason: "Vector/RAG directory detected",
  },
  {
    patterns: ["n8n/", ".n8n/"],
    servers: ["n8n"],
    tags: ["orchestration"],
    reason: "n8n workflow directory found",
  },
  {
    patterns: [".github/", ".github/workflows/"],
    servers: ["github"],
    tags: ["vcs"],
    reason: "GitHub Actions / .github directory found",
  },
  {
    patterns: ["redis.conf", "redis/"],
    servers: ["redis"],
    tags: ["cache"],
    reason: "Redis configuration found",
  },
];

function globLike(pattern: string, files: string[]): string[] {
  if (pattern.endsWith("/")) {
    return files.filter((f) => f.includes(`/${pattern.slice(0, -1)}/`) || f.startsWith(pattern));
  }
  if (pattern.startsWith("*.")) {
    const ext = pattern.slice(1);
    return files.filter((f) => f.endsWith(ext));
  }
  return files.filter((f) => path.basename(f) === pattern || f === pattern);
}

function collectFiles(dir: string, depth = 0): string[] {
  if (depth > 3) return [];
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".github") continue;
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
      const full = path.join(dir, entry.name);
      results.push(full.replace(dir + "/", ""));
      if (entry.isDirectory()) {
        results.push(...collectFiles(full, depth + 1).map((f) => path.join(entry.name, f)));
      }
    }
  } catch {
    // skip unreadable dirs
  }
  return results;
}

export interface ScanResult {
  projectRoot: string;
  signals: ScanSignal[];
  suggestedServers: string[];
  suggestedTemplates: ServerTemplate[];
}

export function scanProject(dir = process.cwd()): ScanResult {
  const files = collectFiles(dir);
  const signals: ScanSignal[] = [];
  const serverSet = new Set<string>();

  for (const rule of SIGNAL_RULES) {
    const matched: string[] = [];
    for (const pattern of rule.patterns) {
      matched.push(...globLike(pattern, files));
    }
    if (matched.length > 0) {
      signals.push({
        file: matched[0] ?? rule.patterns[0] ?? ".",
        tags: rule.tags,
        servers: rule.servers,
        reason: rule.reason,
      });
      rule.servers.forEach((s) => serverSet.add(s));
    }
  }

  // Always recommend core servers if none found
  if (serverSet.size === 0) {
    ["fs", "git", "process", "http"].forEach((s) => serverSet.add(s));
    signals.push({
      file: ".",
      tags: ["core"],
      servers: ["fs", "git", "process", "http"],
      reason: "Generic project — core MCP servers recommended",
    });
  }

  const suggestedServers = Array.from(serverSet);
  const suggestedTemplates = ALL_TEMPLATES.filter((t) =>
    suggestedServers.includes(t.name)
  );

  return { projectRoot: dir, signals, suggestedServers, suggestedTemplates };
}
