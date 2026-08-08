import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  findCatalogEntry,
  loadCatalog,
  searchCatalog,
} from '../dist/lib/catalog.js';
import { installCatalogPlugin, resolveLockfilePath } from '../dist/lib/installer.js';
import { assertLoopbackHost, namespaceTool } from '../dist/lib/proxy.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const catalogPath = path.join(repoRoot, 'catalog', 'servers.json');

test('catalog exposes Context7 as a pinned supported plugin', () => {
  const catalog = loadCatalog(catalogPath);
  const context7 = findCatalogEntry(catalog, 'context7');
  assert.equal(context7?.status, 'supported');
  assert.equal(context7?.install?.package, '@upstash/context7-mcp');
  assert.equal(context7?.install?.version, '2.1.3');
  assert.equal(searchCatalog(catalog, 'documentation').some(({ id }) => id === 'context7'), true);
});

test('candidate plugins fail closed instead of running catalog shell text', () => {
  const candidate = findCatalogEntry(loadCatalog(catalogPath), 'sharkmcp');
  assert.ok(candidate);
  assert.throws(
    () => installCatalogPlugin(candidate, '/tmp/unused-registry.json', '/tmp/unused-cache'),
    /candidate, not a supported install/,
  );
});

test('gateway namespacing and lockfile location are deterministic', () => {
  assert.equal(namespaceTool('context7', 'query-docs'), 'context7__query-docs');
  assert.equal(
    resolveLockfilePath('/work/project/.agent/mcp-registry.json'),
    '/work/project/.agent/mcp-builder.lock.json',
  );
});

test('unauthenticated HTTP gateway is restricted to loopback', () => {
  assert.doesNotThrow(() => assertLoopbackHost('127.0.0.1'));
  assert.doesNotThrow(() => assertLoopbackHost('::1'));
  assert.throws(() => assertLoopbackHost('0.0.0.0'), /loopback/);
});
