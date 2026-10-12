# Surfing

Next.js 기반의 서핑 모임 관리 앱이다. 홈 화면에서 달력, 모임 상세, 참가 신청, 신청 현황, 관리자용 정산 현황까지 한 흐름으로 처리하고, 프로필과 관리자 기능을 함께 제공한다.

## 주요 화면
- `/` 홈 및 메인 일정/신청 흐름
- `/profile` 프로필 편집 및 동반인 관리
- `/settlement` 로그인 사용자 기준 개인 정산 확인
- `/meeting/create` 비정기 모임 생성
- `/admin/*` 관리자 화면

## 개발 메모
- 인증은 카카오 로그인 기반이다.
- 프로필 이미지는 브라우저에서 먼저 압축한 뒤 업로드한다.
- 운영에서는 `BLOB_READ_WRITE_TOKEN`을 설정해 프로필 이미지를 Vercel Blob에 저장한다.
- 로컬 개발에서 `BLOB_READ_WRITE_TOKEN`이 없으면 프로필 이미지는 `public/uploads/` 아래에 저장된다.
- 관리자 보호는 `src/proxy.ts`에서 처리한다.
- 참가 옵션 가격 안내 문구는 관리자 설정과 `/api/settings/public` API를 통해 노출된다.
- 비용 책정은 `/admin/pricing`, 회차별 추가/차감 정산은 `/admin/meetings/[id]/settlement`에서 관리한다.
- 홈 헤더의 종 아이콘은 `알림 센터`를 열고, 공지와 정산 알림을 같은 리스트에서 보여준다.
- 정산 알림은 총 비용, 토스 송금 딥링크, 계좌번호 복사, 트립 정보와 비용 발생 사유를 함께 보여준다.
- 정산 알림에서 `토스로 송금` 또는 `계좌번호 복사`를 누르면 해당 회차 정산을 확인한 것으로 기록한다.
- 관리자 계정은 홈 모임 상세에서 `정산 현황` 탭을 추가로 보고, 미확인/확인 수신자를 바로 확인할 수 있다.
- 브랜드 토큰과 카드/패널/헤더/옵션 외곽선 스타일은 `src/app/globals.css`에서 관리한다.
- 외곽선 조정이 필요하면 컴포넌트별 JSX보다 `brand-card*`, `brand-panel*`, `brand-choice*`, `brand-tab-*` 클래스를 먼저 수정한다.
- 회원 삭제 후 stale 쿠키로 자동 재생성되지 않도록 `src/lib/active-session.ts`가 `DeletedKakaoId`와 `User`를 함께 확인한다.

## 실행
```bash
npm install
npm run dev
```

## 로컬 개발 모드 (카카오 로그인 우회)
운영 DB를 건드리지 않도록 로컬 PostgreSQL(127.0.0.1:54329/surfing_dev)에 운영 데이터 사본을 올려 개발한다.

```bash
npm run db:backup:prod   # 운영 DB → ~/surfing-backups/<타임스탬프>/ (읽기 전용)
npm run dev:db:restore   # 가장 최근 완료 백업을 로컬 DB에 덮어쓰기 (경로 인자로 특정 백업 지정 가능, 아직 운영에 적용 안 된 scripts/deploy/*.sql 도 차례로 적용)
npm run dev
```

