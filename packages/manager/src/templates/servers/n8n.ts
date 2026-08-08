import type { ServerTemplate } from "../index.js";

export const n8nTemplate: ServerTemplate = {
  name: "n8n",
  description: "n8n — workflow automation, trigger/inspect/run workflows",
  tags: ["orchestration", "automation"],
  command: "npx",
  args: ["-y", "mcp-server-n8n"],
  env: { N8N_URL: "${N8N_URL}", N8N_API_KEY: "${N8N_API_KEY}" },
  config: { baseUrl: "${N8N_URL}", apiKey: "${N8N_API_KEY}" },
  envVars: [
    { key: "N8N_URL", description: "n8n base URL", example: "https://n8n.example.com/api/v1" },
    { key: "N8N_API_KEY", description: "n8n API key", example: "changeme" },
  ],
  health: { command: "curl -sf -H 'X-N8N-API-KEY: ${N8N_API_KEY}' '${N8N_URL}/workflows'", timeout: 8000 },
  install: "npm install -g mcp-server-n8n",
  docs: "https://docs.n8n.io/integrations/mcp/",
};
