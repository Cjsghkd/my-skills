import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { init, status as codexStatus } from '../plugins/my-skills/skills/my-oc-flow/scripts/flow.mjs';
import { status as claudeStatus } from '../plugins/my-skills-claude/skills/my-oc-flow/scripts/flow.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const json = file => JSON.parse(readFileSync(file, 'utf8'));

test('both marketplace entries resolve self-contained packages at the release version', () => {
  const version = json(join(root, 'package.json')).version;
  const [codex] = json(join(root, '.agents/plugins/marketplace.json')).plugins;
  const [claude] = json(join(root, '.claude-plugin/marketplace.json')).plugins;
  const codexDir = resolve(root, codex.source.path);
  const claudeDir = resolve(root, claude.source);
  assert.notEqual(codexDir, claudeDir);
  for (const [entry, dir, manifest] of [
    [codex, codexDir, 'plugin.json'],
    [codex, codexDir, '.codex-plugin/plugin.json'],
    [claude, claudeDir, '.claude-plugin/plugin.json']
  ]) {
    const plugin = json(join(dir, manifest));
    assert.equal(plugin.name, entry.name);
    assert.equal(plugin.version, version);
    assert.deepEqual(readdirSync(join(dir, 'skills')), ['my-oc-flow']);
  }
  const roles = Object.keys(json(join(codexDir, 'skills/my-oc-flow/roles.json')));
  const names = roles.map(role => role.replaceAll('_', '-') + '.md').sort();
  assert.deepEqual(readdirSync(join(claudeDir, 'agents')).sort(), names);
  execFileSync(process.execPath, [join(root, 'scripts/sync-claude.mjs'), '--check']);
});

test('run origin is visible to both hosts and pre-0.3 runs still open', t => {
  const dir = mkdtempSync(join(tmpdir(), 'my-oc-flow-origin-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', dir]);
  for (const host of ['codex', 'claude', undefined]) {
    const id = host ?? 'legacy';
    init(dir, id, 'readable feature memo', host);
    assert.equal(claudeStatus(dir, id).host, host);
    assert.deepEqual(claudeStatus(dir, id), codexStatus(dir, id));
  }
  assert.throws(() => init(dir, 'bad', 'memo', 'typo'), /Unknown workflow host/);
});
