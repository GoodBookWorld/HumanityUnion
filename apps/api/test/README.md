# API Test Suite

## Canonical regression command

```
pnpm test
```

Run from `apps/api` (or `pnpm --filter @hu/api test` from the repository
root). This is the complete, canonical recursive regression command for the
API. It discovers and runs **every** `*.test.ts` file anywhere under `test/`,
including deeply nested suites (e.g. `test/unit/<module>/**`), and exits
non-zero if any test fails.

## Why this isn't a shell glob

`pnpm`/`npm` run package scripts through `/bin/sh` on this platform, and
`/bin/sh`'s `**` glob is **not recursive**. A script written as:

```
node --test test/**/*.test.ts
```

silently expands, under `/bin/sh`, to only the shallow files directly inside
`test/*/` — it skips every file under `test/unit/**` (or any other nested
directory) with **no error and exit code 0**. That false-green result is
exactly what Recovery Task 29 found and fixed: the previous script discovered
15 of 59 test files while reporting full success.

`pnpm test` now runs `tsx ./scripts/run-tests-recursively.ts`
(`apps/api/scripts/run-tests-recursively.ts`), which performs its own
recursive filesystem walk in Node — no shell glob involved — and then invokes
the same `node --test` execution (same `tsx` loader, same
`test/helpers/test-setup.ts` preload hook, same flags) with the complete,
explicit, deterministically sorted file list. The result is identical
regardless of which shell invokes it (`sh`, `bash`, `zsh`) or whether it runs
locally or in CI.

**Do not** treat a directly-typed shell glob (interactive `zsh` in particular,
which does expand `**` recursively) as proof of complete test coverage. Only
`pnpm test` — or an explicit recursive filesystem walk — reflects the true,
complete test set.

## Verifying discovery independently

To confirm `pnpm test` is discovering the complete file set, compare it
against an independent recursive walk:

```
node -e '
const fs = require("fs"), path = require("path");
function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.name.endsWith(".test.ts")) acc.push(full);
  }
  return acc;
}
console.log(walk("test", []).sort().join("\n"));
'
```

The set of files this prints must exactly match the files
`scripts/run-tests-recursively.ts` discovers (see
`test/unit/scripts/run-tests-recursively.test.ts` for the focused tests
covering the discovery utility itself).

## Mongo test-database isolation

Every `pnpm test` invocation runs against its own throwaway MongoDB database,
never the development database. This closes the root cause behind the
intermittent failures observed in Recovery Tasks 25–29: without isolation,
the test suite and a running `dev:api` process shared the exact same
database (`MONGODB_DATABASE=humanity_union_dev`, from `apps/api/.env`), so a
`dev:api` request could insert, update, or dispatch outbox events for
fixtures the test suite was simultaneously asserting on, and vice versa.

**You do not need to do anything to get this.** It's automatic:

* `apps/api/scripts/run-tests-recursively.ts` (the `pnpm test` entry point)
  generates one unique database name per invocation — shape
  `hu_test_<timestamp-base36>_<pid-base36>_<random-hex>` — and injects it
  into the test process via the `MONGODB_TEST_DATABASE` environment
  variable. It is generated **once** per run and is identical for every
  test file in that run.
* `test/helpers/test-setup.ts` (the test preload hook) requires this
  variable to be set whenever `MONGODB_URI` is configured, validates it
  against a strict pattern (`^hu_test_[a-zA-Z0-9_]+$`) and an explicit
  forbidden-name list (the real development/default database names, plus
  MongoDB's own reserved `admin`/`local`/`config` databases), points the
  shared Mongo configuration at it, and **locks** that configuration before
  any repository can connect — nothing afterward (accidental or otherwise)
  can change which database the test process talks to. Missing or unsafe
  names fail the run immediately, with no fallback to the development
  database.
* Every Mongo-backed repository (outbox, processed events, workspace
  projections, Activity, Participant Action, …) already resolves its
  database through this one shared configuration chokepoint
  (`src/infrastructure/mongodb/`), so isolation requires no per-module
  awareness — this is provable and covered by
  `test/integration/mongo-test-isolation.test.ts`.
* Once the test process exits, `run-tests-recursively.ts` drops **only**
  that one database and reports the result — the original test exit code is
  always authoritative; a cleanup failure is reported as a separate warning
  and never changes it.

**Running `dev:api` at the same time is fully supported** — that's the
point. The two processes use different database names on the same MongoDB
deployment and never interact.

### Naming pattern

```
hu_test_<timestamp-base36>_<pid-base36>_<random-hex>
```

Encoded in base36 (rather than plain decimal) specifically to stay under
MongoDB Atlas's 38-byte database-name limit — a plain
`hu_test_<ms-epoch>_<pid>_<hex>` name already exceeds it.

### Cleanup and debug retention

Cleanup is automatic and unconditional — it runs whether the suite passed,
failed, or was interrupted (`SIGINT`/`SIGTERM`; bounded to a few seconds so
an unreachable server can't hang the shutdown). No manual database cleanup
is normally required.

To inspect a failing run's data afterward, opt out of cleanup for that one
invocation:

```
KEEP_TEST_DATABASE=1 pnpm test
```

`run-tests-recursively.ts` will print the retained database name clearly
instead of dropping it. This has no effect on which database the tests
actually use or how they behave — only on whether it's dropped afterward.
Remember to drop it yourself once you're done (it will not collide with a
later run, since each run generates a new name, but it will otherwise sit on
the cluster indefinitely).

### Verification scripts remain separate

`apps/api/src/scripts/verify-*.ts` scripts use
`activateVerificationDatabaseIsolationAsync` (`hu_verify_*` databases).
Lifecycle is:

1. create isolation
2. run verification
3. `await isolation.dispose()` (drops owned DB, then restores env)

`restore()` / `restoreEnvironment()` restore process env only and do **not**
drop the database. `finalizeVerificationResources()` also disposes any
still-active isolations as a safety net.

Diagnostic preserve: `KEEP_VERIFICATION_DATABASE=1` (verification) or
`KEEP_TEST_DATABASE=1` (pnpm test) — explicit, inspection-only.
