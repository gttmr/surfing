# Surfing 작업 정리

## 현재 구조
- 메인 페이지 `/`가 일정 확인, 모임 상세, 참가 신청, 신청 현황, 관리자용 정산 현황까지 모두 담당한다.
- `/meeting/[id]`는 직접 상세를 렌더링하지 않고 `/?date=YYYY-MM-DD`로 돌려보낸다.
- `/meeting/create`는 비정기 모임 생성 전용 화면으로만 남아 있고, 홈의 빈 날짜 상태에서 진입한다.
- 프로필은 `/profile`, 관리자 기능은 `/admin/*` 아래로 정리돼 있다.
- 홈/프로필/참가 폼은 거대 파일 하나에 상태와 JSX를 모두 두지 않고, 상태 훅과 섹션 컴포넌트로 분리한 구조를 사용한다.

## 홈/모임 흐름
- 홈은 월간 달력과 선택 날짜 기반 상세 흐름을 사용한다.
- 초기 진입 시 오늘 기준 가장 가까운 모임을 자동 선택한다.
- 홈 첫 렌더는 서버가 이미 알고 있는 사용자/선택 모임/신청 상태를 내려주고, 클라이언트에서 같은 데이터를 다시 연속 fetch하지 않도록 정리했다.
- 모임 상세는 기본적으로 `참가하기` / `신청현황` 탭으로 나뉘고, 관리자에게만 `정산 현황` 탭이 추가로 보인다.
- `정산 현황` 탭은 홈에서 read-only 요약만 보여주고, 기존 `/admin/meetings/[id]/settlement`는 편집 전용 화면으로 유지한다.
- `신청현황` 탭 우측 badge는 두 자릿수까지 그대로 표시하고, 하위 리스트는 번호 대신 프로필 사진 또는 기본 아바타를 보여준다.
- 관리자 `정산 현황` 탭 badge는 미확인 수신자 수를 뜻하며, 본문은 `미확인` / `확인`으로 나뉘고 가나다순으로 정렬한다.
- 동반인 시스템 메모(`~~의 동반`)는 숨기고, 일반 비고만 노출한다.
- 이미 신청한 정회원은 기본 상태에서 완료 카드와 `참가 내역 보기` CTA만 본다.
- `참가 내역 보기`를 열면 본인 신청 옵션/비고 수정, 동반인 참가 관리, 참가 취소를 같은 edit mode 안에서 처리한다.
- 헤더에는 작은 종 아이콘만 두고, 별도 상단 공지 배너는 쓰지 않는다.
- 종 아이콘을 누르면 `알림 센터` 팝업이 열리고, 공지사항과 정산 알림을 같은 리스트에서 펼쳐 볼 수 있다.
- 정산 알림은 총 비용을 상단에 크게 보여주고, `토스로 송금` / `계좌번호 복사` CTA와 트립 정보, 비용 발생 사유를 함께 노출한다.
- 관리자 설정에 입금 계좌가 있으면 정산 알림에서 송금/복사 흐름을 바로 사용할 수 있다.
- 정산 확인 여부는 알림 센터에서 `토스로 송금` 또는 `계좌번호 복사` CTA를 눌렀을 때 기록한다.
- `신청현황` polling은 상시가 아니라 해당 탭에서만 돌도록 제한했다.

## 참가 옵션
- 신청 옵션은 `강습+장비대여`, `장비 대여만`, `셔틀 버스` 세 가지다.
- `강습+장비대여`와 `장비 대여만`은 배타적으로 동작한다.
- `셔틀 버스`는 독립적으로 추가 선택된다.
- 본인 신청, 동반인 신청, 기존 동반인 수정, 신청 현황, 관리자 상세 화면까지 같은 용어와 같은 상태 표현을 쓴다.
- 가격 안내 문구는 관리자 설정에서 수정 가능하고, 공개 읽기용 API는 `/api/settings/public`이다.

