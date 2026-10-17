import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { PROTECTED_DATABASE_NAMES } from "../../../src/infrastructure/mongodb/ephemeral-mongo-database-safety.js";
import {
  assertExplicitIsolatedMongoTestTarget,
  ExplicitIsolatedMongoTestError,
  isExplicitIsolatedMongoTest,
  lockExplicitIsolatedMongoTestConfig,
} from "../../../src/infrastructure/mongodb/explicit-isolated-mongo-test.js";
import { getMongoClient } from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { getLockedMongoConfigForTests } from "../../../src/infrastructure/mongodb/mongo-config.js";
import { MemberRegistrationUnavailableError } from "../../../src/modules/member/domain/member.errors.js";
import {
  findMemberById,
  findMemberByIdentityId,
  insertMember,
  listMembers,
} from "../../../src/modules/member/infrastructure/member.repository.js";
import {
  getExternalAuthorLinkStore,
  setExternalAuthorLinkStoreForTests,
} from "../../../src/modules/external-author-link/external-author-link.store.js";
import { INTEGRITY_MEDIA_SOURCE } from "../../../src/modules/external-author-link/external-author-link.constants.js";

const SAFE_DATABASE = "hu_test_sso";
const SAFE_URI = "mongodb://127.0.0.1:9/hu_test_sso";

