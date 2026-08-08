import type { ServerTemplate } from "../index.js";

export const braveSearchTemplate: ServerTemplate = {
  name: "brave-search",
  description: "Brave Search API — privacy-focused web and news search",
  tags: ["search", "web"],
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-brave-search"],
  env: { BRAVE_API_KEY: "${BRAVE_API_KEY}" },
  config: { apiKey: "${BRAVE_API_KEY}" },
  envVars: [{ key: "BRAVE_API_KEY", description: "Brave Search API key", example: "changeme" }],
  health: { command: "curl -sf -H 'Accept: application/json' -H 'Accept-Encoding: gzip' -H 'X-Subscription-Token: ${BRAVE_API_KEY}' 'https://api.search.brave.com/res/v1/web/search?q=test'", timeout: 8000 },
  install: "npm install -g @modelcontextprotocol/server-brave-search",
  docs: "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search",
};
