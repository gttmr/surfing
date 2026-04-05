# Surfing

Next.js 기반의 서핑 모임 관리 앱이다. 홈 화면에서 달력, 모임 상세, 참가 신청, 신청 현황을 한 흐름으로 처리하고, 프로필과 관리자 기능을 함께 제공한다.

## 주요 화면
- `/` 홈 및 메인 일정/신청 흐름
- `/profile` 프로필 편집 및 동반인 관리
- `/meeting/create` 비정기 모임 생성
- `/admin/*` 관리자 화면

## 개발 메모
- 인증은 카카오 로그인 기반이다.
- 프로필 이미지는 브라우저에서 먼저 압축한 뒤 업로드한다.
- 관리자 보호는 `src/proxy.ts`에서 처리한다.
- 참가 옵션 가격 안내 문구는 관리자 설정과 `/api/settings/public` API를 통해 노출된다.
- 브랜드 토큰과 카드/패널/헤더/옵션 외곽선 스타일은 `src/app/globals.css`에서 관리한다.
- 외곽선 조정이 필요하면 컴포넌트별 JSX보다 `brand-card*`, `brand-panel*`, `brand-choice*`, `brand-tab-*` 클래스를 먼저 수정한다.

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
- `BLOB_READ_WRITE_TOKEN` (프로필 이미지 업로드 사용 시)
