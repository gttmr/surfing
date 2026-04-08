# Design Tokens

이 문서는 현재 리포지토리에서 사용하는 주요 디자인 토큰, 특히 컬러 토큰을 정리한 문서다.
실제 소스 기준 원본은 [globals.css](/workspace/surfing/src/app/globals.css)이며, 이 문서는 의미와 사용처를 빠르게 이해하기 위한 요약본이다.

## Base Colors

| Token | Value | Meaning |
| --- | --- | --- |
| `--color-sky-100` | `#c4ddff` | 연한 블루 배경, 보조 패널 |
| `--color-sky-300` | `#7fb5ff` | 강조 블루, 선택 상태, 보더 |
| `--color-navy-900` | `#001d6e` | 메인 브랜드 컬러, 주 텍스트, 핵심 액션 |
| `--color-peach-100` | `#ffffff` | 기본 밝은 배경, 카드 표면 |

## Brand Tokens

| Token | Resolved Value | Usage |
| --- | --- | --- |
| `--brand-primary` | `#001d6e` | 기본 CTA 버튼, 강조 칩, 강한 액션 |
| `--brand-primary-hover` | `#001d6e` | 기본 CTA hover |
| `--brand-primary-foreground` | `#ffffff` | 어두운 배경 위 텍스트 |
| `--brand-primary-soft` | `#c4ddff` | 정보 카드, 선택 가능한 보조 상태 |
| `--brand-primary-soft-strong` | `#7fb5ff` | 활성 토글, 강조된 보조 패널 |
| `--brand-primary-soft-accent` | `#ffffff` | 밝은 강조 칩 |
| `--brand-primary-border` | `#7fb5ff` | 주요 보더, input 기본 보더 |
| `--brand-primary-border-strong` | `#001d6e` | 강한 선택 상태 보더 |
| `--brand-primary-text` | `#001d6e` | 블루 계열 패널 내부 텍스트 |
| `--brand-primary-text-strong` | `#001d6e` | hover나 강한 강조 텍스트 |
| `--brand-page` | `#ffffff` | 페이지 전체 배경 |
| `--brand-surface` | `#c4ddff` | 일반 카드/패널 배경 |
| `--brand-surface-elevated` | `#ffffff` | 떠 있는 카드, 흰 패널 배경 |
| `--brand-surface-strong` | `#7fb5ff` | 활성 토글/선택 상태 배경 |
| `--brand-text` | `#001d6e` | 기본 텍스트 |
| `--brand-text-muted` | `rgba(0, 29, 110, 0.74)` | 보조 설명 텍스트 |
| `--brand-text-subtle` | `rgba(0, 29, 110, 0.48)` | 더 약한 설명/캡션 |
| `--brand-divider` | `rgba(0, 29, 110, 0.16)` | 기본 구분선 |
| `--brand-divider-strong` | `rgba(0, 29, 110, 0.28)` | 더 강한 구분선 |
| `--brand-dimmed-surface` | `#e5e7eb` | 비활성/읽기 전용 필드 배경 |
| `--brand-dimmed-border` | `#9ca3af` | 비활성/읽기 전용 보더 |
| `--brand-dimmed-text` | `#4b5563` | 비활성/읽기 전용 텍스트 |
| `--brand-shadow` | `rgba(0, 29, 110, 0.1)` | 기본 그림자 색 |
| `--brand-ring` | `rgba(127, 181, 255, 0.35)` | 포커스 링, 선택 강조 |

## Component-Level Special Colors

| Selector / Token | Value | Usage |
| --- | --- | --- |
| `.brand-chip-companion` | `#fee2c5` | 동반인 칩 전용 배경 |
| `.brand-avatar-shell` border | `#7fb5ff` | 아바타 원형 테두리 |
| `.brand-avatar-shell` background | `#ffffff` | 아바타 쉘 배경 |
| `.brand-button-primary` shadow | `rgba(0, 29, 110, 0.16)` | 기본 버튼 그림자 |
| `.brand-button-primary:hover` shadow | `rgba(0, 29, 110, 0.2)` | 기본 버튼 hover 그림자 |

## Usage Rules

- 메인 블루는 핵심 행동과 선택 상태에만 쓴다.
- 연한 블루는 보조 정보, 요약 카드, 선택 가능 상태에 쓴다.
- 흰색은 페이지 배경과 떠 있는 카드 표면에 쓴다.
- 회색 계열은 비활성, 읽기 전용, 준비중 상태에만 쓴다.
- 동반인 칩의 `#fee2c5`는 예외 컬러로 유지하고, 다른 도메인에 확장하지 않는다.

## Avoid

- 새로운 페이지에서 임의의 파란색/남색을 직접 추가하지 않는다.
- 경고/성공/오류 컬러를 토큰 체계 없이 산발적으로 넣지 않는다.
- 같은 의미를 가진 상태에 서로 다른 파랑을 혼용하지 않는다.
- CTA 버튼 외 영역에 `--brand-primary`를 과하게 칠하지 않는다.

## Source of Truth

- 실제 최신 값은 항상 [globals.css](/workspace/surfing/src/app/globals.css)를 기준으로 본다.
- 이 문서는 Agent와 개발자가 빠르게 의도를 파악하기 위한 보조 문서다.
