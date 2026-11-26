import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { example } from '../examples/demo.mjs';
import { saveDiff } from '../plugins/my-skills/skills/my-oc-flow/scripts/changes.mjs';

test('report diff includes the new file on an unborn branch',()=>{
  const root=mkdtempSync(join(tmpdir(),'my-skills-patch-'));
  example(root,'verify');
  const result=saveDiff(root,'greeting',['greet.mjs']);
  assert.match(readFileSync(join(root,'.flow','greeting',result),'utf8'),/new file mode/);
  assert.throws(()=>saveDiff(root,'greeting',['../outside']),/Invalid/);
});
test('marketplace resolves both manifests and the skill entry point',()=>{
  const base=new URL('../',import.meta.url);
  const json=name=>JSON.parse(readFileSync(new URL(name,base),'utf8'));
  const [plugin]=json('.agents/plugins/marketplace.json').plugins;
  const dir=plugin.source.path+'/';
  assert.equal(plugin.name,'my-skills');
  const portable=json(dir+'plugin.json'),codex=json(dir+'.codex-plugin/plugin.json');
  assert.equal(portable.version,codex.version);assert.equal(portable.name,codex.name);
  assert.match(readFileSync(new URL(dir+'skills/my-oc-flow/SKILL.md',base),'utf8'),/^name: my-oc-flow$/m);
});
