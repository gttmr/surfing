# Surfing Design System Rules

이 문서는 이 저장소에서 Figma 디자인을 코드로 옮기거나, 코드 기준으로 Figma 디자인 시스템을 정비할 때 따라야 하는 프로젝트 규칙이다.

## Stack

- Framework: Next.js App Router + React 19 + TypeScript
- Styling: Tailwind utility + global semantic classes in [src/app/globals.css](/workspace/surfing/src/app/globals.css)
- Tokens: CSS custom properties in [src/app/globals.css](/workspace/surfing/src/app/globals.css)
- Secondary token reference: [docs/design-tokens.md](/workspace/surfing/docs/design-tokens.md)

## Source Of Truth

- 디자인 토큰의 단일 원본은 [src/app/globals.css](/workspace/surfing/src/app/globals.css) `:root`이다.
- 새 색상, 그림자, 오버레이, 상태색이 필요하면 먼저 CSS 변수로 승격하고 나서 컴포넌트에서 사용한다.
- [tailwind.config.ts](/workspace/surfing/tailwind.config.ts)는 토큰 브리지다. 색 체계를 새로 정의하는 곳이 아니다.
- 문서는 구현을 요약할 뿐이다. 코드와 문서가 다르면 코드를 기준으로 문서를 갱신한다.

## Component Structure

- Route entry는 [src/app](/workspace/surfing/src/app)에 둔다.
- 재사용 UI 조각은 [src/components/ui](/workspace/surfing/src/components/ui)에 둔다.
- 도메인 화면 조합은 [src/components/landing](/workspace/surfing/src/components/landing), [src/components/meeting](/workspace/surfing/src/components/meeting), [src/components/profile](/workspace/surfing/src/components/profile), [src/components/admin](/workspace/surfing/src/components/admin)에 둔다.
- 컨테이너는 데이터와 상태를 갖고, 섹션/패널 컴포넌트는 렌더링 책임만 가진다. 자세한 원칙은 [docs/frontend-philosophy.md](/workspace/surfing/docs/frontend-philosophy.md)를 따른다.

## Styling Rules

- 우선순위는 `semantic token -> global brand class -> Tailwind layout utility` 순서다.
- 색상은 `text-brand-*`, `bg-brand-*` 같은 토큰 브리지나 `brand-*` 클래스로만 쓴다.
- `#hex`, `rgb()`, `rgba()` 하드코딩은 금지한다.
- 예외가 필요하면 같은 변경 안에서 [src/app/globals.css](/workspace/surfing/src/app/globals.css)에 의미 토큰과 공용 클래스를 먼저 추가한다.
- 버튼, 카드, 패널, 입력창은 가능한 한 기존 `brand-button-*`, `brand-card*`, `brand-panel*`, `brand-input*` 계열을 재사용한다.
- radius와 shadow는 임의값보다 기존 토큰(`--brand-frame-shadow`, `--brand-header-shadow`, `--brand-avatar-shadow`)을 우선 사용한다.

## Typography

- 기본 산세리프는 `Pretendard`이며 `--font-sans`, `--font-headline`을 통해 노출된다.
- Tailwind의 `font-sans`, `font-body`, `font-headline`, `font-label`은 모두 이 변수에 정렬되어야 한다.
- 새 텍스트 스타일을 만들 때는 크기보다 역할 이름을 먼저 본다. 캡션, 보조 텍스트, 섹션 제목처럼 의미를 기준으로 일관성을 유지한다.

## Tokens

- 브랜드 핵심 컬러는 네이비/스카이/화이트 조합이다.
- 성공/위험/비활성 상태도 의미 토큰으로 관리한다. 직접 Tailwind red/green scale을 가져오지 않는다.
- 동반인 전용 색은 `--brand-companion`, `--brand-companion-surface`로 한정한다.
- 오버레이, 모달 스크림, 크롭 마스크처럼 투명도가 포함된 값도 토큰으로 다룬다.

## Icon System

- 아이콘은 기본적으로 [src/components/ui/Icon.tsx](/workspace/surfing/src/components/ui/Icon.tsx)를 통해 Material Symbols를 사용한다.
- Figma가 별도 SVG 자산을 주지 않는 한 새 아이콘 패키지를 추가하지 않는다.
- Figma가 localhost asset/SVG를 제공하면 그 자산을 그대로 사용한다.

## Figma MCP Flow

1. `get_design_context`로 정확한 노드를 읽는다.
2. 응답이 크면 `get_metadata`로 구조를 먼저 보고 필요한 노드만 다시 읽는다.
3. `get_screenshot`으로 실제 시각 기준을 확인한다.
4. 구현 시 Figma가 준 Tailwind/React 표현을 그대로 복붙하지 말고, 이 저장소의 토큰과 컴포넌트 체계에 맞게 번역한다.
5. 완료 전 Figma 스크린샷과 실제 UI를 비교해 간격, 상태, 계층을 검증한다.

## Implementation Constraints

- 상태 문구보다 상태 표현이 먼저 보여야 한다.
- 모바일 우선 레이아웃을 유지한다.
- 읽기 화면과 편집 화면을 섞지 않는다.
- JSX 안에서 복잡한 상태 계산을 직접 늘어놓지 말고 파생 상태를 먼저 만든다.
- 같은 이름, 상태, 총액 같은 핵심 정보는 여러 카드에 반복하지 않는다.

## Asset Placement

- 새 정적 자산은 기본적으로 `public/` 아래에 둔다.
- Figma에서 받은 개별 SVG/이미지는 재사용 범위가 명확할 때만 로컬 자산으로 저장한다.
- 임시 placeholder 자산은 만들지 않는다. Figma 자산이 있으면 그것을 쓴다.
