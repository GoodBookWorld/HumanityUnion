/**
 * Existing-account linking against real MongoDB transactions.
 *
 * Starts a process-owned single-node MongoMemoryReplSet on 127.0.0.1 and
 * locks this test process to one hu_test_ database. Never reads MONGODB_URI.
 */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import { MongoMemoryReplSet } from "mongodb-memory-server-core";

import {
  isProtectedDatabaseName,
  TEST_DATABASE_NAME_PATTERN,
} from "../../../src/infrastructure/mongodb/ephemeral-mongo-database-safety.js";
import {
  assertExplicitIsolatedMongoTestTarget,
  lockExplicitIsolatedMongoTestConfig,
} from "../../../src/infrastructure/mongodb/explicit-isolated-mongo-test.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getLockedMongoConfigForTests } from "../../../src/infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection, getMongoDatabase } from "../../../src/infrastructure/mongodb/mongo-database.js";
import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import { getLastIssuedConfirmationCodeForTests } from "../../../src/modules/email/email-confirmation-code.repository.js";
import {
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV,
} from "../../../src/modules/external-author-link/external-author-link.constants.js";
import {
  EXTERNAL_AUTHOR_LINK_INDEXES,
  EXTERNAL_AUTHOR_LINK_RESULT_INDEXES,
  EXTERNAL_AUTHOR_PROVISION_ATTEMPT_INDEXES,
} from "../../../src/modules/external-author-link/external-author-link.indexes.js";
import {
  setProvisionMemoryForTests,
  type ExistingAccountLinkBinding,
  type ProvisionAttemptRecord,
} from "../../../src/modules/external-author-link/external-author-link.provision.database.js";
import {
  ProvisionRequestError,
  sendExistingAccountLinkCode,
  verifyExistingAccountLink,
} from "../../../src/modules/external-author-link/external-author-link.provision.service.js";
import {
  createMongoExternalAuthorLinkStore,
  setExternalAuthorLinkStoreForTests,
} from "../../../src/modules/external-author-link/external-author-link.store.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_im_otp_${RUN}`;
const EMAIL = `author-${RUN}@example.com`;
const MEMBER = randomUUID();
const USER = `user-${MEMBER}`;
const ENV_KEYS = [
  "NODE_TEST_ENV",
  "PLATFORM_MODE",
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV,
  "LOGIN_EMAIL_CODE_RESEND_COOLDOWN_SECONDS",
];

const lockedBeforeThisSuite = getLockedMongoConfigForTests();

let replSet: MongoMemoryReplSet | null = null;
let connected = false;
const savedEnv = new Map<string, string | undefined>();

