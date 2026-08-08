import fs from "node:fs";
import chalk from "chalk";
import { listLogDirs, listLogFiles, latestLogDir } from "../lib/logger.js";

export function logsCommand(
  serverName: string | undefined,
  opts: { date?: string; all?: boolean; lines?: number }
): void {
  const logDirs = listLogDirs();

  if (logDirs.length === 0) {
    console.log(chalk.yellow("No log directories found. Run `mcp-builder verify` to generate logs."));
    return;
  }

  if (opts.all) {
    // Print all log dates
    console.log(chalk.bold("\nAvailable log dates:\n"));
    for (const dir of logDirs) {
      const files = listLogFiles(dir);
      console.log(`  ${chalk.cyan(dir.split("/").pop() ?? dir)}  (${files.length} file(s))`);
      for (const f of files) {
        console.log(chalk.dim(`    ${f.split("/").pop()}`));
      }
    }
    return;
  }

  const targetDir = opts.date
    ? logDirs.find((d) => d.endsWith(opts.date!))
    : latestLogDir();

  if (!targetDir) {
    console.log(chalk.yellow(`No logs found${opts.date ? ` for date ${opts.date}` : ""}.`));
    return;
  }

  let files = listLogFiles(targetDir);
  if (serverName) {
    files = files.filter((f) => {
      const base = f.split("/").pop() ?? "";
      return base.includes(serverName);
    });
  }

  if (files.length === 0) {
    console.log(chalk.yellow(`No log files found${serverName ? ` for "${serverName}"` : ""}.`));
    return;
  }

  const maxLines = opts.lines ?? 50;

  for (const file of files) {
    const label = file.split("/").slice(-3).join("/");
    console.log(chalk.bold(`\n── ${label} ──`));
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");
    const tail = lines.slice(-maxLines).join("\n");
    console.log(chalk.dim(tail));
  }
}
