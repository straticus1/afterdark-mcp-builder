import type { ServerTemplate } from "../index.js";

export const gitTemplate: ServerTemplate = {
  name: "git",
  description: "Git repository operations — status, log, diff, commit, branch",
  tags: ["core", "vcs"],
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-git", "--repository", "${GIT_REPO}"],
  config: { repo: "${GIT_REPO}" },
  envVars: [{ key: "GIT_REPO", description: "Path to git repository", example: "/path/to/repo" }],
  health: { command: "git -C ${GIT_REPO} status", timeout: 5000 },
  install: "npm install -g @modelcontextprotocol/server-git",
  docs: "https://github.com/modelcontextprotocol/servers/tree/main/src/git",
};
