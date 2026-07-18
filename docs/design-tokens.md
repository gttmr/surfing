# Surfing Design System Contract

이 문서는 현재 구현을 설명하고 후속 UI 리팩터링의 경계를 고정하는 계약이다. 구현 토큰의 단일 원본은 [`src/app/globals.css`](../src/app/globals.css)의 `:root`이며, [`tailwind.config.ts`](../tailwind.config.ts)는 그 값을 노출하는 브리지다. 문서와 코드가 다르면 `:root`를 먼저 확인하고 이 문서를 갱신한다.

## 1. Atmosphere & Identity

Surfing의 현재 시각 언어는 네이비, 스카이 블루, 화이트로 구성된 밝고 단정한 모바일 운영 화면이다. 핵심 행동과 상태가 장식보다 먼저 읽혀야 하며, 사용자는 한 화면에서 지금 할 수 있는 다음 행동 하나를 쉽게 찾아야 한다.

- 현재 원칙: 모바일 우선, 상태 명확성 우선, 읽기와 편집 분리, 중복 정보 최소화, 서버 초기 데이터 우선.
- 현재 브랜드: 네이비는 주요 행동과 강한 선택, 연한 스카이는 정보와 보조 표면, 초록은 성공, 빨강은 위험, 회색은 비활성 상태에만 쓴다.
- 현재 구조: 페이지 컨테이너가 데이터와 상태를 소유하고, 도메인 섹션과 패널은 렌더링을 담당한다. 공용 UI는 `src/components/ui`에만 둔다.
- 리팩터링 경계: 리브랜딩, 데스크톱 레이아웃, 새 아이콘 패키지, 범용 카드·폼 프레임워크를 이 계약만으로 추가하지 않는다.
- 소스 우선순위: `globals.css :root` → 공용 `brand-*` 클래스 → Tailwind 레이아웃 유틸리티 → 이 문서.

## 2. Color

### Core palette

| Token | Current value | Role |
| --- | --- | --- |
| `--color-sky-100` | `#c4ddff` | 연한 정보 표면 |
| `--color-sky-300` | `#7fb5ff` | 강조 표면과 브랜드 경계 |
| `--color-navy-900` | `#001d6e` | 기본 텍스트와 주요 행동 |
| `--color-peach-100` | `#ffffff` | 페이지와 상승 표면 |

### Brand semantics

| Token | Current value | Role |
| --- | --- | --- |
| `--brand-primary` / `--brand-primary-hover` | `var(--color-navy-900)` | 주요 행동과 hover |
| `--brand-primary-foreground` | `var(--color-peach-100)` | 주요 행동 위 전경 |
| `--brand-primary-soft` | `var(--color-sky-100)` | 정보·선택 전 표면 |
| `--brand-primary-soft-strong` | `var(--color-sky-300)` | 활성 보조 표면 |
| `--brand-primary-soft-accent` | `var(--color-peach-100)` | 선택 내부의 밝은 표면 |
| `--brand-primary-border` | `var(--color-sky-300)` | 기본 브랜드 경계 |
| `--brand-primary-border-strong` | `var(--color-navy-900)` | 강한 선택 경계 |
| `--brand-primary-text` / `--brand-primary-text-strong` | `var(--color-navy-900)` | 브랜드 표면 위 텍스트 |
| `--brand-page` | `var(--color-peach-100)` | 페이지 배경 |
| `--brand-surface` | `var(--color-sky-100)` | 기본 브랜드 패널 |
| `--brand-surface-elevated` | `var(--color-peach-100)` | 카드·모달·입력 |
| `--brand-surface-strong` | `var(--color-sky-300)` | 활성 선택 표면 |
| `--brand-text` | `var(--color-navy-900)` | 기본 본문 |
| `--brand-text-muted` | `rgba(0, 29, 110, 0.74)` | 보조 설명 |
| `--brand-text-subtle` | `rgba(0, 29, 110, 0.68)` | 캡션과 낮은 위계 텍스트 |
| `--brand-divider` | `rgba(0, 29, 110, 0.16)` | 기본 경계 |
| `--brand-divider-strong` | `rgba(0, 29, 110, 0.28)` | 강조 경계 |

### Status and domain semantics