## 프로필
- 프로필 사진은 브라우저에서 먼저 리사이즈/압축한 뒤 업로드한다.
- 커스텀 프로필 이미지를 우선 사용하고, 없으면 서핑 이모지 기반 기본 아바타를 고정 선택해 표시한다.
- 기본 아바타 원형 셸은 흰 배경과 하늘색 보더(`#7FB5FF`)를 쓴다.
- 프로필 화면은 `기본 정보` / `동반인 관리` 탭 구조다.
- 상단 카메라 버튼으로 즉시 사진을 바꿀 수 있고, 별도의 “카카오 사진으로 복원” 흐름은 제거했다.
- 프로필 화면 우측 상단에는 썸네일 대신 로그아웃 버튼만 둔다.
- 모바일에서는 하단 고정 `프로필 저장하기` 버튼을 사용해 첫 화면에서 바로 저장 액션이 보이게 했다.
- 프로필 화면의 초기 상태와 액션은 `useProfilePageState`로 분리했고, 헤더/기본 정보/동반인 관리/모바일 저장 버튼은 별도 섹션 컴포넌트로 나눴다.

## 인증/운영
- 카카오 SDK는 `next/script`로 로드한다.
- `/meeting/create`의 `useSearchParams()`는 `Suspense` 내부로 옮겨 Vercel prerender 오류를 막았다.
- 프로필 진입 시 DB에 사용자 row가 없으면 자동으로 `upsert`해서 화면이 깨지지 않게 한다.
- 다만 삭제된 회원의 stale session 쿠키로 사용자가 다시 생성되지 않도록 `src/lib/active-session.ts`를 추가했다.
- `DeletedKakaoId`에 남아 있는 kakaoId는 홈/프로필/참가/정산/동반인 관련 API에서 비활성 세션으로 취급한다.
- 카카오 콜백은 `DeletedKakaoId`가 남아 있으면 기존 `User` row가 있어도 재가입으로 간주해 setup 흐름으로 보낸다.
- 관리자 보호 라우팅은 Next 16 경고를 피하기 위해 `middleware.ts` 대신 `proxy.ts`를 사용한다.
- Firebase Hosting 앞단을 쓰므로 사용자/관리자 세션 쿠키는 모두 `__session` 기준으로 동작한다.

## 구조 정리 메모
- `src/components/meeting/SignupForm.tsx`는 렌더 분기 조립만 맡고, 실제 상태/부트스트랩/mutation은 `src/components/meeting/useSignupFormState.ts`로 분리했다.
- 참가 폼의 guest/동반인/기존 신청/신규 신청 패널과 공용 옵션 UI는 각각 `src/components/meeting/signup-form-panels.tsx`, `src/components/meeting/signup-form-controls.tsx`로 분리했다.
- 홈 랜딩의 선택 날짜/탭/알림 센터/정산 알림 상태는 `src/components/landing/useLandingState.ts`로 분리했다.
- 홈 랜딩의 헤더/알림 센터/달력/탭 JSX는 `src/components/landing/landing-page-sections.tsx`로 분리했다.
- 홈 초기 선택 계산과 서버에서 내려주는 홈 전용 타입은 `src/lib/home-view.ts`, `src/lib/landing-types.ts`에 모아뒀다.
- 홈에서 관리자만 보는 정산 read-only 요약은 `src/app/api/admin/meetings/[id]/settlement-status/route.ts`와 `src/lib/admin-page-data.ts`에서 제공한다.
- 프로필은 `src/app/profile/page.tsx`가 화면 조립만 맡고, 실제 로딩/저장/동반인 액션은 `src/components/profile/useProfilePageState.ts`에 둔다.
- 프로필 헤더/설정 모달/기본 정보/동반인 관리/모바일 저장 버튼은 `src/components/profile/profile-page-sections.tsx`로 분리했다.

