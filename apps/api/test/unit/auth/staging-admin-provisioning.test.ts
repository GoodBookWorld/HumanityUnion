import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertStagingAdminProvisionGuards,
  isAllowedStagingAdminProvisionDatabase,
  readStagingAdminCredentials,
  StagingAdminProvisionError,
  STAGING_ADMIN_PROVISION_DATABASE,
} from "../../../src/modules/auth/staging-admin-provisioning.js";

describe("staging admin provision guards", () => {
  const validBase = {
    NODE_ENV: "production",
    PLATFORM_MODE: "staging",
    ALLOW_STAGING_ADMIN_PROVISION: "true",
    AUTH_BOOTSTRAP_FALLBACK: "false",
    database: STAGING_ADMIN_PROVISION_DATABASE,
  };

  it("rejects non-staging platform mode", () => {
    assert.throws(
      () => assertStagingAdminProvisionGuards({ ...validBase, PLATFORM_MODE: "beta" }),
      (error: unknown) =>
        error instanceof StagingAdminProvisionError &&
        error.message.includes("PLATFORM_MODE must be staging"),
    );

    assert.throws(
      () => assertStagingAdminProvisionGuards({ ...validBase, PLATFORM_MODE: "production" }),
      StagingAdminProvisionError,
    );

    assert.throws(
      () => assertStagingAdminProvisionGuards({ ...validBase, PLATFORM_MODE: "development" }),
      StagingAdminProvisionError,
    );
  });

  it("rejects wrong / forbidden / unknown databases", () => {
    for (const database of [
      "humanity_union_dev",
      "humanity_union",
      "humanity_union_production",
      "production",
      "hu_verify_something",
      "unknown_db",
      "",
    ]) {
      assert.equal(
        isAllowedStagingAdminProvisionDatabase(database),
        false,
        `expected ${database || "(empty)"} to be refused`,
      );
      assert.throws(
        () => assertStagingAdminProvisionGuards({ ...validBase, database }),
        StagingAdminProvisionError,
      );
    }
  });

  it("allows only humanity_union_staging outside tests", () => {
    assert.equal(isAllowedStagingAdminProvisionDatabase(STAGING_ADMIN_PROVISION_DATABASE), true);
    assert.doesNotThrow(() => assertStagingAdminProvisionGuards(validBase));
  });

  it("allows isolated hu_test_* databases only when NODE_TEST_ENV=true", () => {
    const testDb = "hu_test_abc123";
    assert.equal(isAllowedStagingAdminProvisionDatabase(testDb), false);
    assert.equal(
      isAllowedStagingAdminProvisionDatabase(testDb, { nodeTestEnv: true }),
      true,
    );
    assert.doesNotThrow(() =>
      assertStagingAdminProvisionGuards({
        ...validBase,
        NODE_TEST_ENV: "true",
        database: testDb,
      }),
    );
  });

  it("requires explicit provisioning flag", () => {
    assert.throws(
      () =>
        assertStagingAdminProvisionGuards({
          ...validBase,
          ALLOW_STAGING_ADMIN_PROVISION: undefined,
        }),
      (error: unknown) =>
        error instanceof StagingAdminProvisionError &&
        error.message.includes("ALLOW_STAGING_ADMIN_PROVISION"),
    );

    assert.throws(
      () =>
        assertStagingAdminProvisionGuards({
          ...validBase,
          ALLOW_STAGING_ADMIN_PROVISION: "false",
        }),
      StagingAdminProvisionError,
    );
  });

  it("rejects NODE_ENV other than production", () => {
    assert.throws(
      () => assertStagingAdminProvisionGuards({ ...validBase, NODE_ENV: "test" }),
      StagingAdminProvisionError,
    );
  });

  it("refuses AUTH_BOOTSTRAP_FALLBACK=true (no bootstrap fallback dependency)", () => {
    assert.throws(
      () =>
        assertStagingAdminProvisionGuards({
          ...validBase,
          AUTH_BOOTSTRAP_FALLBACK: "true",
        }),
      (error: unknown) =>
        error instanceof StagingAdminProvisionError &&
        error.message.includes("AUTH_BOOTSTRAP_FALLBACK"),
    );
  });

  it("reads credentials from env without hardcoding and validates them", () => {
    assert.throws(() => readStagingAdminCredentials({}), StagingAdminProvisionError);

    const credentials = readStagingAdminCredentials({
      STAGING_ADMIN_EMAIL: " Admin@Example.COM ",
      STAGING_ADMIN_PASSWORD: "SecurePass1!",
      STAGING_ADMIN_DISPLAY_NAME: "Staging Admin",
    });

    assert.equal(credentials.email, "admin@example.com");
    assert.equal(credentials.displayName, "Staging Admin");
    assert.equal(credentials.password, "SecurePass1!");
  });
});
