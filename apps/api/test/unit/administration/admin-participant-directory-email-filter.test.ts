/**
 * Directory email-verification filter and pagination.
 * Writes only when MONGODB_DATABASE is an owned hu_test_* database.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import { AdminParticipantDirectoryValidationError, listAdminParticipants } from "../../../src/modules/administration/admin-participant-directory.service.js";
import {
  deleteAuthUsersByEmailPrefix,
  insertAuthUser,
  listAuthUsersForAdmin,
  markAuthUserEmailVerified,
} from "../../../src/modules/auth/auth-user.repository.js";
import { isMongoConfigured, resolveMongoConfig } from "../../../src/infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";

const RUN_ID = randomUUID();
const EMAIL_PREFIX = `sec03b-${RUN_ID}`;
const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function ownedTestDatabase(): boolean {
  const name = process.env.MONGODB_DATABASE?.trim() ?? "";
  return /^hu_test_[a-zA-Z0-9_]+$/.test(name);
}

const mongoReady = isMongoConfigured() && ownedTestDatabase();

describe("Admin participant directory email verification filter", {
  skip: mongoReady ? false : "owned hu_test_ MongoDB is not selected",
}, () => {
  const userIds: string[] = [];

  before(async () => {
    await connectMongoClient();
    const pending = await insertAuthUser(
      {
        email: `${EMAIL_PREFIX}-pending@directory-filter.test`,
        password: "Password123!",
        displayName: "Pending directory",
      },
      `${EMAIL_PREFIX}-pending`,
    );
    const verified = await insertAuthUser(
      {
        email: `${EMAIL_PREFIX}-verified@directory-filter.test`,
        password: "Password123!",
        displayName: "Verified directory",
        role: "admin",
      },
      `${EMAIL_PREFIX}-verified`,
    );
    const other = await insertAuthUser(
      {
        email: `${EMAIL_PREFIX}-other@directory-filter.test`,
        password: "Password123!",
        displayName: "Other pending directory",
      },
      `${EMAIL_PREFIX}-other`,
    );
    userIds.push(pending.userId, verified.userId, other.userId);
    await markAuthUserEmailVerified(verified.userId);
  });

  after(async () => {
    await deleteAuthUsersByEmailPrefix(`${EMAIL_PREFIX}-`);
    await disconnectMongoClient();
  });

  it("returns only the requested verification status and preserves page bounds", async () => {
    const verified = await listAuthUsersForAdmin({
      search: EMAIL_PREFIX,
      emailVerificationStatus: "verified",
      sort: "email",
      order: "asc",
      limit: 25,
      offset: 0,
    });
    assert.equal(verified.total, 1);
    assert.equal(verified.items[0]?.emailVerificationStatus, "verified");
    assert.equal("passwordHash" in verified.items[0]!, true);

    const pendingPage = await listAuthUsersForAdmin({
      search: EMAIL_PREFIX,
      emailVerificationStatus: "pending",
      sort: "email",
      order: "asc",
      limit: 1,
      offset: 0,
    });
    const pendingNext = await listAuthUsersForAdmin({
      search: EMAIL_PREFIX,
      emailVerificationStatus: "pending",
      sort: "email",
      order: "asc",
      limit: 1,
      offset: 1,
    });

    assert.equal(pendingPage.total, 2);
    assert.equal(pendingNext.total, 2);
    assert.equal(pendingPage.items.length, 1);
    assert.equal(pendingNext.items.length, 1);
    assert.notEqual(pendingPage.items[0]?.userId, pendingNext.items[0]?.userId);
    assert.equal(pendingPage.items[0]?.emailVerificationStatus, "pending");
    assert.equal(pendingNext.items[0]?.emailVerificationStatus, "pending");
  });

  it("rejects an invalid email verification filter before listing participants", async () => {
    const adminId = userIds[1];
    assert.ok(adminId);

    await assert.rejects(
      () =>
        listAdminParticipants({
          actorUserId: adminId,
          search: EMAIL_PREFIX,
          emailVerificationStatus: "confirmed",
          limit: 25,
          offset: 0,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AdminParticipantDirectoryValidationError);
        assert.match(error.message, /Invalid emailVerificationStatus filter/);
        return true;
      },
    );
  });

  it("projects emailVerificationStatus without password material", async () => {
    const adminId = userIds[1];
    assert.ok(adminId);
    const listed = await listVerifiedDirectoryOutsideMemberTestGate(adminId, EMAIL_PREFIX);

    assert.equal(listed.total, 1);
    assert.equal(listed.emailVerificationStatus, "verified");
    assert.equal(listed.limit, 25);
    assert.equal(listed.offset, 0);
    assert.equal(listed.containsPasswordHash, false);
    assert.equal(listed.containsReviewToken, false);
  });
});

/**
 * Member and membership reads refuse NODE_TEST_ENV, which the shared test
 * preload always sets. The directory service still has to be exercised against
 * the same isolated hu_test database, so this one call runs with that gate off.
 */
function listVerifiedDirectoryOutsideMemberTestGate(
  actorUserId: string,
  search: string,
): Promise<{
  total: number;
  limit: number;
  offset: number;
  emailVerificationStatus: string | null;
  containsPasswordHash: boolean;
  containsReviewToken: boolean;
}> {
  const config = resolveMongoConfig();
  if (!config.uri || !/^hu_test_[a-zA-Z0-9_]+$/.test(config.database)) {
    return Promise.reject(new Error("Directory projection test requires an owned hu_test_ database."));
  }

  const script = `
    const { listAdminParticipants } = await import("./src/modules/administration/admin-participant-directory.service.ts");
    const { disconnectMongoClient } = await import("./src/infrastructure/mongodb/mongo-connection.ts");
    const listed = await listAdminParticipants({
      actorUserId: process.env.HU_SEC03B_ACTOR_ID,
      search: process.env.HU_SEC03B_SEARCH,
      emailVerificationStatus: "verified",
      limit: 25,
      offset: 0,
    });
    const encoded = JSON.stringify(listed);
    process.stdout.write(JSON.stringify({
      total: listed.total,
      limit: listed.limit,
      offset: listed.offset,
      emailVerificationStatus: listed.participants[0]?.emailVerificationStatus ?? null,
      containsPasswordHash: encoded.includes("passwordHash"),
      containsReviewToken: encoded.includes("reviewToken"),
    }));
    await disconnectMongoClient();
    process.exit(0);
  `;

  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      {
        timeout: 20_000,
        cwd: API_ROOT,
        env: {
          ...process.env,
          NODE_ENV: "test",
          NODE_TEST_ENV: "false",
          EMAIL_PROVIDER: "mock",
          ALLOW_REAL_EMAIL_IN_TESTS: "false",
          MONGODB_URI: config.uri ?? "",
          MONGODB_DATABASE: config.database,
          HU_SEC03B_ACTOR_ID: actorUserId,
          HU_SEC03B_SEARCH: search,
        },
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `Directory projection process exited ${code}.`));
        return;
      }
      const payload = stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("{"))
        .at(-1);
      try {
        resolve(JSON.parse(payload ?? ""));
      } catch (error) {
        reject(new Error(`${error instanceof Error ? error.message : "Invalid projection output."}\n${stderr}\n${stdout}`));
      }
    });
  });
}
