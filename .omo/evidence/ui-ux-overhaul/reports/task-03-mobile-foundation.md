# Task 03 Mobile Foundation Evidence

## Scope and design trace

- Objective: preserve the intentional 430px mobile product while making the foundation usable at exactly 390x844 and 430x932.
- Primary user: a Korean-speaking club member using touch first, with keyboard, 200% zoom, or reduced-motion preferences also supported.
- Hierarchy: the existing navy/sky/white identity remains unchanged; the shell, not an accidental 390px child cap, owns width.
- Interaction: frequent controls inherit a 44px minimum target and every keyboard-focusable control receives a two-color `:focus-visible` ring.
- Adaptation: safe-area tokens constrain fixed surfaces; Korean wrapping and reduced motion are global behavior, not per-screen patches.
- Contract: `src/app/globals.css :root` remains the implementation source of truth. `docs/design-tokens.md` now records current behavior, refactor boundaries, and accepted debt in the standard eight-section structure.

## Failing-first baseline

The unchanged 430 project failed `tests/e2e/mobile-foundation.spec.ts` before production edits with these actual observables:

- shell width `415px` instead of `430px` because `scrollbar-gutter: stable` reserved desktop-scrollbar space;
- main wrapper width `390px` instead of `430px`;
- first frequent control `40x40px` instead of `44x44px`;
- reduced-motion transition `0.15s` instead of `0s`;
- browser attempted jsDelivr Pretendard, Google Fonts Material Symbols, and Kakao JavaScript SDK requests.

The REST OAuth characterization already passed: `/api/auth/kakao?returnTo=/` returned an unfollowed Kakao authorization `Location`.

## Implemented foundation

- `src/app/layout.tsx`: removed external font links, `next/script`, the Kakao SDK, retry initializer, and public JS-key read; retained the mobile shell and server REST OAuth routes.
- `src/app/globals.css`: added local font faces, 430 shell and safe-area tokens, full-width bridge for legacy 390 wrappers, shell-bounded fixed surfaces, 44px targets, visible focus, Korean wrapping, higher-contrast subtle/status usage, and reduced-motion behavior.
- `tailwind.config.ts`: preserved the 10000-14000px disabled breakpoints and extended only bridges to current semantic CSS tokens.
- `.env.example` and `src/types/kakao.d.ts`: removed the unused public JS key and browser SDK ambient type.
- `public/fonts/`: vendored pinned Pretendard 1.3.9 and Material Symbols Outlined v361 WOFF2 files with upstream license notices and source hashes.
- `docs/design-tokens.md`: replaced the former token summary with exactly eight substantive design-system sections.

## Automated and real-browser verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS, exit 0 |
| `npm run lint` | PASS, exit 0, exactly 7 pre-existing warnings and 0 errors |
| sanitized local env `npm run build` | PASS, production build completed and 32 static pages generated |
| mobile-390 focused Playwright | PASS, 3/3 |
| mobile-430 focused Playwright | PASS, 3/3 |
| design contract source check | PASS, exactly eight required H2 sections; every documented CSS token name resolves in `globals.css` |
| runtime source egress search | PASS, no product runtime reference to external fonts, Kakao SDK/retry initializer, public JS key, or `next/script` |
| disabled breakpoint inspection | PASS, `10000px`, `11000px`, `12000px`, `13000px`, `14000px` unchanged |

### Browser-computed evidence

| Observable | 390x844 | 430x932 |
| --- | --- | --- |
| shell width | `390px` | `430px` |
| main width | `390px` | `430px` |
| fixed surfaces inside shell | true | true |
| toast distance above viewport bottom with synthetic `20px` safe inset | `44px` | `44px` |
| bottom scroll reserve | `116px` | `116px` |
| final control clear of fixed toast | true | true |
| first frequent control | `44x44px` | `44x44px` |
| undersized frequent controls | none | none |
| focus visible | true | true |
| reduced-motion transition | `0s` | `0s` |
| Pretendard loaded | local `/fonts/PretendardVariable-1.3.9.woff2` | same |
| Material Symbols loaded | local `/fonts/MaterialSymbolsOutlined-v361.woff2` | same |
| external browser requests | none | none |
| integrity/Kakao/retry console errors | none | none |
| 200% zoom scroll/client width | `390/390`, no overflow | `430/430`, no overflow |

