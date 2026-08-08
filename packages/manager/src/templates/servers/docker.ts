import type { ServerTemplate } from "../index.js";

export const dockerTemplate: ServerTemplate = {
  name: "docker",
  description: "Docker — manage containers, images, networks, volumes",
  tags: ["devops", "infra"],
  command: "npx",
  args: ["-y", "mcp-server-docker"],
  config: {},
  envVars: [],
  health: { command: "docker info --format '{{.ServerVersion}}'", timeout: 8000 },
  install: "npm install -g mcp-server-docker",
  docs: "https://github.com/ckreiling/mcp-server-docker",
};
