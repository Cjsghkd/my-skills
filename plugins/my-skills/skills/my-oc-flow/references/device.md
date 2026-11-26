# Android 기기 확인

기능의 기대 결과, 실행 경로, 이번 빌드의 실행 증거를 구분한다. 설계자가 ui 기준을 정하고 같은 변경본에서 빌드한 테스트 앱과 사용자가 허용한 기기/에뮬레이터를 사용한다. adb devices -l에서 승인된 serial을 고른다. 테스트 계정·격리된 데이터의 전제와 로케일을 기록한다.

경로는 JSON의 id, package, steps로 표현한다. launch에는 activity, tap과 expect에는 id(리소스 ID), text, description 중 하나 이상을 준다. stop은 대상 앱 프로세스를 종료하며 데이터를 지우지 않는다. input의 value는 비민감 ASCII 테스트 문자열용이다. 예제:

```json
{"id":"home","package":"com.example.demo","steps":[
  {"action":"launch","activity":".MainActivity"},
  {"action":"tap","id":"com.example.demo:id/open_drafts"},
  {"action":"expect","text":"Drafts"}
]}
```

처음 기기를 탐색해 확정한 동작을 후보 경로에 작성한다. record는 후보를 실제 실행하고 기대 동작까지 성공한 경우에만 새 경로 파일을 저장한다. 장기 회귀로 편입하기 전 초기 상태로 돌려 독립 재생한다. 경로 파일은 테스트 코드와 함께 버전 관리하고, captures는 .flow/<id>/evidence 아래에 둔다.

```
node <skill>/scripts/android.mjs record SERIAL draft.json .flow/ID/evidence NEW_ROUTE.json
node <skill>/scripts/android.mjs replay SERIAL NEW_ROUTE.json .flow/ID/evidence
```

재생기는 현재 UI 구조에서 유일한 대상 요소를 찾아 조작한다. 기대 상태가 없거나 여러 개면 실행 위치와 근거를 기록한다. 기기 담당은 앱 실패와 환경 차단을 구분해 device 단계에 전달한다. 연결 불가·비승인·실패 상태를 준비할 수 없는 경우 unverified를 사용한다. 민감한 입력·운영 계정 조작은 경로에 담지 않는다.

레이아웃, 겹침, 가독성처럼 구조 검사만으로 판단할 수 없는 기준은 실제 캡처를 시각 검토한다. 변경된 선택자는 새로운 후보로 작성하고 재검증한다. 대체 경로에서 기대 결과까지 확인한 실행은 '복구 후 통과'라고 남긴다. 첫 실패의 증거는 보존하고 대표 캡처만 부모에게 연결한다. Android 이외 UI는 대상 저장소의 실제 브라우저/플랫폼 도구로 확인한 범위와 환경을 명시한다.
