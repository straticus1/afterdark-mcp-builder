# Agent Usage (Universal)

Ask Claude Code: “Run **Project Scan** and propose a minimal **MCP Plan**. Patch `./.agent/mcp-registry.json` and `.env.example`, verify servers (dry-run), then proceed with the task.”

## Conventions
- Use `--help`/introspect on any new server and summarize usage.
- Prefer dry-runs before apply. Never output secrets—use placeholders.
- Log to `./.agent/logs/YYYY-MM-DD/step-*.log`.

## Optional Hints (empty is fine)
- Domain keywords (e.g., “RAG”, “n8n”, “FastAPI”) may steer tool suggestions.
