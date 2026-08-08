import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type SkillCompliance = "unmanaged" | "unverified-receipt";

export interface SkillInventoryEntry {
  name: string;
  description?: string;
  path: string;
  digest: string;
  compliance: SkillCompliance;
  unsafeSymlinks: string[];
  source?: {
    repository: string;
    revision: string;
    relativePath: string;
  };
}

interface Receipt {
  digest?: string;
}

function parseFrontmatter(skillPath: string): { name?: string; description?: string } {
  const content = fs.readFileSync(skillPath, "utf8");
  const match = /^---\s*\n([\s\S]*?)\n---/m.exec(content);
  if (!match?.[1]) return {};
  const fields: Record<string, string> = {};
  const lines = match[1].split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (/^[>|][+-]?$/.test(value)) {
      const folded = value.startsWith(">");
      const parts: string[] = [];
      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1] ?? "")) {
        index += 1;
        parts.push((lines[index] ?? "").trim());
      }
      value = parts.join(folded ? " " : "\n").trim();
    }
    if (key === "name" || key === "description") fields[key] = value;
  }
  return {
    ...(fields["name"] ? { name: fields["name"] } : {}),
    ...(fields["description"] ? { description: fields["description"] } : {}),
  };
}

function walkSkillFiles(root: string): { files: string[]; symlinks: string[] } {
  const files: string[] = [];
  const symlinks: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === ".afterdark-receipt.json") continue;
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute);
      if (entry.isSymbolicLink()) {
        symlinks.push(relative);
      } else if (entry.isDirectory()) {
        visit(absolute);
      } else if (entry.isFile()) {
        files.push(relative);
      }
    }
  };
  visit(root);
  files.sort();
  symlinks.sort();
  return { files, symlinks };
}

export function digestSkill(skillRoot: string): { digest: string; unsafeSymlinks: string[] } {
  const { files, symlinks } = walkSkillFiles(skillRoot);
  const hash = createHash("sha256");
  for (const relative of files) {
    hash.update(relative);
    hash.update("\0");
    hash.update(fs.readFileSync(path.join(skillRoot, relative)));
    hash.update("\0");
  }
  for (const symlink of symlinks) {
    hash.update(`SYMLINK:${symlink}\0`);
  }
  return { digest: `sha256:${hash.digest("hex")}`, unsafeSymlinks: symlinks };
}

const sourceCache = new Map<string, SkillInventoryEntry["source"]>();

function findGitRoot(start: string): string | undefined {
  let current = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(current, ".git"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function sourceEvidence(skillRoot: string): SkillInventoryEntry["source"] {
  const gitRoot = findGitRoot(skillRoot);
  if (!gitRoot) return undefined;
  if (sourceCache.has(gitRoot)) {
    const cached = sourceCache.get(gitRoot);
    return cached ? { ...cached, relativePath: path.relative(gitRoot, skillRoot) } : undefined;
  }
  const remote = spawnSync("git", ["-C", gitRoot, "remote", "get-url", "origin"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const revision = spawnSync("git", ["-C", gitRoot, "rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (remote.status !== 0 || revision.status !== 0) {
    sourceCache.set(gitRoot, undefined);
    return undefined;
  }
  const source = {
    repository: remote.stdout.trim(),
    revision: revision.stdout.trim(),
    relativePath: path.relative(gitRoot, skillRoot),
  };
  sourceCache.set(gitRoot, source);
  return source;
}

function findSkillRoots(searchRoots: string[]): string[] {
  const found: string[] = [];
  const visit = (directory: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((entry) => entry.isFile() && entry.name === "SKILL.md")) found.push(directory);
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      if ([".git", "node_modules", "dist", "build"].includes(entry.name)) continue;
      visit(path.join(directory, entry.name));
    }
  };
  for (const root of searchRoots) visit(path.resolve(root));
  return [...new Set(found)].sort();
}

export function defaultSkillSearchRoots(): string[] {
  const configured = process.env["MCP_BUILDER_SKILL_ROOTS"];
  if (configured) return configured.split(path.delimiter).filter(Boolean);
  return [path.join(os.homedir(), ".codex", "skills"), path.join(os.homedir(), ".agents", "skills")]
    .filter((candidate) => fs.existsSync(candidate));
}

export function inventorySkills(searchRoots = defaultSkillSearchRoots()): SkillInventoryEntry[] {
  return findSkillRoots(searchRoots).map((skillRoot) => {
    const metadata = parseFrontmatter(path.join(skillRoot, "SKILL.md"));
    const { digest, unsafeSymlinks } = digestSkill(skillRoot);
    const receiptPath = path.join(skillRoot, ".afterdark-receipt.json");
    let receipt: Receipt | undefined;
    try {
      receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8")) as Receipt;
    } catch {
      receipt = undefined;
    }
    const compliance: SkillCompliance = receipt?.digest === digest
      ? "unverified-receipt"
      : "unmanaged";
    const source = sourceEvidence(skillRoot);
    return {
      name: metadata.name ?? path.basename(skillRoot),
      ...(metadata.description ? { description: metadata.description } : {}),
      path: skillRoot,
      digest,
      compliance,
      unsafeSymlinks,
      ...(source ? { source } : {}),
    };
  });
}
