# Todo 18 — 관리자 비용·설정 UX

## 소스 재현

- Todo 18 시작 시 `HEAD`의 `src/components/admin/AdminPricingPageClient.tsx:35-42,72-84`는 입력에서 숫자가 아닌 문자를 즉시 제거하고 빈 문자열을 `0`으로 변환했다. 따라서 빈 값·비숫자·음수·범위 초과를 저장 전에 구분해 안내할 수 없었다.
- 시작 시 `HEAD`의 `src/components/admin/AdminPricingPageClient.tsx:49-51,90-94`는 서버 초기값과 편집값을 하나의 state로 관리했다. 저장 성공 때 persisted snapshot을 갱신하지 않고 실패 때도 오류 종류나 서버 값과 초안을 구분하지 않았다.
- 시작 시 `HEAD`의 `src/components/admin/AdminPricingPageClient.tsx:123-291`는 모든 비용 필드를 항상 편집 가능하게 노출하고 전역 저장 버튼만 제공했다. 섹션별 dirty 상태와 Discard가 없었다.
- 시작 시 `HEAD`의 `src/components/admin/AdminSettingsPageClient.tsx:15-17,39-43`도 서버 초기값과 초안을 하나의 state로 관리하며, 저장 실패를 한 문구로만 처리했다.
- 시작 시 `HEAD`의 `src/components/admin/AdminSettingsPageClient.tsx:76-244`는 세 역할이 다른 설정을 모두 상시 편집 상태로 보여 주고 persisted 요약, 섹션별 dirty 상태, Discard를 제공하지 않았다.
- `src/app/api/admin/settings/route.ts:19-59`의 기존 PUT API는 `updates` 객체를 그대로 저장한다. Todo 18에서는 이 API와 설정 키·값 데이터 shape를 유지하고 클라이언트 경계에서 필요한 검증과 복구 상태만 추가한다.

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

## 정적 검증

- `npx tsx --test src/lib/admin-pricing-settings.test.ts` — RED: 2 pass/2 fail when normalized account value was absent; GREEN: PASS, 4/4.
- `npx tsc --noEmit` — PASS.
- `npx eslint <Todo 18 changed TypeScript files>` — PASS, 13 files.
- TypeScript no-excuse checker — PASS, 13 files and no violations. Plugin 절대 경로의 module resolution 한계 때문에 동일 script를 `.tmp/qa`에 일시 복사해 workspace `typescript`로 실행했고 cleanup에서 제거했다.
- `git diff --check` — PASS.
- 파일 크기 점검 — production TypeScript는 모두 200 pure LOC 미만. 실행 spec은 247 pure LOC warning band이며 별도 helper로 시각/axe harness를 분리했다. 다음 시나리오 추가 전 추가 분리가 필요하다.
- 최종 `npm run build -- --webpack` — PASS, TypeScript와 32 static pages 생성 완료.

## 런타임·시각 검증

- 포트 3100/55432 free 확인 후 등록 QA wrapper로 `qa:db:up` → `qa:db:assert` → `qa:db:reset` → `qa:db:assert`를 통과했다. DB는 `127.0.0.1:55432`에만 열었다.
- production server는 동일 synthetic `SESSION_SECRET=surfing-qa-session-secret-not-production`로 `127.0.0.1:3100`에만 열었다. standalone 실행에는 현재 build의 `.next/static` 복사가 필요함을 HTML-only/no-hydration 실패로 확인하고 runtime bundle을 조립했다. 보호 route는 비인증 요청에 `307 /admin/login`을 반환했다.
- `EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/390 npm run test:e2e:mobile -- tests/e2e/admin-pricing-settings.spec.ts --project=mobile-390 --workers=1` — 최종 PASS, 13/13.
- 같은 명령의 `mobile-430`/430 evidence — 최종 PASS, 13/13.
- 두 폭 모두 pricing/policy edit/discard/save/reload, portal/logout/dock dirty stay/discard/focus, synthetic beforeunload, delayed PUT lock, whitespace-only·mixed account validation/payload/reload/restore, 400/403/404/500 draft retention, long Korean, half-width 200% zoom equivalent, sticky action/dock geometry, zero horizontal overflow, serious/critical Axe를 통과했다.
- 최종 browser egress ledger는 390에서 1,469건, 430에서 940건 모두 `allowed:127.0.0.1:3100`뿐이다. Kakao 또는 외부 서비스는 열거나 따라가지 않았다.
- fresh PNG 12개를 직접 원본 크기로 확인했다. dirty dialog는 제목/설명/Stay/Discard 위계와 focus target이 명확하고, 390/430 component preview는 저장 항목과 confirmed-usage 설명을 자연스럽게 감싼다. 긴 한국어, 오류/초안 구분, sticky action과 fixed dock, half-width reflow에 clipping·겹침·수평 overflow가 없다.

## 남은 범위

- 사용자 경계에 따라 subagent/독립 visual oracle, 광범위 Lighthouse·persona·release matrix는 실행하지 않았다. Todo 18의 두 모바일 폭과 요청된 synthetic 상태는 main worker가 fresh evidence로 직접 판정했다.
- backend API validation/schema, CAS/409, 새 billing policy, 데스크톱 layout, 중앙 plan/ledger 갱신은 의도적으로 범위 밖이다.
