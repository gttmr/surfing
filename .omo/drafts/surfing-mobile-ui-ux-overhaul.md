---
slug: surfing-mobile-ui-ux-overhaul
status: approved
intent: unclear
review_required: true
classification: architecture
pending-action: run mandatory dual high-accuracy review
approach: Preserve the intentional mobile-only shell and Surfing brand, then rebuild the member ordering, shop operations, and admin workflows around task-focused navigation, explicit order history, safe mutations, and shared accessible primitives without changing the external DB schema.
---

# Draft: surfing-mobile-ui-ux-overhaul

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->
| id | outcome | status | evidence path |
| --- | --- | --- | --- |
| C1 | Mobile foundation has safe-area-correct navigation, semantic reusable controls, route states, corrected tokens, and no unused Kakao SDK loader | active | `src/app/layout.tsx`, `src/app/globals.css`, `src/components/ui/*`, `tailwind.config.ts` |
| C2 | Members can understand and move among meetings, participation, alerts, companions, and their settlements without unbounded or orphaned flows | active | `src/components/landing/*`, `src/components/schedule/*`, `src/components/profile/*`, `src/app/settlement/page.tsx` |
| C3 | Participants can find menus, build/review an order, and see/edit/cancel eligible historical submissions without losing fulfillment state | active | `src/components/meeting/MeetingFoodOrderPanel.tsx`, `src/lib/food-ordering*.ts`, `src/app/api/meetings/[id]/orders/route.ts` |
| C4 | Shop staff receive automatically refreshed orders and complete food/usage work through searchable, exception-first, concurrency-safe queues | active | `src/components/shop/*`, `src/components/admin/MeetingOrdersWorkspace.tsx`, `src/app/api/shop/meetings/[id]/orders/route.ts` |
| C5 | Admin staff manage messages, meetings, members, settlements, pricing, settings, and the catalog through bounded mobile workspaces with explicit save/destructive-action contracts | active | `src/components/admin/*`, `src/app/admin/**/*` |
| C6 | All roles and critical states are verified at 390px and 430px against a guarded disposable local PostgreSQL database; the external DB is never connected during new automated QA | active | tracked `.omo/evidence/ui-ux-audit/baseline-manifest.md`, optional private captures, `package.json`, planned QA assets |

