# Todo 11 — 매장 실시간 주문 큐

## 구현 범위

- 매장 `/shop`에서 관리자 주문 작업공간 재사용을 제거하고 매장 전용 `ShopOrderQueue`를 구성했다. 제출 부모와 variant 행을 그대로 사용해 같은 메뉴의 반복 주문을 합치지 않으며, 부모·항목 도착 시각과 ID로 오래된 미처리 주문부터 안정 정렬한다.
- 상단에는 처리할 주문/접수/준비 중 건수, 마지막 갱신 시각, 수동 새로고침을 한 계층으로 배치했다. 참가자·메뉴·한글 상태 검색과 접수/준비 중/완료/취소 필터를 제공하고 완료 목록은 기본 접힘 상태로 분리했다.
- 문서가 보일 때만 5초 GET polling을 실행하고 숨김 상태에서는 요청하지 않는다. 다시 보일 때 한 번 즉시 갱신하며, 새 요청이 이전 GET을 중단하고 mutation epoch를 확인해 지연된 과거 응답이 최신 mutation을 덮지 못하게 했다.
- GET 실패는 마지막 정상 목록을 유지하면서 `동기화 지연`, 마지막 갱신 시각, `다시 시도`를 표시한다. 409는 authoritative `current`를 적용하고 다른 화면에서 바뀌었다는 안내를 남긴다.
- 준비/완료는 응답 후에만 반영하고 같은 행의 모든 sibling action을 하나의 mutex로 잠근다. 다른 행은 동시에 처리할 수 있다. 준비 취소·완료 취소·주문 취소는 의미가 드러나는 확인 대화상자를 거치며, 기타 취소 사유는 설명을 필수로 한다.
- WebSocket/SSE, optimistic success, 부분 수량 처리, 새 generic 주문 프레임워크, Prisma schema 변경은 추가하지 않았다.

## 검증

- failing-first 순수 큐 계약 테스트를 추가했다. 반복 제출 분리, oldest-first, 참가자/메뉴/상태 검색, 상태 필터, 행별 허용 action을 고정했다.
- `EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/unit npm run test:unit` — PASS, 67/67. 브라우저 서버/DB가 열린 상태에서 cleanup 보안 테스트가 환경 선행조건으로 두 번 막힌 뒤 둘 다 내린 깨끗한 조건에서 전체 suite를 재실행했다.
- `npx tsc --noEmit --incremental false` — PASS.
- 변경 TypeScript 11개 파일 ESLint — PASS, warning 0.
- TypeScript no-excuse checker — PASS, 11 files, violation 0. plugin script 임시 복사본은 실행 직후 제거했다.
- `git diff --check`와 `git diff -- prisma/schema.prisma` — PASS, schema diff 없음.
- `NEXT_TELEMETRY_DISABLED=1 CHECKPOINT_DISABLE=1 npm run build -- --webpack` — PASS. compile, TypeScript, 32 static pages를 확인했다.

## 실제 브라우저 QA

- 계획의 exact Playwright command를 390x844와 430x932에서 각각 실행해 최종 4/4씩 통과했다.
- 기본 큐에서 실제 도착 순서 `[8901, 8901, 8902, 8903]`, 반복 제출 분리, 참가자/메뉴/상태 검색, 상태 필터, 완료 기본 접힘, 준비 취소와 주문 취소 확인을 검증했다.
- 5초 visible polling, hidden 5.3초 동안 요청 0건 증가, visibility 복귀 시 정확히 한 번 갱신, 숨김 중 삽입한 새 주문 노출을 확인했다.
- 지연된 과거 GET을 보류한 채 prepare를 완료한 뒤 과거 응답을 풀어도 최신 상태가 유지됐다. 이어진 합성 500에서 기존 네 행과 상태가 보존되고 오류 안내/재시도가 동작했다.
- 두 브라우저의 같은 행 action은 200/409 한 건씩, 서로 다른 두 행 action은 200/200이었다. 충돌 화면은 authoritative 상태와 안내를 표시했다.
- 각 폭에서 가로 넘침 없음, 보이는 버튼·입력·summary 44px 이상, 확인 취소 후 trigger 포커스 복귀, axe serious/critical 0을 확인했다.
- 최종 390/430 큐·last-good 오류·복구 PNG 6장을 직접 열어 정보 계층, 상태색, 한글 줄바꿈, 필터 밀도, 고정 dock 여백을 검토했고 verdict는 GOOD이다.
- 합성 session과 loopback DB/서버만 사용했다. 실제 Kakao 로그인과 외부 navigation은 필요하지 않아 실행하지 않았다.

## 정리

- 종료 후 3100/55432 listener, QA PostgreSQL container와 volume, `.next`, `test-results`, QA lock/receipt, 임시 no-excuse checker, `node_modules` symlink가 모두 없음을 확인했다.
- 최종 시각 증거 PNG 6장만 ignored evidence 경로에 보존했다.

## 다음 범위

- Todo 16이 같은 version/mutex 계약을 관리자 주문 처리·정산 작업공간에 맞게 재구성한다.
- Todo 12의 장비 이용 검수 화면은 별도 사용량 version 계약(Todo 7)을 먼저 완료한 뒤 진행한다.
