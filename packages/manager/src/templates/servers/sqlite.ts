import type { ServerTemplate } from "../index.js";

export const sqliteTemplate: ServerTemplate = {
  name: "sqlite",
  description: "SQLite — local database queries and schema inspection",
  tags: ["data", "database"],
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-sqlite", "--db-path", "${SQLITE_DB_PATH}"],
  config: { database: "${SQLITE_DB_PATH}" },
  envVars: [{ key: "SQLITE_DB_PATH", description: "Path to SQLite database file", example: "/path/to/database.sqlite" }],
  health: { command: "sqlite3 ${SQLITE_DB_PATH} '.tables'", timeout: 5000 },
  install: "npm install -g @modelcontextprotocol/server-sqlite",
  docs: "https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite",
};
