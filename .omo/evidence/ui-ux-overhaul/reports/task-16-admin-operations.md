# Todo 16 — Admin operations evidence

Date: 2026-07-15
Worktree: `surfing-ui-todo16-lite`

## Implemented

- Admin fulfillment now projects `orderRows` into distinct `orderId` groups, keeps repeated submissions separate, defaults to `처리할 일`, supports participant/menu search, and exposes `처리할 일`, `전체 주문`, and `완료·취소` filters.
- Only one fulfillment order accordion can be expanded; completed/cancelled history starts collapsed. Existing row actions, PATCH payloads, 409 handling, cancellation confirmation, and completion-reversal confirmation remain in the admin path.
- The shop composition was extracted without changing its rendered path or behavior.
- Settlement now presents one page total, recipient accordions split into `정산 대기` and `송금 완료`, and participant details only inside an expanded recipient. Closed settlements show `정산 준비 중` and `금액 비공개`. Adjustment inputs have visible labels, and settlement opening/deletion use named semantic dialogs.
- Existing settlement endpoints, payloads, mutations, and error handling are preserved. No API, server helper, schema, auth, transaction, polling, or generic framework changes were made.

## TDD and verification

- Red: `node --import tsx --test src/lib/admin-fulfillment-presentation.test.ts` failed before the projection helper existed with `Cannot find module './admin-fulfillment-presentation'`.
- Green: the focused projection test passed after implementation; `EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/unit npm run test:unit` passed all `72` tests.
- `npx tsc --noEmit` — passed.
- Changed-file ESLint — passed for all changed production/helper files and `tests/e2e/admin-operations.spec.ts`.
- `npx next build --webpack` — passed: Next 16.2.1, compile/typecheck/static generation complete, `32/32` pages generated.
- `EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/390 npm run test:e2e:mobile -- tests/e2e/admin-operations.spec.ts --project=mobile-390` — passed, `1 passed (6.0s)`.
- `EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/430 npm run test:e2e:mobile -- tests/e2e/admin-operations.spec.ts --project=mobile-430` — passed, `1 passed (5.8s)`.
- The focused browser flow verified grouping/search/filtering, one-expanded-order behavior, completion reversal, 409 cancellation feedback, adjustment add/delete confirmations, closed-settlement privacy copy, and completed-recipient grouping. Final 430px geometry and accessibility assertions passed.

## Screenshots

Representative captures are retained in `390/` and `430/`:

- `390/mobile-390-admin-meetings-orders-search.png`
- `390/mobile-390-admin-meetings-orders-reversal-confirmation.png`
- `390/mobile-390-admin-meetings-orders-cancel-conflict.png`
- `390/mobile-390-admin-meetings-settlement-adjustment-confirmation.png`
- `390/mobile-390-admin-meetings-settlement-open-confirmation.png`
- `430/mobile-430-admin-meetings-settlement-completed-recipient.png`

## Cleanup and scope

- The disposable QA database and loopback server are stopped after verification; generated Playwright/runtime artifacts are removed except for the requested screenshots and this report. Port `3100` is free and the QA lock is absent.
- `.omo/plans/surfing-mobile-ui-ux-overhaul.md` remains intentionally dirty and is not staged or committed.
- Default `npm run build` was attempted but cannot run in this isolated worktree because Next's default Turbopack rejects the symlinked `node_modules` path as outside the filesystem root. The required webpack production build passed with `npx next build --webpack`.

Commit: recorded in the final handoff.
