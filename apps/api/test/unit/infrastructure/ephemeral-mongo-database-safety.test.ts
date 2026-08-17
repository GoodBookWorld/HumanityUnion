import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ALLOW_EPHEMERAL_DB_UNDER_HIGH_COLLECTION_PRESSURE_ENV_VAR,
  COLLECTION_PRESSURE_THRESHOLDS,
  CollectionPressureError,
  KEEP_VERIFICATION_DATABASE_ENV_VAR,
  PROTECTED_DATABASE_NAMES,
  ProtectedDatabaseError,
  assertMayCreateEphemeralDatabase,
  assertSafeOwnedEphemeralDatabaseName,
  classifyCollectionPressure,
  dropOwnedEphemeralDatabase,
  isProtectedDatabaseName,
} from "../../../src/infrastructure/mongodb/ephemeral-mongo-database-safety.js";
import {
  activateVerificationDatabaseIsolation,
  assertVerificationDatabaseIsolated,
  clearActiveVerificationIsolationsForTests,
  disposeActiveVerificationIsolations,
} from "../../../src/scripts/verification-database-isolation.js";

const SCRIPT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../src/scripts/inspect-mongo-topology.ts",
);

afterEach(() => {
  clearActiveVerificationIsolationsForTests();
});

describe("ephemeral mongo protected database contract", () => {
  it("treats staging as protected", () => {
    assert.equal(isProtectedDatabaseName("humanity_union_staging"), true);
    assert.ok(PROTECTED_DATABASE_NAMES.has("humanity_union_staging"));
  });

  it("treats dev as protected", () => {
    assert.equal(isProtectedDatabaseName("humanity_union_dev"), true);
  });

  it("treats production-shaped and configured canonical DB as protected", () => {
    assert.equal(isProtectedDatabaseName("humanity_union_production"), true);
    assert.equal(
      isProtectedDatabaseName("my_custom_prod", {
        MONGODB_DATABASE: "my_custom_prod",
      } as NodeJS.ProcessEnv),
      true,
    );
  });

  it("refuses drop of staging via owned-drop helper", async () => {
    await assert.rejects(
      () =>
        dropOwnedEphemeralDatabase({
          uri: "mongodb://127.0.0.1:1/x",
          databaseName: "humanity_union_staging",
          ownedDatabaseName: "humanity_union_staging",
          kind: "test",
          connectAndDrop: async () => {
            throw new Error("must not connect");
          },
        }),
      ProtectedDatabaseError,
    );
  });

  it("refuses drop of dev via owned-drop helper", async () => {
    await assert.rejects(
      () =>
        dropOwnedEphemeralDatabase({
          uri: "mongodb://127.0.0.1:1/x",
          databaseName: "humanity_union_dev",
          ownedDatabaseName: "humanity_union_dev",
          kind: "verify",
          connectAndDrop: async () => {
            throw new Error("must not connect");
          },
        }),
      ProtectedDatabaseError,
    );
  });

  it("refuses ownership mismatch and non-ephemeral names", () => {
    assert.throws(
      () =>
        assertSafeOwnedEphemeralDatabaseName({
          databaseName: "hu_test_a",
          ownedDatabaseName: "hu_test_b",
          kind: "test",
        }),
      /does not match run-owned name/,
    );
    assert.throws(
      () =>
        assertSafeOwnedEphemeralDatabaseName({
          databaseName: "random_db",
          ownedDatabaseName: "random_db",
          kind: "test",
        }),
      /must start with hu_test_/,
    );
  });

  it("does not accept staging/dev as ephemeral under either kind", () => {
    for (const name of ["humanity_union_staging", "humanity_union_dev"]) {
      for (const kind of ["test", "verify"] as const) {
        assert.throws(
          () =>
            assertSafeOwnedEphemeralDatabaseName({
              databaseName: name,
              ownedDatabaseName: name,
              kind,
            }),
          ProtectedDatabaseError,
        );
      }
    }
  });
});

