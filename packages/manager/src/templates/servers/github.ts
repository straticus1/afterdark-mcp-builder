import type { ServerTemplate } from "../index.js";

export const githubTemplate: ServerTemplate = {
  name: "github",
  description: "GitHub API — repos, issues, PRs, actions, code search",
  tags: ["vcs", "cloud", "api"],
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-github"],
  env: { GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_TOKEN}" },
  config: { token: "${GITHUB_TOKEN}" },
  envVars: [{ key: "GITHUB_TOKEN", description: "GitHub personal access token", example: "ghp_..." }],
  health: { command: "curl -sf -H 'Authorization: token ${GITHUB_TOKEN}' https://api.github.com/user", timeout: 8000 },
  install: "npm install -g @modelcontextprotocol/server-github",
  docs: "https://github.com/modelcontextprotocol/servers/tree/main/src/github",
};
