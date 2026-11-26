import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execute,match,validateRoute} from '../plugins/my-skills/skills/my-oc-flow/scripts/android.mjs';
const pkg='demo.test', node=t=>'<node package="demo.test" text="'+t+'" bounds="[0,0][40,24]"/>';
const route={id:'drafts',package:pkg,steps:[{action:'launch',activity:'.Main'},{action:'tap',text:'Open'},{action:'expect',text:'Drafts'}]};
test('current selector and product outcome must both match',async()=>{
  let opened=false;
  const driver={start(){},dump(){return node(opened?'Drafts':'Open')},tap(){opened=true},capture(){return Buffer.alloc(0)}};
  const dir=mkdtempSync(join(tmpdir(),'device-fixture-'));
  const ok=await execute(route,driver,dir,'replay',0);assert.equal(ok.status,'pass');assert.ok(existsSync(join(ok.dir,'result.json')));
  driver.tap=()=>{};opened=false;
  const bad=await execute(route,driver,dir,'replay',0);assert.equal(bad.status,'blocked-or-failed');assert.equal(bad.step,3);
});
test('ambiguous and foreign selectors are never tapped',()=>{
  assert.throws(()=>match(node('Open')+node('Open'),pkg,{text:'Open'}),/Ambiguous/);
  assert.equal(match(node('Open'),'foreign.app',{text:'Open'}),undefined);
  assert.throws(()=>validateRoute({...route,steps:route.steps.slice(0,2)}),/assertion/);
});
