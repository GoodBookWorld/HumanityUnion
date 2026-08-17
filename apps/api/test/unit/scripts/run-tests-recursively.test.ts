import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import {
  discoverTestFiles,
  type RunChildProcessResult,
  runChildProcess,
  runIsolatedTestSuite,
} from "../../../scripts/run-tests-recursively.js";
import { KEEP_TEST_DATABASE_ENV_VAR, TEST_DATABASE_ENV_VAR } from "../../../scripts/test-mongo-isolation.js";

/**
 * Recovery Task 29 — coverage notes.
 *
 * `run-tests-recursively.mjs` replaces the previous `test/**\/*.test.ts`
 * shell glob, which silently discovered only 15 of 59 API test files when
 * expanded by `/bin/sh` (the shell npm/pnpm use to run package scripts),
 * because `**` is not recursive under `sh`. These tests exercise the
 * discovery function directly against small, disposable fixture trees — no
 * Mongo, no application modules — so a regression in the walk itself (e.g.
 * reintroducing shell-glob dependence, losing recursion, or matching the
 * wrong suffix) is caught without needing to run the full API suite.
 */

let tempDir: string;
const API_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");

before(() => {
  tempDir = fs.mkdtempSync(path.join(API_ROOT, ".hu-run-tests-recursively-test-"));
});

after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

let fixtureCounter = 0;

/** Creates a fresh, empty fixture root isolated from every other test case. */
function freshFixtureRoot(): string {
  fixtureCounter += 1;
  const root = path.join(tempDir, `fixture-${fixtureCounter}`);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function writeFile(root: string, relativePath: string, contents = "// fixture\n"): void {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, contents, "utf-8");
}

