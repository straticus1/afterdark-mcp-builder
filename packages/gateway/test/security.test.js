import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  SecurityError,
  validateFileExtension,
  validatePath,
} from '../dist/shared/utils.js';

test('validatePath permits a path inside an allowed root', () => {
  const root = path.resolve('/tmp/afterdark-workspace');
  assert.equal(
    validatePath(path.join(root, 'notes', 'file.md'), [root]),
    path.join(root, 'notes', 'file.md'),
  );
});

test('validatePath rejects sibling paths with the same prefix', () => {
  const root = path.resolve('/tmp/afterdark-workspace');
  assert.throws(
    () => validatePath('/tmp/afterdark-workspace-private/secret.md', [root]),
    SecurityError,
  );
});

test('validateFileExtension allows source files and rejects executables', () => {
  assert.doesNotThrow(() => validateFileExtension('README.md'));
  assert.throws(() => validateFileExtension('payload.exe'), SecurityError);
});
