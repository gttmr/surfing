# Todo 19 — Focused mobile release check

Date: 2026-07-15
Worktree: `surfing-mobile-ui-ux-overhaul`

## Scope

- UI/UX release confidence for the integrated 390px and 430px mobile application.
- Representative existing specs only: mobile foundation, member journey, shop orders, shop usage, and admin operations.
- Explicitly excluded: full persona/route matrices, load or concurrency work, generalized security/egress proof, Lighthouse/React Doctor programs, pixel-golden systems, and unrelated product changes.

## Verification

- Unit: `73/73` passed, including destructive-seed refusal before database-client access.
- TypeScript: `npx tsc --noEmit --incremental false` passed.
- Lint: passed with no warnings or errors after removing unused companion state, handlers, and props.
- Production build: `npm run build` passed with both Prisma URLs forced to a non-running loopback QA address; 32/32 static pages generated without production database access.
- Mobile 390 representative browser suite: `16/16` passed — foundation 3, personal journey 6, shop order queue 4, shop usage 2, and admin operations 1.
- Mobile 430 representative browser suite: `16/16` passed with the same representative split.
- Foundation geometry after the focused fix: shell/main widths match each 390px/430px viewport, all fixed elements remain inside the shell, scroll reserve is 164px, the final control is reachable, and undersized frequent controls/external requests/console errors are all zero.
- Direct screenshot review: 11 representative public/member/shop/admin states were inspected across both widths. Hierarchy, Korean wrapping, dialogs, controls, and docks remained usable with no horizontal overflow or dock-covered final action.
- Runtime cleanup: passed — port 3100 and QA database port 55432 are free; no QA container/volume remains; the QA lock, `.next`, traces, and `test-results` were removed. Temporary release screenshots were retained only for the DB-free independent visual check and removed after its PASS verdict.

## Concrete UI blocker fixed during this check

The foundation test first reproduced a real mobile regression: after the toast had been moved above the bottom dock, the page still reserved only the older 6rem bottom space. At maximum scroll the toast could overlap the final action, so `finalControlReachable` was false.

`src/app/globals.css` now derives the shell and document bottom reserve from `--brand-dock-clearance` plus 4rem and the safe-area inset. This Todo 19 correction changed only that CSS and this report; it added no API, backend, database, schema, auth, security, load, or concurrency behavior. The focused foundation spec then passed `3/3` at both widths with `finalControlReachable: true`.

## Result

PASS. The integrated mobile UI passed the proportionate release check at both target widths. One concrete bottom-clearance regression was reproduced, fixed minimally, and locked by the existing foundation test.

## Finalization safety update — 2026-07-16

- The production-capable `start` command no longer performs `prisma db push --accept-data-loss`.
- Destructive mobile QA fixture seeding now requires both the fixed loopback test database and the private QA wrapper capability.
- The screenshot-derived recovery tool completed a no-connection dry-run for 13 settings, 1 notice, 5 categories, 37 menus, and 60 active variants.
- Vercel Preview no longer receives production credentials; retained Preview deployments were removed before this branch was pushed again.
