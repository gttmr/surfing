# Task 02: deterministic mobile UX fixtures

## Result

Todo 2 adds one deterministic synthetic fixture graph, an idempotent local-PostgreSQL seed target, five authenticated browser contexts needed for representative UI work, and a flat focused route-case registry. It does not change product authentication, Prisma schema, UI components, or styling.

## Fixture contract

The committed fixture uses stable synthetic identifiers and Korean stress content. Database-derived inspection after each registered seed reported:

| Contract | Observed |
| --- | --- |
| Users | 35 |
| Meetings | 4; IDs 8101-8104 |
| Menus | 37 total, 36 active |
| Active selectable variants | 60 |
| Database roles | ADMIN, BANNED, MEMBER, SHOP_OWNER |
| Companion links | 1 linked, 1 unlinked |
| Food-order states | active, preparing, served, cancelled, mixed |
| Usage states | missing, submitted, confirmed |
| Repeated submissions | 2 parents for the representative participant |
| Disposable IDs | synthetic user, meeting, and inactive menu targets present |
| Fixture checksum | `2153eaa9c5b1a79dcbf11aecbd2bfae3e1d51300f297fd86b40e1da370788b98` |

The route registry contains one public or authorized case for each current member, shop, and admin route plus representative admin/shop barriers. It intentionally does not generate a persona-by-route Cartesian product; Todo 19 can extend the records it actually needs.

## TDD evidence

- Baseline dependency bootstrap: the first unchanged `test:unit` invocation could not start because the isolated worktree had no dependencies. `npm ci --ignore-scripts` installed the lockfile without lifecycle scripts.
- Baseline after bootstrap: `EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/todo2-baseline-unit npm run test:unit` exited 0 with 21/21 tests. The real `qa:db:up -> qa:db:assert -> qa:db:down` smoke also exited 0.
- Red: the focused fixture command failed three intended contract tests because meetings/users/menus/variants, route cases, and auth contexts were empty.
- Green: `EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/todo2-final-integration npm run test:integration -- --test-concurrency=1 --test-name-pattern='fixture contract|atomic route matrix|P0-P8 session matrix|reset idempotence'` exited 0 with 5/5 tests. It created real Chromium contexts and reset the real local database twice.
- Final baseline regression: `EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/todo2-final-unit npm run test:unit` exited 0 with 21/21 tests.

## Registered seed proof

The manual data channel ran `qa:db:up`, `qa:db:push`, `qa:db:reset`, `qa:db:assert`, two consecutive `qa:db:seed` calls, an assertion after each generation, and `qa:db:down`. The three generations were distinct. Counts, stable meeting/disposable IDs, role/state sets, and checksum were identical after all three writes. The generation file, reserved Setting row, and later wrapper child matched after each assertion.

Malformed calendar dates, unknown fixture/auth keys, malformed generation values, tampered cookies, and stale wrapper generations refuse before fixture mutation or browser context use.

## Manual browser QA

The registered `build:qa` target exposed a pre-existing Todo 1 harness defect: after Next begins its optimized build, a forwarded loader is interpreted as package `tsx ` with a trailing space. Runtime capture confirmed the wrapper passed a valid separated `--import`, `tsx` argument pair into the top-level Next process. Per the UI-first override, no harness refactor was added to this Todo 2 commit.

A bounded fallback used the same fixed local database, synthetic auth values, empty external-service credentials, telemetry disabled, direct `next build`, and direct `next start -p 3100`; product `npm start` was never invoked. The direct production build exited 0. Real Chromium then observed:

| Context | Route | Result |
| --- | --- | --- |
| Public | `/` | 200, root shell |
| Member | `/` | 200, root shell |
| Shop owner | `/shop` | 200, shop shell |
| Kakao administrator | `/admin` | 200, admin shell |
| Password administrator | `/admin` | 200, admin shell |

Representative barriers returned the intended internal redirects: public `/shop` to the internal OAuth route, member `/admin` to `/admin/login`, and member `/shop` to `/`. The internal OAuth response was requested with redirects disabled; its Kakao authorization Location shape was validated and recorded only as `redirect-location-only`. No Kakao request was followed. Existing remote font/CDN attempts from the base UI were aborted by the context-wide route guard; local requests continued. Font removal belongs to the parallel Todo 3 foundation work.

Raw redacted runtime receipts are ignored under `.omo/evidence/ui-ux-overhaul/todo2*/`; no cookie, secret, profile identity, external database row, or raw token is tracked.

## Quality and adversarial checks

- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0 with 0 errors and exactly 7 pre-existing warnings.
- Changed-file ESLint and forbidden-pattern searches: exit 0.
- Pure LOC: all changed TypeScript files are below 250. The data fixture and seed script are in the 200-250 warning band and should split before substantial future growth.
- Malformed input: invalid dates, fixture/context keys, generations, and cookie signatures refuse.
- Stale state: two integration resets and three registered seed generations retained one checksum and stable keyed data while rotating generation IDs.
- Dirty worktree: work ran only in the isolated Todo 2 branch and touched fixture/seed/helper/test/report files.
- Flaky tests: Node concurrency and Playwright workers remain serial; no sleeps or wall-clock assertions were added.
- Hung commands: database, browser, navigation, and build operations used bounded waits; teardown ran after both pass and failure paths.
- Misleading success: verification queried actual database rows/counts and drove real route outcomes rather than accepting seed/server log text.
- Prompt injection, cancel/resume, and repeated interruption are not applicable because the task consumes no untrusted text and exposes no resumable operation.

## Cleanup

The Todo 2 cleanup receipt recorded its PostgreSQL container, volume, ports 3100/55432, owner lock, task process registry, generation file, server state, browser auth, and uploads absent. The temporary manual driver and debugging journal were removed. No browser, database, server, storage state, or upload created by Todo 2 remains.
