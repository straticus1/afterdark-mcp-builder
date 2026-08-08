#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { inventorySkills } from '../packages/manager/dist/lib/skills.js';

const home = os.homedir();
const auditor = process.env.SKILL_AUDITOR_PATH
  ?? path.join(home, '.agents/skills/claude-skills/engineering/skill-security-auditor/scripts/skill_security_auditor.py');
const output = process.argv[2] ?? path.resolve('catalog/skills.json');
const auditorDigest = `sha256:${createHash('sha256').update(fs.readFileSync(auditor)).digest('hex')}`;
let priorAudits = new Map();
try {
  const prior = JSON.parse(fs.readFileSync(output, 'utf8'));
  if (prior.auditTool?.digest === auditorDigest) {
    priorAudits = new Map((prior.skills ?? []).map(({ digest, audit }) => [digest, audit]));
  }
} catch {
  priorAudits = new Map();
}
const roots = [
  { platform: 'claude', root: path.join(home, '.claude/skills') },
  { platform: 'shared', root: path.join(home, '.agents/skills') },
  { platform: 'codex', root: path.join(home, '.codex/skills') },
  { platform: 'codex-plugin', root: path.join(home, '.codex/plugins/cache') },
].filter(({ root }) => fs.existsSync(root));

const installedPluginsPath = path.join(home, '.claude/plugins/installed_plugins.json');
if (fs.existsSync(installedPluginsPath)) {
  const installed = JSON.parse(fs.readFileSync(installedPluginsPath, 'utf8'));
  for (const records of Object.values(installed.plugins ?? {})) {
    for (const record of records) {
      if (typeof record.installPath === 'string' && fs.existsSync(record.installPath)) {
        roots.push({ platform: 'claude-plugin', root: record.installPath });
      }
    }
  }
}

function portableRepository(repository) {
  if (/^(?:https?:\/\/|ssh:\/\/|git@)[^\s]+$/.test(repository)) return repository;
  return undefined;
}

function slug(value) {
  const result = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return result || 'unnamed-skill';
}

function runAudit(skillPath) {
  return new Promise((resolve) => {
    const child = spawn('python3', [auditor, skillPath, '--json'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, Number(process.env.SKILL_AUDIT_TIMEOUT_MS ?? 60_000));
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timeout);
      resolve({ error: error.message });
    });
    child.on('close', () => {
      clearTimeout(timeout);
      if (timedOut) {
        resolve({ error: 'audit exceeded the per-skill timeout' });
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve({ error: stderr.trim() || stdout.trim() || 'auditor returned no JSON' });
      }
    });
  });
}

async function mapLimited(items, concurrency, mapper) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

const byDigest = new Map();
let occurrenceCount = 0;
for (const { platform, root } of roots) {
  for (const skill of inventorySkills([root])) {
    occurrenceCount += 1;
    const relativePath = path.relative(root, skill.path) || '.';
    let candidate = byDigest.get(skill.digest);
    if (!candidate) {
      const repository = skill.source && portableRepository(skill.source.repository);
      candidate = {
        name: skill.name,
        ...(skill.description ? { description: skill.description } : {}),
        digest: skill.digest,
        auditPath: skill.path,
        installations: [],
        unsafeSymlinks: new Set(),
        ...(repository ? { source: { ...skill.source, repository } } : {}),
      };
      byDigest.set(skill.digest, candidate);
    }
    candidate.installations.push({ platform, relativePath });
    for (const symlink of skill.unsafeSymlinks) candidate.unsafeSymlinks.add(symlink);
  }
}

const candidates = [...byDigest.values()].sort((a, b) =>
  a.name.localeCompare(b.name) || a.digest.localeCompare(b.digest));
process.stderr.write(`Auditing ${candidates.length} unique candidates from ${occurrenceCount} installed occurrences...\n`);

let completedAudits = 0;
const reports = await mapLimited(candidates, Number(process.env.SKILL_AUDIT_CONCURRENCY ?? 8), async (candidate) => {
  const cached = priorAudits.get(candidate.digest);
  const report = cached ?? await runAudit(candidate.auditPath);
  completedAudits += 1;
  if (completedAudits % 100 === 0 || completedAudits === candidates.length) {
    process.stderr.write(`Audited ${completedAudits}/${candidates.length}\n`);
  }
  if (cached) return cached;
  if (typeof report.error === 'string') {
    return {
      verdict: 'ERROR',
      critical: 0,
      high: 0,
      info: 0,
      filesScanned: 0,
      categories: [],
      error: report.error.slice(0, 500),
    };
  }
  return {
    verdict: report.verdict,
    critical: report.summary.critical,
    high: report.summary.high,
    info: report.summary.info,
    filesScanned: report.stats.files_scanned,
    categories: [...new Set((report.findings ?? []).map(({ category }) => category))].sort(),
  };
});

const nameCounts = new Map();
for (const candidate of candidates) {
  const baseId = slug(candidate.name);
  nameCounts.set(baseId, (nameCounts.get(baseId) ?? 0) + 1);
}
const skills = candidates.map((candidate, index) => {
  const report = reports[index];
  const baseId = slug(candidate.name);
  const id = nameCounts.get(baseId) === 1 ? baseId : `${baseId}-${candidate.digest.slice(7, 19)}`;
  const verdict = report.verdict;
  const blockers = [];
  if (verdict !== 'PASS') blockers.push(`static-audit-${verdict.toLowerCase()}`);
  if (!candidate.source) blockers.push('source-provenance-unavailable');
  if (candidate.unsafeSymlinks.size > 0) blockers.push('contains-symlinks');
  blockers.push('manual-review-required', 'signed-artifact-not-promoted');
  return {
    id,
    name: candidate.name,
    ...(candidate.description ? { description: candidate.description } : {}),
    kind: 'skill',
    state: 'candidate',
    intakeApproved: true,
    executionApproved: false,
    digest: candidate.digest,
    installations: candidate.installations.sort((a, b) =>
      a.platform.localeCompare(b.platform) || a.relativePath.localeCompare(b.relativePath)),
    ...(candidate.source ? { source: candidate.source } : {}),
    audit: {
      verdict,
      critical: report.critical,
      high: report.high,
      info: report.info,
      filesScanned: report.filesScanned,
      categories: report.categories,
      ...(report.error ? { error: report.error } : {}),
    },
    promotion: {
      manualReviewRequired: true,
      blockers: [...new Set(blockers)].sort(),
    },
  };
});

const counts = { PASS: 0, WARN: 0, FAIL: 0, ERROR: 0 };
for (const skill of skills) counts[skill.audit.verdict] += 1;
const document = {
  $schema: './skills.schema.json',
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  auditTool: {
    name: 'skill-security-auditor',
    digest: auditorDigest,
  },
  summary: {
    uniqueCandidates: skills.length,
    installedOccurrences: occurrenceCount,
    pass: counts.PASS,
    warn: counts.WARN,
    fail: counts.FAIL,
    error: counts.ERROR,
  },
  skills,
};

fs.writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
process.stderr.write(`Wrote ${output}: ${JSON.stringify(document.summary)}\n`);
