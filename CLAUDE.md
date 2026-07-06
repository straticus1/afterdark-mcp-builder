# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AfterDark MCP Builder — a workspace for building and consolidating MCP (Model Context Protocol) servers. Most top-level directories are **vendored third-party MCP server repos** used as reference/source material (chrome-devtools-mcp, claude-flow, context7, desktopcommandermcp, fonoster, gpt-researcher, mcp-chrome, mcp-servers, openmetadata, zen-mcp-server, awesome-mcp-servers). The in-house work lives in two places:

- **`unified-mcp-server/`** — the main deliverable: a TypeScript MCP server consolidating capabilities of 8+ servers (60+ tools) into one modular process
- **`dwilcox-universal-agent-mcp-kit/`** (symlinked as `universal-agent-mcp-kit/`) — `mcp-manager`/`mcpm`, a universal CLI for managing MCP server registries, health checks, project scanning, and Claude Code sync; used as the foundational framework

When making changes, work in those two directories — do not modify the vendored repos unless explicitly asked.

## Commands (unified-mcp-server/)

From `unified-mcp-server/` (Node >= 18):

- `npm install` then `npm run build` — tsc compile to `dist/` (+ chmod of executables)
- `npm start` — stdio server (`dist/index.js`); `npm run start:http` — HTTP server (`dist/http-server.js`)
- `npm test` — jest; single test: `npm test -- <path-or-pattern>`
- `npm run lint` — eslint over `src/**/*.ts`; `npm run format` — prettier
- `npm run watch` / `npm run dev` — watch modes
- `npm run docker:build` / `docker:run` / `docker:stop` / `docker:logs` — Docker Compose deployment

Runtime flags: `npm start -- --modules filesystem,memory`, `--debug`, `--allowed-paths /workspace,...`.

## Architecture (unified-mcp-server/)

- Two entry points exposing the same tool set over different transports: `src/index.ts` (stdio, for Claude Desktop/Code) and `src/http-server.ts` (Express-based HTTP); transport plumbing in `src/transports/`.
- **Modular tool domains** under `src/modules/` — filesystem (11 tools), memory/knowledge-graph (9), terminal (10), browser automation via puppeteer-core (25+), documentation/Context7 (2), protocol testing (12+). Modules are individually loadable via `--modules`.
- Shared utilities in `src/shared/`. Tool schemas are defined with zod + zod-to-json-schema; built on `@modelcontextprotocol/sdk`.
- **Security framework** enforced across modules: path traversal protection, allowed-path restrictions, file extension validation, file size limits, command timeouts.
- Deployment assets in the same directory: `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `terraform/`, `ansible/`, `deploy.sh` (see `AWS-DEPLOYMENT.md`).

## Reference docs

- `README.md` — project structure and feature overview
- `unified-mcp-server/README.md`, `README-HTTP.md`, `QUICKSTART.md` — server usage and Claude Desktop config
- `MCP_EXPANSION_PLAN.md`, `IMPLEMENTATION_GUIDE.md`, `QUICK_START.md`, `AFTERDARK_SYSTEMS_OVERHUAL_V1.md` — planning/technical docs at repo root
