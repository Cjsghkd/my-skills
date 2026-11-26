import * as fs from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { render } from './report.mjs';

export const stages = ['survey','criteria','design-a','design-b','plan','plan-a','plan-b','plan-judge','implementation','verify','code-a','code-b','code-judge','device','finish'];
const safeId = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const need = (ok, msg) => { if (!ok) throw Error(msg); };
const string = x => typeof x === 'string' && x.trim().length > 0;
const rows = (xs, validate) => Array.isArray(xs) && xs.every(validate);
const unique = xs => new Set(xs).size === xs.length;

export function snapshot(root) {
  const git = (...args) => execFileSync('git', ['-C',root,...args], {maxBuffer:128*1024*1024, stdio:['ignore','pipe','pipe']});
  need(!git('rev-parse','--show-prefix').toString().trim(), 'Run from the target Git root.');
  const parts = ['--','.',':(exclude).flow',':(exclude).flow/**'];
  // HEAD covers clean tracked files. Read bytes only for changed or untracked paths.
  const hash = createHash('sha256');
  try { hash.update(git('rev-parse','--verify','--quiet','HEAD^{tree}')); }
  catch (error) { if(error.status!==1) throw error; hash.update('unborn'); }
  const entries = git('--no-optional-locks','status','--porcelain=v1','-z','--no-renames','--untracked-files=all','--ignore-submodules=none',...parts).toString().split('\0').filter(Boolean);
  const buffer=Buffer.allocUnsafe(64*1024);
  for (const entry of entries.sort()) {
    const p=entry.slice(3), full=join(root,p);
    const st=fs.lstatSync(full,{throwIfNoEntry:false});
    hash.update(entry+'\0');
    if (!st) hash.update('deleted');
    else if (st.isSymbolicLink()) hash.update('link:'+fs.readlinkSync(full));
    else if (st.isFile()) {
      const file=fs.openSync(full,'r'), contents=createHash('sha256');
      try { let n; while((n=fs.readSync(file,buffer))>0) contents.update(buffer.subarray(0,n)); }
      finally { fs.closeSync(file); }
      hash.update(String(st.mode & 0o111)).update(contents.digest());
    }
    else if (st.isDirectory()) {
      hash.update(execFileSync('git',['-C',full,'rev-parse','HEAD']));
      need(!execFileSync('git',['-C',full,'status','--porcelain']).length, 'Commit or isolate dirty submodule '+p+' before validation.');
    }
    hash.update('\0');
  }
  return hash.digest('hex');
}
export function directory(root,id) {
  need(safeId.test(id) && typeof id === 'string','Invalid run ID');
  return join(root,'.flow',id);
}
export function init(root,id,memo) {
  need(string(memo),'Empty memo');
  const before = snapshot(root);
  const dir = directory(root,id);
  fs.mkdirSync(join(root,'.flow'),{recursive:true});
  const ignore = join(root,'.flow','.gitignore');
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore,'*\n',{flag:'wx'});
  fs.mkdirSync(dir); // Refuse to replace an existing run.
  for (const name of ['events','inputs','evidence']) fs.mkdirSync(join(dir,name));
  fs.writeFileSync(join(dir,'memo.json'),JSON.stringify({id,memo,started:new Date().toISOString(),before},null,2),{flag:'wx'});
  return dir;
}
export function review(state,group) {
  const a=state[group+'-a']?.votes, b=state[group+'-b']?.votes;
  if (!a || !b) return {ready:false, issues:[], pending:['second independent review']};
  const ids = [...new Set([...a,...b].map(v=>v.id))].sort();
  const issues = ids.map(id=>{
    const left=a.find(v=>v.id===id),right=b.find(v=>v.id===id);
    let verdict='peer-check';
    if(left && right) {
      verdict=left.vote===right.vote ? left.vote : [left.vote,right.vote].includes('unknown') ? 'unknown' : 'split';
      if(verdict==='split') verdict=state[group+'-judge']?.decisions.find(v=>v.id===id)?.vote ?? 'split';
    }
    return {id,verdict,left,right};
  });
  return {ready:issues.every(i=>i.verdict==='reject'),issues,pending:issues.filter(i=>i.verdict!=='reject').map(i=>i.id+': '+i.verdict)};
}
function fold(events) {
  const state={};
  for (const e of events) {
    if (['criteria','plan','implementation','verify'].includes(e.stage) || (e.stage.startsWith('plan-') && e.stage!=='plan-judge')) {
      let start=stages.indexOf(e.stage)+1;
      if(e.stage==='plan-a'||e.stage==='plan-b') start=stages.indexOf('plan-judge');
      for(const k of stages.slice(start)) delete state[k];
    }
    if(e.stage==='code-a'||e.stage==='code-b') {delete state['code-judge'];delete state.finish;}
    if(e.stage==='device'||e.stage==='code-judge') delete state.finish;
    state[e.stage]=e.data;
  }
  return state;
}
export function read(root,id) {
  const dir=directory(root,id);
  const meta=JSON.parse(fs.readFileSync(join(dir,'memo.json'),'utf8'));
  const files=fs.readdirSync(join(dir,'events')).filter(x=>/^\d{6}\.json$/.test(x)).sort();
  const events=files.map(x=>JSON.parse(fs.readFileSync(join(dir,'events',x),'utf8')));
  return {dir,meta,events,state:fold(events)};
}
function validChecks(cs,ids,pendingUI=[]) {
  return rows(cs,c=>c && ids.includes(c.id) && (['pass','fail','unverified'].includes(c.result) || (c.result==='device-pending' && pendingUI.includes(c.id))) && string(c.evidence)) && unique(cs.map(c=>c.id));
}
function eligible(state) {
  const {verify,device,criteria,plan}=state;
  if(!verify?.buildPassed || !review(state,'code').ready) return false;
  const all=[...verify.checks.filter(c=>c.result!=='device-pending'),...(device?.checks??[])];
  return criteria.items.every(c=>all.some(x=>x.id===c.id && x.result==='pass')) &&
    all.every(x=>x.result==='pass') &&
    plan.ui.every(id=>device?.checks.some(x=>x.id===id && x.result==='pass'));
}
function validate(run,stage,d,revision) {
  const t=run.state;
  need(stages.includes(stage) && d && string(d.summary),'Unknown stage or empty summary');
  const has=(...keys)=>need(keys.every(k=>t[k]),'Requires '+keys.join(', '));
  const ids=t.criteria?.items.map(c=>c.id)??[];
  if (stages.indexOf(stage)>stages.indexOf('plan')) need(t.plan && d.planKey===t.plan.planKey,'Plan revision changed; obtain fresh results for status.planKey.');
  if(['verify','code-a','code-b','code-judge','device','finish'].includes(stage)) need(d.basedOn===revision,'The inspected source revision differs. Run status and recheck changed inputs.');
  if(stage==='survey') need(!t.criteria,'Survey is frozen after criteria; put new facts in a revised plan or criteria.');
  const session=()=>need(string(d.session),'Provide the actual originating session identifier');
  if (d.usage) need(['input','cached','output'].every(k=>d.usage[k]===undefined || (Number.isSafeInteger(d.usage[k])&&d.usage[k]>=0)), 'Invalid token counts');
  if(stage==='criteria') {
    has('survey'); need(rows(d.items,c=>c && typeof c.id==='string' && safeId.test(c.id) && string(c.expect)) && d.items.length && unique(d.items.map(c=>c.id)),'Provide unique acceptance criteria');
  }
  if(stage.startsWith('design-')) {has('criteria');session();need(!t.plan,'Design pair is frozen; record updated criteria to reopen design');}
  if(stage==='plan') {has('design-a','design-b');need(rows(d.ui,id=>ids.includes(id)) && unique(d.ui),'List UI criterion IDs');}
  const pair=/^(plan|code)-(a|b)$/.exec(stage);
  if(pair) {
    session();has(pair[1]==='plan'?'plan':'verify');
    need(rows(d.votes,v=>v && typeof v.id==='string' && safeId.test(v.id) && ['accept','reject','unknown'].includes(v.vote) && string(v.evidence)) && unique(d.votes.map(v=>v.id)),'Provide issue votes and evidence');
    if(t[stage]) need(t[stage].votes.every(v=>d.votes.some(n=>n.id===v.id)), 'Keep existing issue IDs during peer follow-up');
  }
  if(stage.endsWith('-judge')) {
    session();const group=stage.split('-')[0];
    const clean={...t};delete clean[stage];
    const split=review(clean,group).issues.filter(v=>v.verdict==='split').map(v=>v.id);
    need(split.length && rows(d.decisions,v=>v && split.includes(v.id) && ['accept','reject','unknown'].includes(v.vote) && string(v.evidence)) && unique(d.decisions.map(v=>v.id)) && d.decisions.length===split.length,'Decide only explicit disagreements and cite evidence');
  }
  if(stage==='implementation') {
    has('plan-a','plan-b');need(review(t,'plan').ready,'Resolve plan review first');session();
    if (d.diff !== undefined) need(typeof d.diff==='string' && /^evidence\/[\w./-]+$/.test(d.diff) && !d.diff.split('/').includes('..'),'Invalid local diff path');
  }
  if(stage==='verify') {
    has('implementation');need(t.implementation.revision===revision,'Source changed; record the implementation/fix first');
    need(typeof d.buildPassed==='boolean' && validChecks(d.checks,ids,t.plan.ui) && ids.every(id=>t.plan.ui.includes(id) || d.checks.some(c=>c.id===id)),'Provide build and all non-UI check results');
  }
  if(['code-a','code-b','code-judge','device','finish'].includes(stage)) {
    has('verify');need(t.verify.buildPassed && !t.verify.checks.some(x=>x.result==='fail') && t.verify.revision===revision,'Verify a successful build and checks for this revision first');
  }
  if(stage==='device') {
    need(t.plan.ui.length && validChecks(d.checks,t.plan.ui) && t.plan.ui.every(id=>d.checks.some(c=>c.id===id)),'Account for each planned UI check, including unavailable devices');
  }
  if(stage==='finish') need(eligible(t),'Open issues, failed or unverified criteria remain. Deliver the incomplete report or recheck.');
  if(d.session && (pair || stage.startsWith('design-') || stage.endsWith('-judge') || stage==='implementation')) {
    const previous=run.events.filter(e=>e.data.session===d.session);
    need(previous.every(e=>e.stage===stage) && !(stage==='implementation' && previous.length),'Use an independent session for each role and a fresh one for each fix');
    if(t[stage] && pair) need(t[stage].session===d.session, 'Use the same reviewer for a peer follow-up');
  }
}
export function record(root,id,stage,data) {
  const run=read(root,id);
  const revision=snapshot(root);
  validate(run,stage,data,revision);
  const event={stage,at:new Date().toISOString(),data:{...data,revision,...(stage==='plan'?{planKey:randomUUID()}:{})}};
  const base=join(run.dir,'events');
  const tmp=join(base,randomUUID()+'.tmp');
  fs.writeFileSync(tmp,JSON.stringify(event,null,2),{flag:'wx'});
  try {fs.linkSync(tmp,join(base,String(run.events.length+1).padStart(6,'0')+'.json'));} finally {fs.unlinkSync(tmp);}
  const next=read(root,id);
  render(next,revision);
  return stage;
}
export function status(root,id) {
  const run=read(root,id),rev=snapshot(root);
  const current=run.state.verify?.revision===rev;
  render(run,rev);
  return {id,planKey:run.state.plan?.planKey,done:Boolean(run.state.finish && current),revision:rev,verifiedRevision:run.state.verify?.revision,
    stages:Object.keys(run.state),planReview:review(run.state,'plan'),codeReview:review(run.state,'code'),
    criteria:run.state.criteria?.items,ui:run.state.plan?.ui,report:join(run.dir,'report','index.html')};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const [cmd,id,arg,file]=process.argv.slice(2),root=process.cwd();
    let result;
    if(cmd==='init') result=init(root,id,fs.readFileSync(arg,'utf8').replace(/^\uFEFF/,''));
    else if(cmd==='record') result=record(root,id,arg,JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')));
    else if(cmd==='status'||cmd==='report') result=status(root,id);
    else throw Error('flow.mjs init ID MEMO_FILE | record ID STAGE JSON_FILE | status ID | report ID');
    console.log(JSON.stringify(result,null,2));
  } catch(e) {console.error(e.message);process.exitCode=1;}
}
