# AGENTS.MD — 작업 기록 및 에이전트 가이드

## 프로젝트 개요

서핑 동호회 모임 관리 웹앱. Next.js 16 + Prisma + 카카오 로그인 기반.

---

## 작업 이력

### 2026-04-03 세션 1
- BMW 디자인 시스템 (`feature/bmw-ui`) 적용 시도
  - `tailwind.config.ts`, `globals.css`, `page.tsx` 수정
  - BMW 브랜드 색상, sharp corner, 폰트 설정 적용
  - 결과: 사용자 요청으로 **원래 UI로 롤백**

### 2026-04-03 세션 2 — Stitch UI 통합 (현재)
- 원래 코드(main 브랜치) 기반으로 새 브랜치 `feature/update-home-logo` 생성
- **로고 교체**: `logo.svg` → `logo.png` (전체 컴포넌트 일괄 적용)
- **Stitch 프로젝트 생성**: ID `3824528270167795906` (surfing)
- **DB 전환**: `schema.prisma` provider를 `postgresql` → `sqlite`로 변경 (로컬 개발용)
- **Stitch UI 코드 통합** (화면 ID: `e57a2597f3a64c469981074c61b13289`):

#### 변경된 파일
| 파일 | 변경 내용 |
|------|----------|
| `tailwind.config.ts` | Stitch 색상 토큰 전면 교체 (sky blue 팔레트, 폰트, 반경) |
| `src/app/layout.tsx` | Plus Jakarta Sans, Inter, Material Symbols 폰트 추가 |
| `src/components/schedule/SchedulePageContent.tsx` | Stitch frosted glass 헤더, 검은색 로그인 버튼(미로그인) |
| `src/components/schedule/ScheduleView.tsx` | 달력을 현재 달 동적 연동, 날짜 클릭 모임 상세, "비정기모임 생성하기" 버튼 추가 |  
| `src/app/meeting/create/page.tsx` | Stitch 디자인 헤더/폼 스타일 적용 |

#### 주요 기능 구현
- ✅ 달력 현재 달 자동 연동 + 월 이전/다음 네비게이션
- ✅ 날짜에 모임 도트 인디케이터 표시 (파란 점)
- ✅ 날짜 클릭 시 해당 날 모임 상세 카드 표출
- ✅ "🏄 모임 참가" CTA 버튼 → `/meeting/[id]` 이동
- ✅ "비정기모임 생성하기" 버튼 → `/meeting/create` (로그인 회원 누구나)
- ✅ 미로그인 시 검은색 로그인 버튼
- ✅ 관리자 링크는 ADMIN 권한일 때만 노출

---

## 아키텍처 메모

### 컴포넌트 구조
```
src/
├── app/
│   ├── page.tsx                    # → SchedulePageContent 렌더
│   ├── layout.tsx                  # 전역 폰트/스크립트
│   ├── meeting/
│   │   ├── [id]/page.tsx           # 모임 신청 페이지
│   │   └── create/page.tsx         # 비정기 모임 생성 (회원용)
│   ├── profile/page.tsx            # 내 프로필
│   └── admin/                      # 관리자 대시보드
└── components/
    └── schedule/
        ├── SchedulePageContent.tsx # 서버 컴포넌트 (DB 조회)
        └── ScheduleView.tsx        # 클라이언트 컴포넌트 (인터랙션)
```

### 데이터 흐름
- `SchedulePageContent` (서버): DB에서 meetings, pinnedNotice 조회 → props로 전달
- `ScheduleView` (클라이언트): 달력/목록 뷰 상태 관리, 날짜 선택 인터랙션

### DB 로컬 설정
- `./prisma/dev.db` SQLite 파일 사용
- `DATABASE_URL="file:./dev.db"` (.env)
- `npx prisma db push` 로 스키마 동기화

---

## 에이전트 주의사항

- `killall node` 명령은 IDE를 리셋시킴 → **절대 사용 금지**
- 브랜치: 현재 `feature/update-home-logo`에서 작업 중
- Stitch Project ID: `3824528270167795906`
- 로컬 서버: 3001 포트 (3000은 IDE 점유)