- `.env.development.local`에 로컬 DB 주소와 `DEV_AUTH_BYPASS="1"`을 둔다 (git 미추적).
- 우회가 켜지면 모든 카카오 로그인 버튼이 `/dev/login`으로 이동하고, 기존 회원을 골라 로그인하거나 새 회원으로 가입할 수 있다.
- 관리자 화면은 ADMIN 회원으로 로그인하면 자동 인증된다. 비밀번호 로그인은 `.env.development.local`의 `ADMIN_PASSWORD`를 쓴다.
- 우회는 `next dev` + `DEV_AUTH_BYPASS=1` + loopback DB 조건이 모두 맞을 때만 켜진다. Vercel 배포나 원격 DB 연결에서는 항상 꺼진다.
- 백업은 `supabase login` 후 `supabase link --project-ref vkskxsbybvkcxsyockxz`가 되어 있어야 한다.
- Supabase 풀러는 새 연결 인증이 가끔 시간 초과(`EAUTHQUERY`)된다. 백업은 운영 DB에 두 번만 접속하고 각각 다시 시도하며, 모든 행 수 검증이 끝나야 `COMPLETE` 표시를 남긴다. 표시가 없는 백업은 쓰지 않는다.
- 스키마만 있는 빈 DB가 필요하면 `npm run dev:db:reset`.
- 백업 복구: `pg_restore --no-owner --no-privileges -d <대상 DB URL> ~/surfing-backups/<타임스탬프>/public.dump`

## 모임 운영 흐름
1. 모집: 회원은 강습 여부와 (강습 안 하면) 장비 대여 필요만 고른다. 운영진 화면 상단에 확정·강습·동반·대기 인원이 보인다.
2. 모임 후 이용 기록: `실제 이용 확인`에서 `신청 내용으로 한 번에 채우기` → 다르게 이용한 사람만 수정. 불참자만 `불참 처리`(참가비는 그대로 청구).
3. 샵 수량 확인: 샵 운영자는 항목별 합계를 보고 `수량 맞음`. 이용 내역이 바뀌면 자동으로 다시 확인 대기가 된다(청구를 막지는 않음).
   - 샵 계정(SHOP_OWNER)은 앱을 열면 `/`에서 바로 주문판(`/shop`)으로 간다. 회원 화면은 내 정보 → 화면 전환(`/?view=member`)으로 본다.
   - 확인이 남은 모임은 주문판 맨 위에 `M/D 장비 수량 확인` 배너로 뜬다(모임 종료 후, 청구 공개 전, 확정된 이용 기록이 있을 때).
4. 청구: 식음료·이용 확인이 끝나면 `금액 확인하고 청구 공개` 한 번으로 공개(공개 시각이 곧 청구 상태, 신청 자동 마감). 정정은 `청구 정정`.
5. 입금: 입금 대조 화면에서 자동 확인, 나머지만 수동 확인.
6. 샵 지급: 장비와 식음료를 합친 금액을 한 번 기록하고 마감.

### 데이터 구조 요약
- 모임(`Meeting`) 하나가 당일 또는 1박 일정을 맡는다. 1박은 `endDate`가 있고, 날마다 다른 것(실제 이용 `ParticipantSurfUsage.day`, 식음료 지원 한도)은 몇째 날로 나눈다. 식음료 주문은 주문 날짜로 날을 가린다.
- 참가비·숙박비는 모임마다 저장한다(`regularFee`·`companionFee`·`lodgingFee`). 요금 설정의 기본 참가비는 새 모임에 미리 채우는 값일 뿐이다.
- 참가자(`Participant`)는 모임당 한 줄. 둘째 날 장비 신청(`hasDay2Rental`), 불참(`absentAt`), 실제 이용 기록(`usageSubmittedAt`)·확정(`usageConfirmedAt`)을 함께 가진다.
- 이용 항목표(`SurfUsageItem`)는 모든 모임 공통. 정회원 가격(`regularPrice`)은 0 = 동호회 지원, 금액 = 고정, 비우면 샵 가격. 동반인은 항상 샵 가격. 기록할 때 가격을 함께 저장하므로 항목표를 바꿔도 지난 기록은 그대로다.