## Open assumptions (announced defaults)
<!-- Intent is UNCLEAR: research resolves ambiguity, defaults are adopted (not asked), and each is surfaced in the plan's human TL;DR for veto. -->
<!-- assumption | adopted default | rationale | reversible? -->
| assumption | adopted default | rationale | reversible? |
| --- | --- | --- | --- |
| Visual direction | Keep the navy/sky/white brand and improve hierarchy/interaction rather than rebrand | Existing tokens and user request support product improvement, not identity replacement | Yes |
| Viewports | Keep the global 430px shell and disabled desktop breakpoints; QA only 390px and 430px | User explicitly stated the app is mobile-only and desktop Chrome is a mobile preview surface | Yes |
| Portal topology | Keep member/admin/shop portals separate; add explicit role switching and a discoverable `내 정산` entry | Roles have distinct work, but current shortcuts are buried | Yes |
| UI dependencies | Build small semantic primitives in `src/components/ui`; add no third-party UI framework | Existing token/class system is the source of truth and current controls need one interaction contract | Yes |
| Order data | Keep the existing schema; edit by atomically cancelling and replacing the entire eligible submission, never by updating item quantities in place | Existing parents/snapshots preserve both submissions; `updatedAt` supports conflicts, while in-place edits would contradict immutable history | Yes |
| New order semantics | Later additions remain explicit new submissions; existing submissions are shown separately with time/status | Repeated submissions already exist and collapsing them caused the review problem | Yes |
| Shop refresh | Visibility-aware 5-second polling, manual refresh, and last-updated feedback; no WebSocket/SSE | Low-volume traffic does not justify new realtime infrastructure | Yes |
| Long lists | Search/filter/collapse/pagination as appropriate; no virtualization dependency | Current real sizes are moderate but task density is high | Yes |
| Shop usage | Exception-first filters and explicit per-participant save/confirm; no bulk mutations | Bulk fulfillment changes are operationally risky and not requested | Yes |
| Kakao SDK | Remove unused JS SDK loader, public JS key wiring, retry loop, and ambient types; preserve REST OAuth | Repo-wide usage search found no JS SDK consumer and real login succeeds through server OAuth | Yes |
| Verification data | Use only a guarded disposable local PostgreSQL database for every new automated unit/integration/browser run; never connect the external DB | `/profile`, shop usage GET, and current `npm start` can write, so even nominally read-only navigation is unsafe | Yes |
| QA toolchain | Add direct dev dependencies `tsx`, `@playwright/test`, and `@axe-core/playwright`, plus named local-DB/unit/integration/mobile-E2E scripts | Existing TS tests are not runnable and broad interaction changes require deterministic browser/accessibility checks | Yes |
| QA environment | Run every DB-capable command through one sanitized wrapper that overwrites inherited DB/auth/storage variables with fixed QA-only values | A guard on selected write scripts is insufficient because server renders and nominal GETs connect/write | Yes |
| Mutable test isolation | Serialize mutation-bearing browser/gate runs and force-reset/reseed the guarded local database before each spec/viewport/gate | Shared global catalog, users, and orders otherwise make the matrix order-dependent | Yes |
| Mixed order submissions | Lock participant edit/cancel when any sibling item in the parent is cancelled, preparing, or served; version-check every sibling | “Whole submission” must not mean only the active remainder | Yes |
| Confirmed usage | Confirmed usage is read-only until an explicit confirmed-version `reopen` action returns it to SUBMITTED | Silent reopening on Save would erase the meaning of confirmation | Yes |
| General admin conflicts | Use version conflicts only for order/usage/fulfillment; validate ordinary member/menu/settings writes and preserve drafts on 4xx/5xx | Existing schema has no coherent CAS token for all admin forms and a schema migration is out of scope | Yes |

## Findings (cited - path:lines)
- `src/app/layout.tsx:58-66` intentionally constrains the app to 430px and injects Kakao JS SDK 2.7.4; the user confirmed the mobile-only shell is intentional.
- `src/app/layout.tsx:66-83` contains an SRI value missing its final `a` and an unbounded 100ms retry loop. Repo-wide search finds no JS SDK consumer outside this initialization; server OAuth is implemented in `src/app/api/auth/kakao/route.ts` and `callback/route.ts`.
- `src/components/meeting/MeetingFoodOrderPanel.tsx:36-62,224-241,355-496` initializes every menu/option to zero, renders the full catalog, and places the total/support summary below the catalog and submit CTA.
- `src/components/meeting/MeetingFoodOrderPanel.tsx:252-315` uses a clickable `div` and a non-semantic bottom sheet without dialog/focus/Escape behavior.
- `src/lib/food-ordering-data.ts:66-251` returns all active menus and historical order IDs/timestamps; the current participant UI discards submission identity.
- `src/app/api/meetings/[id]/orders/route.ts:106-154` accepts append-only POST submissions; participants have no owner-scoped edit/cancel route.
- `src/components/shop/ShopDashboardPageClient.tsx:18-50` calls the board real-time but only holds server `initialData`; an existing shop GET route is not polled.
- `src/components/admin/MeetingOrdersWorkspace.tsx:177-217,228-267,584-620` exposes independent row actions and immediate `완료 취소`; the audit accidentally triggered it, proving the affordance risk.
- `src/lib/food-ordering-data.ts:326-512` aggregates participant/menu rows, losing submission identity and later arrival ordering.
- `src/lib/food-ordering-data.ts:857-949` performs all-or-nothing prepare/serve/undo writes with no version check.
- Source inventory found 19 routes, 18 rendered pages, no custom `loading.tsx`, `error.tsx`, or `not-found.tsx`, and no in-app entry to `/settlement`.
- Browser evidence at `.omo/evidence/ui-ux-audit/private/` covers all routes and critical loaded/modal/tab states with actual external DB data: 35 users, four meetings, 36 active menus expanding to 60 controls, meeting 9 with 21 confirmed participants and 40 active ordered units.
- Full-page evidence measured admin orders at 10,267px, admin menus at 7,672px, and populated shop usage at 11,380px; fixed bottom navigation overlays these mobile workspaces.
- Home DOM measurement found 44 buttons, 35 unlabeled numeric date buttons, and zero tab/selected/current semantics.
- `package.json` has no `test` script or test runner dependency even though three `node:test` TypeScript suites exist. `node --test src/lib/*.test.ts` currently fails all three files at module resolution before any assertion; the plan must first make existing tests genuinely runnable.
- Current baselines are `npm run lint` exit 0 with seven pre-existing unused-variable warnings in signup files, and `npm run build` exit 0 across all current routes. These warnings are not a license for unrelated cleanup.
- Docker 29.2 is available locally while the Prisma datasource is PostgreSQL-only (`prisma/schema.prisma:5-8`); write-path QA can use a disposable local PostgreSQL container and must never point at the external DB.
- `/profile` writes through `prisma.user.upsert` during render (`src/app/profile/page.tsx:14-38`), and shop-usage GET creates default catalog rows when absent (`src/lib/surf-usage-data.ts:221-271,533-589`); therefore no new automated browser check may use the external DB.
- Current `npm start` executes `prisma db push --accept-data-loss` (`package.json:5-11`) and is forbidden for QA; a guarded `start:qa` must invoke `next start` directly after explicit local DB setup.
- `ParticipantFoodOrderItem.updatedAt` exists (`prisma/schema.prisma:122-146`) but participant order responses omit item IDs, fulfillment quantities, and versions (`src/lib/food-ordering-data.ts:119-150,184-249`).
- Shop usage saves delete/recreate entries and confirm status independently without a version precondition (`src/lib/surf-usage-data.ts:687-777`); `ParticipantSurfUsageSubmission.updatedAt` is available as a conflict token (`prisma/schema.prisma:218-234`).

