# Todo 6 — 매장·관리자 주문 처리 동시성 계약

## 구현 범위

- 매장/관리자 주문 행을 `주문 제출 부모 + 메뉴 variant` 단위로 유지하고, 부모·항목 도착 시각, snapshot, 항목 ID와 `updatedAt` 버전을 함께 제공한다. 실제 주문이 없는 카탈로그 variant는 제외하며 같은 메뉴를 나중에 다시 주문해도 별도 행으로 남긴다.
- PATCH 본문을 `action`, 전체 `orderItemIds`, 전체 `expectedItems`, 취소 시 `reasonCode`/`reasonText`의 정확한 필드로 제한했다. 추가 필드, 중복·누락 ID, 비표준 시각, 다른 행 혼합, 잘못된 취소 사유를 400/404로 구분한다.
- 준비·완료·준비 취소·완료 취소·주문 취소의 전이표를 순수 함수로 고정했다. 검증과 조건부 쓰기, 취소 알림은 한 serializable transaction에서 실행하며 stale version과 주문자 수정/취소 경쟁의 패자는 authoritative `current`가 포함된 409를 받는다.
- 매장/관리자 route는 같은 handler와 응답 envelope를 사용한다. 클라이언트는 제출 행 전체를 하나의 mutex key로 잠그고, 다른 행은 독립적으로 처리하며 409 시 서버의 현재 데이터를 즉시 표시한다.
- Prisma schema와 참가자 주문 조회/수정 계약은 변경하지 않았다.

## 검증

- failing-first 순수 계약 테스트를 추가한 뒤 전체 unit suite — PASS, 64/64.
- 계획의 fulfillment integration command — PASS, 4/4. 다섯 전이, 정확한 200/400/401/404/409 envelope, 부모/항목 실제 도착 순서, 반복 제출 분리, zero-order variant 제외를 일회용 PostgreSQL에서 확인했다.
- 같은 행의 serve/cancel, 참가자 PATCH/prepare, 참가자 DELETE/serve 경쟁은 각각 정확히 한 요청만 200이고 패자는 authoritative 409였다. 다른 두 행의 동시 요청은 모두 200이었다. 테스트 중 보인 Prisma P2034 로그는 의도한 serializable 경쟁의 패자이며 부분 쓰기는 없었다.
- `npx tsc --noEmit --incremental false` — PASS.
- 변경 TypeScript 12개 파일 ESLint — PASS, warning 0.
- TypeScript no-excuse checker — PASS, 12 files, violation 0. plugin script 임시 복사본은 실행 직후 제거했다.
- `git diff --check`와 `git diff -- prisma/schema.prisma` — PASS, schema diff 없음.
- `NEXT_TELEMETRY_DISABLED=1 CHECKPOINT_DISABLE=1 npm run build -- --webpack` — PASS. compile, TypeScript, 32 static pages와 두 fulfillment API route를 확인했다.

## 실제 경로 확인

- 합성 session과 고정 QA DB로 production Next 서버를 `127.0.0.1:3100`에 직접 띄운 뒤 `/api/shop/meetings/8101/orders`를 `curl`로 호출했다.
- GET에서 실제 7개 제출 행을 읽었고, 무인증 PATCH 401 `AUTH_REQUIRED`, 추가 필드 요청 400 `INVALID_ORDER_ACTION`, prepare 200 `{ data }`, 같은 버전 재전송 409 `ORDER_ACTION_CONFLICT` + `current`를 확인했다.
- integration에서도 합성 session cookie가 담긴 실제 `NextRequest`와 로컬 PostgreSQL을 사용해 권한 없는 사용자 401, 최종 행·취소 알림, cross-domain race를 확인했다.
- 외부 네트워크와 실제 Kakao 로그인은 필요하지 않아 실행하지 않았다.

## 다음 범위

- Todo 11이 이 계약을 사용해 매장 전용 oldest-first live queue, 5초 visible polling, last-good/retry, 검색·필터, reversal 확인 UI를 구성한다.
- Todo 16이 같은 행/버전 계약을 관리자 주문 처리 화면에 맞게 재구성한다.
