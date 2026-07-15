# Todo 18 — 관리자 비용·설정 UX

## 소스 재현

- Todo 18 시작 시 `HEAD`의 `src/components/admin/AdminPricingPageClient.tsx:35-42,72-84`는 입력에서 숫자가 아닌 문자를 즉시 제거하고 빈 문자열을 `0`으로 변환했다. 따라서 빈 값·비숫자·음수·범위 초과를 저장 전에 구분해 안내할 수 없었다.
- 시작 시 `HEAD`의 `src/components/admin/AdminPricingPageClient.tsx:49-51,90-94`는 서버 초기값과 편집값을 하나의 state로 관리했다. 저장 성공 때 persisted snapshot을 갱신하지 않고 실패 때도 오류 종류나 서버 값과 초안을 구분하지 않았다.
- 시작 시 `HEAD`의 `src/components/admin/AdminPricingPageClient.tsx:123-291`는 모든 비용 필드를 항상 편집 가능하게 노출하고 전역 저장 버튼만 제공했다. 섹션별 dirty 상태와 Discard가 없었다.
- 시작 시 `HEAD`의 `src/components/admin/AdminSettingsPageClient.tsx:15-17,39-43`도 서버 초기값과 초안을 하나의 state로 관리하며, 저장 실패를 한 문구로만 처리했다.
- 시작 시 `HEAD`의 `src/components/admin/AdminSettingsPageClient.tsx:76-244`는 세 역할이 다른 설정을 모두 상시 편집 상태로 보여 주고 persisted 요약, 섹션별 dirty 상태, Discard를 제공하지 않았다.
- `src/app/api/admin/settings/route.ts:19-59`의 기존 PUT API는 `updates` 객체를 그대로 저장한다. Todo 18에서는 이 API와 설정 키·값 데이터 shape를 유지하고 클라이언트 경계에서 필요한 검증과 복구 상태만 추가한다.

## 독립 검토 재개방 및 정적 교정 (2026-07-15)

- 독립 검토가 Todo 18 완료 판정을 다시 열었다. 현재 `HEAD 50f0c78`에는 PUT 진행 중 dirty shell 링크와 로그아웃이 계속 활성 상태여서 discard dialog를 열 수 있고, dialog의 discard handler는 페이지의 `discardDraft`가 저장 중 조용히 반환한 뒤에도 이동이나 로그아웃을 실행할 수 있었다.
- 두 페이지의 명시적 `isSaveInFlight` 상태를 `AdminLayout`과 `useAdminDirtyNavigationGuard`까지 전달했다. 저장 중 portal link와 다른 dock 목적지는 `aria-disabled=true`와 tab 제외 상태를, 로그아웃은 native disabled 상태를 노출한다. guard의 navigate/logout/discard callback도 synthetic 또는 programmatic 호출을 먼저 거부한다. 저장 완료 후 기존 clean shell 의미가 복원된다.
- 기존 pricing/settings delayed PUT 시나리오 각각에서 portal, 다른 dock 목적지, logout의 disabled 의미, discard dialog 미노출, URL 유지, logout 무요청과 완료 후 정상 의미 복원을 검증하도록 회귀 assertion을 확장했다.
- `AdminSettingSectionHeader`는 320px 미만에서 내용과 편집 action을 세로로 배치하고, 390/430에서는 기존 단일 행 구성을 유지한다. 역할 badge는 Korean word group을 유지하고, persisted summary는 좁은 폭에서 clamp를 제거하되 긴 무공백 token은 containment를 위해 줄바꿈할 수 있다.
- 195px/215px 200%-equivalent 시나리오는 대상 header의 stacked geometry와 containment, 역할 label의 단일 rect 및 computed `word-break`/`overflow-wrap`, persisted 원문과 clamp 미적용·전체 높이 노출, 문서의 zero horizontal overflow, sticky action/dock clearance를 객관적으로 검사한다. 캡처 직전 editor를 접어 교정된 header와 sticky action이 같은 viewport에 실제로 보이는지도 검사한다.
- 정적 교정 뒤 아래의 등록 synthetic QA lifecycle, current-source production build, focused Playwright 재실행, 12개 fresh screenshot 직접 검토까지 완료했다.