| Family | Current tokens and values | Constraint |
| --- | --- | --- |
| Success | `--brand-success: #15803d`; hover `#166534`; surface `#f0fdf4`; strong surface `#dcfce7`; border `#bbf7d0`; text `#166534` | 확정·완료·성공에만 사용 |
| Danger | `--brand-danger` / `--brand-error: #dc2626`; hover `#b91c1c`; surface `#fef2f2`; strong surface `#fee2e2`; inline surface `rgba(254, 202, 202, 0.6)`; border `#fecaca`; strong border `#f87171`; text `#991b1b`; ring `rgba(220, 38, 38, 0.15)` | 실패·삭제·위험에만 사용 |
| Preparing | surface `#fef3c7`; border `#fde68a`; text `#92400e` | 처리 준비 상태에만 사용 |
| Dimmed | surface `#e5e7eb`; border `#9ca3af`; text `#4b5563` | 비활성·읽기 전용에만 사용 |
| Companion | `--brand-companion: #c2580a`; surface `#fee2c5` | 동반인 표시 밖으로 확장 금지 |
| Calendar | sun `#b91c1c`; sat `#1d4ed8` | 달력 요일 표시에만 사용하며 흰 배경의 일반 텍스트 대비를 유지 |

### Focus, overlay, and Tailwind bridge

- 포커스는 내부 흰색 `--brand-focus-inner: #ffffff`과 외부 네이비 `--brand-focus-outer: #001d6e`의 이중 표시를 사용한다.
- 상태색 위 전경은 `--brand-on-status: #ffffff`을 사용한다.
- 오버레이는 `--brand-overlay: rgba(0, 29, 110, 0.24)`, strong `0.34`, modal scrim `0.5`, crop mask `rgba(0, 22, 92, 0.72)`, crop guide `rgba(255, 255, 255, 0.95)`, glass surface `rgba(255, 255, 255, 0.95)`다.
- Tailwind `brand` 브리지는 page, surface 계열, primary 계열, text/muted/subtle, divider, ring/focus, overlay, companion, success surface/text, preparing surface/text, danger surface/text, error를 현재 CSS 변수에 연결한다. 새 색 체계를 Tailwind에서 직접 정의하지 않는다.

## 3. Typography

- 본문과 헤드라인은 로컬 `PretendardVariable-1.3.9.woff2`를 `45 920` 가변 굵기로 사용한다. `--font-sans`와 `--font-headline`이 같은 스택을 가리키며 `font-sans`, `font-body`, `font-headline`, `font-label`이 이를 따른다.
- 아이콘은 로컬 `MaterialSymbolsOutlined-v361.woff2`를 `100 700` 가변 굵기로 사용한다. `.material-symbols-outlined`가 ligature, 기본 `24px`, FILL 0, wght 400, GRAD 0, opsz 24를 고정한다.
- 폰트 원본, 해시, 라이선스는 `public/fonts/SOURCES.md`와 같은 디렉터리의 라이선스 파일에 기록한다. 런타임 외부 폰트 요청은 허용하지 않는다.
- 현재 별도 타입 스케일 토큰은 없다. 크기는 기존 Tailwind 역할별 유틸리티를 유지하고, 후속 리팩터링에서 실제 반복 패턴이 확인될 때만 역할 토큰으로 승격한다.
- 한국어는 `lang="ko"`, `line-break: strict`, `word-break: keep-all`, `overflow-wrap: anywhere`를 기본으로 한다. 자연스러운 어절을 우선하고, 긴 식별자만 비상 줄바꿈한다.

## 4. Spacing & Layout

| Contract | Current implementation |
| --- | --- |
| Mobile shell | `--brand-shell-max: 26.875rem` (`430px`), `width: 100%`, 중앙 정렬 |
| Supported QA widths | `390x844`, `430x932` |
| Content gutter | `--brand-shell-gutter: 1rem`; 기존 `px-4`가 좌우 gutter를 만든다 |
| Frequent control target | `--brand-control-min: 2.75rem` (`44px`) |
| Fixed dock clearance | `--brand-dock-clearance: 5rem`; toast가 dock 위에 머무는 공통 여유 |
| Safe area | top/right/bottom/left 각각 `env(safe-area-inset-*, 0px)` |
| Full-height surface | `min-height: 100dvh` |
| Fixed surface | shell 중앙 기준, 최대 `430px`; dock는 좌우 safe area를 포함 |
| Final-row reachability | 문서와 shell의 `scroll-padding-bottom`, shell의 물리적 하단 padding은 bottom safe area에 `6rem`을 더한다 |

