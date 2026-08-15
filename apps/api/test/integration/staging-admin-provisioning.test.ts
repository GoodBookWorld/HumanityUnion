import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";

import {
  deleteAuthUsersByEmailPrefix,
  findAuthUserByEmail,
  insertAuthUser,
} from "../../src/modules/auth/auth-user.repository.js";
import {
  formatStagingAdminProvisionSummary,
  provisionStagingAdmin,
  StagingAdminProvisionError,
} from "../../src/modules/auth/staging-admin-provisioning.js";
import {
  countMembersByIdentityId,
  countMembersByMemberId,
  deleteMembersByMemberIdPrefix,
  findMemberByIdentityId,
  insertMember,
} from "../../src/modules/member/infrastructure/member.repository.js";
import { createMemberProfileForUser } from "../../src/modules/member-profile/member-profile.service.js";
import { deleteMemberProfileByUserId } from "../../src/modules/member-profile/member-profile.repository.js";
import { resolveMongoConfig } from "../../src/infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../src/infrastructure/mongodb/mongo-indexes.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../helpers/test-env.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("stg-admin");
const ADMIN_EMAIL = `${TEST_PREFIX}-admin@staging-provision.test`;
const ADMIN_PASSWORD = "StagingAdminPass123!";
const ADMIN_DISPLAY_NAME = "Staging Provision Admin";

const trackedEmails = [
  ADMIN_EMAIL,
  `${TEST_PREFIX}-orphan-auth@staging-provision.test`,
  `${TEST_PREFIX}-bad-role@staging-provision.test`,
];

function provisionEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: "production",
    PLATFORM_MODE: "staging",
    ALLOW_STAGING_ADMIN_PROVISION: "true",
    AUTH_BOOTSTRAP_FALLBACK: "false",
    NODE_TEST_ENV: "true",
    STAGING_ADMIN_EMAIL: ADMIN_EMAIL,
    STAGING_ADMIN_PASSWORD: ADMIN_PASSWORD,
    STAGING_ADMIN_DISPLAY_NAME: ADMIN_DISPLAY_NAME,
  };
}

async function cleanupProvisionArtifacts(): Promise<void> {
  for (const email of trackedEmails) {
    const user = await findAuthUserByEmail(email);
    if (user) {
      await deleteMembersByMemberIdPrefix(user.memberId);
      await deleteMemberProfileByUserId(user.userId);
    }
  }

  await deleteMembersByMemberIdPrefix(TEST_PREFIX);
  await deleteAuthUsersByEmailPrefix(TEST_PREFIX);
}

