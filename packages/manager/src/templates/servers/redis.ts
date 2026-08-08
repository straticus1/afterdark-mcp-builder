import type { ServerTemplate } from "../index.js";

export const redisTemplate: ServerTemplate = {
  name: "redis",
  description: "Redis — key-value store, pub/sub, queues, caching",
  tags: ["data", "cache", "queue"],
  command: "npx",
  args: ["-y", "mcp-server-redis"],
  env: { REDIS_URL: "${REDIS_URL}" },
  config: { url: "${REDIS_URL}" },
  envVars: [{ key: "REDIS_URL", description: "Redis connection URL", example: "redis://localhost:6379" }],
  health: { command: "redis-cli -u ${REDIS_URL} PING", timeout: 5000 },
  install: "npm install -g mcp-server-redis",
  docs: "https://github.com/modelcontextprotocol/servers/tree/main/src/redis",
};