describe("discoverTestFiles", () => {
  it("finds a root-level test file", () => {
    const root = freshFixtureRoot();
    writeFile(root, "root.test.ts");

    const files = discoverTestFiles(root);

    assert.deepEqual(
      files.map((f) => path.relative(root, f)),
      ["root.test.ts"],
    );
  });

  it("finds deeply nested test files", () => {
    const root = freshFixtureRoot();
    writeFile(root, "unit/a/b/c/deep.test.ts");

    const files = discoverTestFiles(root).map((f) => path.relative(root, f));

    assert.ok(
      files.includes(path.join("unit", "a", "b", "c", "deep.test.ts")),
      `expected deeply nested file to be discovered, got: ${JSON.stringify(files)}`,
    );
  });

  it("ignores non-test files", () => {
    const root = freshFixtureRoot();
    writeFile(root, "helper.ts");
    writeFile(root, "index.js");
    writeFile(root, "notes.txt");
    // A directory with zero matching files still throws (see the dedicated
    // "zero test files" case below); give this fixture one genuine match so
    // it can isolate the "ignores non-test files" behavior on its own.
    writeFile(root, "real.test.ts");

    const files = discoverTestFiles(root).map((f) => path.relative(root, f));

    assert.equal(files.includes("helper.ts"), false);
    assert.equal(files.includes("index.js"), false);
    assert.equal(files.includes("notes.txt"), false);
    assert.deepEqual(files, ["real.test.ts"]);
  });

  it("ignores files with similar but non-matching names", () => {
    const root = freshFixtureRoot();
    writeFile(root, "almost.test.ts.bak");
    writeFile(root, "almosttest.ts");
    writeFile(root, "almost.test.tsx");
    writeFile(root, "almost.Test.ts");
    writeFile(root, "almost.test.js");
    // Only this one should match — kept last so the fixture directory also
    // exercises "similar decoys alongside one genuine match".
    writeFile(root, "real.test.ts");

    const files = discoverTestFiles(root).map((f) => path.relative(root, f));

    assert.deepEqual(files.sort(), ["real.test.ts"]);
  });

  it("produces deterministic, lexically sorted paths regardless of creation order", () => {
    const root = freshFixtureRoot();
    writeFile(root, "z-suite/z.test.ts");
    writeFile(root, "a-suite/a.test.ts");
    writeFile(root, "m-suite/nested/m.test.ts");

    const runOne = discoverTestFiles(root).map((f) => path.relative(root, f).split(path.sep).join("/"));
    const runTwo = discoverTestFiles(root).map((f) => path.relative(root, f).split(path.sep).join("/"));

    assert.deepEqual(runOne, runTwo, "repeated discovery of the same tree must return the same order");
    const expectedSorted = [...runOne].sort();
    assert.deepEqual(runOne, expectedSorted, "results must already be in sorted order");
  });

  it("handles an empty nested directory without error", () => {
    const root = freshFixtureRoot();
    fs.mkdirSync(path.join(root, "empty-nested", "still-empty"), { recursive: true });
    writeFile(root, "present.test.ts");

    const files = discoverTestFiles(root).map((f) => path.relative(root, f));

    assert.deepEqual(files, ["present.test.ts"]);
  });

  it("does not depend on shell glob expansion", () => {
    const root = freshFixtureRoot();
    // `*` and `[]` are shell glob metacharacters. A real filesystem walk
    // treats them as ordinary characters in a file/directory name; a
    // shell-glob-dependent implementation would either fail to create these
    // paths meaningfully or mishandle them. Discovering them proves the walk
    // is pure `fs` traversal, not a re-implementation of shell expansion.
    writeFile(root, "weird[dir]/star*.test.ts");

    const files = discoverTestFiles(root).map((f) => path.relative(root, f).split(path.sep).join("/"));

    assert.ok(
      files.includes("weird[dir]/star*.test.ts"),
      `expected glob-metacharacter path to be discovered literally, got: ${JSON.stringify(files)}`,
    );
  });

  it("supports paths containing spaces", () => {
    const root = freshFixtureRoot();
    writeFile(root, "has spaces/in a dir.test.ts");

    const files = discoverTestFiles(root).map((f) => path.relative(root, f).split(path.sep).join("/"));

    assert.ok(files.includes("has spaces/in a dir.test.ts"));
  });

  it("fails with a clear error when the root does not exist", () => {
    const missingRoot = path.join(tempDir, "does-not-exist");

    assert.throws(
      () => discoverTestFiles(missingRoot),
      (error: unknown) => error instanceof Error && error.message.includes(missingRoot),
    );
  });

  it("fails with a clear error when zero test files exist", () => {
    const root = freshFixtureRoot();
    writeFile(root, "nested/not-a-test.ts");

    assert.throws(
      () => discoverTestFiles(root),
      (error: unknown) => error instanceof Error && /zero/i.test(error.message),
    );
  });
});

describe("runChildProcess", () => {
  it("propagates a successful child exit code", async () => {
    const result = await runChildProcess(process.execPath, ["-e", "process.exit(0)"], { stdio: "pipe" });

    assert.equal(result.code, 0);
    assert.equal(result.signal, null);
  });

  it("propagates a failing child exit code", async () => {
    const result = await runChildProcess(process.execPath, ["-e", "process.exit(7)"], { stdio: "pipe" });

    assert.equal(result.code, 7);
    assert.equal(result.signal, null);
  });

  it("captures stdout/stderr when piped", async () => {
    const result = await runChildProcess(
      process.execPath,
      ["-e", "console.log('hello-stdout'); console.error('hello-stderr'); process.exit(0)"],
      { stdio: "pipe" },
    );

    assert.match(result.stdout, /hello-stdout/);
    assert.match(result.stderr, /hello-stderr/);
  });

  it("reports the signal when a child terminates itself via signal", async () => {
    const result = await runChildProcess(
      process.execPath,
      ["-e", "process.kill(process.pid, 'SIGTERM')"],
      { stdio: "pipe" },
    );

    assert.equal(result.signal, "SIGTERM");
  });
});

/**
 * Recovery Task 30 — orchestration coverage notes.
 *
 * `runIsolatedTestSuite` composes discovery (Task 29), database-name
 * generation, child-process spawning, and owned cleanup behind an
 * injectable-dependency seam specifically so these behaviors — env
 * injection, exit-code authority, cleanup-failure reporting — can be
 * verified without spawning the real 500+-test suite or touching real
 * Mongo. Real Mongo-backed isolation (repositories actually resolving the
 * injected database) is covered by `test/integration/mongo-test-isolation.test.ts`.
 */