## Decisions (with rationale)
- Treat the user's clarification as authoritative: do not add desktop/tablet layouts and do not normalize the intentionally disabled breakpoints.
- Prioritize trust/correctness before visual polish: owner order corrections, shop refresh, action mutexes, and safe undo/confirmation precede dense-screen redesign.
- Treat option choices as purchasable variants in copy/UI because the backend permits multiple choices for one menu; do not invent exclusivity.
- Show each historical submission separately; do not replace the existing append-only history with a single mutable cart record.
- Define `PATCH /api/meetings/[id]/orders/[orderId]` as whole-submission cancel-and-replace and `DELETE` as whole-submission cancel. Every active item must be unprepared, unserved, uncancelled, ownership-authorized, order-open, and version-matched. PATCH marks originals with reason `participant_edit` and creates a replacement parent/items in the same transaction; DELETE uses `participant_cancel`. Do not promise predecessor/successor lineage without a schema change.
- Participant mutation payloads contain every sibling item ID + ISO `updatedAt` exactly once. Any cancelled/preparing/served sibling locks the parent. Return 401 unauthenticated, 403 wrong owner/proxy, 404 wrong meeting/order, 400 malformed/duplicate/incomplete payload, and 409 valid-but-stale/locked/order-closed with authoritative current history.
- Fulfillment actions require expected item versions, validate and conditionally update in one transaction, return 409 plus authoritative data on conflicts, and lock every sibling action on the affected row until completion.
- Shop usage save/confirm requires the submission `updatedAt` token (or explicit null for first creation), uses transactional compare-and-write, returns 409 with authoritative participant state, and never lets concurrent save/confirm both succeed.
- Shop order polling runs only while visible, refreshes on visibility regain/manual request, aborts or sequences requests so stale responses cannot overwrite a mutation, pauses for the affected mutation, retains last good data on failure, and shows last-updated/retry state.
- Default shop queues to oldest unhandled work, collapse completed rows, and label never-ordered catalog rows as empty rather than complete.
- Use shared semantic primitives for tabs, dialog/sheet, feedback, and loading/empty/error states; keep domain composition in existing domain folders.
- Limit shared components to behavior-bearing `Dialog/Sheet`, `Tabs`, `Toast/LiveRegion`, `AsyncState`, and mobile shell/dock behavior. Add `Button/IconButton` only if repeated accessible-name/target invariants require it; do not migrate every styled button or create generic cards/forms/filters.
- Define the portal switcher as navigation only: member `/`; shop `/shop` only when role is `ADMIN`/`SHOP_OWNER`; admin `/admin/login` preserving current auto-login/admin-cookie flow. No role mutation or auth bypass.
- Pin the mobile geometry contract: viewports exactly 390 and 430, outer maximum 430, consistent horizontal gutters, and every header/dock/sheet/dialog/toast contained inside the shell with safe-area insets. Existing 375px screenshots are baseline observations, not release evidence.
- Automated QA toolchain exposes `test:unit`, `test:integration`, guarded local DB setup/seed/down, `start:qa`, and `test:e2e:mobile`. The DB guard rejects a non-loopback host or database name without `_test` before any Prisma write.
- Every DB-capable QA entrypoint (`qa:db:*`, integration, build, server, E2E, final gates) runs through `scripts/qa/run.ts`, which sets a fixed loopback `_test` database, deterministic QA auth/origin/port values, clears external storage credentials, validates before dynamically importing or spawning the target, and refuses caller-supplied remote candidates before Prisma/Next is loaded.
- Participant PATCH uses `{ replacementItems, expectedItems }`; participant DELETE uses `{ expectedItems }`. Fulfillment uses `{ action, orderItemIds, expectedItems, reasonCode?, reasonText? }`. Usage uses `{ participantId, action, expectedVersion, items? }`. Conflicts use `{ error, code, current }` with domain codes and authoritative current data.
- A participant submission is replaceable/cancellable only if it has at least one item and every item in the parent is uncancelled, unprepared, unserved, and included exactly once in `expectedItems`. “Order open” means the existing Seoul-date `isMeetingOrderOpen` rule, not `Meeting.isOpen`.
- Usage transitions are `missing --save(null)--> SUBMITTED`, `SUBMITTED --save(version)--> SUBMITTED`, `SUBMITTED --confirm(version)--> CONFIRMED`, and `CONFIRMED --reopen(version+confirmation)--> SUBMITTED`. Confirmed Save is rejected; repeated Confirm with the same authoritative confirmed version is idempotent; stale/missing transitions return 409 with current data.
- All non-login admin pages use one server-side `requireAdminPage` guard before page data access, in addition to the existing proxy/admin-cookie behavior. Password-only admin remains supported; portal switching never grants the cookie.
- Keep legacy `/meeting/[id]` and `/signup/confirm` compatibility but reuse current confirmation presentation and make `/settlement` discoverable.