describe("collection pressure guard", () => {
  it("allows safe low-count runs", () => {
    const assessment = classifyCollectionPressure(120);
    assert.equal(assessment.level, "ok");
    assert.equal(assessment.mayCreateEphemeralDatabase, true);
    assert.doesNotThrow(() => assertMayCreateEphemeralDatabase(assessment));
  });

  it("classifies info and warning thresholds", () => {
    assert.equal(classifyCollectionPressure(COLLECTION_PRESSURE_THRESHOLDS.infoFrom).level, "info");
    assert.equal(
      classifyCollectionPressure(COLLECTION_PRESSURE_THRESHOLDS.warningFrom).level,
      "warning",
    );
    assert.doesNotThrow(() =>
      assertMayCreateEphemeralDatabase(classifyCollectionPressure(COLLECTION_PRESSURE_THRESHOLDS.warningFrom)),
    );
  });

  it("refuses new ephemeral DB at high-risk threshold", () => {
    const assessment = classifyCollectionPressure(COLLECTION_PRESSURE_THRESHOLDS.highRiskFrom);
    assert.equal(assessment.level, "high_risk");
    assert.equal(assessment.mayCreateEphemeralDatabase, false);
    assert.throws(() => assertMayCreateEphemeralDatabase(assessment), CollectionPressureError);
  });

  it("allows high-risk creation only with explicit diagnostic override", () => {
    const assessment = classifyCollectionPressure(480);
    assert.doesNotThrow(() =>
      assertMayCreateEphemeralDatabase(assessment, {
        env: {
          [ALLOW_EPHEMERAL_DB_UNDER_HIGH_COLLECTION_PRESSURE_ENV_VAR]: "1",
        } as NodeJS.ProcessEnv,
      }),
    );
  });
});

describe("dropOwnedEphemeralDatabase (mocked)", () => {
  it("drops owned hu_test_* and verifies absence", async () => {
    const dropped: string[] = [];
    const result = await dropOwnedEphemeralDatabase({
      uri: "mongodb://example.invalid/hu_test_owned_1",
      databaseName: "hu_test_owned_1",
      ownedDatabaseName: "hu_test_owned_1",
      kind: "test",
      connectAndDrop: async ({ databaseName }) => {
        dropped.push(databaseName);
      },
      listDatabaseNames: async () => ["humanity_union_dev"],
    });
    assert.deepEqual(dropped, ["hu_test_owned_1"]);
    assert.equal(result.dropped, true);
    assert.equal(result.verifiedAbsent, true);
  });

  it("surfaces cleanup failure when drop verification finds the DB still present", async () => {
    await assert.rejects(
      () =>
        dropOwnedEphemeralDatabase({
          uri: "mongodb://example.invalid/hu_test_owned_2",
          databaseName: "hu_test_owned_2",
          ownedDatabaseName: "hu_test_owned_2",
          kind: "test",
          connectAndDrop: async () => {},
          listDatabaseNames: async () => ["hu_test_owned_2"],
        }),
      /still exists/,
    );
  });
});