## 구현 범위

- 비용 화면을 `참가비와 옵션 비용`(회원 정산)과 `식음료 지원 한도`(식음료 정산)로 나눴다. 각 섹션은 서버에 저장된 요약을 항상 표시하고 편집 버튼을 눌렀을 때만 입력과 현재 데이터로 지원되는 금액 미리보기를 연다.
- 설정 화면을 `취소 안내`, `참가 옵션 안내`, `정산 계좌`로 나눠 실제 회원 노출 역할을 표시했다. 취소/옵션 문구와 계좌는 기존 공개 화면 데이터만 미리보기한다.
- 두 화면 모두 서버 snapshot과 draft를 분리하고 섹션별 `초안 있음`, 전역 변경 섹션 수, shell 안 sticky Save/Discard 영역을 제공한다. 성공 시 snapshot을 갱신하고, 실패 시 persisted 요약과 draft를 함께 유지한다.
- 금액은 required, 정수, 비숫자, 음수, 안전 계산 범위를 저장 전에 검사한다. 취소 기준은 기존 UI의 0-30일 범위를 검사하며, 회원 안내 문구는 빈 값을 거부한다. 정산 계좌는 기존의 전체 미등록 상태를 허용하되 일부만 입력한 상태는 저장하지 않는다.
- 400/401/403/기타 서버 오류를 서로 다른 복구 문구로 표시한다. 409/CAS나 새로운 정책은 추가하지 않았다.
- 기존 `PUT /api/admin/settings`와 `updates` shape는 유지했다. 식음료 지원 한도는 기존 camelCase draft 속성을 기존 저장 키 `food_order_support_cap`으로 명시 매핑해 저장 후 재조회가 가능하도록 했다.
- 렌더링 책임은 역할별 섹션 파일로만 로컬 분리했다. 공용 폼 프레임워크, schema, backend validation, API 변경, 새 토큰·아이콘 패키지는 추가하지 않았다.
- `tests/e2e/admin-pricing-settings.spec.ts`에 clean/dirty, 편집/Discard, 지원되는 preview, client validation 무요청, 실패 draft 유지, 단일 저장과 reload, axe 검증 시나리오를 작성했고 아래 최종 runtime pass에서 실행했다.

## 교정 완료

- `AdminLayout`의 회원/샵 포털, 로그아웃, 관리자 bottom dock를 하나의 `useAdminDirtyNavigationGuard`에 연결했다. dirty 상태에서는 공용 `Dialog`가 `계속 편집`/`버리고 이동`을 명시하고, 계속 편집을 선택하면 원래 링크 또는 로그아웃 버튼으로 포커스를 복원한다. 같은 경로와 새 탭/보조 클릭은 가로채지 않으며 브라우저 종료에는 `beforeunload`를 등록한다.
- 비용·설정 PUT이 진행되는 동안 열린 입력/textarea, 모든 섹션 편집 토글, Discard, Submit을 disabled 처리하고 이벤트 handler도 중복 mutation을 거부한다. 지연 PUT 시 두 화면 모두 잠기는 실제 브라우저 회귀 검증을 추가했다.
- 정산 계좌 세 값은 검증 전에 trim한다. 모두 공백이면 빈 문자열 세 개로 저장하고, 공백과 실제 값이 섞인 부분 계좌는 누락 필드 오류로 막는다. 성공한 validation value가 PUT payload와 새 persisted snapshot의 단일 원본이다.
- 비용 미리보기는 기본 참가비/강습비/장비 대여비의 저장 component를 정회원·동반인별로 보여 준다. base+lesson+rental 합계를 회원 청구액처럼 표시하지 않고, 확정된 강습·장비 대여 이용 여부에 따라 해당 항목만 반영된다고 명시한다.
- 확장된 참가 옵션 미리보기에서 `brand-text-muted`가 sky strong 표면과 4.24:1로 Axe serious를 발생시킨 것을 실제 390 브라우저에서 재현했다. 패널의 고대비 의미 전경을 상속하도록 한 클래스 제거 1줄로 수정했다.

