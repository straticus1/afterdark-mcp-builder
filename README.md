# AfterDark MCP Builder

AfterDark MCP Builder is becoming a local plugin manager and unified gateway for
[Model Context Protocol](https://modelcontextprotocol.io) servers.

Third-party server source does not live in this repository. A curated catalog
records projects we consider useful; supported entries will be downloaded into
a managed cache, configured, supervised as isolated processes, and exposed
through one namespaced MCP endpoint.

## Current state

This is an active reconstruction, not a production release. The first complete
plugin path is working end to end.

- `packages/manager` contains catalog discovery, a typed npm installer, integrity
  lockfile, registry management, process supervision, and the unified proxy.
- `packages/gateway` contains the legacy in-process unified server. It is being
  retained as migration material and is not yet the target proxy architecture.
- `catalog` contains pinned provenance for the initial set of interesting MCP
  projects. Entries are candidates until they have a tested installer and
  runtime definition.
- `docs/architecture.md` defines the target boundaries and lifecycle.

## Working vertical slice

```bash
mcp-builder catalog documentation
mcp-builder add context7 --enable --yes
mcp-builder serve                # MCP over stdio
mcp-builder serve --http         # http://127.0.0.1:3737/mcp
mcp-builder daemon start         # detached local HTTP gateway
mcp-builder status
```

The `serve` command starts enabled third-party servers, discovers their MCP
tools, namespaces them as `<plugin>__<tool>`, and routes calls to the owning
process. Context7 is the first supported catalog entry; other entries remain
candidates until they receive tested install and launch definitions.

Downloaded packages are stored outside the repository in the managed cache.
Set `MCP_BUILDER_CACHE` to override its location. The resolved version,
integrity, executable, and installation location are recorded alongside the
registry in `.agent/mcp-builder.lock.json`.

## Development

Node.js 20 or newer is required.

```bash
npm install
npm run build
npm run typecheck
```

These commands describe the intended reproducible path. During reconstruction,
individual packages may still fail and should be treated as work to complete,
not as a documented success.

## Security direction

Installers will be typed adapters rather than arbitrary catalog shell commands.
Resolved versions and integrity data belong in a lockfile. Secrets never belong
in the catalog. Plugins that request filesystem, process, Docker, cloud, or
network-capture access must declare those permissions and receive explicit user
approval.

The HTTP gateway is currently unauthenticated and therefore refuses to bind to
anything except a loopback address.