- `sm`, `md`, `lg`, `xl`, `2xl`은 각각 `10000px`, `11000px`, `12000px`, `13000px`, `14000px`로 비활성화되어 있다. 이 값은 의도적인 모바일 전용 계약이며 일반 반응형 breakpoint로 되돌리지 않는다.
- 기존 `max-w-[390px]` 컨테이너는 shell 아래에서 최대 `430px`로 해석된다. `px-4` gutter는 유지되어 430 화면의 사용 가능한 폭을 낭비하지 않는다.
- fixed header, dock, scrim, sheet는 shell 경계를 벗어나지 않아야 한다. toast는 shell 우측 gutter와 safe area 안에 머물고 모바일 dock을 가리지 않는다.
- spacing scale 자체는 Tailwind 기본값을 사용한다. 실제 반복 없이 새 간격 토큰이나 데스크톱 grid를 만들지 않는다.

## 5. Components

### Structure and ownership

- route entry는 `src/app`, 공용 UI는 `src/components/ui`, 도메인 조합은 landing/meeting/profile/admin/shop 디렉터리가 소유한다.
- 컨테이너는 fetch, mutation, 파생 상태를 담당하고, 패널과 섹션은 렌더링을 담당한다. 같은 이름·상태·총액을 여러 카드에 반복하지 않는다.
- 공용 구성요소의 현재 코드 원본은 `Icon.tsx`, `StatusBadge.tsx`, `Toast.tsx`, `Dialog.tsx`, `Tabs.tsx`, `AsyncState.tsx`, `MobileShell.tsx`다. 색과 표면은 아래 공용 `brand-*` 클래스를 우선한다.
- `Dialog`/`Sheet`는 제목·설명 연결, focus trap·restore, Escape·scrim 닫기, body scroll lock을 공통으로 소유한다. 도메인 데이터나 저장 로직은 받지 않는다.
- `Tabs`는 tablist/tab/tabpanel 연결과 arrow/Home/End roving focus를 소유한다. 활성 탭과 실제 panel 내용은 소비 화면이 소유한다.
- `AsyncState`는 loading/error/empty/not-found의 공통 위계만 제공하고, `MobileDock`은 현재 경로의 `aria-current`와 safe-area dock 구조를 제공한다.

### Existing variants

| Family | Current public classes |
| --- | --- |
| Shell and admin | `brand-mobile-shell`, `brand-mobile-fixed-bar`, `brand-admin-shell`, `brand-admin-section`, `brand-admin-stat`, `brand-admin-list-shell` |
| Surface | `brand-panel`, `brand-panel-white`, `brand-panel-strong`, `brand-inset-panel`, `brand-card`, `brand-card-soft`, `brand-highlight-panel` |
| Alert and status | `brand-alert-info`, `brand-alert-success`, `brand-alert-error`, status dots, toast info/success/error |
| Button and link | primary, secondary, danger, danger-solid, confirm, `brand-link` |
| Chip | soft, strong, accent, companion, dark, dimmed, danger, success, preparing |
| Input and choice | input, dimmed, error, form-error, toggle/check active, choice and indicator, select-card |
| List and tabs | list shell/item/row variants, tab underline active/inactive, filter-tab active |
| Overlay and dock | `brand-bottom-dock`, `brand-modal-scrim`, `brand-crop-guide` |

### States, accessibility, and motion

- 버튼과 입력은 기존 hover, disabled, focus 변형을 유지한다. 상태색은 텍스트 라벨과 함께 써서 색만으로 의미를 전달하지 않는다.
- 빈번한 button, role button, form control, summary와 `.brand-touch-target`은 최소 `44x44px` 목표를 따른다.
- 모든 링크·버튼·폼 컨트롤·summary·tabindex 대상은 전역 `:focus-visible` 이중 링을 받는다.
- 동작이 있는 공용 구성요소는 default, focus, active, disabled, loading, success, error 중 적용 가능한 상태를 명시해야 한다. 후속 리팩터링은 기존 도메인 props를 범용 공용 컴포넌트로 밀어 넣지 않는다.
- motion은 상태 변화와 다음 시선을 설명할 때만 쓴다. reduced motion에서는 transition과 smooth scroll을 제거한다.

## 6. Motion & Interaction

- 현재 `.brand-input`의 border, shadow, background, color transition은 `200ms ease`다. Toast의 현재 구성요소 transition은 `300ms`다.
- hover는 실제 클릭 가능한 컨트롤의 상태 변화를 알려야 하며, 장식만을 위한 움직임은 추가하지 않는다.
- `prefers-reduced-motion: reduce`에서는 transition duration/delay를 `0s`, animation duration을 `0.01ms` 1회, scroll behavior를 `auto`로 강제한다.
- keyboard와 touch는 같은 행동 결과를 제공해야 한다. 포커스 표시를 hover로 대체하지 않고, 포커스를 제거하거나 투명하게 만들지 않는다.
- Toast는 한 개의 live region으로 메시지를 한 번만 발표하고 포커스를 빼앗지 않는다. 닫기 버튼은 화면 읽기 이름을 갖는다.
- fixed dock와 sheet는 마지막 포커스 가능한 행을 가리지 않아야 한다. safe-area와 bottom scroll padding은 전역 기반이고, 각 화면의 실제 dock 높이는 소비 화면에서 검증한다.