### 저장 완료 뒤 stale 이탈 의도 교정 (2026-07-15)

- 독립 검토가 delayed PUT 회귀를 한 단계 더 강화했다. dirty 상태에서 먼저 `변경 내용을 버릴까요?` dialog를 연 뒤 form을 programmatic submit하고, 저장 중 dialog가 닫혀 있으며 저장 완료 뒤에도 다시 열리지 않고 현재 URL을 유지해야 한다.
- 교정 전 current source는 두 delayed-save 시나리오만 실패해 mobile-390에서 11/13이었다. `pendingLeave`는 저장 중 숨겨질 뿐 제거되지 않아, PUT 완료로 `isSaveInFlight=false`가 되면 clean 화면 위에 이전 dialog가 다시 열리는 것이 직접 재현됐다.
- guard가 저장 시작 또는 dirty 해소를 관찰하면 다음 animation frame에서 `pendingLeave`와 원래 trigger를 함께 비우도록 했다. dialog의 open 조건에도 `isDirty`를 포함해 clean snapshot에는 stale 이탈 의도가 표시되지 않는다. effect 안 동기 state update를 피하면서 연속 focus/event 전환에도 cleanup 가능한 최소 교정이다.
- 같은 회귀 시나리오를 포함한 최종 focused Playwright는 mobile-390 13/13, fixture reset 뒤 mobile-430 13/13을 통과했다. 두 폭 모두 저장 중 dialog 0개, shell 잠금, navigation/logout 무반응, 저장 완료 뒤 dialog 0개와 원래 URL 유지까지 관찰했다.

## 정적 검증

- `npx tsx --test src/lib/admin-pricing-settings.test.ts` — RED: 2 pass/2 fail when normalized account value was absent; GREEN: PASS, 4/4.
- `npx tsc --noEmit` — PASS.
- `npx eslint <Todo 18 changed TypeScript files>` — PASS, 13 files.
- TypeScript no-excuse checker — PASS, 13 files and no violations. Plugin 절대 경로의 module resolution 한계 때문에 동일 script를 `.tmp/qa`에 일시 복사해 workspace `typescript`로 실행했고 cleanup에서 제거했다.
- `git diff --check` — PASS.
- 파일 크기 점검 — production TypeScript는 모두 200 pure LOC 미만. 실행 spec은 247 pure LOC warning band이며 별도 helper로 시각/axe harness를 분리했다. 다음 시나리오 추가 전 추가 분리가 필요하다.
- 최종 `npm run build -- --webpack` — PASS, TypeScript와 32 static pages 생성 완료.

### 독립 검토 교정 최종 재검증 (2026-07-15)

- `node --import tsx --test src/lib/admin-pricing-settings.test.ts` — PASS, 4/4.
- `npx tsc --noEmit --incremental false` — PASS.
- correction changed-file ESLint — PASS, TypeScript 8개 파일.
- TypeScript no-excuse checker — PASS, 8개 파일, violation 0. Plugin 절대 경로의 `typescript` resolution 한계는 workspace `.tmp`에 script를 일시 복사해 실행하고 같은 command의 `trap`으로 제거했다.
- `git diff --check` — PASS.
- 파일 크기 점검 — 변경 TypeScript 8개 모두 250 pure LOC 이하이며 실행 spec은 234 pure LOC다.
- `npm run build -- --webpack` — PASS, Next.js 16.2.1 production compile·TypeScript·32 static pages 완료.

### stale 이탈 의도 교정 최종 재검증 (2026-07-15)

- mobile-390 RED — 11/13, pricing/settings의 delayed-save 두 시나리오가 저장 완료 뒤 dialog 1개를 관찰해 실패했다.
- mobile-390 GREEN — PASS, 13/13.
- fixture reset 뒤 mobile-430 GREEN — PASS, 13/13.
- `node --import tsx --test src/lib/admin-pricing-settings.test.ts`, `npx tsc --noEmit --incremental false`, correction changed-file ESLint, TypeScript no-excuse, `git diff --check`를 current correction에서 다시 실행했다.

## 교정 후 런타임·시각 검증

