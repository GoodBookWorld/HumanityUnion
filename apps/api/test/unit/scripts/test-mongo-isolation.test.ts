import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertSafeTestDatabaseName,
  dropIsolatedTestDatabase,
  FORBIDDEN_TEST_DATABASE_NAMES,
  generateIsolatedTestDatabaseName,
  isSafeTestDatabaseName,
  rewriteMongoUriDatabase,
  TEST_DATABASE_NAME_PATTERN,
  UnsafeTestDatabaseNameError,
} from "../../../scripts/test-mongo-isolation.js";

/**
 * Recovery Task 30 — coverage notes.
 *
 * These tests cover the pure, Mongo-free half of the isolation mechanism:
 * name generation, the safe-name pattern/forbidden-name guard, and the URI
 * rewrite helper. The Mongo-gated half (actual isolated-database usage by
 * repositories, drop-only-owned-database behavior against a real server) is
 * covered separately in `test/integration/mongo-test-isolation.test.ts`,
 * which skips itself when `MONGODB_URI` is not configured.
 */

describe("generateIsolatedTestDatabaseName", () => {
  it("produces a name matching the safe pattern (Part 12 item 3/4)", () => {
    const name = generateIsolatedTestDatabaseName();

    assert.match(name, TEST_DATABASE_NAME_PATTERN);
    assert.equal(isSafeTestDatabaseName(name), true);
  });

  it("produces different names across calls, even called back-to-back (Part 12 item 2)", () => {
    const names = new Set(Array.from({ length: 20 }, () => generateIsolatedTestDatabaseName()));

    assert.equal(names.size, 20, "expected 20 distinct names from 20 calls");
  });

  it("embeds the current process id (base36), so concurrent OS processes never collide by pid alone", () => {
    const name = generateIsolatedTestDatabaseName();

    assert.ok(
      name.includes(`_${process.pid.toString(36)}_`),
      `expected generated name to embed base36 pid ${process.pid.toString(36)}, got: ${name}`,
    );
  });

  it("never exceeds the 38-byte MongoDB Atlas database-name limit", () => {
    for (let i = 0; i < 10; i += 1) {
      const name = generateIsolatedTestDatabaseName();
      assert.ok(
        Buffer.byteLength(name, "utf-8") <= 38,
        `expected generated name to be <= 38 bytes, got ${Buffer.byteLength(name, "utf-8")}: ${name}`,
      );
    }
  });

  it("contains no spaces or path separators (safe as both a Mongo database name and an env var value)", () => {
    const name = generateIsolatedTestDatabaseName();

    assert.equal(/[\s/\\]/.test(name), false, `expected no whitespace or path separators in: ${name}`);
  });
});

