import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  RegistrySchema,
  disableServer,
  enableServer,
  loadRegistry,
  saveRegistry,
} from '../dist/lib/registry.js';

test('registry defaults are stable', () => {
  const registry = RegistrySchema.parse({});
  assert.equal(registry.version, '2.0.0');
  assert.deepEqual(registry.servers, {});
  assert.equal(registry.project.root, '.');
});

test('registry round-trips and toggles a server', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-builder-test-'));
  const registryPath = path.join(tempDir, 'mcp-registry.json');

  try {
    const registry = RegistrySchema.parse({
      servers: {
        context7: { enabled: false, tags: ['documentation'] },
      },
    });
    saveRegistry(registry, registryPath);

    const loaded = loadRegistry(registryPath);
    assert.equal(enableServer(loaded, 'context7').servers.context7?.enabled, true);
    assert.equal(disableServer(loaded, 'context7').servers.context7?.enabled, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
