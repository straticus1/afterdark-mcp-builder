# Repository guidance

AfterDark MCP Builder is a TypeScript workspace for a curated MCP plugin
manager, process supervisor, and unified proxy gateway.

Third-party source must not be committed here. Add or update catalog metadata
and installer adapters instead. Downloads belong in the ignored managed cache.

The current packages are:

- `packages/manager`: existing CLI foundation and the primary place for catalog,
  installation, configuration, and lifecycle work.
- `packages/gateway`: legacy in-process implementation retained for migration.
  New integrations should be external MCP processes connected through client
  adapters, not copied modules.

Keep catalog status honest: `candidate` means provenance only; `supported`
requires a typed installer, pinned resolution, permission declaration, launch
definition, and tested MCP initialization.
