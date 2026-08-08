import chalk from "chalk";
import ora from "ora";
import type { Registry } from "../lib/registry.js";
import { listServers } from "../lib/registry.js";
import { checkServer } from "../lib/health.js";
import { writeLog } from "../lib/logger.js";

export async function verifyCommand(
  registry: Registry,
  serverName?: string
): Promise<void> {
  let servers = listServers(registry).filter(({ entry }) => entry.enabled);

  if (serverName) {
    servers = servers.filter(({ name }) => name === serverName);
    if (servers.length === 0) {
      console.error(chalk.red(`Server "${serverName}" not found or not enabled.`));
      process.exit(1);
    }
  }

  if (servers.length === 0) {
    console.log(chalk.yellow("No enabled servers to verify."));
    return;
  }

  console.log(chalk.bold(`\nVerifying ${servers.length} server(s)...\n`));

  let passed = 0;
  let failed = 0;

  for (const { name, entry } of servers) {
    const spinner = ora(`Verifying ${chalk.cyan(name)}...`).start();
    const result = checkServer(name, entry);

    const logContent = [
      `Server: ${name}`,
      `Status: ${result.status}`,
      `Duration: ${result.durationMs ?? "—"}ms`,
      result.output ? `Output:\n${result.output}` : "",
      result.error ? `Error:\n${result.error}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const logFile = writeLog(logContent, `verify-${name}`);

    if (result.status === "ok") {
      spinner.succeed(`${chalk.green(name)} — ok (${result.durationMs}ms)`);
      if (result.output) {
        console.log(chalk.dim(`   ${result.output.split("\n")[0]?.slice(0, 80)}`));
      }
      passed++;
    } else if (result.status === "fail") {
      spinner.fail(`${chalk.red(name)} — FAILED`);
      console.log(chalk.red(`   ${result.error?.split("\n")[0]?.slice(0, 100)}`));
      failed++;
    } else {
      spinner.warn(`${chalk.dim(name)} — skipped (no health check)`);
    }

    console.log(chalk.dim(`   → log: ${logFile}`));
  }

  console.log(
    `\n${chalk.green(`${passed} passed`)}  ${failed > 0 ? chalk.red(`${failed} failed`) : chalk.dim("0 failed")}`
  );

  if (failed > 0) process.exit(1);
}
