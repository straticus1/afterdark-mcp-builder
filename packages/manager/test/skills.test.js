import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { digestSkill, inventorySkills } from '../dist/lib/skills.js';

test('skill inventory hashes content and never treats an unsigned install as managed', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-skill-inventory-'));
  const skillRoot = path.join(tempRoot, 'example-skill');
  fs.mkdirSync(path.join(skillRoot, 'scripts'), { recursive: true });
  fs.writeFileSync(
    path.join(skillRoot, 'SKILL.md'),
    '---\nname: example-skill\ndescription: Test fixture\n---\n\n# Example\n',
  );
  fs.writeFileSync(path.join(skillRoot, 'scripts', 'run.js'), 'console.log("ok");\n');

  try {
    const firstDigest = digestSkill(skillRoot).digest;
    const [entry] = inventorySkills([tempRoot]);
    assert.equal(entry?.name, 'example-skill');
    assert.equal(entry?.description, 'Test fixture');
    assert.equal(entry?.compliance, 'unmanaged');
    assert.equal(entry?.digest, firstDigest);

    fs.writeFileSync(path.join(skillRoot, 'scripts', 'run.js'), 'console.log("changed");\n');
    assert.notEqual(digestSkill(skillRoot).digest, firstDigest);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('skill inventory includes nested skill manifests', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-nested-skill-inventory-'));
  fs.mkdirSync(path.join(tempRoot, 'bundle', 'skills', 'child'), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, 'bundle', 'SKILL.md'), '# Bundle\n');
  fs.writeFileSync(path.join(tempRoot, 'bundle', 'skills', 'child', 'SKILL.md'), '# Child\n');

  try {
    const entries = inventorySkills([tempRoot]);
    assert.equal(entries.length, 2);
    assert.deepEqual(entries.map(({ name }) => name).sort(), ['bundle', 'child']);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('skill inventory parses folded YAML frontmatter values', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-folded-skill-inventory-'));
  const skillRoot = path.join(tempRoot, 'folded');
  fs.mkdirSync(skillRoot, { recursive: true });
  fs.writeFileSync(
    path.join(skillRoot, 'SKILL.md'),
    '---\nname: >-\n  real-skill-name\ndescription: >-\n  A folded\n  description.\n---\n',
  );

  try {
    const [entry] = inventorySkills([tempRoot]);
    assert.equal(entry?.name, 'real-skill-name');
    assert.equal(entry?.description, 'A folded description.');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
