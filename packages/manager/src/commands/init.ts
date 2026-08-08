import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { input } from "@inquirer/prompts";
import { saveRegistry } from "../lib/registry.js";

export async function initCommand(
  dir: string,
  opts: { nonInteractive?: boolean }
): Promise<void> {
  const agentDir = path.join(dir, ".agent");
  const logsDir = path.join(agentDir, "logs");
  const registryPath = path.join(agentDir, "mcp-registry.json");
  const envPath = path.join(dir, ".env.example");
  const hintsPath = path.join(agentDir, "project.hints.yaml");

  // Create dirs
  fs.mkdirSync(logsDir, { recursive: true });

  let projectName = path.basename(dir);
  if (!opts.nonInteractive) {
    projectName = await input({ message: "Project name:", default: projectName });
  }

  // Bootstrap registry
  if (!fs.existsSync(registryPath)) {
    saveRegistry(
      {
        $schema: "./.agent/mcp-registry.schema.json",
        version: "2.0.0",
        project: {
          name: projectName,
          root: ".",
          created: new Date().toISOString(),
        },
        servers: {},
      },
      registryPath
    );
    console.log(chalk.green(`✓ Created ${registryPath}`));
  } else {
    console.log(chalk.dim(`  (registry already exists: ${registryPath})`));
  }

  // Bootstrap .env.example
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(
      envPath,
      "# MCP Manager — add your server env vars here\n# Copy to .env and fill in values\n",
      "utf8"
    );
    console.log(chalk.green(`✓ Created ${envPath}`));
  } else {
    console.log(chalk.dim(`  (already exists: ${envPath})`));
  }

  // Bootstrap project.hints.yaml
  if (!fs.existsSync(hintsPath)) {
    fs.writeFileSync(
      hintsPath,
      "project:\n  domain_keywords: []   # e.g., [\"RAG\",\"n8n\",\"supabase\"]\n  prefer:\n    language: null      # e.g., \"python\" | \"typescript\"\n    vector: null        # e.g., \"qdrant\" | \"pinecone\"\n    db: null            # e.g., \"postgres\" | \"supabase\"\n",
      "utf8"
    );
    console.log(chalk.green(`✓ Created ${hintsPath}`));
  }

  console.log(chalk.bold(`\n✓ Initialized mcp-builder in ${dir}`));
  console.log(chalk.dim("  Next steps:"));
  console.log(chalk.dim("    mcp-builder scan         # detect project + suggest servers"));
  console.log(chalk.dim("    mcp-builder add <name>   # add a server from built-in templates"));
  console.log(chalk.dim("    mcp-builder sync         # push to Claude Code settings"));
}
