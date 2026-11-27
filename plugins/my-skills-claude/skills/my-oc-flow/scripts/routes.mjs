import * as fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adbDriver, execute, validateRoute } from './android.mjs';
import { snapshot } from './flow.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = path => JSON.parse(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));

function routePath(root, screen, id) {
  for (const key of [screen, id]) {
    if (typeof key !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,78}$/.test(key)) {
      throw Error('Use a lowercase screen key and action ID (letters, digits, hyphens or underscores).');
    }
  }
  let dir = root;
  for (const part of ['docs', 'flows', screen]) {
    dir = join(dir, part);
    if (fs.lstatSync(dir, {throwIfNoEntry: false})?.isSymbolicLink()) {
      throw Error('Expected a project-local route directory: ' + dir);
    }
  }
  return join(dir, id + '.android.json');
}

function previousDigest(target) {
  const entry = fs.lstatSync(target, {throwIfNoEntry: false});
  if (!entry) return null;
  if (!entry.isFile()) throw Error('Expected a regular route file: ' + target);
  return digest(fs.readFileSync(target));
}

function checkRevision(root, expected) {
  if (snapshot(root) !== expected) throw Error('Source revision changed. Learn again on the current build.');
}

export async function learn(root, screen, route, evidence, serial, driver) {
  validateRoute(route);
  const target = routePath(root, screen, route.id);
  const previous = previousDigest(target);
  const revision = snapshot(root);
  const bytes = JSON.stringify(route, null, 2) + '\n';
  const result = await execute(route, driver, evidence, 'learn');
  if (result.status === 'pass') {
    checkRevision(root, revision);
    fs.writeFileSync(join(result.dir, 'candidate.json'), bytes, {flag: 'wx'});
    const receipt = {screen, serial, revision, previous, digest: digest(bytes)};
    fs.writeFileSync(join(result.dir, 'learn.json'), JSON.stringify(receipt), {flag: 'wx'});
  }
  return result;
}

function publish(root, target, bytes, previous) {
  // Serialize confirmations for this target; keep scratch files out of the verified tree.
  const locks = join(root, '.flow', '.route-locks');
  fs.mkdirSync(locks, {recursive: true});
  const lock = join(locks, digest(target.toLowerCase()) + '.lock');
  const tmp = join(locks, randomUUID() + '.tmp');
  const handle = fs.openSync(lock, 'wx');
  try {
    const current = previousDigest(target);
    if (current === digest(bytes)) return;
    if (current !== previous) throw Error('The saved route changed. Check the current route and learn again.');
    fs.mkdirSync(dirname(target), {recursive: true});
    fs.writeFileSync(tmp, bytes, {flag: 'wx'});
    if (current === null) fs.linkSync(tmp, target);
    else fs.renameSync(tmp, target);
  } finally {
    try { fs.rmSync(tmp, {force: true}); }
    finally { fs.closeSync(handle); fs.unlinkSync(lock); }
  }
}

export async function confirm(root, firstRun, evidence, serial, driver) {
  const first = readJson(join(firstRun, 'result.json'));
  const receipt = readJson(join(firstRun, 'learn.json'));
  const bytes = fs.readFileSync(join(firstRun, 'candidate.json'));
  if (first.mode !== 'learn' || first.status !== 'pass' || receipt.serial !== serial || receipt.digest !== digest(bytes)) {
    throw Error('Confirm the unchanged candidate from a successful learn on the same device.');
  }
  const route = JSON.parse(bytes);
  const target = routePath(root, receipt.screen, route.id);
  checkRevision(root, receipt.revision);
  const result = await execute(route, driver, evidence, 'confirm');
  if (result.status === 'pass') {
    checkRevision(root, receipt.revision);
    publish(root, target, bytes, receipt.previous);
    result.saved = target;
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [mode, serial, ...args] = process.argv.slice(2);
    const root = process.cwd();
    let result;
    if (mode === 'learn' && args.length === 3) {
      const [screen, draft, evidence] = args;
      result = await learn(root, screen, readJson(draft), resolve(evidence), serial, adbDriver(serial));
    } else if (mode === 'confirm' && args.length === 2) {
      const [firstRun, evidence] = args;
      result = await confirm(root, firstRun, resolve(evidence), serial, adbDriver(serial));
    } else {
      throw Error('routes.mjs learn SERIAL SCREEN DRAFT.json EVIDENCE_DIR | confirm SERIAL FIRST_RUN_DIR EVIDENCE_DIR');
    }
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== 'pass') process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
