import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const roles = JSON.parse(readFileSync(new URL('../roles.json', import.meta.url), 'utf8'));
export function setup(root, install = false) {
  const dir = join(resolve(root), '.codex', 'agents');
  const records = Object.entries(roles).map(([role, spec]) => {
    const name = 'my_oc_' + role;
    const path = join(dir, name + '.toml');
    const contents = [
      'name = ' + JSON.stringify(name),
      'description = ' + JSON.stringify('my-oc-flow: ' + role),
      'model = ' + JSON.stringify(spec.model),
      'model_reasoning_effort = ' + JSON.stringify(spec.effort),
      'developer_instructions = ' + JSON.stringify(spec.instruction),
      ''
    ].join('\n');
    const status = existsSync(path) ? (readFileSync(path, 'utf8') === contents ? 'ready' : 'conflict') : 'missing';
    return { role, path, contents, status };
  });
  if (install && records.some(r => r.status === 'conflict')) throw Error('Conflicting my_oc_* agent files. Inspect the setup status first.');
  if (install) {
    mkdirSync(dir, { recursive: true });
    for (const r of records.filter(r => r.status === 'missing')) {
      writeFileSync(r.path, r.contents, { flag: 'wx' });
      r.status = 'installed';
    }
  }
  return records.map(({ role, path, status }) => ({ role, path, status }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [root, action] = process.argv.slice(2);
  if (!root || (action && action !== '--install')) throw Error('node setup.mjs PROJECT [--install]');
  console.log(JSON.stringify(setup(root, action === '--install'), null, 2));
}
