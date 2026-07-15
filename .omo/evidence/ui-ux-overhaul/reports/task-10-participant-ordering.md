# Todo 10 — 참가자 주문 탐색·검토·제출 이력

## 구현 범위

- `MeetingFoodOrderPanel`은 모임 주문 데이터와 화면 상태만 조합하고, 메뉴 탐색·variant 행·고정 장바구니 요약·검토·제출 이력·진입 카드를 `src/components/meeting/food-order/` 아래의 작은 컴포넌트로 분리했다.
- 메뉴 이름·카테고리·옵션 한글 검색, sticky 카테고리 이동, 선택 메뉴만 보기, 옵션별 독립 variant, 의미 있는 접근성 이름을 가진 44×44 수량 조절을 추가했다. 카테고리 이동은 대상 제목으로 스크롤한 뒤 키보드 focus를 옮긴다.
- sheet 본문과 footer를 분리해 메뉴 수량·합계·지원·청구액과 검토 CTA가 shell 내부 하단에 계속 보인다. 빈 장바구니에서는 CTA가 비활성이고 POST 전에 반드시 별도 검토 화면을 거친다.
- 주문은 부모 제출 단위와 시간순을 유지한다. 각 제출의 메뉴·금액·접수/준비/제공/취소 상태를 표시하고, 모든 sibling이 미처리인 부모만 전체 수정·취소를 노출한다. 준비·제공·일부 취소·전체 취소 제출은 사유와 함께 읽기 전용이다.
- 수정은 기존 variant와 수량을 정확히 다시 담고 새 주문 추가와 문구·동작을 구분한다. 500 실패는 현재 검토/선택을 유지하고, 409는 authoritative history를 먼저 표시한 뒤 보관한 선택을 명시적으로 다시 담게 한다.
- P8/BANNED 조회는 유지하면서 주문 UI 전체를 읽기 전용으로 표시한다. 데이터 계약에서 `canOrder=false`, `읽기 전용`, 잠금 사유를 내려 주며 POST/PATCH/DELETE는 기존 Todo 5 계약대로 403이다.

## 기능·데이터 검증

- `EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/final npm run test:unit` — PASS, 60/60. 이 중 Todo 10 순수 테스트 6개가 60개 active variant, 한글 검색, selected-only, edit prefill, 지원/청구 계산, 제출별 action 잠금을 검증한다.
- focused participant-order integration — PASS. 401/404/403/400/409 우선순위, P1·P2·P3/P8, snapshot 보존, 전체 replace/cancel, 동시 PATCH 한 건 성공·한 건 authoritative 409를 일회용 PostgreSQL에서 재검증했다. 동시성 패자의 Prisma write-conflict 로그는 의도한 retry 경로이며 최종 test exit는 0이다.
- mobile-390 `participant-ordering.spec.ts` — PASS, 5/5. mobile-430 — PASS, 5/5. 검색/카테고리 focus/selected-only/검토/실제 추가, 전체 수정·취소, 신규 POST 500과 수정 500 draft 유지, 409 재적용, 빈 CTA, unknown/inactive/foreign option 400 무변경, wrong owner/P8, 두 context race를 포함한다.
- 공용 `interaction-primitives.spec.ts` — mobile-390 PASS 4/4, mobile-430 PASS 4/4. 내역 우선 sheet에서 `새 주문 추가`를 거치는 현재 동선과 관리자 dock의 현재 `모임` 명칭에 맞춰 오래된 locator를 갱신했다. focus trap, Escape 복귀, scroll lock, tabs/dialog/dock 회귀가 유지된다.
- 두 browser spec의 Axe critical/serious 결과는 0이다. 주문 sheet의 가로 overflow assertion도 두 폭에서 통과했다.

## 시각 검증

- 최종 PNG는 390×844 다섯 장과 430×932 다섯 장이며 모두 RGB 원본이다: 주문 추가 후 이력, 전체 이력, 실패 draft, 충돌 재적용, 읽기 전용.
- 두 폭의 원본을 직접 비교했다. CJK 줄바꿈, 상태 chip, 제출별 카드 구분, 검토 금액 위계, 고정 footer, 장문 잠금 사유, 마지막 action 접근성에 clipping·수평 overflow·shell 이탈·겹침이 없다.
- `지원 0원`은 음수처럼 보이지 않으며 P8 header는 행동을 유도하는 `새 주문 추가` 대신 `읽기 전용 주문 내역`을 사용한다. 시각 판정은 GOOD이다.

## 정적·빌드·정리

- `npx tsc --noEmit --incremental false` — PASS.
- 변경 TypeScript 16개 파일 ESLint — PASS, warning 0.
- TypeScript no-excuse checker — PASS, 16 files, violation 0. plugin script의 임시 workspace 복사본은 실행 직후 제거했다.
- 새 production 컴포넌트와 hook은 모두 250줄 이하이다. `git diff --check` — PASS, `prisma/schema.prisma` diff 없음.
- `NEXT_TELEMETRY_DISABLED=1 CHECKPOINT_DISABLE=1 npm run build -- --webpack` — PASS. compile, TypeScript, 32/32 static pages와 주문 collection/revision route를 확인했다.
- 최종 cleanup receipt에서 container, volume, DB/app ports, owner lock, task process, generation, auth, uploads가 모두 absent다.
- 실제 Kakao 로그인이나 외부 browser navigation은 필요하지 않아 실행하지 않았다.

## 다음 범위

- 참가자 주문 UI와 Todo 5 계약의 소비는 완료했다. shop/admin fulfillment 상태 전이는 Todo 6, shop의 실시간 주문 queue는 Todo 11 범위로 남긴다.
