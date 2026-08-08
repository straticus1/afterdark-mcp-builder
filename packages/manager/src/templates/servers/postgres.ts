import type { ServerTemplate } from "../index.js";

export const postgresTemplate: ServerTemplate = {
  name: "postgres",
  description: "PostgreSQL — query, inspect schema, run migrations",
  tags: ["data", "database"],
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-postgres", "${POSTGRES_DSN}"],
  config: { dsn: "${POSTGRES_DSN}" },
  envVars: [{ key: "POSTGRES_DSN", description: "PostgreSQL connection string", example: "postgresql://user:pass@host:5432/db" }],
  health: { command: "psql \"${POSTGRES_DSN}\" -c '\\l'", timeout: 8000 },
  install: "npm install -g @modelcontextprotocol/server-postgres",
  docs: "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres",
};