- 등록 QA wrapper로 `qa:db:up` → `qa:db:assert` → `qa:db:reset` → `qa:db:assert`를 통과했다. PostgreSQL은 `127.0.0.1:55432`에만 열었고 reset이 schema push와 deterministic fixture seed를 함께 수행했다.
- current build의 `public` 7개 파일과 `.next/static` 97개 파일을 `.next/standalone`에 복사하고 fixed synthetic `SESSION_SECRET=surfing-qa-session-secret-not-production` 및 DB URL로 production server를 `127.0.0.1:3100`에만 열었다. root probe는 HTTP 200이었다.
- 첫 direct `npx playwright` 시도는 test process에 fixed `SESSION_SECRET`가 없어 synthetic cookie가 development fallback으로 서명되어 `/admin/login`으로 이동한 harness invocation 오류였다. 로그인 snapshot과 환경 차이로 원인을 확정했고 product/test source는 수정하지 않았다. 이후 모든 최종 실행은 fixed 환경을 주는 등록 target을 사용했다.
- `EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/390 npm run test:e2e:mobile -- tests/e2e/admin-pricing-settings.spec.ts --project=mobile-390 --workers=1` — PASS, 13/13, 22.3초, fresh PNG 6개.
- server를 내린 뒤 두 번째 `qa:db:reset`과 `qa:db:assert`로 fixture를 다시 만들고 같은 production build를 재기동했다. `EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/430 npm run test:e2e:mobile -- tests/e2e/admin-pricing-settings.spec.ts --project=mobile-430 --workers=1` — PASS, 13/13, 22.4초, fresh PNG 6개.
- 두 폭 모두 editor mutation, portal link, 다른 dock 목적지, logout이 delayed PUT 동안 실제·synthetic click에 반응하지 않고 dialog·navigation·logout request를 만들지 않으며, 저장 완료 뒤 disabled semantics가 복원되는 것을 통과했다.
- 390/430 capture는 각 6개, 합계 12개다. PNG signature와 390×844/430×932 크기를 확인했고 zoom-equivalent는 각각 195×844/215×932였다. 모든 파일 timestamp와 SHA-256을 fresh run 뒤 확인했다.
- 12개 capture를 모두 직접 열어 검사하고 두 zoom-equivalent 이미지는 original detail로 다시 검사했다. 195/215 모두 header content와 edit action이 세로로 쌓이고, Korean 역할 chip이 단어 안에서 끊기지 않으며, persisted summary 전체가 clamp·clipping 없이 보이고, full-width edit action·sticky save action·fixed dock가 겹치지 않고 도달 가능하다. 나머지 10개에도 CJK clipping, 수평 overflow, action 가림, dialog hierarchy 이상이 없다. 시각 판정은 GOOD이다.
- fresh browser ledger는 폭별 484행 모두 `127.0.0.1:3100` 허용 요청뿐이었다. QA process guard는 Prisma의 `checkpoint.prisma.io` 시도 2건씩을 차단했으며 실제 외부 연결은 없었다. Kakao/external login이나 browser egress는 실행하지 않았다.
- 종료 시 `qa:db:down`을 통과했고 container와 `surfing-ux-qa-data` volume이 제거됐다. `ss`에서 3100/55432 listener가 없음을 확인했다. `.next`, `test-results`, debug journal, QA receipts/ledgers, temp 파일을 제거하고 intended PNG 12개와 실제 `node_modules`만 보존했다.

## 남은 범위

- 현재 tool surface에는 완료 agent를 닫을 수 있는 subagent API가 없어 프로젝트 constitution에 따라 resident agent를 만들지 않았다. 따라서 visual-qa의 독립 dual-oracle은 실행하지 못했고, fresh 12개에 대한 main worker 직접 검토와 geometry/accessibility assertions가 최종 시각 근거다.
- 사용자 경계에 따라 광범위 Lighthouse·persona·security/release matrix는 추가하지 않았다.
- backend API validation/schema, CAS/409, 새 billing policy, 데스크톱 layout, 중앙 plan/ledger 갱신은 의도적으로 범위 밖이다.
