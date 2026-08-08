import type { ServerTemplate } from "../index.js";

export const qdrantTemplate: ServerTemplate = {
  name: "qdrant",
  description: "Qdrant vector database — semantic search, RAG, embeddings",
  tags: ["vector", "rag", "ai"],
  command: "npx",
  args: ["-y", "mcp-server-qdrant"],
  env: { QDRANT_URL: "${QDRANT_URL}", QDRANT_API_KEY: "${QDRANT_API_KEY}" },
  config: { url: "${QDRANT_URL}", apiKey: "${QDRANT_API_KEY}" },
  envVars: [
    { key: "QDRANT_URL", description: "Qdrant instance URL", example: "https://your-cluster.qdrant.io" },
    { key: "QDRANT_API_KEY", description: "Qdrant API key", example: "changeme" },
  ],
  health: { command: "curl -sf '${QDRANT_URL}/collections'", timeout: 8000 },
  install: "npm install -g mcp-server-qdrant",
  docs: "https://github.com/qdrant/mcp-server-qdrant",
};
