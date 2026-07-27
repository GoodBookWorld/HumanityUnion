# Engineering Verification Baseline

This document records the stabilized verification baseline for the Humanity Union platform after TASK-060B.

## Resolved Issue

`npm run verify:auth` intermittently hung after authentication passes completed, during the bundled `verify:collective-decision` regression step.

Symptoms:

- Auth passes 1–3 completed successfully
- Collective Decision main checks completed
- Output stopped after `Collective Decision persistence checks passed.`
- Process never exited (indefinite hang)

## Root Cause

Two interacting problems:

1. **Background notification Mongo connections**
   - Civic lifecycle hooks call `emitCivicNotificationEvent()` (fire-and-forget).
   - `resolveRecipientIdentity()` attempted Mongo auth/profile lookup whenever `MONGODB_URI` was present, even when `NOTIFICATION_PERSISTENCE=memory`.
   - That opened a MongoDB client in verification subprocesses that never called `disconnectMongoClient()`, keeping the Node event loop alive.

2. **Verification lifecycle cleanup gaps**
   - `verify:auth` kept a Mongo connection open while spawning the Collective Decision regression via `spawnSync`.
   - `verify:auth` used a non-awaited async `.finally()` disconnect pattern.
   - Verification scripts lacked a shared, deterministic resource finalization step.

Secondary regression during fix:

- Static import chain `verification-script-lifecycle → notification.service → notification.recipients → collective-decision.store` initialized persistence adapters before persistence env vars were applied in subprocesses.
- Fixed by lazy/dynamic imports in the lifecycle helper.

## Engineering Lessons

1. **Fire-and-forget async work must not open durable connections** unless production requires it and shutdown is handled.
2. **Memory-mode civic verification must not probe Mongo** for notification recipient resolution.
3. **Verification scripts must finalize resources explicitly**: drain background civic tasks, disconnect Mongo, exit cleanly.
4. **Avoid static import side effects** in verification helpers that touch persistence stores; use dynamic imports when stores read env at module load time.
5. **Do not use un-awaited async `.finally()` for teardown**; use `try/finally` inside an async `main()`.

## Verification Fixes

| Change                                                                                     | Purpose                                                          |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `notification.recipients.ts` — gate Mongo lookup behind `NOTIFICATION_PERSISTENCE=mongodb` | Prevent incidental Mongo connections in memory civic tests       |
| `notification.service.ts` — track and drain pending notification tasks                     | Allow verification scripts to await background notification work |
| `verification-script-lifecycle.ts` — shared `finalizeVerificationResources()`              | Deterministic drain + Mongo disconnect                           |
| `verify-auth-e2e.ts` — disconnect Mongo before regression spawn; proper `try/finally`      | Prevent parent connection interference; clean exit               |
| `verify-collective-decision-e2e.ts` — `try/finally` finalization                           | Ensure persistence subprocesses exit cleanly                     |

## Recommended Verification Execution Order

Run quality gates first, then domain verifications:

```bash
npm run verify:barrels
npm run typecheck
npm run build
npm run lint
npm run format:check

npm run verify:auth
npm run verify:mongodb

npm run verify:collective-decision
npm run verify:civic-action-package
npm run verify:civic-delivery
npm run verify:official-response
npm run verify:civic-accountability
npm run verify:civic-archive
npm run verify:capability02-integration

npm run verify:workspace-assistant-engine
npm run verify:workspace-intelligence
npm run verify:ai-provider
npm run verify:workspace-personalization

npm run verify:notifications
npm run verify:global-search
```

## Expected Execution Times (approximate, local dev)

| Script                       | Before TASK-060B                       | After TASK-060B |
| ---------------------------- | -------------------------------------- | --------------- |
| `verify:auth`                | Hung indefinitely (~25+ min observed)  | ~27s            |
| `verify:collective-decision` | ~11s (when not blocked by parent hang) | ~11s            |
| `verify:ai-provider`         | ~5s                                    | ~5s             |
| `verify:mongodb`             | ~15s                                   | ~15s            |

Times vary with MongoDB Atlas latency and machine load. The critical improvement is deterministic completion — no hangs.

## Remaining Technical Debt

- Other verification scripts that trigger civic notification hooks could adopt `finalizeVerificationResources()` for extra safety (not required after recipient gating fix, but recommended for Mongo-enabled scripts).
- `verify:notifications` still uses a 50ms timeout to wait for fire-and-forget publish hooks; could be replaced with `drainCivicNotificationEventsForTests()` for deterministic synchronization.
- ~~`verify:auth` bundles a full triple-run `verify:collective-decision` regression~~ — **resolved in TASK-088B**; see [VERIFICATION_ARCHITECTURE.md](./VERIFICATION_ARCHITECTURE.md).

## Status

Verification baseline is **deterministic** as of TASK-060B. Auth and Collective Decision gates are **separated** as of TASK-088B. AI Provider functionality (TASK-060) remains unchanged.