## Scope IN
- Mobile-only member, shop, and admin UI/UX improvements grounded in the captured real-data shapes.
- Participant menu discovery, cart/review, submission history, eligible edit/cancel APIs, and fulfillment-aware locking.
- Shop order auto-refresh, safe row actions, status/search filters, and exception-first usage workflow.
- Admin long-list/form restructuring for messages, meetings, participants, members, settlement, menu catalog, pricing, and settings.
- Shared tokens/primitives, focus/target/dialog/tab/live-region/reduced-motion/CJK handling, safe-area navigation, and explicit route states.
- Removal of unused Kakao JS SDK wiring while preserving current REST OAuth login.
- Runnable `tsx` unit tests, local-Postgres integration tests, and `@playwright/test` + axe mobile browser QA at exactly 390px/430px with deterministic fixtures and screenshot/trace evidence.

## Scope OUT (Must NOT have)
- No desktop/tablet layout, conventional breakpoints, or removal of the 430px mobile shell.
- No rebrand, new icon package, third-party UI framework, speculative design-system rewrite, or unrelated styling cleanup.
- No WebSocket, SSE, queue, cache layer, or realtime infrastructure beyond bounded polling.
- No external DB schema migration, destructive production-data cleanup, or any new automated QA connection to the real external DB, including nominally read-only page navigation.
- No payment flow, push notifications, recommendation engine, favorites system, inventory management, or other adjacent product features.
- No bulk fulfillment/confirmation mutation and no hidden optimistic success before the server confirms.
- No removal of legacy deep-link routes without an explicit compatibility replacement.

