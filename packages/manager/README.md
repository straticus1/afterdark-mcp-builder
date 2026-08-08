# mcp-builder

Universal CLI for managing [Model Context Protocol (MCP)](https://modelcontextprotocol.io) servers — registry management, health checks, project scanning, and Claude Code sync.

```
mcp-builder list
mcp-builder scan
mcp-builder add postgres --enable
mcp-builder verify
mcp-builder sync
```

The curated path is now:

```bash
mcp-builder catalog documentation
mcp-builder add context7 --enable --yes
mcp-builder serve
```

Use `mcp-builder serve --http` for a loopback Streamable HTTP endpoint or
`mcp-builder daemon start` to run that endpoint in the background. The
unauthenticated HTTP transport refuses non-loopback bind addresses.

Also available as `mcpm` (short alias) and a Python wrapper (`mcpm-py`).

---

## Install

```bash
npm install -g @afterdark/mcp-builder
```

Or run without installing:

```bash
npx @afterdark/mcp-builder <command>
```

### Python wrapper

```bash
pip install -e py/
mcpm-py --help
```

---

## Commands

| Command | Description |
|---------|-------------|
| `mcp-builder catalog [query]` | Search curated plugins and support status |
| `mcp-builder init [dir]` | Bootstrap `.agent/` in a project |
| `mcp-builder scan [dir]` | Detect project type → suggest servers |
| `mcp-builder templates` | List 15+ built-in server templates |
| `mcp-builder list` | Table of all servers + status |
| `mcp-builder add <name>` | Add a server from template or custom |
| `mcp-builder enable <name>` | Enable a server |
| `mcp-builder disable <name>` | Disable a server |
| `mcp-builder remove <name>` | Remove from registry |
| `mcp-builder status` | Live health check table |
| `mcp-builder verify [name]` | Deep verify + write logs |
| `mcp-builder logs [server]` | View log files |
| `mcp-builder sync` | Push enabled servers → Claude Code `settings.json` |
| `mcp-builder serve` | Aggregate enabled servers through one MCP endpoint |
| `mcp-builder daemon start\|stop\|status` | Manage the local HTTP gateway daemon |

### Global flags

```
-r, --registry <path>   Override registry path (default: .agent/mcp-registry.json)
--version               Show version
--help                  Show help
```

---

## Built-in Server Templates

Run `mcp-builder templates` to see all. Filter by tag with `-t`:

```bash
mcp-builder templates -t data
mcp-builder templates -t vector
```

| Tag | Servers |
|-----|---------|
| `core` | `fs`, `git`, `process`, `http` |
| `data` | `postgres`, `sqlite`, `supabase`, `redis` |
| `vector` / `rag` | `qdrant`, `pinecone` |
| `cloud` | `github`, `aws`, `supabase` |
| `devops` / `infra` | `docker`, `aws` |
| `orchestration` | `n8n` |
| `search` | `brave-search` |

---

## Typical workflow

```bash
# 1. Bootstrap a new project
mcp-builder init

# 2. Scan to detect what you need
mcp-builder scan

# 3. Add servers (interactive — picks up built-in templates)
mcp-builder add postgres --enable
mcp-builder add qdrant

# 4. Set env vars
cp .env.example .env
# edit .env with real values

# 5. Verify health
mcp-builder verify

# 6. Sync to Claude Code
mcp-builder sync               # local .claude/settings.json
mcp-builder sync --global      # ~/.claude/settings.json

# 7. Check status any time
mcp-builder status
mcp-builder logs
```

---

## Registry format

`.agent/mcp-registry.json` — versioned, tagged, with health check commands per server:

```json
{
  "$schema": "./.agent/mcp-registry.schema.json",
  "version": "2.0.0",
  "project": { "name": "my-project", "root": "." },
  "servers": {
    "postgres": {
      "enabled": true,
      "description": "PostgreSQL — query, inspect schema",
      "tags": ["data", "database"],
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "${POSTGRES_DSN}"],
      "envVars": [{ "key": "POSTGRES_DSN", "description": "Connection string", "example": "postgresql://..." }],
      "health": { "command": "psql \"${POSTGRES_DSN}\" -c '\\l'", "timeout": 8000 }
    }
  }
}
```

Full JSON schema: `.agent/mcp-registry.schema.json`

---

## Makefile targets

```bash
make help          # show all targets
make install       # npm install
make build         # compile TypeScript
make scan          # mcp-builder scan .
make list          # mcp-builder list
make status        # health check all servers
make verify        # deep verify + logs
make sync          # dry-run sync
make sync-apply    # write to .claude/settings.json
make sync-global   # write to ~/.claude/settings.json
make templates     # list built-in templates
make py-install    # pip install -e py/
```

---

## Development

```bash
git clone https://github.com/dwilcox/mcp-builder
cd mcp-builder
npm install
npm run dev -- list          # run without building
npm run build                # compile to dist/
npm run typecheck            # type-check only
```

### Project structure

```
src/
├── cli.ts                   # Commander.js entry point
├── commands/                # One file per command
│   ├── list.ts
│   ├── add.ts
│   ├── remove.ts
│   ├── enable.ts / disable.ts
│   ├── status.ts
│   ├── verify.ts
│   ├── scan.ts
│   ├── init.ts
│   ├── logs.ts
│   └── sync.ts
├── lib/                     # Core library (also exported as package API)
│   ├── registry.ts          # CRUD for mcp-registry.json
│   ├── health.ts            # Health check runner
│   ├── logger.ts            # Log file management
│   ├── scanner.ts           # Project scanner / server suggester
│   └── claude-sync.ts       # Claude Code settings.json writer
└── templates/               # Built-in server configs
    ├── index.ts
    └── servers/             # One file per server (15+)

py/                          # Python wrapper
├── pyproject.toml
└── mcp_manager/
    ├── cli.py               # Typer CLI (delegates to Node binary)
    └── bridge.py            # subprocess bridge

.agent/
├── mcp-registry.json        # Your server registry
├── mcp-registry.schema.json # JSON schema for validation
└── logs/                    # Health check logs (YYYY-MM-DD/)
```

---

## License

MIT — maintained by dwilcox.
