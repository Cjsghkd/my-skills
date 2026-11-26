# 실행 기록

Node 20 이상과 Git을 사용한다. 모든 명령은 대상 저장소 루트에서 실행한다. id는 영문·숫자·밑줄·하이픈이다. .flow/<id>/inputs/에 단계 입력 JSON을 작성하고 메인이 다음 명령을 호출한다.

```
node <skill>/scripts/flow.mjs init <id> <UTF8-메모파일>
node <skill>/scripts/flow.mjs status <id>
node <skill>/scripts/flow.mjs record <id> <stage> .flow/<id>/inputs/<input>.json
node <skill>/scripts/flow.mjs report <id>
```

plan을 기록한 뒤 status.planKey를 읽는다. 이후 모든 작업을 보낼 때 이 키를 함께 제공하고 반환 JSON의 planKey에 포함한다. 재개 후 예전 설계에서 출발한 결과를 새 키로 바꿔 제출하지 않는다.

모든 입력에는 사람이 이해할 수 있는 summary가 있다. 위임한 역할의 실제 session 식별자를 기록한다. 역할을 호출할 때와 결과를 받을 때의 차이를 측정했으면 elapsedMs로 기록한다. 일반 단계에서 정확한 역할별 토큰 증분을 알면 usage에 input, cached, output을 적고 알 수 없는 값은 생략한다. 코드 내용을 검증할 단계는 먼저 status의 revision을 읽고 작업 종료 후 입력에 basedOn으로 그대로 돌려준다. 구현·수정은 작업을 끝낸 뒤의 스냅샷을 기록한다. 외부 변경이 생겼으면 영향받은 검사부터 다시 수행한다.

| stage | 필수 내용 |
|---|---|
| survey | 기존 동작, 근거 파일, 환경, 실행 방법을 summary에 정리 |
| criteria | items 배열. 각 원소는 id와 expect. 예시 {"id":"C1","expect":"종료 후 초안이 복원된다"} |
| design-a, design-b | 서로 다른 session, 독립 설계와 기준별 검증 계획을 summary에 기록 |
| plan | 통합 설계와 이견의 근거. ui는 실제 기기에서 검사할 기준 ID 배열. 없으면 빈 배열 |
| plan-a, plan-b | 서로 다른 session, votes 배열. 근거 있는 지적이 없으면 빈 배열 |
| plan-judge | 명시적 1:1이 있을 때만 새 session과 decisions 배열 |
| implementation | 새 session, 변경 파일과 구현 내용. 선택 항목 diff는 evidence/ 아래 실제 텍스트 diff의 경로다. 별도로 실행한 수정은 항상 새 session |
| verify | basedOn, buildPassed(boolean), checks 배열. summary에 실제 명령과 결과. 빌드 단계가 없는 프로젝트는 실행 가능한 진입점 확인을 명시 |
| code-a, code-b | basedOn, 별도 session과 votes. 같은 리뷰어의 추가 의견은 같은 session으로 전체 기존 ID를 포함해 다시 기록 |
| code-judge | basedOn, 새 session과 decisions |
| device | basedOn, 환경·경로 재생·복구 내역과 checks. 계획한 ui 기준 전부를 기록 |
| finish | basedOn, 결과 요약 |

리뷰 투표 예시 {"id":"duplicate-save","vote":"accept","evidence":"두 진입점이 같은 저장을 다시 호출함, src/save.js 28행"}. accept는 결함 채택, reject는 결함 기각, unknown은 미확인이다. 반박 결과도 같은 구조다. 각 리뷰어에게 해당하는 같은 지적 ID 목록을 맞춘 뒤 추가 투표를 받는다. 한쪽이 확신하지 못하면 근거를 구하거나 미확인으로 남긴다.

검사 예시 {"id":"C1","result":"pass","evidence":"재실행 후 본문 일치","artifact":"evidence/restart/screen.png"}. result는 pass/fail/unverified다. verify에서 예정된 UI 전용 검사는 생략하거나 device-pending으로 남긴다. 실제 자동 검사의 미확인은 unverified로 보존한다. artifact는 선택이며 해당 실행의 evidence/ 아래 로컬 경로다. 소스 구현이 바뀌면 이전 verify·code·device 결과는 이력에만 남는다. 안정적인 단계의 근거를 이월할 때는 그 근거와 영향 범위를 명시한다.

status/report는 현재 소스와 기록을 대조한다. report/index.html은 최신 상태, events/는 회차별 기록이다. 미확인이나 실패가 남으면 finish 대신 report를 전달한다. 중단 전 마지막 결과의 summary에 다음 행동을 남긴다. 독립 리뷰와 외부 실행을 수행하지 못한 경우 해당 단계 기록을 만들어내지 않는다.
