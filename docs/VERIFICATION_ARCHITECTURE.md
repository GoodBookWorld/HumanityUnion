# Verification Architecture

This document defines verification gate ownership, execution boundaries, resource cleanup requirements, and lint/format policy for vendored or generated assets.

## Gate ownership

Verification gates are **domain-scoped**. Each gate owns one bounded subsystem and must terminate deterministically without bundling unrelated domains.

| Gate                                     | Owns                                                                                                                                               |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verify:auth`                            | Registration, email confirmation, login, optional two-step login, access/refresh tokens, logout, password flows, auth middleware, auth persistence |
| `verify:auth-production`                 | Production auth hardening (rate limits, cookies, security headers)                                                                                 |
| `verify:registration-email-confirmation` | Registration email confirmation codes and pending-confirmation sessions                                                                            |
| `verify:email-two-step-login`            | Optional email two-step login enable/disable and login challenge flow                                                                              |
| `verify:email`                           | Transactional email infrastructure (templates, providers, queues)                                                                                  |
| `verify:mongodb`                         | MongoDB connectivity, indexes, and adapter round-trips                                                                                             |
| `verify:collective-decision`             | Collective Decision lifecycle, voting, transparent results, persistence reload                                                                     |

Capability 02 integration (`verify:capability02-integration`) covers cross-module civic workflows. It is separate from the auth gate.

## Why auth and collective-decision are separate

Historically, `verify:auth` spawned a full triple-run `verify:collective-decision` regression after auth passes completed. That coupling caused:

1. **Unclear gate ownership** — auth CI failures could reflect civic-domain issues unrelated to authentication.
2. **Indefinite hangs** — the auth script held MongoDB lifecycle state, then blocked on `spawnSync("npm run verify:collective-decision")`. The nested regression subprocess could stall after persistence checks while finalizing background notification/Mongo resources, leaving the parent process blocked indefinitely.
3. **Duplicated coverage** — collective decision already has its own required triple-run gate in CI.

**Current policy (TASK-088B):**

- `verify:auth` runs auth checks only (3 internal passes).
- `verify:collective-decision` remains a **separate required gate** (3 chained runs via `package.json`).
- Auth still includes a lightweight Capability 02 smoke check (`createInitiativeDraft`) to ensure authenticated identity resolution does not break initiative draft creation. That is not a substitute for the collective-decision gate.

## Resource cleanup requirements

All verification scripts that open durable resources must finalize them explicitly.

### Shared lifecycle helper

`apps/api/src/scripts/verification-script-lifecycle.ts` provides:

- `finalizeVerificationResources()` — drains pending civic notification tasks, then disconnects MongoDB when configured.
- `runVerificationScript(main)` — wraps `main()` in `try/catch/finally` so scripts exit deterministically.

Use `runVerificationScript(main)` instead of ad-hoc `main().catch()` plus un-awaited `.finally()` teardown.

### MongoDB

- Call `disconnectMongoClient()` via the shared finalizer after verification work completes.
- `disconnectMongoClient()` cancels in-flight connect promises to avoid leaving clients open during teardown races (verification scripts may bootstrap and disconnect repeatedly).

### Civic notifications

- Memory-mode civic verification must not open Mongo for notification recipient resolution (`NOTIFICATION_PERSISTENCE=mongodb` required for Mongo lookup).
- Fire-and-forget notification tasks are tracked and drained via `drainCivicNotificationEventsForTests()` before process exit.

### Subprocesses

- Avoid nesting full domain gates inside other gates via `spawnSync` unless the parent fully isolates resource lifecycles (prefer separate npm scripts).
- Collective Decision persistence checks use dedicated subprocess env (`VERIFY_COLLECTIVE_DECISION_PERSISTENCE=1`) and must still call `finalizeVerificationResources()` in `finally`.

### Prohibited workarounds

- Do not use `process.exit(0)` to mask open handles or hung background tasks.
- Do not bundle unrelated triple-run gates into auth verification.

## Recommended CI order

```bash
npm run typecheck
npm run build
npm run lint
npm run format:check

npm run verify:auth
npm run verify:auth-production
npm run verify:registration-email-confirmation
npm run verify:email-two-step-login
npm run verify:email
npm run verify:mongodb

npm run verify:collective-decision
# … additional civic/domain gates …
```

## Lint and format policy

### Excluded from ESLint

- `node_modules/`, build output (`.next/`, `dist/`, `build/`, `out/`, `coverage/`)
- Vendored/minified public assets: `apps/web/public/wdcr-js-map/**`, `apps/web/public/**/*.min.js`
- Generated geography JSON: `packages/geography/src/*.json`
- Geography normalization script (standalone tooling): `scripts/normalize-geography-data.ts`

### Excluded from Prettier

Same paths as above, plus lockfiles. Prettier applies to normal handwritten TypeScript, TSX, CSS, and Markdown in application packages.

### Application source

Genuine project source under `apps/`, `packages/types/`, and shared `scripts/` (except excluded tooling) must remain linted and formatted. Unused-import lint errors in application code should be fixed, not ignored.

## Related documents

- [ENGINEERING_VERIFICATION_BASELINE.md](./ENGINEERING_VERIFICATION_BASELINE.md) — TASK-060B hang investigation and notification/Mongo fixes
- [AUTHENTICATION_FOUNDATION.md](./AUTHENTICATION_FOUNDATION.md) — auth verification entry point
- [OPTIONAL_EMAIL_TWO_STEP_LOGIN.md](./OPTIONAL_EMAIL_TWO_STEP_LOGIN.md) — two-step login verification
