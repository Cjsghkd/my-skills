import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'plugins/my-skills/skills/my-oc-flow');
const target = join(root, 'plugins/my-skills-claude');
const check = process.argv.includes('--check');
const sharedFiles = [
  'references/workflow.md', 'references/records.md', 'references/device.md', 'references/notion.md',
  'scripts/android.mjs', 'scripts/changes.mjs', 'scripts/flow.mjs', 'scripts/report.mjs', 'scripts/routes.mjs'
];

function publish(relative, content) {
  const dest = join(target, relative);
  if (existsSync(dest) && readFileSync(dest).equals(content)) return;
  if (check) throw Error('Run npm run sync:claude to refresh ' + relative);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, content);
}

for (const file of sharedFiles) {
  publish(join('skills/my-oc-flow', file), readFileSync(join(source, file)));
}

// Role instructions are shared. These are Claude Code's model aliases and effort defaults.
const profiles = {
  survey: ['sonnet', 'medium', 'Trace existing behavior and available checks for a feature memo.'],
  criteria: ['sonnet', 'medium', 'Resolve ambiguous acceptance criteria before design.'],
  design: ['sonnet', 'high', 'Design an implementation and falsifiable checks independently.'],
  plan_review: ['sonnet', 'medium', 'Review a proposed plan against the memo before implementation.'],
  implement: ['sonnet', 'medium', 'Apply the accepted plan or a reviewed fix to the project.'],
  verify: ['haiku', 'low', 'Run the build and criterion checks on the specified revision.'],
  code_review: ['sonnet', 'high', 'Review the actual diff and its callers independently.'],
  device: ['haiku', 'low', 'Replay or record the device check for an affected UI action.'],
  visual: ['sonnet', 'medium', 'Assess a specific visual criterion using captured evidence.'],
  arbiter: ['opus', 'high', 'Decide an explicit accept–reject split on a single finding.']
};
const roles = JSON.parse(readFileSync(join(source, 'roles.json'), 'utf8'));
for (const [key, { instruction }] of Object.entries(roles)) {
  const [model, effort, description] = profiles[key];
  const name = key.replaceAll('_', '-');
  const body = [
    '---', 'name: ' + name, 'description: ' + description,
    'model: ' + model, 'effort: ' + effort, '---', '', instruction, '',
    'Return your findings and evidence to the coordinating conversation. It writes the stage record.', ''
  ].join('\n');
  publish('agents/' + name + '.md', Buffer.from(body));
}
