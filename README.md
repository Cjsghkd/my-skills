# my-skills

개인 프로젝트에서 함께 사용할 Codex 스킬 모음입니다. 첫 스킬 **my-oc-flow**는 메모에서 시작해 독립 설계, 구현, 실행 검증, 독립 리뷰를 진행하고 로컬 HTML 보고서를 만듭니다.

## 설치

Git, Node.js 20 이상, 하위 에이전트를 지원하는 로컬 Codex가 필요합니다. Android 기기 확인을 사용할 때만 adb와 승인된 테스트 기기가 필요합니다.

```shell
codex plugin marketplace add Cjsghkd/my-skills --ref v0.1.0
codex plugin add my-skills@my-skills
```

개발할 **대상 프로젝트**에서 새 Codex 대화를 열고 스킬 목록에서 `my-oc-flow`를 선택합니다. 메인 대화 권장값은 `gpt-6.1-terra / low`입니다. 모델 선택은 계정·클라이언트에 따라 달라집니다. 커스텀 역할을 처음 설정할 때는 다음처럼 요청할 수 있습니다.

> my-oc-flow에 필요한 프로젝트 역할을 이 저장소에 설치해줘.

스킬에 포함된 `scripts/setup.mjs PROJECT`는 설치 상태를 보여줍니다. 같은 명령에 `--install`을 붙이면 대상 프로젝트의 `.codex/agents/my_oc_*.toml`을 만듭니다. 기존 설정과 내용이 충돌하면 중단합니다. 설치 후 새 대화에서 역할을 확인합니다. 모델과 effort를 직접 지정해 독립 세션을 열 수 있는 클라이언트는 같은 역할 설정을 사용할 수 있습니다.

## 사용 예

> $my-oc-flow 작성 중 앱을 닫고 다시 열어도 초안을 복원해줘. 같은 기기에서만 동작하면 돼.

1. 메인이 메모와 결정을 기록합니다. 조사 역할이 기존 동작을 찾고 제품 선택이 남은 경우에만 질문합니다.
2. 두 설계자가 독립 설계하고, 두 명의 새 리뷰어가 통합안과 검증 계획을 검토합니다. 별도 구현자가 코드를 작성합니다.
3. 실행 검증을 통과한 버전에서 두 새 코드 리뷰어가 독립 검토합니다. UI 변경이면 같은 빌드에서 기기 확인을 병렬 진행합니다.
4. 수정 후 영향받은 경로를 다시 검사합니다. 같은 로컬 링크 `.flow/<id>/report/index.html`에 완료 기준·코드 변경·테스트·기기 근거·리뷰와 사용량이 모입니다. 중단한 작업은 `$my-oc-flow <작업 ID> 이어서 진행해줘`로 재개합니다.

| 역할 | 모델 | effort |
|---|---|---|
| 진행, 조사, 검증 명령, 기기 조작 | GPT-6.1 Terra | low |
| 요구 해석, 설계자 2명, 설계 리뷰어 2명, 구현, 코드 리뷰어 2명, 시각 판정 | GPT-6.2 Sol | medium |
| 양측이 명시적으로 다른 결론을 내린 쟁점의 반박자 | GPT-6.2 Sol | high |

하나의 정상 작업에 설계 2, 설계 리뷰 2, 구현 1, 코드 리뷰 2로 Sol 세션 7개가 기본입니다. 역할별로 필요한 자료와 증거 경로만 전달합니다. 기기 단계는 검증 경로와 기대 결과를 분리하며 재생이 통과해도 이번 빌드에서 기대 동작을 확인합니다.

## 로컬 검증과 공개 예제

```shell
npm test
npm run demo
```

외부 npm 패키지 설치 없이 동작합니다. demo는 임시 Git 저장소에서 작은 인사말 CLI를 실제로 실행하고 생성한 HTML 경로를 출력합니다. 예제의 역할 응답은 합성 데이터입니다. [예제 보고서 원본](examples/greeting.html)을 받아 브라우저에서 볼 수 있습니다.

- [스킬과 하위 세션 운용](plugins/my-skills/skills/my-oc-flow/SKILL.md)
- [실행 기록·투표·재개 규약](plugins/my-skills/skills/my-oc-flow/references/records.md)
- [Android 테스트와 기록·재생](plugins/my-skills/skills/my-oc-flow/references/device.md)
- [선택적 Notion 회귀 목록](plugins/my-skills/skills/my-oc-flow/references/notion.md)

프로젝트의 메모·증거는 로컬 .flow 디렉터리에 보관하며 Notion 공유는 요청한 경우에만 수행합니다. 재사용할 Android 시나리오는 대상 프로젝트의 테스트 코드와 함께 관리할 수 있습니다.

## 다른 스킬 추가

`plugins/my-skills/skills/<이름>/SKILL.md`에 스킬을 추가하고 플러그인 버전을 갱신합니다. 같은 개인 마켓플레이스와 플러그인에서 여러 스킬을 제공합니다.

## 참고와 라이선스

설계에 참고한 자료는 [Ponytail](https://github.com/DietrichGebert/ponytail), [Token Optimizer](https://github.com/alexgreensh/token-optimizer), [Answer Me With HTML](https://github.com/QingYunA/answer-me-with-html), [당근의 기기 테스트 사례](https://medium.com/p/5340546886b5)입니다. 이 저장소의 자체 구현은 [MIT](LICENSE)로 배포합니다.
