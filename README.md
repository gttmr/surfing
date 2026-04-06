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
- Cloud Run 운영에서는 `GCS_PROFILE_IMAGE_BUCKET`을 설정해 프로필 이미지를 GCS에 저장한다.
- 로컬 개발에서 `GCS_PROFILE_IMAGE_BUCKET`과 `BLOB_READ_WRITE_TOKEN`이 모두 없으면 프로필 이미지는 `public/uploads/` 아래에 저장된다.
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

## 배포 전 확인
- `DATABASE_URL`
- `SESSION_SECRET`
- `KAKAO_CLIENT_ID`
- `KAKAO_REDIRECT_URI`
- `NEXT_PUBLIC_KAKAO_JS_KEY`
- `GCS_PROFILE_IMAGE_BUCKET` (Cloud Run 프로필 이미지 업로드 사용 시)
- `BLOB_READ_WRITE_TOKEN` (기존 Vercel Blob 호환 사용 시)
