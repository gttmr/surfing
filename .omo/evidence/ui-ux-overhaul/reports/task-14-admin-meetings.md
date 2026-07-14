# Todo 14 — Admin meetings evidence and wrapping correction

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
- Mutation errors remain in the open dialog. Long Korean descriptions remain wrappable, while only the participant name and action phrase are atomic `inline-block whitespace-nowrap` semantic chunks.
- `Dialog.description` now accepts `ReactNode`; existing string callers retain their prior rendering behavior.

## Synthetic runtime lifecycle

- Initial ownership check found ports `3100` and `55432` free and no prior Todo 14 QA container/volume.
- `EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/task14-runtime npm run qa:db:up`, `qa:db:assert`, `qa:db:reset`, and `qa:db:seed`: PASS (`QA_CHILD_SENTINEL accepted` for each target).
- `npm run build -- --webpack`: PASS before runtime. After the reproduced inline-fragment failure, a clean final rebuild also passed compilation, TypeScript validation, and all 32 static page generations.
- Next.js 16.2.1 assigned `AdminMeetingsPageClient` webpack client module ID `0` but omitted that module from the generated React Client Manifest, including after removing `.next` and rebuilding. The disposable standalone QA assembly restored that generated ID `0` mapping from the same build's client/SSR/RSC bundles; no tracked source or dependency was altered for this build-tool defect.
- Current `public/` and `.next/static` were copied into the standalone output before launch so the production shell hydrated from the current build.
- The production server used loopback PostgreSQL and the fixed synthetic `SESSION_SECRET`. `/` returned `200`; unauthenticated `/admin/meetings` returned `307` to `/admin/login`.
- Browser egress remained guarded. No real Kakao or external URL was followed.

## Focused Playwright evidence

Fresh final commands used the same synthetic `SESSION_SECRET`, exact Todo 14 spec, one worker, and matching evidence directory. The registered QA DB reset/seed lifecycle restored the destructive fixture between viewport runs:

- `SESSION_SECRET='surfing-qa-session-secret-not-production' EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/390 npx playwright test tests/e2e/admin-meetings.spec.ts --project=mobile-390 --workers=1`: PASS, `12 passed (23.6s)`.
- `SESSION_SECRET='surfing-qa-session-secret-not-production' EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/430 npx playwright test tests/e2e/admin-meetings.spec.ts --project=mobile-430 --workers=1`: PASS, `12 passed (23.5s)`.

The focused contract proves:

- Upcoming/past/search/no-result list states and creation required/time validation with zero invalid POSTs.
- Retained creation draft on intercepted `500`, followed by a real synthetic create with HTTP `201` and visible list read-back.
- Counted tabs, search, grouping/details, one tab panel, four distinct empty states, and zero participant writes from read-only expansion.
- Cancel/restore/delete dialog names, consequences, initial focus, focus return, and zero writes when confirmations are dismissed.
- Retained dialogs and visible errors for intercepted participant-cancel `400`, participant-restore `404`, and meeting-delete `500`.
- Real participant cancel and restore against fixture `8838`, each HTTP `200`, returning the fixture to its original approved state.
- Real HTTP `200` delete only for disposable empty meeting `8104`, with list navigation and absence read-back.
- Reload `500` recovery UI and malformed meeting-ID not-found navigation.

The focused contract additionally locates `data-dialog-chunk="participant-name"` and `data-dialog-chunk="participant-action"` in both cancel and restore dialogs. It asserts that each chunk has exactly one client rect and that the rect remains within its description paragraph. All eight chunk/viewport combinations passed.

Intermediate red evidence was investigated rather than hidden. The first fresh mobile-390 run had `7 passed` and `5 failed`: three list/create failures came from the generated module-ID-zero manifest omission, while both dialog tests proved a plain inline span could expose two same-line client rect fragments at JSX text-node boundaries. Runtime toggling showed `inline-block` collapsed the name chunk to one contained rect, so the source was corrected without weakening the assertion. The clean final build and both complete viewport suites then passed.

## Visual and accessibility evidence

- Fresh evidence contains 27 RGB PNGs at `390 × 844` and 27 at `430 × 932` under `.omo/evidence/ui-ux-overhaul/390` and `/430`.
- Captures cover list states, validation/failure/success creation, counted/search/grouped participant views, dock clearance, all empty states, cancel/restore/delete confirmations and errors/successes, reload failure, and invalid ID.
- The earlier verifier found two wrapping defects: at `390px` the restore dialog split `합성 회원 34님` after `회원`, and at `430px` the cancel dialog split `참가를 취소합니다` between object and predicate.
- The final correction wraps only the participant name and action phrase in atomic `inline-block whitespace-nowrap` spans; the surrounding long description still wraps naturally and the geometry contract guards both chunk fragmentation and paragraph overflow.
- The four final cancel/restore confirmation PNGs were freshly overwritten at exactly `390 × 844` and `430 × 932`. Original-detail inspection found every participant name and action phrase intact, no horizontal overflow, no clipped copy, and a clear title/body/action hierarchy at both widths.
- A batched image viewer initially displayed apparent black regions in the restore previews. Direct pixel inspection found zero black or near-black pixels in all four RGB PNGs, and individual original-detail opens were fully composited; this was an evidence-viewer presentation artifact, not a product or capture defect.
- Runtime geometry assertions found no horizontal document overflow, a bottom-anchored admin dock, sufficient main bottom padding, and focused controls clearing the dock.
- Axe scans on representative states at both widths found exactly zero serious or critical violations.

## Final static evidence

- `npx tsc --noEmit --incremental false`: PASS, no output after restoring lockfile-pinned local dependencies in this worktree.
- `npx eslint src/components/admin/AdminMeetingDetailPageClient.tsx src/components/ui/Dialog.tsx tests/e2e/admin-meetings-support.ts tests/e2e/admin-meetings.spec.ts`: PASS, no output.
- `git diff --check`: PASS, no output.
- `bun run .tmp/qa/check-no-excuse-rules.ts src/components/admin/AdminMeetingDetailPageClient.tsx src/components/ui/Dialog.tsx tests/e2e/admin-meetings-support.ts tests/e2e/admin-meetings.spec.ts`: PASS, `No violations in 4 file(s).` The temporary checker was an unchanged local copy of the plugin script so Bun resolved the worktree's lockfile-pinned `typescript`; it is removed during cleanup.
- Pure nonblank/noncomment LOC for the current correction files: `185` (`AdminMeetingDetailPageClient.tsx`), `123` (`Dialog.tsx`), `65` (`admin-meetings-support.ts`), and `222` (`admin-meetings.spec.ts`). The main spec remains in the 200–250 warning band and its helpers/scenarios are already split into focused modules.
- Final clean `npm run build -- --webpack`: PASS after the product-source correction.

## Verdict

Todo 14 is runtime-, visual-, accessibility-, and static-check complete for the requested synthetic mobile scope. The wrapping correction passes the exact focused suite and fresh visual inspection at both supported widths. Exhaustive desktop/cross-browser and broad backend/security matrices remain intentionally outside this task.