## Open questions
- None. User approved the announced defaults, including mobile-only behavior and the recommended removal of the unused Kakao JavaScript SDK.

## Executable route/persona/state matrix
### Persona and auth fixtures
| id | signed session / database role | adminAuthenticated | binding expectation |
| --- | --- | --- | --- |
| P0 | none | false | guest/login-gate behavior |
| P1 | regular MEMBER | false | self member behavior |
| P2 | linked COMPANION user | false | linked-companion self behavior |
| P3 | regular MEMBER owning an unlinked companion | false | owner-proxy behavior where supported |
| P4 | SHOP_OWNER | false | member + shop, never admin |
| P5 | ADMIN | false | member + shop; `/admin/login` auto-login may mint admin cookie |
| P6 | ADMIN | true | member + shop + admin |
| P7 | no Kakao identity | true | password-only admin compatibility; member/shop treat as guest |
| P8 | BANNED | false | preserve current signed member-page reads; deny shop and admin |

### Fault and fixture keys
- `D0`: dense four-meeting fixture, 35 synthetic users, 37 total menus of which 36 are active, 60 active selectable variants, repeated/mixed orders, and all usage states.
- `E0`: deterministic empty variant; `L0`: long Korean/dense list; `X0`: invalid dynamic ID; `F0`: client API 500; `F1`: guarded local PostgreSQL outage before server render followed by up/reset/Retry; `S0`: deterministic 2-second client response delay; `N0`: delayed route navigation that must expose the segment loading UI; `C0`: two-context version race; `O0`: browser offline then retry.
- Todo 2 turns the route-family index below into a focused executable matrix. It must cover every route once in an authorized or public state, every protected route once in a representative denied state, and the explicitly named high-risk order/fulfillment/usage conflicts. It must not generate a full route-by-persona Cartesian product.
- Each executable record has one ID, route, persona, fixture, optional fault, viewport, action, and expected result. Todo 19 runs the focused set at 390 and 430 without multiplying equivalent low-risk states.
- R08-R16 share one server-guard contract proven once by the helper test plus one representative denied browser route, while an AST/source check proves every page calls it first. R17-R19 share one guest OAuth two-hop check, one denied-role check, and authorized route coverage.
- Stable fixture IDs are meetings 8101-8104 and invalid meeting 8999. The seed receipt resolves the current Seoul order-open date and the disposable created-meeting date. The manifest stores those concrete values, never a placeholder.

### Route-family index
| family | route | binding requirement |
| --- | --- | --- |
| R01 | `/` | guest/signed home, calendar/tabs/dialog, loading/empty/dense/outage, and all participant-order cases |
| R02 | `/meeting/8101`, `/meeting/8999` | one exact 307 Location row, one exact destination-200 row, and one 404 row for every P0-P8 persona |
| R03 | `/meeting/create` | P0/P7 gate; P1-P6/P8 create; separate missing-time, reversed-time, 500, and slow-auth rows |
| R04 | `/profile` | P0/P7 gate; P1-P6/P8 role view/save; separate companion, upload, dirty-stay/discard, and loading rows |
| R05 | `/settlement` | P0/P7 gate; P1-P6/P8 scoped read; separate empty and owner-controlled outage/recovery rows |
| R06 | `/signup/confirm` | every P0-P8 persona for four exact query strings using `status`, `waitlist`, `meetingId`, `name`, and `companions` |
| R07 | `/admin/login` | exact wrong-password 401, password compatibility, ADMIN auto-login, and existing-cookie redirect rows |
| R08-R16 | non-login admin routes | literal unauthorized and authorized persona rows plus one-action route-specific success/failure rows |
| R17-R19 | shop routes | literal guest two-hop OAuth inspection, denied and authorized personas, plus one-action route-specific rows |

