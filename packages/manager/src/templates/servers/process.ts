import type { ServerTemplate } from "../index.js";

export const processTemplate: ServerTemplate = {
  name: "process",
  description: "Shell/process runner — execute commands in a working directory",
  tags: ["core", "devops"],
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-shell"],
  config: { cwd: "${PROCESS_CWD}" },
  envVars: [{ key: "PROCESS_CWD", description: "Working directory for process execution", example: "/path/to/project" }],
  health: { command: "echo 'process server ok'", timeout: 3000 },
  install: "npm install -g @modelcontextprotocol/server-shell",
  docs: "https://github.com/modelcontextprotocol/servers",
};
