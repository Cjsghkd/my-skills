import { mkdirSync, writeFileSync, renameSync, realpathSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { review } from './flow.mjs';

const escape = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label={pass:'통과',fail:'실패',unverified:'미확인',accept:'결함 채택',reject:'기각',unknown:'근거 부족',split:'반박 검증 대기','peer-check':'상대 검토 대기'};
function table(head,rows) {
  return '<div class="scroll"><table><thead><tr>'+head.map(h=>'<th>'+escape(h)+'</th>').join('')+'</tr></thead><tbody>'+
    rows.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
function attachment(base,path) {
  if(typeof path!=='string' || !path.startsWith('evidence/')) return '';
  try {
    const root=realpathSync(join(base,'evidence')),file=realpathSync(resolve(base,path));
    if(!file.startsWith(root+sep)||!statSync(file).isFile()) return '';
    const url='../evidence/'+relative(root,file).split(sep).map(encodeURIComponent).join('/');
    return /\.(png|jpe?g|webp)$/i.test(file)?'<a href="'+escape(url)+'"><img loading="lazy" alt="검증 캡처" src="'+escape(url)+'"></a>':'<a href="'+escape(url)+'">증거 파일</a>';
  } catch {return '';}
}
export function render(run,revision) {
  const {dir,meta,state:t,events}=run;
  const stale=t.verify && t.verify.revision!==revision;
  const outcome=stale?'코드 변경 · 재검증 필요':t.finish?'완료':'진행 중 · 검증 대기';
  const checks=[...(t.verify?.checks??[]),...(t.device?.checks??[])];
  const results=(t.criteria?.items??[]).map(c=>{
    const items=checks.filter(x=>x.id===c.id);
    const uiMissing=t.plan?.ui.includes(c.id) && !t.device?.checks.some(x=>x.id===c.id);
    const result=items.some(i=>i.result==='fail')?'fail':stale||uiMissing||!items.length||items.some(i=>i.result==='unverified')?'unverified':'pass';
    return {c,result,items};
  }).sort((a,b)=>Number(a.result==='pass')-Number(b.result==='pass'));
  const evidence=x=>escape(x.evidence)+' '+attachment(dir,x.artifact);
  const summaries=events.map(e=>['<code>'+escape(e.stage)+'</code>',escape(e.data.summary),escape(e.data.session??'—'),escape(e.at)]);
  const votes=['plan','code'].flatMap(g=>review(t,g).issues.map(x=>[g,escape(x.id),escape(label[x.verdict]),escape(x.left?.evidence),escape(x.right?.evidence),escape(t[g+'-judge']?.decisions.find(d=>d.id===x.id)?.evidence)]));
  const measured=events.filter(e=>e.data.usage || Number.isFinite(e.data.elapsedMs));
  const usages=measured.map(e=>[escape(e.stage),escape(Number.isFinite(e.data.elapsedMs)?Math.round(e.data.elapsedMs/1000)+'초':'미측정'),...['input','cached','output'].map(k=>escape(e.data.usage?.[k]??'미측정'))]);
  const end=events.at(-1)?.at??meta.started;
  const html='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>my-oc-flow · '+escape(meta.id)+'</title>'+
    '<style>body{margin:auto;padding:2rem 1rem;max-width:72rem;font:1rem/1.65 system-ui,sans-serif;color:#172934;background:#fafbf8}h1{font-size:2rem}h2{margin:2.5rem 0 .5rem}p,td{white-space:pre-wrap;overflow-wrap:anywhere}td,th{border-bottom:1px solid #ccd5d2;text-align:left;padding:.5rem;vertical-align:top}table{border-collapse:collapse;width:100%}.scroll{overflow:auto}img{max-width:14rem;max-height:18rem}b{color:#185e4f}details{margin:.75rem 0}</style>'+
    '<main><h1>'+escape(meta.id)+'</h1><b>'+outcome+'</b><p>'+escape(meta.memo)+'</p>'+
    '<h2>완료 기준</h2>'+table(['기준','기대 동작','상태','실행 근거'],results.map(({c,result,items})=>[escape(c.id),escape(c.expect),escape(label[result]),items.map(evidence).join('<br>')]))+
    '<h2>확정 설계와 검토</h2><p>'+escape(t.plan?.summary??'설계 대기')+'</p>'+table(['단계','쟁점','상태','A 근거','B 근거','반박 근거'],votes)+
    '<h2>기기 확인</h2><p>'+escape(t.device?.summary??(t.plan?.ui.length?'실행 대기':'계획된 UI 검사 없음'))+'</p>'+
    '<h2>변경과 검증</h2><p>'+escape(t.implementation?.summary??'구현 대기')+' '+attachment(dir,t.implementation?.diff)+'</p><p>'+escape(t.verify?.summary??'검증 대기')+'</p>'+
    '<h2>사용량</h2><p>경과 시간 '+Math.max(0,Math.round((Date.parse(end)-Date.parse(meta.started))/1000))+'초 · 기록된 세션 '+new Set(events.map(e=>e.data.session).filter(Boolean)).size+'개 · 수정 회차 '+Math.max(0,events.filter(e=>e.stage==='implementation').length-1)+'</p>'+
    (measured.length?table(['단계','실행 시간','입력','캐시 입력','출력'],usages):'<p>토큰 미측정</p>')+
    '<details><summary>단계별 실행 기록</summary>'+table(['단계','결과','세션','UTC'],summaries)+'</details></main></html>';
  const out=join(dir,'report'); mkdirSync(out,{recursive:true});
  const tmp=join(out,randomUUID()+'.tmp');writeFileSync(tmp,html);renameSync(tmp,join(out,'index.html'));
}
