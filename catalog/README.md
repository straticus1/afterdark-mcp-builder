# Curated MCP catalog

This directory is the source map for third-party MCP servers that AfterDark
considers useful. Third-party source code does **not** belong in this
repository. The manager resolves and installs supported entries into a local,
ignored cache on demand.

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
