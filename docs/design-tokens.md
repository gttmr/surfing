# Design Tokens

이 문서는 현재 리포지토리에서 사용하는 디자인 토큰을 정리한 요약본이다. 실제 원본은 [src/app/globals.css](/workspace/surfing/src/app/globals.css)이며, Tailwind에서 노출하는 브리지 값은 [tailwind.config.ts](/workspace/surfing/tailwind.config.ts)에 있다.

## Source Of Truth

- 단일 원본: [src/app/globals.css](/workspace/surfing/src/app/globals.css)
- Tailwind 브리지: [tailwind.config.ts](/workspace/surfing/tailwind.config.ts)
- 사용 규칙: 새 색이나 상태가 필요하면 먼저 CSS 변수로 승격한 뒤 공용 클래스나 Tailwind 토큰으로 노출한다.

## Core Palette

| Token | Value | Meaning |
| --- | --- | --- |
| `--color-sky-100` | `#c4ddff` | 보조 배경, 요약 카드 |
| `--color-sky-300` | `#7fb5ff` | 보더, 선택 강조, 활성 상태 |
| `--color-navy-900` | `#001d6e` | 핵심 CTA, 기본 텍스트, 브랜드 기준색 |
| `--color-peach-100` | `#ffffff` | 페이지 배경, 떠 있는 표면 |

## Semantic Brand Tokens

| Token | Resolved Value | Usage |
| --- | --- | --- |
| `--brand-primary` | `#001d6e` | 기본 CTA, 강한 강조 |
| `--brand-primary-hover` | `#001d6e` | CTA hover |
| `--brand-primary-foreground` | `#ffffff` | 어두운 배경 위 텍스트 |
| `--brand-primary-soft` | `#c4ddff` | 정보 패널, 선택 전 상태 |
| `--brand-primary-soft-strong` | `#7fb5ff` | 활성 토글, 강한 보조 강조 |
| `--brand-primary-soft-accent` | `#ffffff` | 선택 항목 내부 밝은 표면 |
| `--brand-primary-border` | `#7fb5ff` | 주요 보더 |
| `--brand-primary-border-strong` | `#001d6e` | 강한 선택 보더 |
| `--brand-primary-text` | `#001d6e` | 블루 계열 패널 내부 텍스트 |
| `--brand-page` | `#ffffff` | 페이지 배경 |
| `--brand-surface` | `#c4ddff` | 기본 브랜드 패널 |
| `--brand-surface-elevated` | `#ffffff` | 카드, 모달, 입력창 |
| `--brand-surface-strong` | `#7fb5ff` | 활성화된 선택 패널 |
| `--brand-text` | `#001d6e` | 기본 본문 텍스트 |
| `--brand-text-muted` | `rgba(0, 29, 110, 0.74)` | 보조 설명 |
| `--brand-text-subtle` | `rgba(0, 29, 110, 0.48)` | 캡션, 덜 중요한 보조 문구 |
| `--brand-divider` | `rgba(0, 29, 110, 0.16)` | 기본 경계선 |
| `--brand-divider-strong` | `rgba(0, 29, 110, 0.28)` | 강조된 경계선 |
| `--brand-ring` | `rgba(127, 181, 255, 0.35)` | focus ring |
| `--brand-shadow` | `rgba(0, 29, 110, 0.1)` | 그림자 컬러 |

## Status Tokens

| Token | Value | Usage |
| --- | --- | --- |
| `--brand-success` | `#16a34a` | 완료, 확정, 성공 액션 |
| `--brand-success-hover` | `#15803d` | 성공 CTA hover |
| `--brand-success-surface` | `#f0fdf4` | 성공 알림 배경 |
| `--brand-success-surface-strong` | `#dcfce7` | 성공 칩 배경 |
| `--brand-success-border` | `#bbf7d0` | 성공 알림 경계선 |
| `--brand-success-text` | `#166534` | 성공 상태 텍스트 |
| `--brand-danger` | `#dc2626` | 삭제, 실패, 위험 액션 |
| `--brand-danger-hover` | `#b91c1c` | 위험 CTA hover |
| `--brand-danger-surface` | `#fef2f2` | 에러 알림, 입력 에러 배경 |
| `--brand-danger-surface-strong` | `#fee2e2` | 위험 칩 배경 |
| `--brand-danger-surface-inline` | `rgba(254, 202, 202, 0.6)` | 인라인 경고 박스 배경 |
| `--brand-danger-border` | `#fecaca` | 위험 경계선 |
| `--brand-danger-border-strong` | `#f87171` | 입력 에러 강조 보더 |
| `--brand-danger-text` | `#991b1b` | 위험 상태 텍스트 |
| `--brand-danger-ring` | `rgba(220, 38, 38, 0.15)` | 에러 focus ring |
| `--brand-error` | `#dc2626` | 레거시 텍스트 에러 alias |

