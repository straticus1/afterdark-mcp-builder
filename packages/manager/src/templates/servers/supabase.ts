import type { ServerTemplate } from "../index.js";

export const supabaseTemplate: ServerTemplate = {
  name: "supabase",
  description: "Supabase — database, auth, storage, realtime, edge functions",
  tags: ["data", "database", "cloud", "baas"],
  command: "npx",
  args: ["-y", "@supabase/mcp-server-supabase"],
  env: { SUPABASE_URL: "${SUPABASE_URL}", SUPABASE_SERVICE_ROLE_KEY: "${SUPABASE_SERVICE_ROLE}" },
  config: { url: "${SUPABASE_URL}", key: "${SUPABASE_SERVICE_ROLE}" },
  envVars: [
    { key: "SUPABASE_URL", description: "Supabase project URL", example: "https://xxx.supabase.co" },
    { key: "SUPABASE_SERVICE_ROLE", description: "Supabase service role key", example: "eyJ..." },
  ],
  health: { command: "curl -sf -H 'apikey: ${SUPABASE_SERVICE_ROLE}' '${SUPABASE_URL}/rest/v1/'", timeout: 8000 },
  install: "npm install -g @supabase/mcp-server-supabase",
  docs: "https://supabase.com/docs/guides/getting-started/mcp",
};
