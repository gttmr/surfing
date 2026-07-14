# Todo 8 — Member home and meeting creation

## Outcome

- Reframed `/` around the selected meeting and the member's next action before signup detail.
- Added a Korean-labelled ARIA calendar grid with one tab stop and Arrow/Home/End/Page Up/Page Down navigation.
- Added participant search, status-group disclosure, explicit empty/search-empty/error recovery, and a direct `내 정산` route.
- Kept the bounded Todo 4 alert dialog and the single tabpanel contract.
- Reworked `/meeting/create` with field-linked validation, first-invalid focus, dirty indication, retained values on failure, and redirect to the created date.
- Kept `/meeting/[id]` as the existing compatibility redirect. Kakao remains a gate only; no external login was followed.

## Changed surface

- `src/components/landing/SurfClubLandingPage.tsx`
- `src/components/landing/landing-page-sections.tsx`
- `src/components/landing/EmbeddedMeetingDetail.tsx`
- `src/app/meeting/create/page.tsx`
- `src/lib/home-view.ts`
- `src/lib/meeting-create-form.ts`
- `src/lib/member-home.test.ts`
- `tests/e2e/member-home.spec.ts`
- `tests/e2e/meeting-create.spec.ts`

## Verification

- `npx tsc --noEmit`: PASS, exit 0 with no diagnostics.
- `npm run lint -- --quiet`: PASS, exit 0 with zero errors.
- `EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/task-08/unit npm run test:unit -- --test-name-pattern='calendar|meeting creation'`: PASS, 8/8.
- Sanitized `npm run build -- --webpack`: PASS, compiled successfully and generated 32/32 static pages. The normal Turbopack build cannot traverse the tooling-only external `node_modules` symlink in an isolated worktree; no product change was made for that environment limitation.
- Focused Playwright against the sanitized QA server and synthetic local database: PASS, 5/5 at 390x844 and 5/5 at 430x932. The browser guard recorded loopback `127.0.0.1:3100` only; no real Kakao login or external redirect was followed.
- The first 390 rerun served a stale pre-row-fix `.next` build and reproduced the calendar Axe failure. Rebuilding the current source removed it. One test-only strict-locator ambiguity with Next's route announcer was narrowed to the visible form alert before the passing reruns.

## Direct visual QA

- Inspected ten fresh full-page state captures and four focused-control viewport captures across 390px and 430px.
- Hierarchy is clear: calendar first, selected meeting and next action second, then one active task panel. Dense participants stay behind search/status grouping.
- Korean headings, labels, helper text, badges, and error copy wrap naturally with no orphaned syllables or clipped baselines.
- The calendar exposes one labelled grid, six rows total, five seven-cell week rows, one roving tab stop, full Korean selected-date labels, and visible 3px keyboard focus after Arrow navigation.
- Both widths have `scrollWidth === innerWidth`; no horizontal clipping, card overlap, or hidden content was observed.
- The fixed home header remains visible after scrolling. The final meeting-create control scrolls fully into view, retains a visible focus outline, and is not covered by fixed UI at either viewport.
- Browser console and page-error capture remained empty during the direct semantic/focus checks.

## UI decisions

- The selected-meeting summary owns date, time, location, and next action; the apply panel no longer repeats those facts.
- Members see one `내 정산` panel even when several meetings share a date; admins retain the existing per-meeting settlement view.
- Dense participant data stays available but starts behind status groups and a focused search field.
- Calendar status is expressed in both pixels and accessible names: selected, today, and meeting availability.

## Accepted debt

- The home continues to use existing server-loaded data and existing signup APIs; this task adds no polling, concurrency, or backend contract.
- The existing 15-second participant refresh remains unchanged.
- The create page retains the existing client-side session check and REST Kakao gate rather than introducing a new auth flow.
- Visual QA was performed directly in the main session because the user explicitly prohibited subagents; the independent dual-review portion of the generic visual-QA skill was therefore not run.

## Cleanup

- No real Kakao navigation, account, secret, or production data was used.
- `npm run qa:db:down` removed the `surfing-ux-qa` container and disposable volume.
- Ports 3100 and 55432 are no longer listening; no Todo 8 Next/Playwright process remains.
- `test-results/`, the transient worktree `node_modules` symlink, and the temporary debug journal were removed before staging.
- Fresh ignored screenshots and redacted loopback ledgers remain under `.omo/evidence/ui-ux-overhaul/task-08/` as local QA evidence and are not part of the commit.
