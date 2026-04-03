# Surfing Club Management

동호회 모임 참가 신청 및 관리 웹 애플리케이션.

## 기술 스택

- **Framework**: Next.js 16 (App Router) + TypeScript
- **DB**: Prisma + SQLite (개발) / PostgreSQL (운영)
- **Auth**: 카카오 로그인 (OAuth)
- **스타일**: Tailwind CSS (Stitch 디자인 시스템 기반)

## 주요 기능

- 📅 월별 달력 뷰에서 모임 일정 확인
- 🏄 모임 참가 신청 / 취소
- ➕ 비정기 모임 생성 (로그인 회원 누구나)
- 👤 내 프로필 / 참가 이력 확인
- 🔐 관리자 대시보드 (ADMIN 권한)

## 디자인 시스템

Google Stitch로 디자인된 UI를 기반으로 적용:
- **Primary Color**: Sky Blue (`#0284c7`)
- **폰트**: Plus Jakarta Sans (헤드라인), Inter (본문)
- **아이콘**: Material Symbols Outlined
- **헤더**: Frosted glass (backdrop-blur)

## 로컬 실행

```bash
npm install
npx prisma db push
npm run dev
```

`.env` 파일에 `DATABASE_URL`, `KAKAO_CLIENT_ID`, `SESSION_SECRET` 등을 설정해야 합니다.

## 브랜치 전략

| 브랜치 | 설명 |
|--------|------|
| `main` | 운영 코드 |
| `feature/update-home-logo` | Stitch UI 적용 + 로고 교체 |
| `feature/bmw-ui` | (이전) BMW 디자인 시스템 시도 |

## Stitch 프로젝트

- **Project ID**: `3824528270167795906`
- 메인 화면 및 달력 화면 Stitch 연동 완료