Raw browser evidence remains ignored under:

- `.omo/evidence/ui-ux-overhaul/390/foundation-mobile-390.{png,json}`
- `.omo/evidence/ui-ux-overhaul/390/zoom-mobile-390.json`
- `.omo/evidence/ui-ux-overhaul/390/browser-egress-ledger.jsonl`
- `.omo/evidence/ui-ux-overhaul/430/foundation-mobile-430.{png,json}`
- `.omo/evidence/ui-ux-overhaul/430/zoom-mobile-430.json`
- `.omo/evidence/ui-ux-overhaul/430/browser-egress-ledger.jsonl`

Both PNG files were checked as fresh RGB viewport captures after the final rendered-source edit, with exact dimensions `390x844` and `430x932`.

### Contrast evidence

WCAG contrast calculations against the current resolved colors:

- subtle navy at 68% over white: `5.66:1`;
- success text on success surface: `6.81:1`;
- white on success toast: `5.02:1`;
- danger text on danger surface: `7.60:1`;
- white on danger toast: `4.83:1`;
- preparing text on preparing surface: `6.37:1`.

### Local font provenance

| Asset | SHA-256 | Notice |
| --- | --- | --- |
| Pretendard 1.3.9 variable WOFF2 | `9599f12fd42fc0bce1cd50b47a0c022e108d7aa64dd0d1bb0ed44f3282d900b4` | upstream SIL OFL notice |
| Material Symbols Outlined v361 variable WOFF2 | `a0b648e4531fd6cb23b0473e47ce39461d8e49c33d4a5fc64023c424ab37fb5d` | upstream Apache 2.0 notice |

## Adversarial checks

| Class | Result |
| --- | --- |
| malformed_input | Overlong Korean at 200% zoom remained within the exact viewport width. OAuth `Location` was inspected with redirects disabled and never followed. No callback/login credential flow was exercised. |
| stale_state | Final screenshots and computed JSON were generated after the final rendered-source edit; file timestamps and dimensions were inspected. |
| dirty_worktree | Todo 3 paths were inspected with `git status` and full diff; no Todo 2 fixture, domain API, product data, or later component edit is included. |
| hung_commands | Build, server, and browser commands were bounded/polled; the QA server is explicitly terminated during cleanup. |
| flaky_tests | One worker, exact project viewport, reduced-motion context, disabled screenshot animation/caret, and two consecutive focused project runs produced deterministic passes. |
| misleading_success_output | PNG signatures/dimensions, computed JSON, font resource URLs, browser ledger, console collection, and actual production build output were inspected rather than trusting command banners. |
| prompt_injection | N/A: no untrusted instruction-bearing content is consumed. |
| cancel_resume | N/A: no resumable product flow is introduced. |
| repeated_interruptions | N/A: no interruptible mutation or durable operation is introduced. |

## Visual QA and cleanup

- Pass A (design-system/functional): **PASS, high confidence, no findings or blockers.** It verified capture freshness and exact RGB dimensions, shell/fixed/safe-area geometry, final-row reachability, targets/focus, all measured contrast pairs, local-only fonts, reduced motion, and zoom/CJK evidence.
- Pass B (independent visual/CJK): **PASS, high confidence, no blocking findings.** It opened both PNGs directly and found no tofu, glyph fallback, CJK or baseline clipping, broken hierarchy, crowding, or viewport regression. It also confirmed the visible focus ring, consistent 16px gutters, and intended 390/430 width adaptation.
- Review correction: an earlier evidence-only review rejected full-page PNG heights despite green product assertions. Capture mode was changed to viewport-sized output, both projects were rerun 3/3, and two new read-only reviewers passed the corrected `390x844` and `430x932` packet.
- Cleanup: the direct production server and Playwright debug session were stopped. Generated `test-results`, `.playwright-cli`, and debug-journal artifacts were removed; raw screenshot/JSON evidence remains ignored while this report is tracked.
