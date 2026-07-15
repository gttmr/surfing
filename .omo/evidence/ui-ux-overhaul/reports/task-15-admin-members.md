# Todo 15 — 관리자 회원 검색·상세·편집 분리

## 소스 재현

- 시작 `HEAD 48a86ab`의 `AdminMembersPageClient`는 검색 결과의 각 행 아래에 상세와 편집 동작을 펼쳤다. 역할·회원 유형 변경은 select 변경 즉시 PUT했고, 저장 전 초안·취소·실패 복구 상태가 없었다.
- 검색은 이름·카카오 ID·연락처만 지원했고 역할·회원 유형·상태 필터와 별도 no-result 복구 동작이 없었다. 35개 fixture에서 목록 맥락과 상세 확인이 같은 긴 문서 흐름에 섞였다.
- 삭제는 native `confirm()` 뒤 실행됐고, 역할·회원 유형·패널티의 허용 범위와 마지막 관리자 보호가 서버 경계에 명시되지 않았다.

## 구현 범위

- 목록을 이름/ID/연락처 검색과 역할·회원 유형·상태 필터로 줄이고, 결과 수와 검색 조건 초기화가 있는 전용 목록 패널로 분리했다.
- 행 선택은 데이터를 변경하지 않고 별도 detail sheet를 연다. sheet 안에서도 기본 상태는 읽기이며 `편집`을 눌러야 역할·유형·연락처·패널티 초안이 생긴다.
- 저장 성공 전에는 목록과 상세 snapshot을 바꾸지 않는다. client validation 또는 400/403/404/409/500 실패는 sheet와 초안을 유지하고 복구 문구를 표시한다.
- 닫기 중 dirty 초안은 별도 discard 확인을 거치고, 삭제는 대상 이름과 정리 범위를 명시한 공용 Dialog를 거친다. 취소 시 원래 action, sheet 종료 시 원래 회원 행으로 focus를 복원한다.
- API는 허용 role/type, 연락처, 0~999 패널티, 양의 정수 ID를 파싱한다. 식별된 Kakao ADMIN의 자기 강등/삭제는 `SELF_ADMIN_PROTECTED` 403, 마지막 ADMIN을 없애는 강등/삭제는 serializable transaction 안에서 `LAST_ADMIN_PROTECTED` 409로 막는다. 일반 CAS/409 체계는 추가하지 않았다.

## 정적 검증

- `node --import tsx --test src/lib/admin-members.test.ts` — PASS, 7/7.
- `npx tsc --noEmit --incremental false` — PASS.
- Todo 15 changed-file ESLint — PASS, TypeScript 9개 파일.
- TypeScript no-excuse checker — PASS, 9개 파일, violation 0. plugin script는 workspace `.tmp/qa`에 일시 복사해 실행하고 즉시 제거했다.
- `git diff --check` — PASS.
- 순수 LOC — production 최대 243줄, E2E spec 171줄로 변경 TypeScript 9개 모두 250줄 이하이다.
- 최종 `npm run build -- --webpack` — PASS, Next.js 16.2.1 compile·TypeScript·32 static pages 완료.

## 런타임·시각 검증

- 등록 QA DB lifecycle에서 up/assert/reset/assert를 통과하고, fixed synthetic session과 `127.0.0.1:3100` production standalone server로 실행했다. `start:qa`와 E2E target이 동시에 owner lock을 가질 수 없어 server만 동일 fixed 환경으로 직접 기동했고, browser spec은 등록 target을 유지했다.
- 첫 mobile-390 실행은 1/4였다. 검색 input/list, 편집 role/filter, 삭제 취소/close action을 부분 일치 locator가 함께 잡은 테스트 모호성이었다. 실제 접근성 트리를 확인하고 searchbox·exact locator로 좁혔으며, 편집 form의 label을 control 바깥의 명시적 `htmlFor` 연결로 바로잡았다.
- 두 번째 실행은 2/4였다. 결과 없음 상태에서 `검색 조건 지우기`가 header와 empty action에 중복됐고, `penaltyCount` 오류 focus ID가 실제 `admin-member-penalty`와 달랐다. 빈 상태 action 하나만 남기고 필드별 focus ID를 명시했다.
- 세 번째 실행은 기능 흐름을 끝까지 통과했지만 상세 highlight panel의 카카오 ID가 `brand-text-subtle`과 조합돼 Axe 3.73:1 serious를 냈다. 해당 강한 표면의 의미 전경색을 상속하도록 로컬 클래스 1개만 제거했다.
- 최종 mobile-390 — PASS, 4/4. clean close와 dirty stay/discard, 검색어·scroll·focus 보존, validation 무요청, 500 초안 유지, real disposable 삭제, P6 자기 보호, P7 일반 수정·마지막 관리자 강등/삭제·동시 강등/삭제를 통과했다.
- fresh DB reset 뒤 최종 mobile-430 — PASS, 4/4. 같은 시나리오와 exact business code를 반복 통과했다.
- 삭제 확인 취소 뒤 target GET은 200, 실제 삭제 뒤 404였고 인접 회원은 유지됐다. 두 ADMIN에 대한 동시 demotion/delete는 응답 200/409 하나씩과 `LAST_ADMIN_PROTECTED`, 최종 ADMIN 정확히 한 명을 확인했다.
- 각 폭 4장씩 총 8개 PNG를 390×844/430×932 RGB 원본으로 직접 확인했다. no-result, 장문 detail sheet, 실패 초안, 장문 이름 삭제 확인에서 CJK clipping·수평 overflow·action/dock 겹침이 없고 계층과 대비가 명확했다. 시각 판정은 GOOD이다.
- 두 최종 run의 Axe serious/critical 결과는 0이다. 외부 Kakao 로그인이나 외부 browser navigation은 실행하지 않았다.

## 남은 범위

- 회원 fixture는 35명으로 pagination을 추가하지 않는다.
- 인증 구조나 일반 보안 체계는 바꾸지 않고 계획에 명시된 관리자 소진 business conflict만 다룬다.