## Domain-Specific Tokens

| Token | Value | Usage |
| --- | --- | --- |
| `--brand-dimmed-surface` | `#e5e7eb` | 비활성, 읽기 전용 필드 |
| `--brand-dimmed-border` | `#9ca3af` | 비활성 경계선 |
| `--brand-dimmed-text` | `#4b5563` | 비활성 텍스트 |
| `--brand-companion` | `#c2580a` | 동반인 도메인 포인트 컬러 |
| `--brand-companion-surface` | `#fee2c5` | 동반인 칩 배경 |
| `--brand-calendar-sun` | `#ef4444` | 일정 일요일 텍스트 |
| `--brand-calendar-sat` | `#3b82f6` | 일정 토요일 텍스트 |

## Overlay And Effects

| Token | Value | Usage |
| --- | --- | --- |
| `--brand-overlay` | `rgba(0, 29, 110, 0.24)` | 가벼운 overlay |
| `--brand-overlay-strong` | `rgba(0, 29, 110, 0.34)` | 강한 overlay |
| `--brand-modal-scrim` | `rgba(0, 29, 110, 0.5)` | 모달 배경 |
| `--brand-crop-mask` | `rgba(0, 22, 92, 0.72)` | 이미지 크롭 마스크 |
| `--brand-crop-guide-border` | `rgba(255, 255, 255, 0.95)` | 크롭 가이드 테두리 |
| `--brand-surface-glass` | `rgba(255, 255, 255, 0.95)` | 바텀 독, 반투명 표면 |
| `--brand-primary-shadow-strong` | `0 12px 24px rgba(0, 29, 110, 0.16)` | 기본 CTA 그림자 |
| `--brand-primary-shadow-hover` | `0 14px 28px rgba(0, 29, 110, 0.2)` | CTA hover 그림자 |
| `--brand-frame-shadow` | `0 10px 30px var(--brand-shadow)` | 기본 카드 그림자 |
| `--brand-header-shadow` | `0 8px 24px var(--brand-shadow)` | 헤더 그림자 |
| `--brand-avatar-shadow` | `0 18px 40px var(--brand-shadow)` | 아바타/크롭 패널 그림자 |

## Public Utility Classes

공용 상태는 직접 색을 조합하지 말고 아래 클래스를 우선 쓴다.

- 패널: `brand-panel`, `brand-panel-white`, `brand-panel-strong`, `brand-card`, `brand-card-soft`
- 버튼: `brand-button-primary`, `brand-button-secondary`, `brand-button-danger`, `brand-button-danger-solid`, `brand-button-confirm`
- 상태: `brand-alert-info`, `brand-alert-success`, `brand-alert-error`, `brand-chip-danger`, `brand-chip-success`, `brand-chip-companion`
- 입력: `brand-input`, `brand-input-dimmed`, `brand-input-error`, `brand-form-error`
- 오버레이: `brand-modal-scrim`, `brand-bottom-dock`, `brand-crop-guide`

## Tailwind Bridge

Tailwind에서는 아래처럼 semantic color만 노출한다.

- `brand.page`
- `brand.surface`
- `brand.surface-elevated`
- `brand.surface-strong`
- `brand.primary`
- `brand.primary-hover`
- `brand.primary-soft`
- `brand.primary-border`
- `brand.text`
- `brand.text-muted`
- `brand.divider`
- `brand.ring`
- `brand.overlay`
- `brand.companion`
- `brand.success`
- `brand.danger`
- `brand.error`

예시:

```tsx
<div className="bg-brand-surface text-brand-text shadow-brand" />
```

## Usage Rules

- 메인 네이비는 CTA와 핵심 선택 상태에만 쓴다.
- 연한 블루는 보조 배경과 정보 패널에 쓴다.
- 성공/위험 상태는 green/red scale 하드코딩 대신 성공·위험 의미 토큰으로 통일한다.
- 회색 계열은 비활성/읽기 전용에만 쓴다.
- 동반인 색은 다른 도메인으로 확장하지 않는다.
- 새 화면에서 임의의 파랑, 빨강, 초록을 직접 추가하지 않는다.

## Notes

- [tailwind.config.ts](/workspace/surfing/tailwind.config.ts)에 남아 있던 과거 Stitch 계열 색 체계는 제거했다.
- 디자인 시스템 정비 시 문서와 코드가 어긋나면 항상 [src/app/globals.css](/workspace/surfing/src/app/globals.css)를 기준으로 문서를 다시 맞춘다.