### Binding matrix rules
- A fault row always carries an explicit D0/E0/L0 fixture. F1 uses the current lock owner's internal `db.stop -> navigate -> db.start -> db.reset -> Retry` API; it never invokes a nested public QA script.
- Guest shop rows are two records: route request returns exact 307 to the internal `/api/auth/kakao?returnTo=...`; a manual request to that internal URL returns exact 307 with an external Kakao `Location`. The Location is recorded in the allowed-redirect ledger and is never followed or opened.
- Participant incomplete/extra expected sibling sets are 409 `ORDER_VERSION_CONFLICT`; malformed JSON, malformed timestamps, duplicate IDs, unknown fields, invalid carts, and foreign/inactive variants are 400 `INVALID_ORDER_MUTATION`.
- An ambiguously aborted participant POST is never retried automatically. The UI freezes the reviewed draft and performs a read-only history reconciliation using participant ID, normalized exact variant/quantity/price snapshots, and a server-issued request-start timestamp window. Zero candidates permits a fresh submission only after the user reviews and confirms again; one exact candidate marks success; multiple candidates require manual history review and keep submission disabled. This adds no schema or idempotency key and never claims duplicate-proof transport semantics.
- Every mutation row begins with the matching reset generation; every read row validates its fixture checksum. Equivalent low-risk persona combinations are intentionally not duplicated.

## QA isolation and named scripts
- Add `tsx`, `@playwright/test`, `@axe-core/playwright`, `react-doctor@0.7.7`, and `lighthouse@13.4.0` as direct dev dependencies; install the Playwright Chromium binary with `qa:browsers:install`.
- `test:unit`: pure domain/reducer/component-contract tests with no DB.
- `test:integration`: serialized guarded local PostgreSQL API/domain transaction tests with `--test-concurrency=1`, exclusive QA lock, and reset-generation validation per mutation group.
- Public `qa:db:up`, `qa:db:push`, `qa:db:seed`, `qa:db:reset`, and `qa:db:down` are top-level registry targets only. A running lock owner uses non-exported owner-token methods `db.start`, `db.stop`, `db.push`, `db.reset`, and `db.down` in the same process; nested public launchers are forbidden. `db.reset` returns the UUID to the owner, which writes it to the generation file, reserved Setting row, and each subsequently spawned child's `QA_RESET_GENERATION`.
- `qa:run`: rebuilds the child environment from the plan's small OS allowlist, then explicitly sets fixed database/auth/origin values, `EVIDENCE_DIR`, `QA_RESET_GENERATION`, child token, and `NEXT_TELEMETRY_DISABLED=1`. Kakao secret/JS key, Google/GCS/Blob/Vercel/proxy values are always present as empty strings so local `.env*` loading cannot repopulate them. It installs a token-gated process bootstrap before Next/Prisma that blocks and records non-loopback DNS/socket/fetch attempts while permitting only ports 3100 and 55432. Every QA package script delegates to the exact registry; ordinary product scripts `dev`, `build`, `start`, and `postinstall` are enumerated non-QA exclusions and the registry audit rejects any `qa:*`, `test:*`, `build:qa`, `start:qa`, or `gate:*` bypass.
- `start:qa`: through `qa:run`, run the production Next server directly without `prisma db push`; `npm start` is prohibited in QA.
- `test:e2e:mobile`: `fullyParallel:false`, `workers:1`, exclusive QA lock, forced reset/seed generation before every mutation case, deterministic P0-P8 storage states, 390/430 Playwright projects, global non-loopback abort ledger, and axe.
- Evidence root: `.omo/evidence/ui-ux-overhaul/{unit,integration,390,430}/`; every browser failure retains trace/screenshot, and teardown proves the container, browser, server, auth-state files, and bound port are gone.

