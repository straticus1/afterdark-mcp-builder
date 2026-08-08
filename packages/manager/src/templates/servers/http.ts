import type { ServerTemplate } from "../index.js";

export const httpTemplate: ServerTemplate = {
  name: "http",
  description: "HTTP client — make GET/POST/PUT/DELETE requests to any URL",
  tags: ["core", "api", "web"],
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-fetch"],
  config: {},
  envVars: [],
  health: { command: "curl -sf https://httpbin.org/get", timeout: 8000 },
  install: "npm install -g @modelcontextprotocol/server-fetch",
  docs: "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch",
};
