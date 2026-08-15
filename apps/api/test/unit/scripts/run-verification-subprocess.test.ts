import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import {
  assertVerificationSubprocessSucceeded,
  runVerificationSubprocess,
} from "../../../src/scripts/run-verification-subprocess.js";

/**
 * Recovery Task 14 — coverage notes.
 *
 * `run-verification-subprocess.ts` is the narrow shared helper introduced to
 * fix the `verify-collective-decision-e2e.ts` persistence-subprocess hang
 * (Category B — an open MongoDB handle in a child process kept `spawnSync`
 * blocked forever) and to remove the nested `npx tsx` process layer used by
 * every persistence-verification subprocess call site. These tests exercise
 * the helper directly against small, disposable fixture scripts written to a
 * temp directory — no Mongo, no application modules — so they run instantly
 * and are fully isolated from the rest of the suite.
 */

let tempDir: string;

// `runVerificationSubprocess` invokes `node --import tsx <script>`; Node
// resolves the bare `tsx` loader specifier starting from the child's `cwd`,
// so fixture scripts must live (or be run with a `cwd`) inside this
// package's own directory tree to reach its `node_modules`. A system tmp
// directory (e.g. `/tmp`) is outside that chain and would fail to resolve
// `tsx` regardless of the helper's correctness — an unrelated Node ESM
// resolution detail, not a defect in the helper being tested.
const API_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");

before(() => {
  tempDir = fs.mkdtempSync(path.join(API_ROOT, ".hu-run-verification-subprocess-test-"));
});

after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function writeFixtureScript(name: string, contents: string): string {
  const scriptPath = path.join(tempDir, name);
  fs.writeFileSync(scriptPath, contents, "utf-8");
  return scriptPath;
}

describe("runVerificationSubprocess", () => {
  it("succeeds for a fast child that exits 0", () => {
    const scriptPath = writeFixtureScript(
      "fast-success.ts",
      'console.log("hello from fast-success"); process.exit(0);\n',
    );

    const result = runVerificationSubprocess(scriptPath, []);

    assert.equal(result.status, 0);
    assert.equal(result.signal, null);
    assert.equal(result.timedOut, false);
    assert.match(result.stdout, /hello from fast-success/);
  });

  it("reports a non-zero exit status without treating it as a timeout", () => {
    const scriptPath = writeFixtureScript(
      "fast-failure.ts",
      'console.error("deliberate failure"); process.exit(3);\n',
    );

    const result = runVerificationSubprocess(scriptPath, []);

    assert.equal(result.status, 3);
    assert.equal(result.timedOut, false);
    assert.match(result.stderr, /deliberate failure/);
  });

  it("forwards argv to the child script", () => {
    const scriptPath = writeFixtureScript(
      "echo-args.ts",
      "console.log(JSON.stringify(process.argv.slice(2))); process.exit(0);\n",
    );

    const result = runVerificationSubprocess(scriptPath, ["alpha", "beta"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /\["alpha","beta"\]/);
  });

  it("reports a timeout distinctly and terminates the child instead of hanging forever", () => {
    // Simulates the original defect: a child that finishes its own work but
    // is kept alive by an open handle (here, a repeating timer standing in
    // for an unclosed MongoDB connection) never exits on its own.
    const scriptPath = writeFixtureScript(
      "hangs-forever.ts",
      'console.log("about to hang"); setInterval(() => {}, 1000);\n',
    );

    const start = Date.now();
    const result = runVerificationSubprocess(scriptPath, [], { timeoutMs: 300 });
    const elapsedMs = Date.now() - start;

    assert.equal(result.timedOut, true);
    assert.ok(elapsedMs < 5000, `expected the bounded call to return quickly, took ${elapsedMs}ms`);
    assert.match(result.stdout, /about to hang/);
  });

  it("respects an explicit working directory and environment", () => {
    const scriptPath = writeFixtureScript(
      "echo-env.ts",
      'console.log(process.env.HU_TEST_MARKER ?? "unset"); console.log(process.cwd()); process.exit(0);\n',
    );

    const result = runVerificationSubprocess(scriptPath, [], {
      cwd: tempDir,
      env: { ...process.env, HU_TEST_MARKER: "marker-value" },
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /marker-value/);
    assert.ok(
      result.stdout.includes(fs.realpathSync(tempDir)),
      `expected stdout to include the resolved cwd; got: ${result.stdout}`,
    );
  });
});

describe("assertVerificationSubprocessSucceeded", () => {
  it("does not throw for a successful result", () => {
    assert.doesNotThrow(() => {
      assertVerificationSubprocessSucceeded(
        { status: 0, signal: null, timedOut: false, stdout: "", stderr: "" },
        "fixture script",
      );
    });
  });

  it("throws a descriptive error for a non-zero exit", () => {
    assert.throws(
      () => {
        assertVerificationSubprocessSucceeded(
          { status: 1, signal: null, timedOut: false, stdout: "out", stderr: "err" },
          "fixture script",
        );
      },
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes("fixture script") &&
        error.message.includes("status=1") &&
        error.message.includes("out") &&
        error.message.includes("err"),
    );
  });

  it("throws a distinct, non-success message for a timed-out result", () => {
    assert.throws(
      () => {
        assertVerificationSubprocessSucceeded(
          { status: null, signal: "SIGKILL", timedOut: true, stdout: "partial", stderr: "" },
          "fixture script",
        );
      },
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes("timed out") &&
        !error.message.includes("status=0"),
    );
  });

  it("never reports a timed-out execution as success even when status happens to be 0", () => {
    // A killed process can, in principle, report a stale/irrelevant status;
    // timeout must take priority over status when deciding pass/fail.
    assert.throws(() => {
      assertVerificationSubprocessSucceeded(
        { status: 0, signal: "SIGKILL", timedOut: true, stdout: "", stderr: "" },
        "fixture script",
      );
    }, /timed out/);
  });
});