## Metis gap analysis
- Verdict: `NOT READY` before corrections.
- Folded blockers: external DB GET-side writes, non-runnable tests, underspecified order/usage/fulfillment conflicts, over-broad primitives, auth-switcher ambiguity, missing route matrix, and unpinned 390/430 geometry.
- Resolution: all eight blockers are now recorded as binding decisions above. Todo drafting may proceed only with QA safety/tooling first, then versioned domain contracts, then product surfaces, then exhaustive cross-route verification.

## Approval gate
status: approved
approved-at: 2026-07-14
approval-message: `아주 잘 처리 했다. 나머지도 승인할테니 진행해라`
planning-stop-message: `너는 지금 너무 과하게 작업을 진행하고 있다. 계획 단계에서 이렇게 오래 시간을 끌고 있는게 말이 안된다. 지금까지 판단한 내용을 바탕으로 바로 구현에 들어가도 문제가 없어 보인다. 더이 상 일을 크게 벌리지 말고 작업을 진행할 준비를 하라`
pending-action: Stop further review expansion and hand the current decision-complete plan to `$start-work` for implementation.
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->

## Plan authorship receipt
- Decision-complete plan written at `.omo/plans/surfing-mobile-ui-ux-overhaul.md` with 19 implementation+test todos, exact dependencies, commit boundaries, local-only QA, both mobile viewports, and F1-F4 verification gates.
- TL;DR was completed last and exposes the XL/high-risk scope, cancel-and-replace order semantics, visibility-aware polling, bounded primitives, REST-only Kakao decision, and explicit exclusions for user veto.
- Pending: native Momus and isolated independent Codex CLI review must both return unconditional approval before handoff.

## Dual review round 1
- Native Momus verdict: `REJECT` with ten blockers. Session `/root/momus_plan_review` completed terminally.
- Independent Codex CLI receipt: Codex 0.144.3, session `019f5f19-db86-7fe2-b480-e768cbe8c140`, model `gpt-5.6-sol`, reasoning `xhigh`, isolated temporary clone/CODEX_HOME, `approval: never`, `sandbox: read-only`; verdict `REJECT` with fifteen blockers.
- Corrections folded into draft/plan: hermetic sanitized QA wrapper on every DB-capable boundary; fixed QA auth/origin/storage values and Chromium install; reset/reseed serialization; feasible server-render failure injection; mocked avatar-success UI plus real 503; pre-data admin page guard; explicit P0-P8/R01-R19 case matrix including BANNED and admin-cookie independence; complete all-sibling cancel-and-replace schemas/status envelopes/cross-domain races; exact usage state machine/P2002 mapping/reopen; non-speculative admin conflict scope; self/final-admin protection; adjustment atomicity; visual/React/Lighthouse gates; tracked-vs-ignored evidence policy; corrected 34-capture baseline count and 37-total/36-active menu fixture.
- Pending: structural audit, then a fresh native Momus + fresh isolated Codex CLI round. Both must return unconditional `OKAY`.

## Dual review round 2
- Native Momus round 2: `REJECT` with six blockers. Receipt: `.omo/evidence/ui-ux-overhaul/reports/momus-review-round-2.txt`.
- Independent Codex CLI round 2: `REJECT`, session `019f5f31-3771-7c62-8306-eb36a33f064a`, Codex 0.144.3, `gpt-5.6-sol`, xhigh, isolated read-only clone. Receipt: `.omo/evidence/ui-ux-overhaul/reports/independent-review-round-2.txt`.
- Corrections folded into round 3: a single child-environment allowlist and target registry with direct-entry refusal; lock/reset-generation/one-worker enforcement and global non-loopback abort; tracked 34-row baseline plus planning commit ownership; binding atomic case recipes and participant-order cases; strict order precedence/envelopes and full fulfillment transitions; persisted-field usage state table/P2002 mapping; AST plus DB-down admin guard proof; PostgreSQL-trigger rollback proof; local licensed font assets; deterministic two-pass pixel oracle, tracked goldens, and two available independent reviewers; aligned dependencies and F1-F4 lifecycle; exact task commands and tracked reports.
- Pending: structural audit and fresh dual round 3. No product implementation before both say `OKAY`.
