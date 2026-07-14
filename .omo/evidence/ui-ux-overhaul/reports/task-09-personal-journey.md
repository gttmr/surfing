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
