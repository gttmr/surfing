# Todo 17 menu editor evidence

## Completed scope

- Preserved the shared `/admin/menus` and `/shop/menus` editor, existing API payload, database schema, navigation, semantic tokens, and intentional Todo 17 dirty implementation.
- Corrected search-focus retention. `searchCatalog` now accepts one focused category/menu/option key and retains only that result path while its matching name is edited. Blur or any search change/reset clears the retention; unrelated menus/options do not become sticky.
- Corrected the save race with the smallest safe contract. While a save is pending, the editor fieldset disables every descendant input/button and the hook rejects draft mutations, discard/reload, delete confirmation, and duplicate save calls. A successful response can therefore replace the submitted draft without dropping a post-submit edit.
- Corrected confirmed-delete focus deterministically: category deletion focuses the catalog search, menu deletion focuses its surviving category toggle, and option deletion focuses its surviving menu-name input. Search retention keeps the required parent mounted when the deleted menu/option was the only query match.
- Corrected the reproduced post-delete Save failure. Search-focus release now waits until the next animation frame, cancels a pending release when another retained editor input gains focus, and therefore keeps the sticky Save target stable through the browser click event. The regression requires two real browser PUT requests before reload verification.
- Removed the duplicate search clear affordance by hiding Chromium's native search cancel control while keeping the app's labelled 44px clear button.
- Kept semantic named delete dialogs and existing cancel focus restoration. No shared `Dialog`, route, API, schema, token, or broad hardening changes were made.

## Tests and runtime contracts added

- Added focused pure tests for category, menu, and option search retention after the active matching label changes. The three tests were first observed failing against the mutable-draft-only search, then passed after the correction.
- Updated `tests/e2e/menu-editor.spec.ts` with deterministic contracts for all three confirmed-delete focus destinations.
- Replaced the mocked pre-edit success response with a delayed real PUT contract. The spec asserts the complete editor is locked while pending, saves a disposable option on menu `8437`, reloads, verifies it through the authenticated GET API backed by the QA database, deletes it, sends the second PUT, reloads, verifies removal, and restores the original catalog in `finally`.
- Added a synthetic zero-catalog reload state and serious/critical Axe checks. Dense/long-Korean search also carries serious/critical Axe and overflow checks.

## Verification

- Focused unit test: **PASS, 8/8** via `node --import tsx --test src/lib/food-menu-editor.test.ts`.
- TypeScript: **PASS** via `npx tsc --noEmit --incremental false` and the final production build.
- Changed-file ESLint: **PASS** for the nine Todo 17 TypeScript/TSX files.
- TypeScript no-excuse rules: **PASS, 9 files**.
- Whitespace: **PASS** via `git diff --check`; the final handoff also checks untracked Todo 17 files directly.
- Production webpack build: **PASS** via `npm run build -- --webpack`; TypeScript completed and 32 static pages were generated. One earlier rerun was externally terminated with exit 143 after compilation; memory and kernel checks were clean, and the immediate clean rerun passed.
- Pure LOC review: all Todo 17 source/test files remain at or below 250 non-blank/non-comment lines. `useFoodMenuEditor.ts` is exactly 250 and `food-menu-editor.ts` is 232, so the next behavior added to either responsibility should begin with a cohesive split.

## Runtime and visual QA

- Guarded disposable PostgreSQL lifecycle: **PASS** for up/health, reset/seed, final reset/health, and down on loopback port 55432.
- Mobile 390: **PASS, 6/6** via the exact `tests/e2e/menu-editor.spec.ts` project with one worker.
- Mobile 430: **PASS, 6/6** via the exact same spec and one worker.
- Covered dense 37-menu/60-variant search, client validation without a request, 400/404/500 draft retention, reload cancellation, delayed-save locking, two real PUTs, persisted disposable option add/remove, zero catalog recovery, deterministic category/menu/option focus, and shared admin/shop shells.
- Fresh evidence: **12 PNGs**, six at 390x844 and six at 430x932 under `visual/task-17-menu-editor`.
- Visual verdict: **GOOD** after original-detail inspection of every state. Long Korean text wraps without page overflow, hierarchy and shell identity stay clear, dialogs and feedback remain legible, and the corrected search control exposes one clear action. Serious/critical Axe findings are zero in the dense and zero-catalog scenarios where asserted.

## Cleanup

- The production server, ports 3100/55432, QA container and volume, `.next`, Playwright traces, debug journal, runtime receipts/ledgers, and TypeScript build info were removed.
- The final worktree preserves only the ten intended Todo 17 report/source/test files plus the ignored 12 PNG evidence files and the shared dependency installation.
