import { execFileSync } from 'node:child_process';
import { lstatSync, writeFileSync } from 'node:fs';
import { relative, resolve, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { read } from './flow.mjs';

// Only explicitly selected files enter the report. The diff is relative to HEAD.
export function saveDiff(root,id,files) {
  const {dir}=read(root,id);
  if(!files.length) throw Error('Specify the files changed for this task');
  const git=(args,allowed=[])=>{
    try{return execFileSync('git',['--no-pager','--literal-pathspecs','-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:32*1024*1024});}
    catch(e){if(allowed.includes(e.status))return e.stdout;throw e;}
  };
  const base=git(['rev-parse','--verify','--quiet','HEAD'],[1]).trim();
  const chunks=[];
  for(const name of new Set(files)) {
    const p=relative(root,resolve(root,name)).replaceAll('\\','/');
    if(!p || p==='..' || p.startsWith('../') || isAbsolute(p) || p.split('/').some(x=>['.git','.flow'].includes(x))) throw Error('Invalid source path');
    const st=lstatSync(join(root,p),{throwIfNoEntry:false});
    if(st?.isDirectory()) throw Error('Specify individual files: '+p);
    const existsInBase=base && git(['ls-tree','-z',base,'--',p]).length;
    if(existsInBase) chunks.push(git(['diff','--no-ext-diff','--no-textconv',base,'--',p]));
    else if(st) chunks.push(git(['diff','--no-ext-diff','--no-textconv','--no-index','--','/dev/null',p],[1]));
    else throw Error('No source or baseline for '+p);
  }
  const artifact='evidence/changes-'+randomUUID()+'.txt';
  writeFileSync(join(dir,artifact),chunks.join('\n')||'(no difference from HEAD)',{flag:'wx'});
  return artifact;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(saveDiff(process.cwd(),process.argv[2],process.argv.slice(3)));}
  catch(e){console.error(e.message);process.exitCode=1;}
}
