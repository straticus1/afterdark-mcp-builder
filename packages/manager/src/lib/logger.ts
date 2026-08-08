import fs from "node:fs";
import path from "node:path";

function logsDir(cwd = process.cwd()): string {
  const today = new Date().toISOString().slice(0, 10);
  return path.join(cwd, ".agent", "logs", today);
}

let _stepCounter = 0;

function nextStepFile(dir: string): string {
  _stepCounter += 1;
  const pad = String(_stepCounter).padStart(3, "0");
  return path.join(dir, `step-${pad}.log`);
}

export function writeLog(
  content: string,
  label?: string,
  cwd?: string
): string {
  const dir = logsDir(cwd);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const file = label
    ? path.join(dir, `${label}.log`)
    : nextStepFile(dir);
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}]\n${content}\n\n`;
  fs.appendFileSync(file, entry, "utf8");
  return file;
}

export function readLog(file: string): string {
  if (!fs.existsSync(file)) return "(no log file found)";
  return fs.readFileSync(file, "utf8");
}

export function listLogDirs(cwd = process.cwd()): string[] {
  const base = path.join(cwd, ".agent", "logs");
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse()
    .map((d) => path.join(base, d));
}

export function listLogFiles(dateDir: string): string[] {
  if (!fs.existsSync(dateDir)) return [];
  return fs
    .readdirSync(dateDir)
    .filter((f) => f.endsWith(".log"))
    .sort()
    .map((f) => path.join(dateDir, f));
}

export function latestLogDir(cwd = process.cwd()): string | undefined {
  return listLogDirs(cwd)[0];
}
