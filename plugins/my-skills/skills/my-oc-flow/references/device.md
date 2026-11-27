# UI 검증 경로

대상 Git 프로젝트의 `docs/flows/<화면>/<동작>`에 반복할 절차를 둔다. 화면은 앱에 쓰이는 안정적인 이름, 동작은 관찰할 결과로 이름 짓는다. 예를 들어 `drafts/restore-after-relaunch.android.json`은 초안 복원을 검사한다. 같은 화면의 초안 삭제는 별도 기준이다.

## 작업을 시작할 때

1. 이번 UI 기준에 해당하는 화면 폴더와 프로젝트의 관련 테스트만 찾는다. 전체 화면을 조사하거나 첫 실행에 문서 폴더를 만들 필요가 없다.
2. 저장된 경로의 전제와 마지막 기대 결과를 현재 기준과 대조한다. 일치하면 그 파일을 이번 빌드에서 재생한다. 같은 화면에서 새 동작을 검사한다면 기존 진입 단계를 재사용해 새 동작과 결과만 설계한다. 원래 동작의 파일은 보존한다.
3. 직접 영향을 받는 다른 경로도 해당 기준에 한해 확인한다. 단순히 통과한 화면을 검증 목록에 추가하지 않는다. 스크린샷·로그·실패한 시도는 `.flow/<id>/evidence/`에 둔다. 문서의 Git 추적 여부는 프로젝트 선택이다.

## Android에서 재생하기

대상 프로젝트 루트에서 실행한다. `adb devices -l`에서 사용자가 허용한 기기의 serial을 고른다. 테스트 빌드, 로케일, 계정·픽스처 상태를 맞춘다. 기존 경로를 확인할 때는 한 번만 실행한다.

```sh
node <skill>/scripts/android.mjs replay SERIAL docs/flows/drafts/restore-after-relaunch.android.json .flow/ID/evidence
```

경로에는 `id`, `package`, `steps`가 필요하다. 전제가 있다면 `startState`에 다음 실행자가 복원할 방법을 남긴다. 리소스 ID, 접근성 설명 또는 텍스트로 대상을 고른다. 아래 예는 테스트 초안이 종료 후에도 남는지 확인한다.

```json
{
  "id": "restore-after-relaunch",
  "package": "com.example.demo",
  "startState": "Use the test account with one saved draft titled Sample.",
  "steps": [
    {"action": "launch", "activity": ".MainActivity"},
    {"action": "expect", "id": "com.example.demo:id/open_drafts"},
    {"action": "stop"},
    {"action": "launch", "activity": ".MainActivity"},
    {"action": "tap", "id": "com.example.demo:id/open_drafts"},
    {"action": "expect", "text": "Sample"}
  ]
}
```

`tap`과 `expect`는 유일하게 일치하는 요소를 요구한다. `stop`은 데이터를 유지하고 프로세스만 종료한다. `input`에는 비민감 ASCII 테스트 문자열을 쓴다. 겹침·잘림·가독성 기준은 이번 실행의 실제 캡처로 따로 판정한다.

## 새 경로 또는 의도적으로 바뀐 경로

1. 후보 JSON을 `.flow/ID/inputs/`에 작성하고 아래 `learn`을 실행한다. 성공하면 출력의 `dir` 아래에 후보와 첫 실행 증거가 생긴다.
2. 테스트 계정, 픽스처, 탐색 위치를 문서화한 시작 상태로 되돌린다. 서버의 테스트 데이터도 동작에 영향을 주면 복원한다. 앱 강제 종료만으로 저장된 데이터가 복원되지는 않는다. 시작 상태를 안전하게 준비할 수 없으면 미확인으로 남긴다.
3. 같은 기기와 빌드에서 `confirm`에 첫 실행의 `dir`을 전달한다. 동일 후보가 독립 실행에서 다시 통과하면 `docs/flows/<화면>/<id>.android.json`을 생성하거나 갱신한다. 다음 작업은 이 파일로 곧바로 재생한다.

```sh
node <skill>/scripts/routes.mjs learn SERIAL drafts .flow/ID/inputs/draft.json .flow/ID/evidence
node <skill>/scripts/routes.mjs confirm SERIAL FIRST_RUN_DIR .flow/ID/evidence
```

기존 경로가 실패하면 첫 실패 증거를 보존하고 원인을 확인한다. 환경 차단이면 환경을 복원하고, 제품 결함이면 수정한 빌드에서 기존 경로를 재생한다. 의도한 UI 변경으로 절차가 바뀐 경우에만 같은 동작의 후보를 새로 학습한다. 재생 중 다른 실행이 경로를 갱신했다면 최신 파일을 읽고 필요한지 다시 판단한다.

## 다른 UI 플랫폼

브라우저나 iOS는 프로젝트의 기존 실행 도구를 사용한다. 동일한 조회·재생 기준을 적용한다. 새로 확인한 경우 시작 상태를 복원해 두 번째 실행까지 통과한 후 `docs/flows/<화면>/<동작>.flow.md`에 픽스처, 실제 테스트 파일·명령, 사용자 동작, 확인할 결과를 짧게 적는다. 기존 자동화가 있으면 해당 테스트를 가리킨다. 실행 근거와 기기 차단 사유는 해당 작업의 device 단계에 기록한다.