describe("explicit isolated MongoDB SSO test gate", () => {
  it("does not read application Mongo defaults", () => {
    const source = readFileSync(
      new URL("../../../src/infrastructure/mongodb/explicit-isolated-mongo-test.ts", import.meta.url),
      "utf8",
    );
    assert.equal(source.includes("process.env.MONGODB_URI"), false);
    assert.equal(source.includes("process.env.MONGODB_DATABASE"), false);
    assert.equal(source.includes('"humanity_union"'), false);
  });

  it("rejects a missing connection and a missing database before locking", () => {
    assert.throws(
      () => lockExplicitIsolatedMongoTestConfig({ uri: "", database: SAFE_DATABASE }),
      ExplicitIsolatedMongoTestError,
    );
    assert.throws(
      () => lockExplicitIsolatedMongoTestConfig({ uri: "   ", database: SAFE_DATABASE }),
      ExplicitIsolatedMongoTestError,
    );
    assert.throws(
      () => lockExplicitIsolatedMongoTestConfig({ uri: SAFE_URI, database: "" }),
      ExplicitIsolatedMongoTestError,
    );
    assert.throws(
      () => lockExplicitIsolatedMongoTestConfig({ uri: SAFE_URI, database: undefined }),
      ExplicitIsolatedMongoTestError,
    );
    assert.equal(getLockedMongoConfigForTests(), null);
    assert.equal(isExplicitIsolatedMongoTest(), false);
  });

  it("rejects malformed database names and connection strings before locking", () => {
    const malformedDatabases = [
      "hu_test_",
      "hu_test_bad-name",
      "not_a_test",
      "hu_verify_sso",
      `hu_test_${"a".repeat(40)}`,
      "mongodb://127.0.0.1:9/hu_test_sso",
      "hu_test_sso extra",
    ];
    for (const database of malformedDatabases) {
      assert.throws(
        () => lockExplicitIsolatedMongoTestConfig({ uri: SAFE_URI, database }),
        ExplicitIsolatedMongoTestError,
      );
    }

    assert.throws(
      () =>
        lockExplicitIsolatedMongoTestConfig({
          uri: "http://127.0.0.1:9/hu_test_sso",
          database: SAFE_DATABASE,
        }),
      ExplicitIsolatedMongoTestError,
    );
    assert.throws(
      () =>
        lockExplicitIsolatedMongoTestConfig({
          uri: "mongodb://127.0.0.1:9/hu_test_sso/extra",
          database: SAFE_DATABASE,
        }),
      ExplicitIsolatedMongoTestError,
    );
    assert.throws(
      () =>
        lockExplicitIsolatedMongoTestConfig({
          uri: "mongodb://127.0.0.1:9/hu_test_other",
          database: SAFE_DATABASE,
        }),
      ExplicitIsolatedMongoTestError,
    );
    assert.equal(getLockedMongoConfigForTests(), null);
  });

  it("rejects protected application and system database names before locking", () => {
    const protectedNames = [
      ...PROTECTED_DATABASE_NAMES,
      "staging",
      "hu_test_staging",
      "hu_test_production",
      "hu_test_humanity_union_staging",
    ];
    for (const database of protectedNames) {
      assert.throws(
        () =>
          lockExplicitIsolatedMongoTestConfig({
            uri: `mongodb://127.0.0.1:9/${database}`,
            database,
          }),
        (error: unknown) =>
          error instanceof ExplicitIsolatedMongoTestError &&
          error.message === "The isolated test database name is protected.",
      );
    }

    assert.throws(
      () =>
        lockExplicitIsolatedMongoTestConfig({
          uri: "mongodb://127.0.0.1:9/humanity_union_staging",
          database: SAFE_DATABASE,
        }),
      ExplicitIsolatedMongoTestError,
    );
    assert.throws(
      () =>
        lockExplicitIsolatedMongoTestConfig({
          uri: "mongodb://127.0.0.1:9/humanity_union_production",
          database: SAFE_DATABASE,
        }),
      ExplicitIsolatedMongoTestError,
    );
    assert.equal(getLockedMongoConfigForTests(), null);
    assert.throws(() => getMongoClient(), /not connected/);
  });

  it("accepts an owned hu_test_ target without locking or connecting", () => {
    const accepted = assertExplicitIsolatedMongoTestTarget({
      uri: "mongodb://127.0.0.1:9",
      database: SAFE_DATABASE,
    });
    assert.equal(accepted.database, SAFE_DATABASE);
    const withPath = assertExplicitIsolatedMongoTestTarget({
      uri: SAFE_URI,
      database: SAFE_DATABASE,
    });
    assert.equal(withPath.database, SAFE_DATABASE);
    assert.equal(getLockedMongoConfigForTests(), null);
    assert.equal(isExplicitIsolatedMongoTest(), false);
    assert.throws(() => getMongoClient(), /not connected/);
  });

  it("keeps member reads and writes refused when no explicit test database is locked", async () => {
    await assert.rejects(() => findMemberById("sso-safety-member"), MemberRegistrationUnavailableError);
    await assert.rejects(
      () => findMemberByIdentityId("sso-safety-user"),
      MemberRegistrationUnavailableError,
    );
    await assert.rejects(() => listMembers(), MemberRegistrationUnavailableError);
    await assert.rejects(
      () =>
        insertMember({
          memberId: "sso-safety-member",
          identityId: "sso-safety-user",
          displayName: "Safety",
          uniqueName: "sso-safety-name",
        }),
      MemberRegistrationUnavailableError,
    );
    assert.throws(() => getMongoClient(), /not connected/);
  });

  it("does not follow MONGODB_URI when the explicit test lock is missing", { timeout: 1_000 }, async () => {
    const previousUri = process.env.MONGODB_URI;
    const previousDatabase = process.env.MONGODB_DATABASE;
    process.env.MONGODB_URI = "mongodb://127.0.0.1:9/humanity_union_staging";
    process.env.MONGODB_DATABASE = "humanity_union_staging";

    try {
      await assert.rejects(
        () => findMemberById("sso-safety-member"),
        MemberRegistrationUnavailableError,
      );
      assert.equal(isExplicitIsolatedMongoTest(), false);
      assert.equal(getLockedMongoConfigForTests(), null);
      assert.throws(() => getMongoClient(), /not connected/);
    } finally {
      restoreEnv("MONGODB_URI", previousUri);
      restoreEnv("MONGODB_DATABASE", previousDatabase);
    }
  });

  it("keeps the author-link store in memory when no explicit test database is locked", async () => {
    setExternalAuthorLinkStoreForTests(null);
    const store = getExternalAuthorLinkStore();
    const now = "2026-01-01T00:00:00.000Z";
    const inserted = await store.insertLink({
      source: INTEGRITY_MEDIA_SOURCE,
      externalAuthorId: "11111111-1111-4111-8111-111111111111",
      memberId: "sso-safety-member",
      state: "linked",
      createdAt: now,
      updatedAt: now,
      confirmedAt: now,
      disconnectedAt: null,
      linkRevision: 1,
      linkFinalization: "confirmed",
    });
    assert.equal(inserted, "inserted");
    const found = await store.findLinkByAuthor(
      INTEGRITY_MEDIA_SOURCE,
      "11111111-1111-4111-8111-111111111111",
    );
    assert.equal(found?.memberId, "sso-safety-member");
    assert.throws(() => getMongoClient(), /not connected/);
    setExternalAuthorLinkStoreForTests(null);
  });
});

function restoreEnv(name: "MONGODB_URI" | "MONGODB_DATABASE", value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