describe("runIsolatedTestSuite", () => {
  function makeFakeDeps(overrides: Record<string, unknown> = {}) {
    const root = freshFixtureRoot();
    writeFile(root, "fixture.test.ts");

    const logs: string[] = [];
    const errorLogs: string[] = [];

    return {
      apiRoot: root,
      testRoot: root,
      env: {} as NodeJS.ProcessEnv,
      loadEnv: () => {},
      discover: discoverTestFiles,
      generateDatabaseName: () => "hu_test_fixed_name",
      spawnTests: async (): Promise<RunChildProcessResult> => ({
        code: 0,
        signal: null,
        stdout: "",
        stderr: "",
      }),
      dropDatabase: async () => {},
      ensureCreationAllowed: async () => {},
      log: (message: string) => logs.push(message),
      logError: (message: string) => errorLogs.push(message),
      ...overrides,
      __logs: logs,
      __errorLogs: errorLogs,
    };
  }

  it("generates exactly one database name per run (Part 12 item 1)", async () => {
    let generateCount = 0;
    const deps = makeFakeDeps({
      generateDatabaseName: () => {
        generateCount += 1;
        return `hu_test_call_${generateCount}`;
      },
    });

    const result = await runIsolatedTestSuite(deps);

    assert.equal(generateCount, 1);
    assert.equal(result.databaseName, "hu_test_call_1");
  });

  it("passes the generated name to the child via the documented environment variable, and spawns the whole run once (Part 12 items 5/6)", async () => {
    let capturedEnv: NodeJS.ProcessEnv | undefined;
    let spawnCallCount = 0;
    const deps = makeFakeDeps({
      spawnTests: async (_args: string[], env: NodeJS.ProcessEnv): Promise<RunChildProcessResult> => {
        spawnCallCount += 1;
        capturedEnv = env;
        return { code: 0, signal: null, stdout: "", stderr: "" };
      },
    });

    await runIsolatedTestSuite(deps);

    assert.equal(spawnCallCount, 1, "the entire discovered file set must be run in a single spawn");
    assert.equal(capturedEnv?.[TEST_DATABASE_ENV_VAR], "hu_test_fixed_name");
  });

  it("preserves the child's failing exit code even when cleanup succeeds", async () => {
    const deps = makeFakeDeps({
      env: { MONGODB_URI: "mongodb://127.0.0.1:1/whatever" } as NodeJS.ProcessEnv,
      spawnTests: async (): Promise<RunChildProcessResult> => ({ code: 7, signal: null, stdout: "", stderr: "" }),
    });

    const result = await runIsolatedTestSuite(deps);

    assert.equal(result.code, 7);
    assert.equal(result.cleanup.attempted, true);
    assert.equal(result.cleanup.succeeded, true);
  });

  it("preserves the child's exit code (success or failure) even when cleanup fails, and reports the cleanup failure separately (Part 12 items 19/20)", async () => {
    for (const childCode of [0, 1, 7]) {
      const deps = makeFakeDeps({
        env: { MONGODB_URI: "mongodb://127.0.0.1:1/whatever" } as NodeJS.ProcessEnv,
        spawnTests: async (): Promise<RunChildProcessResult> => ({ code: childCode, signal: null, stdout: "", stderr: "" }),
        dropDatabase: async () => {
          throw new Error("simulated drop failure");
        },
      });

      const result = await runIsolatedTestSuite(deps);

      assert.equal(result.code, childCode, "cleanup failure must never change the authoritative test exit code");
      assert.equal(result.cleanup.attempted, true);
      assert.equal(result.cleanup.succeeded, false);
      assert.match(result.cleanup.error?.message ?? "", /simulated drop failure/);
      assert.ok(
        (deps.__errorLogs as string[]).some((line) => line.includes("simulated drop failure")),
        "expected the cleanup failure to be logged separately from the test result",
      );
    }
  });

  it("calls loadEnv() before deciding whether to clean up, so a .env-provided MONGODB_URI (invisible to this process until then) is honored", async () => {
    // Regression test: the parent runner is a separate OS process from the
    // test child that actually loads `.env` (via `test/helpers/test-setup.ts`).
    // Discovered while validating this task: without calling `loadEnv()`
    // first, this process saw `MONGODB_URI` as unset and silently skipped
    // dropping a database the child had actually created and used.
    const env: NodeJS.ProcessEnv = {};
    let dropCalledWithUri: string | undefined;
    const deps = makeFakeDeps({
      env,
      loadEnv: () => {
        env.MONGODB_URI = "mongodb://127.0.0.1:1/whatever";
      },
      dropDatabase: async (_name: string, uri: string) => {
        dropCalledWithUri = uri;
      },
    });

    await runIsolatedTestSuite(deps);

    assert.equal(dropCalledWithUri, "mongodb://127.0.0.1:1/whatever");
  });

  it("does not attempt cleanup when Mongo is not configured", async () => {
    const deps = makeFakeDeps({ env: {} as NodeJS.ProcessEnv });
    let dropCalled = false;
    (deps as Record<string, unknown>).dropDatabase = async () => {
      dropCalled = true;
    };

    const result = await runIsolatedTestSuite(deps);

    assert.equal(dropCalled, false);
    assert.equal(result.cleanup.attempted, false);
    assert.equal(result.cleanup.succeeded, true);
  });

  it(`honors ${KEEP_TEST_DATABASE_ENV_VAR}=1 by skipping the drop step (Part 15)`, async () => {
    let dropCalled = false;
    const deps = makeFakeDeps({
      env: { MONGODB_URI: "mongodb://127.0.0.1:1/whatever", [KEEP_TEST_DATABASE_ENV_VAR]: "1" } as NodeJS.ProcessEnv,
      dropDatabase: async () => {
        dropCalled = true;
      },
    });

    const result = await runIsolatedTestSuite(deps);

    assert.equal(dropCalled, false);
    assert.equal(result.cleanup.attempted, false);
    assert.ok(
      (deps.__logs as string[]).some((line) => line.includes("hu_test_fixed_name")),
      "expected the retained database name to be logged clearly",
    );
  });

  it("still attempts owned cleanup when the child fails", async () => {
    let dropCalled = false;
    const deps = makeFakeDeps({
      env: { MONGODB_URI: "mongodb://127.0.0.1:1/whatever" } as NodeJS.ProcessEnv,
      spawnTests: async (): Promise<RunChildProcessResult> => ({
        code: 1,
        signal: null,
        stdout: "",
        stderr: "boom",
      }),
      dropDatabase: async () => {
        dropCalled = true;
      },
    });

    const result = await runIsolatedTestSuite(deps);
    assert.equal(result.code, 1);
    assert.equal(dropCalled, true);
    assert.equal(result.cleanup.attempted, true);
    assert.equal(result.cleanup.succeeded, true);
  });

  it("still attempts owned cleanup when spawn throws", async () => {
    let dropCalled = false;
    const deps = makeFakeDeps({
      env: { MONGODB_URI: "mongodb://127.0.0.1:1/whatever" } as NodeJS.ProcessEnv,
      spawnTests: async () => {
        throw new Error("spawn failed");
      },
      dropDatabase: async () => {
        dropCalled = true;
      },
    });

    await assert.rejects(() => runIsolatedTestSuite(deps), /spawn failed/);
    assert.equal(dropCalled, true);
  });

  it("propagates a signal reported by the child instead of a numeric code", async () => {
    const deps = makeFakeDeps({
      spawnTests: async (): Promise<RunChildProcessResult> => ({
        code: null,
        signal: "SIGTERM",
        stdout: "",
        stderr: "",
      }),
    });

    const result = await runIsolatedTestSuite(deps);

    assert.equal(result.signal, "SIGTERM");
  });
});
