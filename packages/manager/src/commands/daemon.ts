import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

interface DaemonRecord {
  pid: number;
  host: string;
  port: number;
  startedAt: string;
}

function daemonPaths(registryPath: string): { pid: string; log: string } {
  const stateDir = path.dirname(registryPath);
  return {
    pid: path.join(stateDir, "mcp-builder.pid.json"),
    log: path.join(stateDir, "logs", "gateway.log"),
  };
}

function readRecord(pidPath: string): DaemonRecord | undefined {
  if (!fs.existsSync(pidPath)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(pidPath, "utf8")) as DaemonRecord;
  } catch {
    return undefined;
  }
}

function isAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EPERM") return true;
    return false;
  }
}

export function daemonStatus(registryPath: string): DaemonRecord | undefined {
  const paths = daemonPaths(registryPath);
  const record = readRecord(paths.pid);
  if (!record || !isAlive(record.pid)) {
    if (record) fs.rmSync(paths.pid, { force: true });
    return undefined;
  }
  return record;
}

export function startDaemon(registryPath: string, host = "127.0.0.1", port = 3737): DaemonRecord {
  const existing = daemonStatus(registryPath);
  if (existing) throw new Error(`Gateway daemon is already running as PID ${existing.pid}`);
  const paths = daemonPaths(registryPath);
  fs.mkdirSync(path.dirname(paths.log), { recursive: true });
  const logFd = fs.openSync(paths.log, "a");
  const entrypoint = process.argv[1];
  if (!entrypoint) throw new Error("Cannot resolve mcp-builder entrypoint");
  const child = spawn(
    process.execPath,
    [entrypoint, "--registry", registryPath, "serve", "--http", "--host", host, "--port", String(port)],
    {
      detached: true,
      stdio: ["ignore", logFd, logFd],
      cwd: process.cwd(),
      env: process.env,
    },
  );
  fs.closeSync(logFd);
  if (!child.pid) throw new Error("Failed to start gateway daemon");
  child.unref();
  const record = { pid: child.pid, host, port, startedAt: new Date().toISOString() };
  fs.writeFileSync(paths.pid, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  return record;
}

export function stopDaemon(registryPath: string): boolean {
  const paths = daemonPaths(registryPath);
  const record = daemonStatus(registryPath);
  if (!record) return false;
  process.kill(record.pid, "SIGTERM");
  fs.rmSync(paths.pid, { force: true });
  return true;
}
