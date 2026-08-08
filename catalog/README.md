# Curated MCP catalog

This directory is the source map for third-party MCP servers that AfterDark
considers useful. Third-party source code does **not** belong in this
repository. The manager resolves and installs supported entries into a local,
ignored cache on demand.

For regulated deployments, `servers.json` is intake metadata rather than the
endpoint installation source. Approved MCP servers and skills are promoted as
signed, immutable internal artifacts conforming to `artifacts.schema.json`.
Endpoint behavior is constrained by a signed policy conforming to
`policy.schema.json`.

Catalog lifecycle states:

- `candidate`: worth evaluating, but not yet installable by the manager.
- `supported`: has a tested installer, launch configuration, and health check.
- `deprecated`: retained for migration information but not recommended.

An entry being present is not a security endorsement. Before an entry becomes
`supported`, its installer must use a typed strategy, pin a resolved version,
record integrity information in the lockfile, declare required permissions,
and pass an MCP initialization health check.

Local state is deliberately separate from this catalog:

- enabled plugins and settings belong in the user's configuration;
- resolved versions and checksums belong in a generated lockfile;
- downloaded packages and Git checkouts belong in the managed cache;
- credentials belong in environment or platform secret storage.

`skills.json` is the intake candidate registry generated from installed Claude,
Codex, shared-agent, and active plugin skill roots. Identical content is grouped
by SHA-256 while every installed occurrence is retained. Each candidate records
the static-audit verdict, source revision when it can be proven from Git, and
promotion blockers. Candidate intake approval is deliberately separate from
endpoint execution approval: generated entries are always
`executionApproved: false`.

Regenerate it with `npm run catalog:skills`. The generator hashes the audit tool
and reuses unchanged digest-keyed results. Local absolute paths and unverified
local repository URLs are never written to the committed catalog.
