import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

function requireThat(ok,message) { if(!ok) throw Error(message); }
const safePackage=/^[A-Za-z][\w]*(?:\.[A-Za-z][\w]*)+$/;
const safeClass=/^\.?[A-Za-z][\w]*(?:\.[A-Za-z][\w]*)*$/;
const pause=ms=>new Promise(done=>setTimeout(done,ms));
function validateStep(step) {
  requireThat(step && typeof step==='object','Invalid Android step');
  switch(step.action) {
    case 'launch': requireThat(safeClass.test(step.activity??''),'Invalid activity'); break;
    case 'stop': break;
    case 'input': requireThat(typeof step.value==='string' && /^[A-Za-z0-9 _.-]{1,180}$/.test(step.value),'Use non-sensitive ASCII fixture input'); break;
    case 'tap': case 'expect':
      requireThat(['id','description','text'].some(k=>typeof step[k]==='string'&&step[k].length>0),'Specify a semantic selector');
      break;
    default: throw Error('Unsupported Android action: '+step.action);
  }
}
export function validateRoute(route) {
  requireThat(route && typeof route.package==='string' && safePackage.test(route.package),'Invalid app package');
  requireThat(typeof route.id==='string' && /^[\w-]+$/.test(route.id) && route.id.length<80,'Invalid scenario ID');
  requireThat(Array.isArray(route.steps) && route.steps.length>1 && route.steps.length<=100,'Expected 2–100 steps');
  route.steps.forEach(validateStep);
  requireThat(route.steps[0].action==='launch' && route.steps.at(-1).action==='expect','Start with launch and finish with a product assertion');
}
function decode(s) {return s.replace(/&(amp|lt|gt|quot|apos);/g,(_,k)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[k]));}
export function match(xml,pkg,step) {
  const matches=[];
  for(const tag of xml.matchAll(/<node\b[^>]*>/g)) {
    const a=Object.fromEntries([...tag[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(x=>[x[1],decode(x[2])]));
    if(a.package!==pkg||a.enabled==='false') continue;
    if(step.id && a['resource-id']!==step.id) continue;
    if(step.text && a.text!==step.text) continue;
    if(step.description && a['content-desc']!==step.description) continue;
    const b=/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(a.bounds??'');
    if(b && +b[3]>+b[1] && +b[4]>+b[2]) matches.push([Math.floor((+b[1]+ +b[3])/2),Math.floor((+b[2]+ +b[4])/2)]);
  }
  requireThat(matches.length<=1,'Ambiguous selector');
  return matches[0];
}
export function adbDriver(serial) {
  requireThat(typeof serial==='string' && /^[\w.:-]+$/.test(serial),'An explicit adb serial is required');
  const run=(...args)=>execFileSync('adb',['-s',serial,...args],{windowsHide:true,timeout:20000,maxBuffer:12*1024*1024,stdio:['ignore','pipe','pipe']});
  return {
    start:(pkg,activity)=>{const result=run('shell','am','start','-W','-n',pkg+'/'+activity).toString();requireThat(!/(?:Error|Exception):|Status: (?!ok)/i.test(result),result);},
    stop:pkg=>run('shell','am','force-stop',pkg),
    dump:()=>run('exec-out','uiautomator','dump','/dev/tty').toString(),
    tap:point=>run('shell','input','tap',...point.map(String)),
    input:value=>run('shell','input','text',value.replaceAll(' ','%s')),
    capture:()=>run('exec-out','screencap','-p')
  };
}
export async function execute(route,driver,out,mode='replay',timeout=8000) {
  validateRoute(route);
  fs.mkdirSync(out,{recursive:true});
  const dir=fs.mkdtempSync(join(out,route.id+'-'));
  const result={id:route.id,mode,status:'unverified',steps:[],started:new Date().toISOString()};
  try {
    for(const [i,step] of route.steps.entries()) {
      result.step=i+1;
      if(step.action==='launch') await driver.start(route.package,step.activity);
      else if(step.action==='stop') await driver.stop(route.package);
      else if(step.action==='input') {
        const xml=await driver.dump();
        const focused=[...xml.matchAll(/<node\b[^>]*>/g)].some(m=>m[0].includes('package="'+route.package+'"') && m[0].includes('focused="true" editable="true"'));
        const field=[...xml.matchAll(/<node\b[^>]*>/g)].some(m=>m[0].includes('package="'+route.package+'"') && m[0].includes('focused="true"') && m[0].includes('EditText'));
        requireThat(focused || field,'Expected an active input in the target app');
        await driver.input(step.value);
      } else {
        const deadline=Date.now()+timeout;
        let point;
        do {
          point=match(await driver.dump(),route.package,step);
          if(point || Date.now()>=deadline) break;
          await pause(250);
        } while(true);
        requireThat(point,'Expected element missing at step '+(i+1));
        if(step.action==='tap') await driver.tap(point);
      }
      result.steps.push({step:i+1,action:step.action});
    }
    result.status='pass';
  } catch(e) {result.status='blocked-or-failed';result.reason=e.message;}
  try {fs.writeFileSync(join(dir,'screen.png'),await driver.capture());result.capture='screen.png';}
  catch(e) {result.captureError=e.message;}
  result.ended=new Date().toISOString();
  fs.writeFileSync(join(dir,'result.json'),JSON.stringify(result,null,2));
  return {dir,...result};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const [mode,serial,source,evidence,target]=process.argv.slice(2);
    requireThat(['record','replay'].includes(mode) && source && evidence && (mode==='record'?Boolean(target):!target),'android.mjs record SERIAL DRAFT.json EVIDENCE_DIR NEW_ROUTE.json | replay SERIAL ROUTE.json EVIDENCE_DIR');
    const route=JSON.parse(fs.readFileSync(source,'utf8').replace(/^\uFEFF/,''));
    if(mode==='record') {
      const local = relative(resolve('docs','flows'),resolve(target)).replaceAll('\\','/');
      requireThat(!/^(?!\.\.?\/)[^/]+\/[^/]+\.android\.json$/i.test(local),'Use routes.mjs learn and confirm for the project route library');
      requireThat(!fs.existsSync(target),'Choose a new route path');
    }
    const result=await execute(route,adbDriver(serial),resolve(evidence),mode);
    if(mode==='record' && result.status==='pass') {
      const dir=dirname(resolve(target));fs.mkdirSync(dir,{recursive:true});
      const tmp=join(dir,'.'+basename(target)+randomUUID()+'.tmp');
      fs.writeFileSync(tmp,JSON.stringify(route,null,2),{flag:'wx'});
      try {fs.linkSync(tmp,target);} finally {fs.unlinkSync(tmp);}
    }
    console.log(JSON.stringify(result,null,2));
    if(result.status!=='pass') process.exitCode=1;
  } catch(e) {console.error(e.message);process.exitCode=1;}
}
