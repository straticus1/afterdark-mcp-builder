# ADR 0001: Regulated artifact distribution

- Status: Accepted
- Date: 2026-08-08

## Context

The platform must operate where endpoint internet access is blocked, MCP servers
and agent skills are allowlisted, and clients may install only artifacts approved
by the organization.

Agent skills are especially sensitive because their Markdown is loaded as trusted
instructions and their scripts may execute with the user's permissions. Source
allowlisting alone is insufficient: an approved repository can change, a tag can
move, dependencies can be compromised, and a previously good artifact can be
revoked.

## Decision

Separate the system into a connected control plane and restricted clients.

### Connected control plane

Only the importer has upstream egress. It:

1. fetches an explicitly approved immutable source revision;
2. resolves and vendors all runtime dependencies;
3. scans skills for prompt injection, code execution, exfiltration, persistence,
   filesystem escape, binaries, symlinks, and dependency risk;
4. executes additional sandboxed tests and records the results;
5. produces an immutable MCP or skill artifact plus SBOM and SLSA provenance;
6. requires approval according to policy;
7. signs the artifact using an organizational KMS identity; and
8. promotes it by digest into the internal OCI registry.

Synchronization from the real source happens only here. A new upstream revision
creates a new candidate; it never mutates an approved artifact.

### Restricted client

The client has no upstream package-manager or Git capability. It:

1. trusts a pinned organizational root and internal registry origin;
2. resolves only allowlisted artifact IDs to immutable OCI digests;
3. verifies TUF metadata freshness, target size and digest;
4. verifies the artifact signature, signer identity, provenance and policy;
5. installs atomically from a content-addressed cache;
6. writes a signed receipt and lock entry;
7. exposes only compliant MCP servers and skills; and
8. continuously reports or quarantines unmanaged content.

Skills are synchronized to client-specific managed roots through adapters. The
same approved artifact can target Codex, Claude, or another client without that
client contacting the original source.

## Enforcement boundary

The CLI alone cannot guarantee “only approved artifacts, period.” Regulated
deployments must also enforce:

- network egress allowing only the internal registry and required identity
  endpoints;
- OS ownership/ACLs that make managed skill and MCP directories writable only by
  the platform service identity;
- managed client configuration that searches only platform-controlled roots;
- application allowlisting for package managers, shells, and alternate clients;
- continuous reconciliation and immutable audit export; and
- an independently authorized, logged break-glass process.

## Artifact storage and trust

Use OCI artifacts for transport and content-addressed storage. Use Sigstore/Cosign
with an organizational KMS signer for artifact signatures and SLSA provenance for
the import/build process. Use TUF metadata in front of the registry catalog for
root rotation, expiry, rollback protection, freeze protection, revocation, and
delegated approval roles.

## Consequences

- The existing direct npm installer is a development/control-plane prototype,
  not an acceptable restricted-client installation path.
- Catalog presence does not imply approval; promotion state and immutable digest
  control eligibility.
- Online, offline, and air-gapped clients use the same verification path. An
  offline bundle is another signed TUF/OCI transport, not a bypass.
- Skills and MCP servers share provenance, policy, approval, receipt, and audit
  machinery while retaining kind-specific scanners and runtime adapters.