describe("real MongoDB existing-account linking", () => {
  if (lockedBeforeThisSuite) {
    it("NOT_RUN_EXTERNAL_MONGO_CONFIGURED", () => {
      assert.notEqual(lockedBeforeThisSuite, null);
    });
    return;
  }

  before(async () => {
    for (const key of ENV_KEYS) {
      savedEnv.set(key, process.env[key]);
    }
    process.env.NODE_TEST_ENV = "true";
    assert.match(DATABASE, TEST_DATABASE_NAME_PATTERN);
    assert.equal(isProtectedDatabaseName(DATABASE), false);

    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
    const uri = replSet.getUri(DATABASE);
    assert.equal(new URL(uri.replace(/^mongodb:/, "http:")).hostname, "127.0.0.1");
    assertExplicitIsolatedMongoTestTarget({ uri, database: DATABASE });
    lockExplicitIsolatedMongoTestConfig({ uri, database: DATABASE });

    process.env.PLATFORM_MODE = "staging";
    process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV] = `hu-existing-account-mongo-${RUN}`;
    process.env[INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV] = "https://integrity.website";
    process.env.LOGIN_EMAIL_CODE_RESEND_COOLDOWN_SECONDS = "0";

    await connectMongoClient();
    connected = true;
    assert.equal(getMongoDatabase().databaseName, DATABASE);
    await collection(MONGO_COLLECTIONS.externalAuthorLinks).createIndexes(EXTERNAL_AUTHOR_LINK_INDEXES);
    await collection(MONGO_COLLECTIONS.externalAuthorLinkResults).createIndexes(EXTERNAL_AUTHOR_LINK_RESULT_INDEXES);
    await collection(MONGO_COLLECTIONS.externalAuthorProvisionAttempts).createIndexes(
      EXTERNAL_AUTHOR_PROVISION_ATTEMPT_INDEXES,
    );

    setProvisionMemoryForTests(null);
    setExternalAuthorLinkStoreForTests(createMongoExternalAuthorLinkStore());
  });

  after(async () => {
    try {
      if (connected && getMongoDatabase().databaseName === DATABASE) {
        await getMongoDatabase().dropDatabase();
      }
    } finally {
      try {
        if (connected) {
          await disconnectMongoClient();
        }
      } finally {
        await replSet?.stop({ doCleanup: true });
        setExternalAuthorLinkStoreForTests(null);
        for (const [key, value] of savedEnv) {
          if (value === undefined) {
            delete process.env[key];
          } else {
            process.env[key] = value;
          }
        }
      }
    }
  });

  beforeEach(async () => {
    await Promise.all(
      [
        MONGO_COLLECTIONS.externalAuthorLinks,
        MONGO_COLLECTIONS.externalAuthorLinkResults,
        MONGO_COLLECTIONS.externalAuthorProvisionAttempts,
        MONGO_COLLECTIONS.authUsers,
        MONGO_COLLECTIONS.emailConfirmationCodes,
        MONGO_COLLECTIONS.emailConfirmationSendLog,
      ].map((name) => collection(name).deleteMany({})),
    );
    await collection(MONGO_COLLECTIONS.authUsers).insertOne(account());
  });

  it("creates exactly one link when the same code is verified concurrently", async () => {
    const authorId = randomUUID();
    const state = `mongoAttempt_${RUN}_single`;
    await insertAttempt(state, authorId);
    const sent = await sendExistingAccountLinkCode({ body: { state, email: EMAIL } });
    assert.equal(sent.accepted, true);
    const code = getLastIssuedConfirmationCodeForTests(USER, "integrity_media_account_link");
    assert.ok(code);

    const settled = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        verifyExistingAccountLink({ body: { state, code, authorize: true } }),
      ),
    );
    const fulfilled = settled.filter((entry) => entry.status === "fulfilled");
    assert.ok(fulfilled.length >= 1);
    for (const entry of settled) {
      if (entry.status === "rejected") {
        assert.ok(entry.reason instanceof ProvisionRequestError, String(entry.reason));
        assert.ok([409, 410].includes(entry.reason.status), `unexpected ${entry.reason.status}`);
      }
    }

    const links = await collection(MONGO_COLLECTIONS.externalAuthorLinks).find({}).toArray();
    assert.equal(links.length, 1);
    assert.equal(links[0]?.memberId, MEMBER);
    assert.equal(links[0]?.externalAuthorId, authorId);
    assert.equal(await collection(MONGO_COLLECTIONS.authUsers).countDocuments({}), 1);
    const attempt = await collection(MONGO_COLLECTIONS.externalAuthorProvisionAttempts).findOne({ attemptId: state });
    assert.equal(attempt?.memberId, MEMBER);
    assert.equal(attempt?.createdMember, false);
    const resultCodes = new Set(
      fulfilled.map((entry) =>
        entry.status === "fulfilled" ? new URL(String(entry.value.redirectUrl)).searchParams.get("code") : null,
      ),
    );
    assert.equal(resultCodes.size, 1);
  });

  it("links one author when two verified attempts claim the same Participant concurrently", async () => {
    const firstAuthor = randomUUID();
    const secondAuthor = randomUUID();
    const verifiedAt = new Date().toISOString();
    await insertAttempt(`mongoAttempt_${RUN}_left`, firstAuthor, verifiedBinding(verifiedAt));
    await insertAttempt(`mongoAttempt_${RUN}_right`, secondAuthor, verifiedBinding(verifiedAt));

    const settled = await Promise.allSettled([
      verifyExistingAccountLink({ body: { state: `mongoAttempt_${RUN}_left`, code: "000000", authorize: true } }),
      verifyExistingAccountLink({ body: { state: `mongoAttempt_${RUN}_right`, code: "000000", authorize: true } }),
    ]);
    assert.equal(settled.filter((entry) => entry.status === "fulfilled").length, 1);
    const rejected = settled.find((entry) => entry.status === "rejected");
    assert.ok(rejected && rejected.status === "rejected");
    assert.ok(rejected.reason instanceof ProvisionRequestError, String(rejected.reason));
    assert.equal(rejected.reason.status, 409);

    const links = await collection(MONGO_COLLECTIONS.externalAuthorLinks).find({ memberId: MEMBER }).toArray();
    assert.equal(links.length, 1);
    assert.ok([firstAuthor, secondAuthor].includes(String(links[0]?.externalAuthorId)));
  });
});

function collection(name: string) {
  return getMongoCollection<Record<string, unknown>>(name);
}

function account(): AuthUserRecord {
  const now = new Date().toISOString();
  return {
    userId: USER,
    email: EMAIL,
    passwordHash: "existing-hash",
    displayName: "Existing Person",
    role: "member",
    status: "active",
    memberId: MEMBER,
    emailVerificationStatus: "verified",
    createdAt: now,
    updatedAt: now,
  };
}

function verifiedBinding(verifiedAt: string): ExistingAccountLinkBinding {
  return {
    confirmationId: randomUUID(),
    userId: USER,
    memberId: MEMBER,
    sentAt: verifiedAt,
    sendCount: 1,
    verifiedAt,
  };
}

async function insertAttempt(
  attemptId: string,
  externalAuthorId: string,
  existingAccountLink?: ExistingAccountLinkBinding,
): Promise<void> {
  const now = new Date().toISOString();
  const record: ProvisionAttemptRecord = {
    attemptId,
    externalAuthorId,
    email: EMAIL,
    displayName: "Example Author",
    target: "staging",
    expiresAt: Math.floor(Date.now() / 1000) + 600,
    returnPath: "/api/author/humanity-union-link/complete",
    emailVerification: "pending",
    memberId: null,
    userId: null,
    createdMember: false,
    createdAt: now,
    updatedAt: now,
    ...(existingAccountLink ? { existingAccountLink } : {}),
  };
  await getMongoCollection<ProvisionAttemptRecord>(MONGO_COLLECTIONS.externalAuthorProvisionAttempts  ).insertOne(
    record,
  );
}
