# Todo 14 — Admin meetings runtime and visual completion

## Scope

- Worktree: `/workspace/surfing-ui-todo14`
- Routes: `/admin/meetings`, `/admin/meetings/[id]`
- Source scope: administrator meeting list/create/detail/participant presentation plus the focused Todo 14 Playwright contract.
- Preserved contracts: existing admin guard and meeting/participant API shapes; orders, settlement, application open/close, and navigation behavior.
- Intentionally out of scope: authorization, API, schema, backend-security, desktop, cross-browser, and unrelated design-system changes.

## Implemented result

### Meeting list and creation

- Added counted upcoming/past workspaces, date/location/type search, bounded results, and distinct empty/no-result states.
- Kept creation in a separate mobile workspace. Required/date/time validation is field-associated, focuses the first invalid control, and sends no POST while invalid.
- Server failures are visible beside the form and retain the complete draft. A successful synthetic POST returns the created meeting to the relevant list.

### Meeting detail and participant review

- Shows all four participant counts, one semantic tab panel at a time, participant search, status grouping, and collapsible read-only facts.
- Provides distinct approved, waitlisted, cancelled, all, and search no-result states.
- Keeps reload/retry and admin navigation available on reload failure; malformed IDs use the existing admin not-found exit.
- Read-only expansion and dismissed confirmations issue zero writes.

### Confirmations and mutation feedback

- Replaced native deletion confirmation with the shared semantic `Dialog`; participant cancel and restore have action-specific dialogs.
- Dialogs name the meeting and participant where applicable, state consequences, focus the close control on open, and return focus to their trigger on dismissal/success.
- Mutation errors remain in the open dialog. Korean descriptions use keep-aware wrapping at narrow widths.

## Synthetic runtime lifecycle

- Initial ownership check found ports `3100` and `55432` free and no prior Todo 14 QA container/volume.
- `EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/task14-runtime npm run qa:db:up`, `qa:db:assert`, `qa:db:reset`, and `qa:db:seed`: PASS (`QA_CHILD_SENTINEL accepted` for each target).
- `npm run build -- --webpack`: PASS before runtime; the final rebuild after the dialog wrapping change also passed compilation, TypeScript validation, and all 32 static page generations.
- The production server used loopback PostgreSQL and the fixed synthetic `SESSION_SECRET`. `/` returned `200`; unauthenticated `/admin/meetings` returned `307` to `/admin/login`.
- Browser egress remained guarded. No real Kakao or external URL was followed.

## Focused Playwright evidence

Final commands used the same synthetic `SESSION_SECRET`, exact Todo 14 spec, one worker, and matching evidence directory:

- `SESSION_SECRET='surfing-qa-session-secret-not-production' EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/390 npx playwright test tests/e2e/admin-meetings.spec.ts --project=mobile-390 --workers=1`: PASS, `12 passed (22.8s)`.
- `SESSION_SECRET='surfing-qa-session-secret-not-production' EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/430 npx playwright test tests/e2e/admin-meetings.spec.ts --project=mobile-430 --workers=1`: PASS, `12 passed (23.4s)`.

The focused contract proves:

- Upcoming/past/search/no-result list states and creation required/time validation with zero invalid POSTs.
- Retained creation draft on intercepted `500`, followed by a real synthetic create with HTTP `201` and visible list read-back.
- Counted tabs, search, grouping/details, one tab panel, four distinct empty states, and zero participant writes from read-only expansion.
- Cancel/restore/delete dialog names, consequences, initial focus, focus return, and zero writes when confirmations are dismissed.
- Retained dialogs and visible errors for intercepted participant-cancel `400`, participant-restore `404`, and meeting-delete `500`.
- Real participant cancel and restore against fixture `8838`, each HTTP `200`, returning the fixture to its original approved state.
- Real HTTP `200` delete only for disposable empty meeting `8104`, with list navigation and absence read-back.
- Reload `500` recovery UI and malformed meeting-ID not-found navigation.

Intermediate red evidence was investigated rather than hidden: the initial focused baseline exposed two brittle test assertions (framework route-announcer alert ambiguity and a prose connective), and a post-rebuild invocation without the matching secret reached the login page. The assertions were scoped to stable semantics and the final test process used the server's secret; neither failure was a product runtime regression.

## Visual and accessibility evidence

- Fresh evidence contains 27 RGB PNGs at `390 × 844` and 27 at `430 × 932` under `.omo/evidence/ui-ux-overhaul/390` and `/430`.
- Captures cover list states, validation/failure/success creation, counted/search/grouped participant views, dock clearance, all empty states, cancel/restore/delete confirmations and errors/successes, reload failure, and invalid ID.
- Direct inspection found coherent navy/sky/white hierarchy, natural Korean dialog wrapping, readable error/empty distinctions, and unobstructed primary actions at both widths.
- Runtime geometry assertions found no horizontal document overflow, a bottom-anchored admin dock, sufficient main bottom padding, and focused controls clearing the dock.
- Axe scans on representative states at both widths found exactly zero serious or critical violations.

## Final static evidence

- `npx tsc --noEmit`: PASS, no output. The earlier missing Playwright/Axe dependency blocker is resolved by the intended ignored `node_modules` symlink used only during QA.
- Changed-file `npx eslint`: PASS, no output across all Todo 14 application and e2e TypeScript/TSX files.
- `git diff --check`: PASS, no output.
- Pure nonblank/noncomment LOC: changed application files are `22`, `185`, `97`, `154`, `57`, `148`, and `48`; test files are `210`, `48`, and `105`. The main spec is in the 200–250 warning band and its helpers/scenarios are already split into focused modules.
- Final `npm run build -- --webpack`: PASS.

## Verdict

Todo 14 is runtime-, visual-, accessibility-, and static-check complete for the requested synthetic mobile scope. No blocking defect remains; exhaustive desktop/cross-browser and broad backend/security matrices remain intentionally outside this task.
