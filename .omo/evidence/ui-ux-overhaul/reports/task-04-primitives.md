# Todo 4 — Accessible interaction primitives

## Outcome

Surfing의 모바일 시각 체계를 유지하면서 공용 `Dialog`/`Sheet`, `Tabs`, `AsyncState`, `MobileDock`/`RouteStateShell`을 추가했다. 알림 센터, 점심 주문 sheet, 주문 취소 dialog, 홈·프로필·관리자 상세 tabs, 관리자·샵 dock이 실제 소비자로 전환됐다. 루트·관리자·샵에는 loading/error/not-found 상태와 역할별 이동·Retry가 추가됐다.

`Toast`는 메시지를 한 번 발표하는 live region, 명시적인 닫기 이름, shell-relative safe placement, reduced-motion 전역 계약을 사용한다. 기존 달력 주말색과 outline danger button은 실제 axe 결과에 따라 흰 배경에서도 AA 일반 텍스트 대비를 갖도록 의미 토큰을 조정했다.

## Behavioral contract verified

- Dialog/sheet: labelled title/description, `aria-modal`, initial focus, Tab/Shift+Tab trap, Escape close, scrim close, trigger focus restoration, body scroll lock.
- Dialog state updates: sheet 안 수량 변경 후에도 활성 control의 focus가 유지된다.
- Tabs: linked `tablist`/`tab`/`tabpanel` IDs, `aria-selected`, one roving tab stop, Arrow keys and Home/End selection.
- Toast: polite/assertive live announcement by type, no focus steal, accessible close control.
- Docks: active 관리자/샵 link exposes `aria-current="page"` and remains within the 430px shell.
- Route states: root, admin, shop loading/error/not-found; invalid `/admin/meetings/999999` preserves administrator navigation and a useful exit.

## Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm run lint -- --max-warnings=999` | PASS, 0 errors and 7 pre-existing warnings outside Todo 4 |
| `npm run build -- --webpack` | PASS, 32 static pages; webpack was used because Turbopack rejects a task-worktree `node_modules` symlink |
| mobile-390 focused Playwright | PASS, 4/4 |
| mobile-430 focused Playwright | PASS, 4/4 |
| axe on settled home/profile/admin/shop/not-found surfaces | PASS, no serious or critical violations |
| Real Kakao login | Not used; all browser roles used synthetic local sessions and no OAuth redirect was followed |
| Independent Visual QA Pass A / Pass B | PASS / PASS, high confidence, no findings or blockers on all 12 fresh captures |

Focused command for each viewport:

```text
EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/task-04/<viewport> npm run test:e2e:mobile -- tests/e2e/interaction-primitives.spec.ts --project=mobile-<viewport> --workers=1
```

## Fresh visual evidence

The final current production build produced six full-page captures at each supported width under:

- `.omo/evidence/ui-ux-overhaul/task-04/390/`
- `.omo/evidence/ui-ux-overhaul/task-04/430/`

The capture set covers expanded home alert dialog, home order sheet, profile tabs, administrator detail tabs plus toast, shop cancel dialog plus dock, and administrator not-found. Direct inspection found no horizontal clipping, shell escape, overlay inversion, Korean tofu/baseline clipping, or blocked final controls. The 390 and 430 layouts preserve the same hierarchy while using the additional width. Computed browser assertions additionally prove the toast clears the administrator dock, the dialog is bounded and internally scrollable, and `서른다섯 번째 사용자` stays together on one rendered line at 390px.

## Scope and residual debt

- The profile first-run setup modal and image-crop overlay were outside the three requested consumers and remain documented follow-up debt in `docs/design-tokens.md`.
- No database-outage matrix, production failure hook, security expansion, auth redesign, backend/API change, or generic Card/Form/Filter abstraction was added.
- Error Retry is implemented and build/type checked; this UI-first pass did not force a live server-render failure through a production hook or database shutdown.
- The task worktree uses a transient `node_modules` symlink to the integrated worktree for tooling only; it is removed during cleanup and is not committed.
