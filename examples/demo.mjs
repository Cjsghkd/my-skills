import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {init,record,status,snapshot,read} from '../plugins/my-skills/skills/my-oc-flow/scripts/flow.mjs';

// Synthetic role records exercise the workflow; the fixture's product check runs with real Node.
export function example(root=mkdtempSync(join(tmpdir(),'my-skills-demo-')),stopAt='finish') {
  execFileSync('git',['init','-q',root]);
  init(root,'greeting','예제 · 이름을 입력하면 인사말을 출력한다. 역할 결과는 합성 데이터입니다.');
  const add=(stage,summary,extra={})=>record(root,'greeting',stage,{summary,planKey:read(root,'greeting').state.plan?.planKey,...extra});
  add('survey','빈 예제 CLI 프로젝트');
  add('criteria','이름과 정확한 인사말',{items:[{id:'C1',expect:'Mina를 입력하면 Hello, Mina! 출력'}]});
  add('design-a','입력 인자를 그대로 표시',{session:'fixture-design-a'});
  add('design-b','CLI 진입점의 stdout 확인',{session:'fixture-design-b'});
  add('plan','CLI의 이름 입력과 출력을 확인',{ui:[]});
  add('plan-a','계획 검사',{session:'fixture-plan-a',votes:[]});
  add('plan-b','검증 계획 검사',{session:'fixture-plan-b',votes:[]});
  writeFileSync(join(root,'greet.mjs'),"console.log('Hello, '+process.argv[2]+'!');\n");
  add('implementation','greet.mjs를 추가',{session:'fixture-implement'});
  const basedOn=snapshot(root);
  const output=execFileSync(process.execPath,[join(root,'greet.mjs'),'Mina'],{encoding:'utf8'}).trim();
  add('verify','node greet.mjs Mina',{basedOn,buildPassed:true,checks:[{id:'C1',result:output==='Hello, Mina!'?'pass':'fail',evidence:output}]});
  if(stopAt!=='verify'){
    add('code-a','예제 지적 없음',{basedOn,session:'fixture-code-a',votes:[]});
    add('code-b','예제 지적 없음',{basedOn,session:'fixture-code-b',votes:[]});
    add('finish','예제 완료',{basedOn});
  }
  return status(root,'greeting');
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log(example().report);
