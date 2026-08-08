import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const catalog = JSON.parse(
  fs.readFileSync(new URL('../catalog/servers.json', import.meta.url), 'utf8'),
);
const skillCatalog = JSON.parse(
  fs.readFileSync(new URL('../catalog/skills.json', import.meta.url), 'utf8'),
);

test('catalog IDs and pinned revisions are valid and unique', () => {
  assert.equal(catalog.schemaVersion, 1);
  assert.ok(catalog.servers.length > 0);

  const ids = new Set();
  for (const server of catalog.servers) {
    assert.match(server.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(ids.has(server.id), false, `duplicate catalog ID: ${server.id}`);
    ids.add(server.id);
    assert.match(server.source.revision, /^[0-9a-f]{40}$/);
    assert.ok(['candidate', 'supported', 'deprecated'].includes(server.status));
  }
});

test('candidate entries do not pretend to have an installer', () => {
  for (const server of catalog.servers.filter(({ status }) => status === 'candidate')) {
    assert.equal(server.install, undefined);
  }
});

test('supported entries have typed installation and launch contracts', () => {
  const supported = catalog.servers.filter(({ status }) => status === 'supported');
  assert.ok(supported.length > 0);
  for (const server of supported) {
    assert.equal(server.install.type, 'npm');
    assert.match(server.install.integrity, /^sha512-/);
    assert.equal(server.launch.transport, 'stdio');
  }
});

test('installed skills are intake candidates, never execution-approved artifacts', () => {
  assert.equal(skillCatalog.schemaVersion, 1);
  assert.ok(skillCatalog.skills.length > 0);
  assert.equal(skillCatalog.summary.uniqueCandidates, skillCatalog.skills.length);
  assert.equal(
    skillCatalog.summary.pass + skillCatalog.summary.warn
      + skillCatalog.summary.fail + skillCatalog.summary.error,
    skillCatalog.skills.length,
  );

  const ids = new Set();
  for (const skill of skillCatalog.skills) {
    assert.match(skill.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(ids.has(skill.id), false, `duplicate skill candidate ID: ${skill.id}`);
    ids.add(skill.id);
    assert.equal(skill.kind, 'skill');
    assert.equal(skill.state, 'candidate');
    assert.equal(skill.intakeApproved, true);
    assert.equal(skill.executionApproved, false);
    assert.match(skill.digest, /^sha256:[0-9a-f]{64}$/);
    assert.equal(skill.promotion.manualReviewRequired, true);
    assert.ok(skill.promotion.blockers.includes('signed-artifact-not-promoted'));
    for (const installation of skill.installations) {
      assert.equal(installation.relativePath.startsWith('/'), false);
      assert.equal(installation.relativePath.includes('..'), false);
    }
    if (skill.source) {
      assert.match(skill.source.revision, /^[0-9a-f]{40}$/);
      assert.doesNotMatch(skill.source.repository, /^\//);
    }
  }
});
