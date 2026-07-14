# Todo 9 Personal Journey

## Outcome

- 프로필은 읽기 화면을 기본으로 보여 주고 `편집`을 눌러야 초안 입력과 이미지 변경이 열린다.
- 초안은 명시적인 저장 전까지 화면 상태에만 머물며, 저장 실패 시 입력값과 오류 안내가 함께 유지된다.
- 정회원의 동반인 목록은 빈 상태, 계정 연결, 연결 대기, 밀집 목록을 서로 다른 시각 상태로 구분한다.
- 프로필에서 홈, 정산, 허용된 샵/관리자 화면으로 이동할 수 있으며 링크는 역할이나 세션을 변경하지 않는다.
- 개인 정산은 모임별 합계와 사람별 상세를 한 번씩만 보여 주고, 신청 확인은 확정/대기/취소/알 수 없음/쿼리 누락을 구분한다.

## Scope

Product files:

- `src/components/profile/ProfilePageClient.tsx`
- `src/components/profile/profile-page-sections.tsx`
- `src/components/profile/useProfilePageState.ts`
- `src/components/profile/ProfileImageUploader.tsx`
- `src/app/settlement/page.tsx`
- `src/app/signup/confirm/page.tsx`

QA files:

- `tests/e2e/personal-journey.spec.ts`
- `tests/fixtures/mobile-ux.ts`

No authentication, session, storage adapter, database schema, or production upload fallback was added.

## Interaction Contract

- Profile read/edit: read state owns the persisted presentation; edit state owns name, phone, and companion-link drafts. `취소` restores persisted values. Successful explicit save returns to read state. A `400`, `403`, `500`, or transport failure leaves the draft visible.
- Avatar: the image picker accepts JPG/PNG/WebP, the Todo 4 `Dialog` traps focus and restores it on Escape/cancel, and the crop has a labelled keyboard-operable zoom input. UI success is tested only with a Playwright-intercepted local `/logo.png` response.
- Real upload route: invalid MIME is checked separately and the production server without GCS/Blob credentials is expected to return `503`; no external storage request is followed.
- Companions: linked and waiting rows have distinct icon/status text and one labelled delete action. Empty state points to the single add action. Five or more rows use a bounded list.
- Portal links: MEMBER sees home/settlement, SHOP_OWNER also sees shop, ADMIN also sees admin login. All are ordinary links to existing routes.
- Settlement: each meeting shows one `보낼 금액`; participant rows show their own reconciled subtotal and non-zero components. Empty state returns to profile.
- Confirmation: approved, waitlisted, cancelled, unknown, and missing-query states keep one home action and a secondary profile link.

## Verification

Static checks completed:

- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with 0 errors and the existing 7 warnings in meeting signup files.
- `npm run build`: PASS, Next.js production build completed all 32 static page generations.
- `git diff --check`: PASS.
- Playwright discovery: 5 focused tests listed for `mobile-390`.

Runtime checks completed on the same fresh production build and reset fixture database:

- `EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/390 npm run test:e2e:mobile -- tests/e2e/personal-journey.spec.ts --project=mobile-390 --workers=1`: PASS, 5/5.
- `EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/430 npm run test:e2e:mobile -- tests/e2e/personal-journey.spec.ts --project=mobile-430 --workers=1`: PASS, 5/5.
- Failed profile save kept name and phone drafts; intercepted success returned to read state.
- Crop Escape restored focus to the labelled photo trigger; invalid MIME returned `400`; the real credential-free production upload returned expected `503`; intercepted UI success used only `/logo.png`.
- Linked, waiting, empty, and five-row dense companion states were observed. Test-created dense rows were deleted before the test finished.
- Fixture user `qa-user-01` reconciled two settlement meetings; `qa-user-35` showed the empty return path.
- Approved, waitlisted, cancelled, unknown, and missing confirmation states rendered without real Kakao login.
- SHOP_OWNER and ADMIN profile navigation exposed only their existing portal links; no test mutated user roles.

Fresh visual evidence contains six states for each viewport. Direct inspection found no clipping, tofu, unnatural Korean wrapping, fixed-dock obstruction, or hierarchy blocker. The image viewer's apparent black patches on the profile-image-edit preview were disproved against the actual RGB files: sampled background pixels are white, white pixels occupy 78.2–80.9%, and black pixels only 0.44–0.48% (logo/text).

