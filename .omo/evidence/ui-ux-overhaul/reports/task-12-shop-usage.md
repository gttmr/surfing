# Todo 12 lite — shop usage review

## Delivered scope

- Default actionable review with exact `미제출`, `확인 필요`, and `확정` counts.
- Participant name/request-label search, one expandable row, read-only confirmed inspection, labelled 44px steppers, and empty-state recovery.
- Saved-versus-local draft tracking, participant/global dirty state, semantic discard guard, save-before-confirm flow, and server-authoritative save/confirm responses with distinct errors.
- Compact progress/dirty summary with initial controls and final content kept clear of the shop dock.
- Confirmed rows use the saved item name and amount snapshots even after current catalog changes.
- Catalog add/edit/activate behavior retained in a separate collapsed settings section.

## Automated verification

- `EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/task-12-lite npm run test:unit -- --test-name-pattern='shop usage review|shop usage response guard'` — 20 passed, 0 failed; includes filtering, dirty comparison, and complete-response validation.
- `npx tsc --noEmit --incremental false` — passed.
- `npx eslint src/components/shop/ShopSurfUsageWorkspace.tsx src/components/shop/ShopUsageCatalogSection.tsx src/components/shop/ShopUsageParticipantReview.tsx src/components/shop/ShopUsageParticipantRow.tsx src/components/shop/shop-usage-response.ts src/components/shop/shop-usage-review.ts src/lib/shop-usage-review.test.ts tests/e2e/shop-usage.spec.ts` — passed.
- `NEXT_TELEMETRY_DISABLED=1 CHECKPOINT_DISABLE=1 npm run build -- --webpack` — passed; compiled, typechecked, and generated 32 static pages.
- `NEXT_TELEMETRY_DISABLED=1 CHECKPOINT_DISABLE=1 npm run build` — blocked before compilation by the pre-existing worktree symlink `node_modules -> /workspace/surfing-mobile-ui-ux-overhaul/node_modules`; Turbopack reports that it points outside the filesystem root.

## Browser and visual evidence

Guarded Playwright used only the synthetic QA session and loopback ports 3100/55432:

- `EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/task-12-lite npm run test:e2e:mobile -- tests/e2e/shop-usage.spec.ts --project=mobile-390 --project=mobile-430 --workers=1` — 4 passed in 12.5s.
- Verified search, all status filters/counts, collapsed default, row editing, dirty stay/discard guard, failed and successful save/confirm, snapshot-based confirmed read-only mode, empty recovery, no horizontal overflow, no serious/critical Axe findings, 44px frequent targets, initial-control/dock/final-content clearance, and no console errors in the normal review flow.
- Fresh screenshots were directly inspected at 390x844 and 430x932; Korean wrapping, hierarchy, target sizing, dock clearance, and exception-first density are acceptable after correcting the 390px first-screen overlap found in review.

Screenshots (each prefix exists for both `mobile-390` and `mobile-430`):

- `.omo/evidence/ui-ux-overhaul/task-12-lite/{viewport}-usage-default.png`
- `.omo/evidence/ui-ux-overhaul/task-12-lite/{viewport}-usage-dirty-guard.png`
- `.omo/evidence/ui-ux-overhaul/task-12-lite/{viewport}-usage-confirmed-readonly.png`
- `.omo/evidence/ui-ux-overhaul/task-12-lite/{viewport}-usage-save-error.png`
- `.omo/evidence/ui-ux-overhaul/task-12-lite/{viewport}-usage-confirm-error.png`
- `.omo/evidence/ui-ux-overhaul/task-12-lite/{viewport}-usage-empty-recovery.png`

## Cleanup

- Standalone QA app process on 3100: stopped.
- QA PostgreSQL container/volume on 55432: removed with `npm run qa:db:down`.
- Ports 3100 and 55432: no listeners; Docker has no container publishing 55432.
- Generated `.next`, `test-results`, and temporary debug journal: removed before commit.

## Remaining uncertainty

- The default Turbopack build cannot run in this isolated worktree while `node_modules` remains an external symlink. No dependency or worktree-layout change was made because it is outside Todo 12.
- The intentionally lightweight flow does not add polling, version conflicts, concurrency orchestration, backend/API changes, or DB-load verification.