## 7. Depth & Surface

| Token | Current value | Use |
| --- | --- | --- |
| `--brand-shadow` | `rgba(0, 29, 110, 0.1)` | 공통 네이비 그림자 색 |
| `--brand-primary-shadow-strong` | `0 12px 24px rgba(0, 29, 110, 0.16)` | 주요 버튼 |
| `--brand-primary-shadow-hover` | `0 14px 28px rgba(0, 29, 110, 0.2)` | 주요 버튼 hover |
| `--brand-frame-shadow` | `0 10px 30px var(--brand-shadow)` | 카드와 패널 |
| `--brand-header-shadow` | `0 8px 24px var(--brand-shadow)` | 고정 헤더 |
| `--brand-avatar-shadow` | `0 18px 40px var(--brand-shadow)` | 아바타·크롭 표면 |

- 상승 표면은 white, 정보 표면은 sky-100, 강한 선택 표면은 sky-300을 쓴다. 그림자는 요소의 정보 위계를 설명할 때만 사용한다.
- modal scrim, crop mask, bottom-dock glass는 모두 의미 토큰을 사용한다. 새 투명도나 임의 그림자를 구성요소에 직접 추가하지 않는다.
- Tailwind shadow bridge는 `shadow-brand`, `shadow-header`, `shadow-avatar`만 현재 공용 토큰에 연결한다.

## 8. Accessibility Constraints & Accepted Debt

### Required constraints

- 두 지원 viewport에서 수평 overflow, 잘린 한국어, shell 밖 fixed UI가 없어야 한다.
- 200% zoom에서도 핵심 정보와 마지막 컨트롤에 도달할 수 있어야 한다.
- 자주 쓰는 컨트롤은 최소 `44x44px`, 키보드 포커스는 밝고 어두운 표면 모두에서 보여야 한다.
- subtle, success, danger 텍스트는 각 지정 표면에서 일반 텍스트 대비를 유지한다. 상태는 색 외에 텍스트나 아이콘 의미를 함께 제공한다.
- 폰트, 아이콘, 로그인 초기 화면은 외부 런타임 요청에 의존하지 않는다. Kakao는 서버 REST OAuth redirect만 유지한다.
- reduced motion, 한국어 줄바꿈, safe area는 후속 화면에서도 전역 기반을 제거하지 않고 실제 브라우저로 검증한다.

### Accepted debt and refactor boundaries

| Debt | Affected users and location | Boundary / next owner |
| --- | --- | --- |
| 프로필 최초 설정 모달과 이미지 크롭 등 이번 소비 화면 밖의 일부 overlay는 아직 공용 `Dialog`로 이전되지 않았다 | 키보드와 screen reader 사용자, profile setup/crop | 해당 도메인 화면 리팩터링 때 동일한 동작 계약으로 이전 |
| 여러 화면에 `max-w-[390px]` 클래스명이 남아 있다 | 430px 사용자와 유지보수자 | 현재 CSS bridge가 430 shell 폭으로 해석한다. 각 도메인 리팩터링 때 의미 있는 shell/content 클래스로 교체 |
| 일부 기존 도메인 구성요소에 직접 Tailwind 색·임의 shadow가 남아 있다 | 시각 일관성과 고대비 사용자 | 해당 도메인 Todo에서 현재 의미 토큰으로 치환하며, foundation 범위에서 광범위한 구성요소 수정은 하지 않음 |
| 일반 데스크톱·태블릿 layout이 없다 | 430px보다 넓은 화면 사용자 | 제품의 의도된 mobile-only 범위다. breakpoint 변경은 별도 제품 결정 없이는 금지 |
| 전용 type scale과 spacing scale token이 없다 | 유지보수자 | 반복 역할이 실제 화면 리팩터링에서 확인될 때만 승격; 현재 Tailwind 크기·간격을 문서만으로 새 토큰화하지 않음 |

접근성 debt는 단순 메모가 아니다. 후속 변경은 영향을 받는 사용자, 위치, 심각도, 구체적 수정과 검증 결과를 함께 남기고, critical 또는 major 문제를 열린 채 완료 처리하지 않는다.