Independent visual review completed on all 12 fresh captures:

- Design-system / functional reviewer: `PASS`, high confidence, no blocking findings.
- Visual-fidelity / CJK reviewer: `PASS`, high confidence, no blocking findings.

## Cleanup

- No real Kakao login was used.
- No external storage credentials or requests were used.
- Test-created companion rows are deleted in a `finally` block; the final QA lifecycle reset/down provides the second cleanup boundary.
- Generated screenshots and JSON remain under `.omo/evidence/ui-ux-overhaul/390` and `/430`; transient Playwright and QA process state is removed at teardown.
- Ports `3100` and `55432` are free; QA container, volume, lock, `.next`, `test-results`, and upload files are absent.

## Independent Verifier Remediation — 2026-07-15

The verifier rejection was reproduced from current source before remediation:

- `ProfileImageUploader` posted the cropped image immediately and `discardDraft` did not own avatar state.
- Profile dirty state had no in-app navigation, tab-change, logout, or browser-exit guard.
- Settlement detail omitted food subtotal/support while `totalFee` included the resulting food charge, and the page ignored `isCompleted`.
- `/signup/confirm` read personal query values but left them in the browser address.
- The companion-name field had only placeholder text and no accessible name.
- The focused E2E file did not assert any of these rejected behaviors.

Remediation implemented:

- Cropped avatars now remain as a local draft preview. Profile cancel revokes/discards the preview without calling the avatar route; explicit profile save uploads it after the profile mutation. An avatar upload failure leaves the draft preview and edit state available for retry.
- A small profile leave guard uses the existing accessible `Dialog` for stay/discard decisions on portal links, home navigation, logout, and semantic tab changes. Dirty browser exits register `beforeunload`; clean profiles do not.
- Settlement participant components are derived from the authoritative line item, including food subtotal and food support as a negative component. A residual reconciliation line prevents a displayed-component mismatch. Each meeting now shows one completion status and one existing-API action without repeating the meeting total.
- Confirmation keeps the existing server-rendered presentation, then removes the query string with `history.replaceState` after hydration.
- The companion-name input now exposes `aria-label="동반인 이름"`.
- Focused regression coverage was added to `tests/e2e/personal-journey.spec.ts`, plus pure unit coverage for avatar dirty state and settlement component reconciliation.

Current static verification:

- `node --import tsx --test --test-concurrency=1 src/lib/profile-draft.test.ts src/lib/settlement-presentation.test.ts`: PASS, 4/4.
- `npx tsc --noEmit`: PASS.
- Changed-file `npx eslint ...`: PASS, 0 errors and 0 warnings.
- `git diff --check`: PASS.
- No Playwright, Docker, database, production build, or QA lifecycle command is counted as remediation evidence.

Boundary incident:

- An unfiltered `npm run test:unit` was mistakenly invoked once. Its QA security-regression fixture briefly binds port `3100` and closes it in a `finally` block. The run completed, but it violated this worker's no-port constraint and is not counted as accepted verification. No further QA-wrapper command was used.

Runtime checks still required by the later QA owner:

- Run the focused personal journey suite at `mobile-390` and `mobile-430` on a fresh owned QA lifecycle.
- Prove avatar apply performs no POST before profile save, profile cancel restores the persisted avatar, save performs one avatar POST, and 400/503 failures retain a recoverable preview.
- Prove dirty stay/discard behavior for links and tabs, logout protection, native browser-exit prompting, focus trap/restore, and clean-navigation behavior after save/discard.
- Prove the `17,750원` food-only fixture renders food and support components whose sum equals the participant total, and completion toggle/reopen reflects authoritative API state without duplicate totals.
- Prove approved/waitlisted/cancelled/unknown/missing confirmation content survives while the address becomes exactly `/signup/confirm`.
- Re-run axe and fresh visual/CJK review for all changed profile, dialog, settlement, and confirmation states at both supported viewports.

All runtime and visual results earlier in this report predate the remediation and are stale for final acceptance.

## Remediation Runtime and Visual Completion — 2026-07-15