## 디자인 시스템
- 브랜드 토큰은 `#C4DDFF`, `#7FB5FF`, `#001D6E`, `#FFFFFF` 중심으로 정리했다.
- 일반적인 성공/에러/경고 상태색만 의미 기반 색을 유지한다.
- 버튼, 카드, 칩, 입력창, 읽기 전용 입력창은 전부 공통 CSS 토큰 클래스를 사용한다.
- 외곽선과 surface 계열은 `src/app/globals.css`의 공통 클래스로 최대한 모아두었다.
- 주요 공통 클래스:
  - `brand-card`, `brand-card-soft`, `brand-panel`, `brand-panel-white`, `brand-inset-panel`
  - `brand-header-surface`, `brand-alert-info`, `brand-highlight-panel`
  - `brand-choice`, `brand-choice-indicator`, `brand-select-card`, `brand-list-item`
  - `brand-tab-bar`, `brand-tab-underline-active`, `brand-tab-underline-inactive`
- 홈 달력, 로그인 전 모임상세, 참가하기 탭 카드, 프로필 카드, 프로필 헤더, 옵션 선택 UI는 위 클래스를 우선 사용하도록 정리했다.
- 관리자 레이아웃, 대시보드, 모임 관리, 회원 관리, 설정 화면도 같은 카드/입력/버튼/칩 체계를 쓰도록 정리했다.
- 관리자에 `비용 책정하기` 탭을 추가해 기본 참가비, 강습비, 장비 대여비를 정회원/동반인별로 설정할 수 있게 했다.
- 관리자 루트 `/admin`은 대시보드 대신 `메시지 관리` 화면으로 바꿔 공지 작성/고정/수정/삭제와 운영 메시지 바로가기를 담당한다.
- 관리자 모임 상세에는 `정산 관리` 링크가 있고, 홈의 관리자 전용 `정산 현황` 탭에서도 같은 편집 화면으로 바로 이동할 수 있다.
- `/admin/meetings/[id]/settlement`는 수신자별 금액 조정과 정산 오픈/닫기 편집 전용 화면으로 유지한다.
- 관리자 설정에는 정산 입금 계좌(은행명/계좌번호/예금주)를 저장하는 필드가 있다.
- 다음에 외곽선 두께/색/그림자를 바꿀 때는 컴포넌트보다 `src/app/globals.css`를 먼저 보면 된다.
- `동반인` 칩만 별도 스타일(`brand-chip-companion`)로 `#FEE2C5`를 유지한다.

## 데이터/DB
- `Participant.hasRental` 필드로 `장비 대여만` 옵션을 저장한다.
- `ParticipantChargeAdjustment`로 참가자별 추가/차감 정산 항목을 저장한다.
- `Meeting.settlementOpen`으로 해당 회차의 정산 노출 여부를 제어한다.
- `SettlementConfirmation`으로 수신자별 정산 확인 완료 여부를 저장한다.
- 프로필 이미지 저장은 `customProfileImageUrl`을 사용한다.
- 정산 규칙은 `src/lib/pricing.ts`에서 관리한다.
- 동반인이 카카오 연동된 경우는 그 동반인에게 직접 정산 그룹이 생기고, 카카오 연동이 없는 동반인은 정회원(owner) 정산 그룹에 합산되도록 설계했다.
- `Notice` 모델은 홈 상단 pinned 공지와 관리자 메시지 관리 화면에서 함께 사용한다.
- `DeletedKakaoId` 모델은 관리자 회원 삭제 이후 stale session 재생성을 막는 기준값으로도 사용한다.
- 프로필 업로드 저장 우선순위는 `GCS_PROFILE_IMAGE_BUCKET` -> `BLOB_READ_WRITE_TOKEN` -> `public/uploads/` 순서다.

## 저장소 정리
- Stitch 산출물 성격의 데모 페이지 `/upload-demo`는 제거했다.
- `docs/index.html`은 GitHub Pages 발행용 정적 파일로 유지한다.
- 미사용 자산 `public/logo.svg`는 제거했다.
- 빌드 경고를 유발하던 `middleware.ts`는 `src/proxy.ts`로 교체했다.

## 브랜치/배포
- 기준 작업 브랜치: `codex/landing-meeting-flow-main`
- 최신 반영 커밋은 `main`과 동일하게 유지한다.
- 현재 운영 배포는 Firebase Hosting(`sds-surfing.web.app`) -> Cloud Run(`sds-surfing`) 구조다.
- 운영 리소스와 이사 대비 메모는 `docs/cloud-run-gcs-notes.md`에 별도로 정리했다.
