# Todo 5 — 참가자 주문 전체 수정·취소 계약

## 구현 범위

- 참가자 주문 응답을 제출 묶음 단위로 유지하면서 항목 ID, 메뉴·옵션·가격 snapshot, 수량, 준비·제공 수량, 취소 사유·행위자, 생성·수정 시각까지 노출했다. 부모와 항목은 생성 시각과 ID 순으로 안정 정렬한다.
- PATCH/DELETE의 정확한 JSON 필드, 양의 정수 수량, canonical ISO 버전, 중복 항목/variant, 활성 메뉴와 옵션 소속을 순수 검증으로 고정했다. 누락·추가 sibling 버전은 409 충돌로 처리한다.
- 새 participant route는 active session, 주문 존재, 소유권/P8, payload/catalog, 당일 여부, 전체 sibling 처리 상태, 버전 순서로 응답한다. P8은 기존 조회는 유지하고 POST/PATCH/DELETE만 `ORDER_FORBIDDEN`으로 막는다.
- 수정은 원본 전체 항목에 `participant_edit` 취소 이력을 남긴 뒤 별도 비어 있지 않은 부모를 생성한다. 취소는 `participant_cancel` 이력만 남기며 부모와 snapshot을 삭제하거나 수량을 제자리 수정하지 않는다.
- 전체 sibling 비교·조건부 취소·replacement 생성은 기존 serializable transaction 안에서 실행한다. 스키마와 기존 추가 주문 POST 의미는 바꾸지 않았다.

## 검증

- failing-first 순수 계약 테스트를 추가한 뒤 `EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/unit npm run test:unit` — PASS, 54/54.
- 계획의 exact integration command — PASS. 401/404/403/400/409 우선순위, unknown/inactive/foreign option, P1·P2·P3 소유권, P8 read-only, 원본 snapshot/시각 보존, 수정 후 취소, authoritative `current`, 동시 PATCH 200/409 한 건씩을 일회용 PostgreSQL에서 확인했다.
- 동시 PATCH의 패자는 Prisma serializable write-conflict 재시도를 거쳐 409가 됐고, 새 부모는 정확히 하나만 생성됐다.
- `npx tsc --noEmit --incremental false` — PASS.
- 변경 TypeScript 9개 파일 ESLint — PASS, warning 0.
- TypeScript no-excuse checker — PASS, 9 files, violation 0. plugin script의 임시 workspace 복사본은 실행 직후 제거했다.
- `git diff --check`와 `git diff -- prisma/schema.prisma` — PASS, schema diff 없음.
- 등록 `build:qa`는 Turbopack 자식 프로세스가 QA import 이름을 `tsx `로 해석하는 harness 오류로 중단됐다. 코드 빌드는 `NEXT_TELEMETRY_DISABLED=1 CHECKPOINT_DISABLE=1 npm run build -- --webpack`으로 재검증해 compile, TypeScript, 32 static pages를 통과했고 새 `/api/meetings/[id]/orders/[orderId]` route가 포함됐다.

## 실제 HTTP 확인

- fixed synthetic session과 `127.0.0.1:3100` production server를 사용해 curl로 직접 호출했다.
- 무인증 DELETE 401, 참가자 GET 200, 전체 PATCH 200, replacement DELETE 200을 확인했다. 원본 2개 항목은 수정 이력으로 남고 replacement 1개 항목은 별도 취소 이력으로 남았다.
- 실제 Kakao 로그인이나 외부 navigation은 실행하지 않았다. 서버 종료 후 QA PostgreSQL container와 volume을 `qa:db:down`으로 제거했다.

## 다음 범위

- 검색·카테고리 이동·검토 단계·제출 이력 UI는 Todo 10에서 이 계약을 소비한다.
- shop/admin fulfillment의 별도 상태 전이와 cross-domain race는 계획대로 Todo 6 범위에 남긴다.
