import chalk from "chalk";
import Table from "cli-table3";
import { loadCatalog, searchCatalog } from "../lib/catalog.js";

export function catalogCommand(query?: string): void {
  const entries = searchCatalog(loadCatalog(), query);
  const table = new Table({
    head: ["ID", "Status", "Tags", "Description"],
    colWidths: [26, 12, 28, 58],
    wordWrap: true,
  });
  for (const entry of entries) {
    const status = entry.status === "supported" ? chalk.green(entry.status) : chalk.yellow(entry.status);
    table.push([chalk.cyan(entry.id), status, entry.tags.join(", "), entry.description]);
  }
  console.log(table.toString());
  console.log(chalk.dim(`\n${entries.length} catalog entr${entries.length === 1 ? "y" : "ies"}`));
}
