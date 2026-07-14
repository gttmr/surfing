# Task 01: isolated mobile QA harness

## Result

Todo 1 provides the local QA wrapper, fixed loopback PostgreSQL lifecycle, process egress guard, Playwright/Lighthouse configuration, baseline manifest, and cleanup receipts. Product source, Prisma schema, routes, auth/session behavior, and the product `start` script were not changed.

A follow-up review found three narrow harness gaps. The wrapper's internal-target proof used caller-controlled environment equality, allowed Node descendants did not inherit the guard, and cleanup checked only the database port while its receipt claimed broader cleanup. The follow-up fixes are covered by focused regressions and intentionally received lightweight acceptance so work can pivot to the UI/UX implementation.

## Focused blocker fixes

- Internal targets now require a wrapper-owned private capability inherited on file descriptors; matching forged environment variables do not authorize direct invocation.
- Allowed Node descendants receive the same preload guard, so the focused DNS and fetch probes fail as `EgressBlockedError` without reaching real resolution.
- Cleanup verifies both reserved ports, the released lifecycle lock, and narrowly registered QA server/browser processes before writing its final receipt.
- Child-process guard logic, capability handling, process registration, and the shared refusal error are split into small single-purpose modules.

## Failing-first evidence

Before the follow-up implementation, one focused run reproduced all three failures:

- forged matching child-token variables invoked the internal target successfully;
- a nested allowed Node DNS request reached resolution and returned `ENOTFOUND`;
- cleanup returned success while loopback port 3100 remained occupied.

After the fixes, the same three subtests pass.

## Lightweight acceptance

| Command | Observation |
| --- | --- |
| `EVIDENCE_DIR=.omo/evidence/ui-ux-overhaul/integration npm run test:unit -- --test-name-pattern='QA registry environment lock and egress refusal: security regressions'` | exit 0; 8 tests passed, including all 3 blocker regressions |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0; 0 errors and the existing 7 product-source warnings |
| `qa:db:up -> qa:db:assert -> qa:db:down` with the integration evidence directory | each command exited 0 on a clean smoke run |
| direct Docker, socket, and filesystem inspection after `qa:db:down` | no QA container, volume, 3100/55432 listener, owner lock, generation file, process registry, capability directory, or server PID remained |

An interrupted integration attempt left a stale generation file before the smoke run. Recovery cleanup exposed and fixed an empty process-registry directory removal bug. The clean smoke sequence above was then run once successfully.

## Scope boundary

This follow-up did not rerun the full integration/browser suite, product build/start, mobile E2E, visual comparison, repeated adversarial matrix, or F1-F3 gates. Earlier Todo 1 validation remains historical evidence for the original harness, not fresh evidence for these blocker fixes. No claim of exhaustive isolation or security verification is made here.

Later seed, visual, and F1-F3 targets remain registered but intentionally report that they are not implemented. Dependency advisory remediation remains out of scope.

## Cleanup receipt

The final classification-only receipt reports the QA container, volume, database/application ports, owner lock, task-owned processes, generation state, server state, browser auth, and uploads absent. `npm start` was not invoked and no external request was intentionally followed.