describe("verification database isolation cleanup contract", () => {
  it("cleanupDatabase drops owned hu_verify_* after successful path", async () => {
    const env: NodeJS.ProcessEnv = {
      MONGODB_URI: "mongodb://127.0.0.1:27017/humanity_union_dev",
    };
    const dropped: string[] = [];
    const isolation = activateVerificationDatabaseIsolation("PACK01-OK", {
      env,
      skipPressureCheck: true,
      pressureAssessment: classifyCollectionPressure(100),
      dropDatabase: async ({ databaseName }) => {
        dropped.push(databaseName);
      },
    });

    assert.match(isolation.databaseName, /^hu_verify_/);
    const result = await isolation.cleanupDatabase();
    assert.equal(result.succeeded, true);
    assert.equal(result.attempted, true);
    assert.deepEqual(dropped, [isolation.databaseName]);
    isolation.restoreEnvironment();
  });

  it("cleanupDatabase still runs after a simulated verification failure path", async () => {
    const env: NodeJS.ProcessEnv = { MONGODB_URI: "mongodb://127.0.0.1:27017/humanity_union_dev" };
    const dropped: string[] = [];
    const isolation = activateVerificationDatabaseIsolation("PACK01-FAIL", {
      env,
      skipPressureCheck: true,
      pressureAssessment: classifyCollectionPressure(100),
      dropDatabase: async ({ databaseName }) => {
        dropped.push(databaseName);
      },
    });

    let verificationError: Error | null = null;
    try {
      throw new Error("verification failed");
    } catch (error) {
      verificationError = error instanceof Error ? error : new Error(String(error));
    } finally {
      await isolation.dispose();
    }

    assert.equal(verificationError?.message, "verification failed");
    assert.deepEqual(dropped, [isolation.databaseName]);
    assert.equal(env.MONGODB_URI, "mongodb://127.0.0.1:27017/humanity_union_dev");
  });

  it("restoreEnvironment does not substitute for database cleanup", async () => {
    const env: NodeJS.ProcessEnv = { MONGODB_URI: "mongodb://127.0.0.1:27017/humanity_union_dev" };
    let dropped = false;
    const isolation = activateVerificationDatabaseIsolation("PACK01-RESTORE-ONLY", {
      env,
      skipPressureCheck: true,
      pressureAssessment: classifyCollectionPressure(100),
      dropDatabase: async () => {
        dropped = true;
      },
    });

    isolation.restoreEnvironment();
    assert.equal(dropped, false);
    assert.equal(env.MONGODB_URI, "mongodb://127.0.0.1:27017/humanity_union_dev");

    // Active isolation still requires dispose/cleanup for DB drop.
    await disposeActiveVerificationIsolations();
    assert.equal(dropped, true);
  });

  it(`honors ${KEEP_VERIFICATION_DATABASE_ENV_VAR}=1 by preserving the DB`, async () => {
    const env: NodeJS.ProcessEnv = {
      MONGODB_URI: "mongodb://127.0.0.1:27017/humanity_union_dev",
      [KEEP_VERIFICATION_DATABASE_ENV_VAR]: "1",
    };
    let dropped = false;
    const isolation = activateVerificationDatabaseIsolation("PACK01-KEEP", {
      env,
      skipPressureCheck: true,
      pressureAssessment: classifyCollectionPressure(100),
      dropDatabase: async () => {
        dropped = true;
      },
    });

    const result = await isolation.dispose();
    assert.equal(dropped, false);
    assert.equal(result.preservedForDiagnostics, true);
    assert.equal(result.attempted, false);
  });

  it("reports cleanup failure without hiding it", async () => {
    const env: NodeJS.ProcessEnv = { MONGODB_URI: "mongodb://127.0.0.1:27017/humanity_union_dev" };
    const errors: string[] = [];
    const isolation = activateVerificationDatabaseIsolation("PACK01-CLEANUP-FAIL", {
      env,
      skipPressureCheck: true,
      pressureAssessment: classifyCollectionPressure(100),
      dropDatabase: async () => {
        throw new Error("simulated verify drop failure");
      },
      logError: (message) => errors.push(message),
    });

    const result = await isolation.cleanupDatabase();
    assert.equal(result.succeeded, false);
    assert.equal(result.attempted, true);
    assert.match(result.error?.message ?? "", /simulated verify drop failure/);
    assert.ok(errors.some((line) => line.includes(isolation.databaseName)));
    isolation.restoreEnvironment();
  });

  it("assertVerificationDatabaseIsolated rejects staging/dev", () => {
    assert.throws(
      () =>
        assertVerificationDatabaseIsolated({
          HU_VERIFICATION_MODE: "true",
          MONGODB_DATABASE: "humanity_union_staging",
        } as NodeJS.ProcessEnv),
      /must not use/,
    );
    assert.throws(
      () =>
        assertVerificationDatabaseIsolated({
          HU_VERIFICATION_MODE: "true",
          MONGODB_DATABASE: "humanity_union_dev",
        } as NodeJS.ProcessEnv),
      /must not use/,
    );
  });

  it("refuses activation under high-risk pressure without override", () => {
    assert.throws(
      () =>
        activateVerificationDatabaseIsolation("PACK01-PRESSURE", {
          env: { MONGODB_URI: "mongodb://127.0.0.1:27017/humanity_union_dev" } as NodeJS.ProcessEnv,
          pressureAssessment: classifyCollectionPressure(425),
        }),
      CollectionPressureError,
    );
  });
});

describe("inspect-mongo-topology is read-only", () => {
  it("contains no drop/write/create operations in source", () => {
    const source = fs.readFileSync(SCRIPT_PATH, "utf8");
    assert.doesNotMatch(source, /\.dropDatabase\s*\(/);
    assert.doesNotMatch(source, /\.drop\s*\(/);
    assert.doesNotMatch(source, /insertOne|insertMany|updateOne|updateMany|deleteOne|deleteMany|bulkWrite/);
    assert.match(source, /READ-ONLY/);
  });
});