describe("staging admin provision integration", () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  after(async () => {
    await cleanupProvisionArtifacts();
    await disconnectMongoClient();
  });

  it("creates one admin correctly with linked Member/Participant and admin role", async () => {
    const database = resolveMongoConfig().database;
    assert.match(database, /^hu_test_/);
    assert.notEqual(database, "humanity_union_dev");

    const result = await provisionStagingAdmin({
      env: provisionEnv(),
      skipBootstrap: true,
    });

    assert.equal(result.outcome, "created");
    assert.equal(result.email, ADMIN_EMAIL);
    assert.equal(result.role, "admin");
    assert.equal(result.database, database);
    assert.ok(result.userId);
    assert.ok(result.memberId);

    const authUser = await findAuthUserByEmail(ADMIN_EMAIL);
    assert.ok(authUser);
    assert.equal(authUser.role, "admin");
    assert.equal(authUser.userId, result.userId);
    assert.equal(authUser.memberId, result.memberId);
    assert.equal(authUser.emailVerificationStatus, "verified");
    assert.ok(authUser.passwordHash);
    assert.equal(authUser.passwordHash.includes(ADMIN_PASSWORD), false);

    const member = await findMemberByIdentityId(authUser.userId);
    assert.ok(member);
    assert.equal(member.memberId, authUser.memberId);
    assert.equal(member.identityId, authUser.userId);
    assert.equal(await countMembersByIdentityId(authUser.userId), 1);
    assert.equal(await countMembersByMemberId(authUser.memberId), 1);
  });

  it("second run is idempotent and does not reset password or duplicate records", async () => {
    const before = await findAuthUserByEmail(ADMIN_EMAIL);
    assert.ok(before);
    const passwordHashBefore = before.passwordHash;

    const result = await provisionStagingAdmin({
      env: provisionEnv(),
      skipBootstrap: true,
      credentials: {
        email: ADMIN_EMAIL,
        password: "DifferentPassword999!",
        displayName: ADMIN_DISPLAY_NAME,
      },
    });

    assert.equal(result.outcome, "already_complete");
    assert.equal(result.userId, before.userId);
    assert.equal(result.memberId, before.memberId);
    assert.equal(result.role, "admin");

    const after = await findAuthUserByEmail(ADMIN_EMAIL);
    assert.ok(after);
    assert.equal(after.passwordHash, passwordHashBefore);
    assert.equal(await countMembersByIdentityId(before.userId), 1);
    assert.equal(await countMembersByMemberId(before.memberId), 1);
  });

  it("fails clearly when Auth User exists without linked Member", async () => {
    const orphanEmail = `${TEST_PREFIX}-orphan-auth@staging-provision.test`;
    const memberId = randomUUID();

    await insertAuthUser(
      {
        email: orphanEmail,
        password: "OrphanAuthPass1!",
        displayName: "Orphan Auth",
        role: "admin",
      },
      memberId,
    );

    await assert.rejects(
      () =>
        provisionStagingAdmin({
          env: {
            ...provisionEnv(),
            STAGING_ADMIN_EMAIL: orphanEmail,
            STAGING_ADMIN_PASSWORD: "OrphanAuthPass1!",
            STAGING_ADMIN_DISPLAY_NAME: "Orphan Auth",
          },
          skipBootstrap: true,
        }),
      (error: unknown) =>
        error instanceof StagingAdminProvisionError &&
        error.message.includes("linked Member/Participant is missing"),
    );
  });

  it("fails clearly when linked Auth+Member exist but Auth role is not admin", async () => {
    // Auth-without-Member is covered above. This case: both sides exist and
    // are linked, but Auth role is not the canonical admin role.
    const badEmail = `${TEST_PREFIX}-bad-role@staging-provision.test`;
    const memberId = `${TEST_PREFIX}-bad-role-member`;
    const authUser = await insertAuthUser(
      {
        email: badEmail,
        password: "BadRolePass1!",
        displayName: "Bad Role",
        role: "member",
      },
      memberId,
    );
    await createMemberProfileForUser({
      userId: authUser.userId,
      displayName: "Bad Role",
    });
    await insertMember({
      memberId,
      identityId: authUser.userId,
      displayName: "Bad Role",
      uniqueName: `${TEST_PREFIX}-bad-role`,
      verificationLevel: "email",
    });

    await assert.rejects(
      () =>
        provisionStagingAdmin({
          env: {
            ...provisionEnv(),
            STAGING_ADMIN_EMAIL: badEmail,
            STAGING_ADMIN_PASSWORD: "BadRolePass1!",
            STAGING_ADMIN_DISPLAY_NAME: "Bad Role",
          },
          skipBootstrap: true,
        }),
      (error: unknown) =>
        error instanceof StagingAdminProvisionError && error.message.includes('role is "member"'),
    );
  });

  it("does not depend on AUTH_BOOTSTRAP_FALLBACK and refuses when it is enabled", async () => {
    await assert.rejects(
      () =>
        provisionStagingAdmin({
          env: {
            ...provisionEnv(),
            AUTH_BOOTSTRAP_FALLBACK: "true",
            STAGING_ADMIN_EMAIL: `${TEST_PREFIX}-bootstrap@staging-provision.test`,
          },
          skipBootstrap: true,
        }),
      (error: unknown) =>
        error instanceof StagingAdminProvisionError &&
        error.message.includes("AUTH_BOOTSTRAP_FALLBACK"),
    );
  });

  it("never prints password or secrets in the success summary", async () => {
    const existing = await findAuthUserByEmail(ADMIN_EMAIL);
    assert.ok(existing);

    const summary = formatStagingAdminProvisionSummary({
      outcome: "already_complete",
      email: existing.email,
      userId: existing.userId,
      memberId: existing.memberId,
      role: existing.role,
      database: resolveMongoConfig().database,
      message: "Staging admin provisioning already complete; no changes made.",
    });

    assert.equal(summary.includes(ADMIN_PASSWORD), false);
    assert.equal(summary.includes("password"), false);
    assert.equal(summary.includes("mongodb"), false);
    assert.equal(summary.includes("Password"), false);
    assert.match(summary, /email:/);
    assert.match(summary, /userId:/);
    assert.match(summary, /memberId:/);
    assert.match(summary, /role: admin/);
  });
});
