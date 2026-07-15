# Todo 19 — Focused mobile release check

Date: 2026-07-15
Worktree: `surfing-mobile-ui-ux-overhaul`

## Scope

- UI/UX release confidence for the integrated 390px and 430px mobile application.
- Representative existing specs only: mobile foundation, member journey, shop orders, shop usage, and admin operations.
- Explicitly excluded: full persona/route matrices, load or concurrency work, generalized security/egress proof, Lighthouse/React Doctor programs, pixel-golden systems, and unrelated product changes.

## Verification

- Unit: `72/72` passed.
- TypeScript: `npx tsc --noEmit --incremental false` passed.
- Lint: passed with the seven previously recorded unused-variable warnings and no errors.
- Webpack production build: passed with `npx next build --webpack`; 32/32 static pages generated. The first npm-wrapper attempt was externally terminated with 143 after reaching 32/32, while a clean direct rerun completed normally and no OOM or product failure was present.
- Mobile 390 representative browser suite: `16/16` passed — foundation 3, personal journey 6, shop order queue 4, shop usage 2, and admin operations 1.
- Mobile 430 representative browser suite: `16/16` passed with the same representative split.
- Foundation geometry after the focused fix: shell/main widths match each 390px/430px viewport, all fixed elements remain inside the shell, scroll reserve is 164px, the final control is reachable, and undersized frequent controls/external requests/console errors are all zero.
- Direct screenshot review: 11 representative public/member/shop/admin states were inspected across both widths. Hierarchy, Korean wrapping, dialogs, controls, and docks remained usable with no horizontal overflow or dock-covered final action.
- Runtime cleanup: passed — port 3100 and QA database port 55432 are free; no QA container/volume remains; the QA lock, `.next`, traces, and `test-results` were removed. Temporary release screenshots remain only long enough for the DB-free independent visual check and are removed afterward.

## Concrete UI blocker fixed during this check

The foundation test first reproduced a real mobile regression: after the toast had been moved above the bottom dock, the page still reserved only the older 6rem bottom space. At maximum scroll the toast could overlap the final action, so `finalControlReachable` was false.

`src/app/globals.css` now derives the shell and document bottom reserve from `--brand-dock-clearance` plus 4rem and the safe-area inset. No API, backend, database, schema, auth, security, load, or concurrency behavior changed. The focused foundation spec then passed `3/3` at both widths with `finalControlReachable: true`.

## Result

PASS. The integrated mobile UI passed the proportionate release check at both target widths. One concrete bottom-clearance regression was reproduced, fixed minimally, and locked by the existing foundation test.
