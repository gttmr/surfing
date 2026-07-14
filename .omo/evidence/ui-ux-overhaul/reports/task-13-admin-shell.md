# Task 13 — Mobile admin shell and notices

## Outcome

- Added one shared server-page guard and placed `await requireAdminPage()` first in all nine non-login admin page functions.
- Replaced emoji/inconsistent navigation with the existing Material Symbols `Icon`, kept six destinations inside the mobile shell, exposed `aria-current`, and added a visible active underline so current location is not conveyed by color alone.
- Added navigation-only member/shop portal links. Their automatic Next production prefetch is disabled so simply opening admin does not background-request role-gated portal/OAuth routes.
- Rebuilt notices as separate list, reader, create, and edit modes with field validation, retained failed drafts, empty/retry states, semantic dirty-discard and named delete dialogs, and live feedback.
- Kept `/admin/login`, Kakao ADMIN auto-login, and password-admin behavior compatible. Final QA used only synthetic password-admin cookies and local fixture data; no Kakao login navigation or credentials were used.

## Fresh final verification

| Check | Exact result |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS: 0 errors, 7 pre-existing warnings in meeting signup files |
| `EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/unit npm run test:unit -- --test-name-pattern='admin page guard AST order'` | PASS: 6/6 tests; guard assertion covers all nine protected page entries |
| `NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack` | PASS: Next 16.2.1 webpack compile and 32/32 static pages |
| Portal prefetch regression red | FAIL 1/1 before fix: captured `http://127.0.0.1:3100/shop?_rsc=17qrm` |
| Portal prefetch regression green | PASS 1/1 after `prefetch={false}` on both portal links |
| 390 focused Playwright | PASS 4/4 in 7.7s at 390x844 |
| 430 focused Playwright | PASS 4/4 in 7.4s at 430x932 |
| Browser accessibility | axe critical/serious findings: 0 in every focused scenario at both widths |
| Final direct browser probe | both widths: portal prefetch 0, forbidden request 0, console errors 0, page errors 0 |

The focused browser scenarios cover public redirect and wrong password, the six-item shell/current destination and portal hrefs, notice list/reader/editor separation, inline required-field validation, retained draft after an intercepted synthetic 500, dirty stay/discard, named delete cancellation, list failure/retry, and dock/submit geometry. The synthetic 500 is an intentional local route interception used to verify error retention; it is not an unexplained product/server failure.

## Launcher and product-behavior distinction

- The initial focused unit command omitted `EVIDENCE_DIR` and exited before test selection with exactly `EVIDENCE_DIR is required`. Supplying the required task-scoped evidence path produced the 6/6 PASS above. This was a launcher invocation mistake, not product behavior.
- The first completion Playwright retry started the protected QA server with the fixed synthetic `SESSION_SECRET` but invoked Playwright directly without the same fixed value. All four browser cases stayed at `/admin/login`; fixture inspection still showed both expected notices. Re-running with the shared synthetic secret produced 4/4 at both widths. This was also invocation setup, not product behavior.
- A later direct console probe found one real Todo 13 defect: the visible `/shop` portal `Link` prefetched `/shop?_rsc`, which redirected toward Kakao and emitted a CORS error without a click. No credentials were supplied and no login flow was followed. A red-first regression now locks navigation-only behavior; final browser probes record zero portal prefetches and zero Kakao requests.

## Fresh visual evidence and verdict

- `390/mobile-390-admin-shell-list.png`
- `390/mobile-390-admin-notice-reader.png`
- `390/mobile-390-admin-notice-dirty-dialog.png`
- `390/mobile-390-admin-notice-save-error.png`
- `390/mobile-390-admin-notice-retry.png`
- The corresponding five `430/mobile-430-admin-*.png` captures

Direct inspection of all ten final PNGs confirms:

- active dock state uses `aria-current` plus a persistent underline, not color alone;
- the long Korean title wraps naturally to two lines with `word-break: keep-all` and `overflow-wrap: anywhere` at both widths;
- list, reader, and editor each present one clear hierarchy without mixing read and edit controls;
- final submit is fully reachable above the fixed dock at 390 and 430;
- list, reader, editor, dirty-dialog, and save-error states have no horizontal overflow or clipped controls;
- final normal-flow probes report zero console errors and zero page errors.

Visual QA verdict: **PASS** for the user-requested direct, proportionate review at 390x844 and 430x932. Independent visual subagents were intentionally not run because this worker was explicitly forbidden from spawning agents or teams.

## Scope and residuals

- No desktop navigation, role/cookie/auth replacement, notice API change, broad release matrix, security expansion, Todo 8 copy change, or real Kakao login was added.
- Seven pre-existing meeting-signup lint warnings remain untouched.
- Admin meeting/member domain screens still contain legacy native confirmations owned by later route-specific todos; the Todo 13 notice workspace itself has no native `confirm()`.
- Explicit keyboard-focus capture was not retained in this proportionate Todo 13 evidence set. Source focus-visible behavior and axe results remain, but dedicated focus capture is later cross-route QA debt.

## Cleanup

- Cleanup receipt: `.omo/evidence/ui-ux-overhaul/runtime/cleanup-receipt.json` records the QA container, QA volume, database port, application port, owner lock, task processes, generation process, server, browser auth process, and uploads as absent.
- Direct final checks found no listeners on ports 3100 or 55432, no `surfing-ux-qa-db-1` container, no `surfing-ux-qa-data` volume, no owned Next/Playwright runtime, and no transient symlinks outside ignored dependency metadata.
- Removed `test-results/`, `.debug-journal.md`, and the temporary response dump. Preserved the ten useful ignored final screenshots listed above.