The later QA owner completed a fresh, bounded lifecycle from the current remediation source. Ports `3100` and `55432` were free before startup. The registered QA database was started, asserted, reset, and seeded; the application was built with `npm run build -- --webpack` and started through the protected `start:qa` launcher with the same synthetic `SESSION_SECRET` used by the test configuration.

Focused runtime results on the final current-source build:

- `mobile-390`, one worker: PASS, 6/6 in 19.4 seconds.
- `mobile-430`, one worker: PASS, 6/6 in 18.8 seconds.
- Each run used its matching `.omo/evidence/ui-ux-overhaul/390` or `/430` `EVIDENCE_DIR`.
- The focused Playwright CLI was invoked directly while the registered `start:qa` process owned the lifecycle lock. Re-entering `test:e2e:mobile` would correctly be rejected as a second lifecycle owner; this is intentional launcher ownership, not a bypass of the protected server.
- Browser request ledgers contain only `127.0.0.1:3100`. The server egress guard allowed only local application/database traffic and blocked four attempted Prisma checkpoint requests before any external connection was followed. No real Kakao login or external storage request was used.

Two product defects surfaced during this fresh runtime and were corrected minimally:

- A successful avatar upload could be overwritten by the response from the basic-profile mutation because that endpoint returned `profileImage: null`. The profile mutation now preserves the client-owned persisted avatar fields, so a later `503` leaves the new preview recoverable and cancel reliably restores the last saved avatar.
- Axe found the shared inline-danger foreground at 3.87:1 against its composited surface. `.brand-inline-danger` now uses the existing `--brand-danger-text` semantic token. The final avatar-failure state has no serious or critical Axe violation at either width.

The final focused suite proves:

- avatar preview performs no avatar POST before explicit save, cancel restores the persisted image, save performs one POST, and the credential-free `503` state keeps a recoverable preview;
- dirty stay/discard behavior covers portal navigation, semantic tabs, and logout, with initial focus, Shift+Tab trapping, focus restoration, browser-exit registration, and clean navigation after save/discard;
- settlement component rows reconcile exactly to `17,750원`, and completion/reopen controls round-trip through the authoritative API without duplicating the meeting total;
- confirmation variants retain their content while the browser address is cleaned to exactly `/signup/confirm`;
- companion input naming, Korean text, focus behavior, horizontal overflow, and fixed-dock reachability pass at both supported widths;
- final Axe scans report zero serious or critical violations for the affected profile, avatar failure, leave dialog, companion, settlement, and confirmation states.

Fresh current-build evidence contains seven PNGs per viewport (14 total): profile read after save, image edit, avatar failure, dense companions, multi-line settlement, missing confirmation, and role navigation. Direct inspection at 390 and 430 pixels found no horizontal clipping, tofu, unnatural Korean wrapping, or fixed-dock obstruction. The settlement food/support lines visibly sum to the displayed total, the completion action is coherent, the confirmation address assertion is clean, and the companion label is exposed. The two final avatar-failure captures were re-inspected after the contrast correction. Independent agent review was intentionally not run because this bounded worker was explicitly prohibited from spawning agents; the acceptance verdict is based on direct current-build inspection and the focused browser assertions.

Final static evidence after the runtime corrections:

- Focused pure unit tests: PASS, 4/4.
- `npx tsc --noEmit`: PASS.
- Changed TypeScript-file ESLint: PASS, 0 errors and 0 warnings. CSS is not an ESLint input in this repository; an excluded CSS invocation produced only the expected ignored-file launcher warning and is not a product result.
- `git diff --check`: PASS.
- Final `npm run build -- --webpack`: PASS, including all 32 static page generations.

Launcher classification:

- One focused recapture was mistakenly started after the server had been stopped for the final rebuild and before it was restarted. It failed at navigation with `ERR_CONNECTION_REFUSED`, reached no product route, and is excluded. The server was then started correctly and both complete 6/6 suites above passed on the final build.

Final teardown verification:

- The protected application process was stopped before database teardown.
- The registered `qa:db:down` command completed with its child sentinel accepted.
- No listener remains on `3100` or `55432`; no Todo 9 QA container or volume remains.
- Lifecycle locks, `.next`, `test-results`, Playwright report output, the debug journal, and transient upload files are absent.
- All 14 useful fresh ignored screenshots remain under the two evidence directories.
