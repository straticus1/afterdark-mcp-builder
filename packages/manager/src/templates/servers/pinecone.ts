import type { ServerTemplate } from "../index.js";

export const pineconeTemplate: ServerTemplate = {
  name: "pinecone",
  description: "Pinecone vector database — managed embeddings and search",
  tags: ["vector", "rag", "ai", "cloud"],
  command: "npx",
  args: ["-y", "@pinecone-database/mcp-server-pinecone"],
  env: { PINECONE_API_KEY: "${PINECONE_API_KEY}", PINECONE_ENVIRONMENT: "${PINECONE_ENV}" },
  config: { apiKey: "${PINECONE_API_KEY}", environment: "${PINECONE_ENV}" },
  envVars: [
    { key: "PINECONE_API_KEY", description: "Pinecone API key", example: "changeme" },
    { key: "PINECONE_ENV", description: "Pinecone environment", example: "us-east-1" },
  ],
  health: { command: "curl -sf -H 'Api-Key: ${PINECONE_API_KEY}' 'https://api.pinecone.io/indexes'", timeout: 8000 },
  install: "npm install -g @pinecone-database/mcp-server-pinecone",
  docs: "https://docs.pinecone.io/integrations/mcp",
};
