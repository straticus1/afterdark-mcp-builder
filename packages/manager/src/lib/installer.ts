import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CatalogEntry } from "./catalog.js";

export interface InstalledPlugin {
  id: string;
  installer: "npm";
  package: string;
  version: string;
  integrity: string;
  root: string;
  command: string;
  args: string[];
  installedAt: string;
}

interface PluginLockfile {
  version: 1;
  plugins: Record<string, InstalledPlugin>;
}

export function resolveCacheRoot(): string {
  if (process.env["MCP_BUILDER_CACHE"]) return path.resolve(process.env["MCP_BUILDER_CACHE"]);
  const base = process.env["XDG_CACHE_HOME"] ?? path.join(os.homedir(), ".cache");
  return path.join(base, "afterdark-mcp-builder");
}

export function resolveLockfilePath(registryPath: string): string {
  return path.join(path.dirname(registryPath), "mcp-builder.lock.json");
}

function loadLockfile(lockfilePath: string): PluginLockfile {
  if (!fs.existsSync(lockfilePath)) return { version: 1, plugins: {} };
  const parsed = JSON.parse(fs.readFileSync(lockfilePath, "utf8")) as PluginLockfile;
  if (parsed.version !== 1 || typeof parsed.plugins !== "object") {
    throw new Error(`Unsupported plugin lockfile: ${lockfilePath}`);
  }
  return parsed;
}

function saveLockfile(lockfilePath: string, lockfile: PluginLockfile): void {
  fs.mkdirSync(path.dirname(lockfilePath), { recursive: true });
  const tempPath = `${lockfilePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(lockfile, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, lockfilePath);
}

function packageDirectory(root: string, packageName: string): string {
  return path.join(root, "node_modules", ...packageName.split("/"));
}

function verifyNpmInstall(root: string, entry: CatalogEntry): { binPath: string; integrity: string } {
  if (!entry.install || entry.install.type !== "npm") throw new Error(`${entry.id} has no npm installer`);
  const packageRoot = packageDirectory(root, entry.install.package);
  const packageJsonPath = path.join(packageRoot, "package.json");
  const lockPath = path.join(root, "package-lock.json");
  if (!fs.existsSync(packageJsonPath) || !fs.existsSync(lockPath)) {
    throw new Error(`Incomplete npm installation for ${entry.id}`);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    version?: string;
    bin?: string | Record<string, string>;
  };
  if (packageJson.version !== entry.install.version) {
    throw new Error(`Installed ${entry.install.package}@${packageJson.version ?? "unknown"}; expected ${entry.install.version}`);
  }
  const binRelative = typeof packageJson.bin === "string"
    ? packageJson.bin
    : packageJson.bin?.[entry.install.bin];
  if (!binRelative) throw new Error(`Package does not expose bin '${entry.install.bin}'`);
  const binPath = path.resolve(packageRoot, binRelative);
  const relativeBin = path.relative(packageRoot, binPath);
  if (relativeBin.startsWith("..") || path.isAbsolute(relativeBin) || !fs.existsSync(binPath)) {
    throw new Error(`Invalid package binary for ${entry.id}`);
  }

  const packageLock = JSON.parse(fs.readFileSync(lockPath, "utf8")) as {
    packages?: Record<string, { integrity?: string }>;
  };
  const lockKey = `node_modules/${entry.install.package}`;
  const integrity = packageLock.packages?.[lockKey]?.integrity;
  if (integrity !== entry.install.integrity) {
    throw new Error(`Integrity mismatch for ${entry.install.package}@${entry.install.version}`);
  }
  return { binPath, integrity };
}

export function installCatalogPlugin(
  entry: CatalogEntry,
  registryPath: string,
  cacheRoot = resolveCacheRoot(),
): InstalledPlugin {
  if (entry.status !== "supported" || !entry.install || !entry.launch) {
    throw new Error(`${entry.id} is a catalog candidate, not a supported install`);
  }
  if (entry.install.type !== "npm") throw new Error(`Unsupported installer: ${entry.install.type}`);

  const finalRoot = path.join(cacheRoot, "npm", entry.id, entry.install.version);
  fs.mkdirSync(path.dirname(finalRoot), { recursive: true });
  let verified: { binPath: string; integrity: string };

  if (fs.existsSync(finalRoot)) {
    verified = verifyNpmInstall(finalRoot, entry);
  } else {
    fs.mkdirSync(cacheRoot, { recursive: true });
    const tempRoot = fs.mkdtempSync(path.join(cacheRoot, `.install-${entry.id}-`));
    try {
      const spec = `${entry.install.package}@${entry.install.version}`;
      const result = spawnSync(
        "npm",
        ["install", "--prefix", tempRoot, "--save-exact", "--ignore-scripts", "--no-audit", "--no-fund", spec],
        { stdio: "inherit", shell: false },
      );
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`npm install failed with exit code ${result.status ?? "unknown"}`);
      verified = verifyNpmInstall(tempRoot, entry);
      fs.renameSync(tempRoot, finalRoot);
      verified = verifyNpmInstall(finalRoot, entry);
    } catch (error) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      throw error;
    }
  }

  const installed: InstalledPlugin = {
    id: entry.id,
    installer: "npm",
    package: entry.install.package,
    version: entry.install.version,
    integrity: verified.integrity,
    root: finalRoot,
    command: process.execPath,
    args: [verified.binPath, ...entry.launch.args],
    installedAt: new Date().toISOString(),
  };
  const lockfilePath = resolveLockfilePath(registryPath);
  const lockfile = loadLockfile(lockfilePath);
  lockfile.plugins[entry.id] = installed;
  saveLockfile(lockfilePath, lockfile);
  return installed;
}