describe("isSafeTestDatabaseName / assertSafeTestDatabaseName", () => {
  it("accepts a well-formed generated name", () => {
    const name = generateIsolatedTestDatabaseName();
    assert.equal(isSafeTestDatabaseName(name), true);
    assert.doesNotThrow(() => assertSafeTestDatabaseName(name));
  });

  it("rejects a name that is otherwise well-formed but exceeds the 38-byte Atlas limit", () => {
    const tooLong = `hu_test_${"a".repeat(40)}`;
    assert.equal(isSafeTestDatabaseName(tooLong), false);
    assert.throws(() => assertSafeTestDatabaseName(tooLong), /bytes long/);
  });

  it("rejects a missing or empty name (Part 12 item 7 precondition)", () => {
    assert.equal(isSafeTestDatabaseName(""), false);
    assert.throws(() => assertSafeTestDatabaseName(undefined), UnsafeTestDatabaseNameError);
    assert.throws(() => assertSafeTestDatabaseName(null), UnsafeTestDatabaseNameError);
    assert.throws(() => assertSafeTestDatabaseName(""), UnsafeTestDatabaseNameError);
    assert.throws(() => assertSafeTestDatabaseName("   "), UnsafeTestDatabaseNameError);
  });

  it("rejects the development database name (Part 12 item 8)", () => {
    assert.equal(isSafeTestDatabaseName("humanity_union_dev"), false);
    assert.throws(() => assertSafeTestDatabaseName("humanity_union_dev"), /forbidden|protected/);
  });

  it("rejects the staging database name", () => {
    assert.equal(isSafeTestDatabaseName("humanity_union_staging"), false);
    assert.throws(() => assertSafeTestDatabaseName("humanity_union_staging"), /forbidden|protected/);
  });

  it("rejects production-like and reserved names (Part 12 item 9)", () => {
    for (const forbidden of ["humanity_union", "production", "development", "admin", "local", "config"]) {
      assert.equal(isSafeTestDatabaseName(forbidden), false, `expected "${forbidden}" to be rejected`);
      assert.throws(() => assertSafeTestDatabaseName(forbidden), /forbidden/);
    }
  });

  it("keeps FORBIDDEN_TEST_DATABASE_NAMES and the assertion in sync", () => {
    for (const forbidden of FORBIDDEN_TEST_DATABASE_NAMES) {
      if (forbidden === "") continue;
      assert.throws(() => assertSafeTestDatabaseName(forbidden));
    }
  });

  it("rejects names that do not match the generated-name pattern even if superficially plausible", () => {
    for (const badName of ["hu_test", "hu-test-123", "HU_TEST_123", "hu_test_", "hu_test_has space", "random_db"]) {
      assert.equal(isSafeTestDatabaseName(badName), false, `expected "${badName}" to be rejected`);
    }
  });

  it("rejects names containing shell/glob metacharacters or path separators", () => {
    for (const badName of ["hu_test_123/../etc", "hu_test_123;drop", "hu_test_123 injected"]) {
      assert.equal(isSafeTestDatabaseName(badName), false, `expected "${badName}" to be rejected`);
    }
  });
});

describe("rewriteMongoUriDatabase", () => {
  it("replaces the database path segment, preserving host/credentials/query", () => {
    const result = rewriteMongoUriDatabase(
      "mongodb+srv://user:pass@cluster0.example.mongodb.net/humanity_union_dev?retryWrites=true",
      "hu_test_123_456_abc",
    );

    assert.equal(
      result,
      "mongodb+srv://user:pass@cluster0.example.mongodb.net/hu_test_123_456_abc?retryWrites=true",
    );
  });

  it("appends a database segment when the URI has none", () => {
    const result = rewriteMongoUriDatabase("mongodb://localhost:27017", "hu_test_123_456_abc");

    assert.equal(result, "mongodb://localhost:27017/hu_test_123_456_abc");
  });

  it("returns an empty string unchanged", () => {
    assert.equal(rewriteMongoUriDatabase("", "hu_test_123_456_abc"), "");
  });
});

describe("dropIsolatedTestDatabase safety guard", () => {
  it("refuses to drop a database whose name is not a safe test-database name, without connecting", async () => {
    await assert.rejects(
      () => dropIsolatedTestDatabase({ uri: "mongodb://127.0.0.1:1/does-not-matter", databaseName: "humanity_union_dev" }),
      UnsafeTestDatabaseNameError,
    );
  });

  it("refuses to drop the production-default database name", async () => {
    await assert.rejects(
      () => dropIsolatedTestDatabase({ uri: "mongodb://127.0.0.1:1/does-not-matter", databaseName: "humanity_union" }),
      UnsafeTestDatabaseNameError,
    );
  });

  it("is bounded: gives up within its timeout instead of hanging when the server is unreachable (Part 12 item 21)", async () => {
    const start = Date.now();

    await assert.rejects(() =>
      dropIsolatedTestDatabase({
        // 10.255.255.1 is a non-routable address chosen to reliably time out
        // rather than fail fast with connection-refused, so this genuinely
        // exercises the bounded-timeout path (not just error propagation).
        uri: "mongodb://10.255.255.1:27017/unreachable",
        databaseName: "hu_test_bounded_timeout_check",
        timeoutMs: 500,
        verifyAbsent: false,
      }),
    );

    const elapsedMs = Date.now() - start;
    assert.ok(elapsedMs < 5_000, `expected bounded cleanup to give up quickly, took ${elapsedMs}ms`);
  });
});
