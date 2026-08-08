import { fsTemplate } from "./servers/fs.js";
import { gitTemplate } from "./servers/git.js";
import { githubTemplate } from "./servers/github.js";
import { postgresTemplate } from "./servers/postgres.js";
import { sqliteTemplate } from "./servers/sqlite.js";
import { supabaseTemplate } from "./servers/supabase.js";
import { qdrantTemplate } from "./servers/qdrant.js";
import { pineconeTemplate } from "./servers/pinecone.js";
import { redisTemplate } from "./servers/redis.js";
import { dockerTemplate } from "./servers/docker.js";
import { awsTemplate } from "./servers/aws.js";
import { n8nTemplate } from "./servers/n8n.js";
import { braveSearchTemplate } from "./servers/brave-search.js";
import { processTemplate } from "./servers/process.js";
import { httpTemplate } from "./servers/http.js";

export interface EnvVar {
  key: string;
  description: string;
  example: string;
}

export interface HealthCheck {
  command: string;
  timeout: number;
}

export interface ServerTemplate {
  name: string;
  description: string;
  tags: string[];
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  config: Record<string, unknown>;
  envVars: EnvVar[];
  health: HealthCheck;
  install: string;
  docs: string;
}

export const ALL_TEMPLATES: ServerTemplate[] = [
  fsTemplate,
  gitTemplate,
  githubTemplate,
  postgresTemplate,
  sqliteTemplate,
  supabaseTemplate,
  qdrantTemplate,
  pineconeTemplate,
  redisTemplate,
  dockerTemplate,
  awsTemplate,
  n8nTemplate,
  braveSearchTemplate,
  processTemplate,
  httpTemplate,
];

export const TEMPLATE_MAP = new Map<string, ServerTemplate>(
  ALL_TEMPLATES.map((t) => [t.name, t])
);

export function getTemplate(name: string): ServerTemplate | undefined {
  return TEMPLATE_MAP.get(name);
}

export function searchTemplates(query: string): ServerTemplate[] {
  const q = query.toLowerCase();
  return ALL_TEMPLATES.filter(
    (t) =>
      t.name.includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.includes(q))
  );
}
