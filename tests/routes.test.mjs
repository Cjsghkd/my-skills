import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { confirm, learn } from '../plugins/my-skills/skills/my-oc-flow/scripts/routes.mjs';
import { execute } from '../plugins/my-skills/skills/my-oc-flow/scripts/android.mjs';
import { snapshot } from '../plugins/my-skills/skills/my-oc-flow/scripts/flow.mjs';

const route = {id: 'open-drafts', package: 'demo.test', steps: [
  {action: 'launch', activity: '.Main'}, {action: 'expect', text: 'Open'},
  {action: 'tap', text: 'Open'}, {action: 'expect', text: 'Drafts'}
]};

function fixture(t) {
  const root = fs.mkdtempSync(join(tmpdir(), 'my-skills-routes-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  execFileSync('git', ['init', '-q', root]);
  const evidence = join(root, '.flow', 'demo', 'evidence');
  const target = join(root, 'docs', 'flows', 'home', 'open-drafts.android.json');
  let screen;
  const driver = {
    start() { screen = 'Open'; },
    dump() { return '<node package="demo.test" bounds="[0,0][10,10]" text="' + screen + '"/>'; },
    tap() { screen = 'Drafts'; },
    capture() { return Buffer.alloc(0); }
  };
  return {root, target, driver, evidence,
    learn: (candidate = route) => learn(root, 'home', candidate, evidence, 'device-1', driver),
    confirm: (first, serial = 'device-1') => confirm(root, first.dir, evidence, serial, driver)};
}

test('a new action needs two successful runs, persists locally and can replay independently', async t => {
  const f = fixture(t);
  const before = snapshot(f.root);
  const first = await f.learn();
  assert.equal(first.status, 'pass');
  assert.ok(!fs.existsSync(join(f.root, 'docs')));
  const originalDump = f.driver.dump;
  f.driver.dump = () => { throw Error('device disconnected'); };
  assert.equal((await f.confirm(first)).status, 'blocked-or-failed');
  assert.ok(!fs.existsSync(join(f.root, 'docs')));
  f.driver.dump = originalDump;
  const second = await f.confirm(first);
  assert.equal(second.saved, f.target);
  assert.notEqual(second.dir, first.dir);
  const saved = JSON.parse(fs.readFileSync(f.target, 'utf8'));
  assert.deepEqual(saved, route);
  assert.equal(snapshot(f.root), before);
  assert.equal((await execute(saved, f.driver, f.evidence)).status, 'pass');
  fs.writeFileSync(join(f.root, 'docs', 'flows', 'home', 'product.md'), 'edited');
  assert.notEqual(snapshot(f.root), before);
});

test('changed candidate, device or source cannot promote a first pass', async t => {
  const f = fixture(t);
  const first = await f.learn();
  await assert.rejects(f.confirm(first, 'device-2'), /same device/);
  fs.writeFileSync(join(f.root, 'app.txt'), 'new build');
  await assert.rejects(f.confirm(first), /revision changed/);
  fs.appendFileSync(join(first.dir, 'candidate.json'), ' ');
  await assert.rejects(f.confirm(first), /unchanged candidate/);
  await assert.rejects(f.learn({...route, id: '../invalid'}));
  assert.ok(!fs.existsSync(f.target));
});

test('failed learning and stale confirmations preserve an already verified action', async t => {
  const f = fixture(t);
  const first = await f.learn();
  await f.confirm(first);
  const original = fs.readFileSync(f.target, 'utf8');
  const tap = f.driver.tap;
  f.driver.tap = () => { throw Error('no longer available'); };
  const failed = await f.learn();
  assert.equal(failed.status, 'blocked-or-failed');
  assert.ok(!fs.existsSync(join(failed.dir, 'learn.json')));
  assert.equal(fs.readFileSync(f.target, 'utf8'), original);
  f.driver.tap = tap;
  const pending = await f.learn({...route, startState: 'old fixture'});
  const corrected = await f.learn({...route, startState: 'current fixture'});
  await f.confirm(corrected);
  await assert.rejects(f.confirm(pending), /saved route changed/);
  assert.equal(JSON.parse(fs.readFileSync(f.target, 'utf8')).startState, 'current fixture');
});

test('a source change during the first device run cannot produce a confirmation receipt', async t => {
  const f = fixture(t);
  const capture = f.driver.capture;
  f.driver.capture = () => {
    fs.writeFileSync(join(f.root, 'app.txt'), 'changed while learning');
    return capture();
  };
  await assert.rejects(f.learn(), /revision changed/);
  const [attempt] = fs.readdirSync(f.evidence);
  assert.ok(fs.existsSync(join(f.evidence, attempt, 'result.json')));
  assert.ok(!fs.existsSync(join(f.evidence, attempt, 'learn.json')));
  assert.ok(!fs.existsSync(f.target));
});
