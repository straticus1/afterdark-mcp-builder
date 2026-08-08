import type { ServerTemplate } from "../index.js";

export const fsTemplate: ServerTemplate = {
  name: "fs",
  description: "Local filesystem access — read, write, list files",
  tags: ["core", "filesystem"],
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "${FS_ROOT}"],
  config: { scope: "${FS_ROOT}" },
  envVars: [{ key: "FS_ROOT", description: "Root directory to expose", example: "/path/to/project" }],
  health: { command: "ls -la ${FS_ROOT}", timeout: 5000 },
  install: "npm install -g @modelcontextprotocol/server-filesystem",
  docs: "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
};