### 1박 모임
- 1박 참가비는 둘째 날을 포함한 총액(정회원·동반인)이며 한 번만 청구한다. 생성 시 당일 참가비 + 둘째 날 25,000원으로 미리 채워지고, 청구 공개 전까지 모임 화면의 `참가비`에서 고칠 수 있다.
- 숙박비는 숙박 대상자에게만 1인 금액으로 한 번 청구한다. 신청 후에도 운영진이 참가자 카드에서 `숙박 포함/제외`로 바꾼다.
- 장비 대여 지원은 정회원 첫 이용일만 적용되고 그 뒤 날은 샵 가격이다. 하루만 오는 사람은 운영진이 조정 금액으로 처리한다.
- 실제 이용은 사람마다 1일차·2일차를 한 화면에서 기록하고 한 번 확정한다.

## 입금 대조 (`/admin/deposits`)
정산 계좌 주인의 안드로이드 폰이 은행 입금 알림을 `POST /api/bank/deposits`로 전달하면 미확인 청구와 자동으로 맞춘다.

- 자동 확인은 "이름(또는 기억한 입금자명) + 금액이 정확히 일치하는 청구가 1건" 또는 "한 사람의 미확인 청구 합계와 정확히 일치"일 때만 한다. 나머지는 `확인 필요`에 후보와 함께 남는다.
- 자동 확인된 입금은 `verifiedByKakaoId = "bank-auto"`로 기록되며 `되돌리기`로 취소할 수 있다. 되돌린 입금은 다시 자동 확인되지 않는다.
- 청구 재공개·조정 등으로 입금 확인이 풀리면, 다음 알림 수신이나 화면 진입 때 연결된 입금을 풀고 다시 대조한다.
- 알림 전달 폰(운영진 안드로이드 2~3대 권장)마다 토큰을 따로 발급한다(`Authorization: Bearer ...`, DB에는 해시만 저장). 폰별 마지막 수신 시각을 보고 개별로 연결을 끊을 수 있다.
- 여러 폰이 같은 알림을 보내도 3분 안의 같은 문구는 한 건으로 저장한다(동시 요청은 DB 잠금으로 직렬화).
- 알림 문구 해석은 `src/lib/bank-deposit-parse.ts`. 실제 은행 알림 문구가 다르면 원문이 `BankDeposit.rawText`에 남으니 그 문구로 테스트를 추가하고 패턴을 고친다.

## 운영 배포 순서
배포 빌드는 `prisma generate && next build`만 하므로 운영 DB 스키마는 자동으로 바뀌지 않는다. 스키마 변경은 아래 순서로 직접 적용한다.

1. `npm run db:backup:prod` — 운영 백업 (적용 스크립트는 1시간 안의 `COMPLETE` 백업이 없으면 멈춘다)
2. 추가분 SQL 만들기: 백업을 로컬 DB(`prod_shadow`)에 복원 → `npx prisma migrate diff --from-url <prod_shadow> --to-schema-datamodel prisma/schema.prisma --script` → `scripts/deploy/<날짜>-*.sql`에 BEGIN/COMMIT으로 감싸 저장. 새 테이블에는 RLS를 켠다.
3. 리허설: `scripts/deploy/apply-prod-schema.sh --rehearse <prod_shadow URL> <파일>.sql` → 같은 diff 명령에 `--exit-code`로 차이 없음 확인
4. `scripts/deploy/apply-prod-schema.sh scripts/deploy/<파일>.sql` — 오래 열린 트랜잭션을 먼저 보여 주고(끊긴 백업 세션이면 `kill` 입력으로 정리, 앱 세션이면 멈춤), `apply` 입력 후 한 트랜잭션으로 적용. `lock_timeout` 5초라 잠금을 못 얻으면 아무것도 바뀌지 않고 취소된다.
5. `main` 병합 → Vercel 운영 배포
6. 되돌리기: 코드는 Vercel에서 이전 배포로 롤백. 추가만 한 스키마는 이전 코드와 함께 써도 문제없으므로 그대로 둔다.

## 배포 전 확인
- `DATABASE_URL`
- `SESSION_SECRET`
- `KAKAO_CLIENT_ID`
- `KAKAO_REDIRECT_URI`
- `BLOB_READ_WRITE_TOKEN` (Vercel Blob 프로필 이미지 업로드 사용 시)
