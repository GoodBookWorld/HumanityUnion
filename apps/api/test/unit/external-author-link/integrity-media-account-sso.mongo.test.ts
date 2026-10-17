import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import {
  assertExplicitIsolatedMongoTestTarget,
  lockExplicitIsolatedMongoTestConfig,
} from "../../../src/infrastructure/mongodb/explicit-isolated-mongo-test.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { connectMongoClient, disconnectMongoClient, getMongoClient } from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection, getMongoDatabase } from "../../../src/infrastructure/mongodb/mongo-database.js";
import { setAuthSessionWriterForTests } from "../../../src/modules/auth/auth-session.repository.js";
import { setFindAuthUserByIdForTests } from "../../../src/modules/auth/auth-user.repository.js";
import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import { MockEmailProvider } from "../../../src/modules/email/providers/mock.provider.js";
import {
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_SOURCE,
} from "../../../src/modules/external-author-link/external-author-link.constants.js";
import { signIntegrityMediaLinkRedeem } from "../../../src/modules/external-author-link/external-author-link.hmac.js";
import {
  EXTERNAL_AUTHOR_LINK_INDEXES,
  EXTERNAL_AUTHOR_SSO_GRANT_INDEXES,
} from "../../../src/modules/external-author-link/external-author-link.indexes.js";
import { buildSsoGrantPayload } from "../../../src/modules/external-author-link/external-author-link.sso.hmac.js";
import { setSsoMemoryForTests } from "../../../src/modules/external-author-link/external-author-link.sso.database.js";
import {
  completeSsoGrant,
  registerSsoGrant,
  SsoRequestError,
} from "../../../src/modules/external-author-link/external-author-link.sso.service.js";
import { setExternalAuthorLinkStoreForTests } from "../../../src/modules/external-author-link/external-author-link.store.js";
import type { MemberMongoDocument } from "../../../src/modules/member/infrastructure/member.persistence.js";

const URI_ENV = "HU_SSO_TEST_MONGODB_URI";
const DATABASE_ENV = "HU_SSO_TEST_DATABASE";
const TEST_SECRET = "hu-sso-isolated-test-secret";
const RUN = randomBytes(4).toString("hex");

const configured = Boolean(process.env[URI_ENV]?.trim() && process.env[DATABASE_ENV]?.trim());

describe("real MongoDB SSO transactions", () => {
  if (!configured) {
    it("NOT_RUN_NO_TEST_DATABASE", () => {
      assert.equal(Boolean(process.env[URI_ENV]?.trim() && process.env[DATABASE_ENV]?.trim()), false);
      assert.throws(() => getMongoClient(), /not connected/);
    });
    return;
  }

  const uri = process.env[URI_ENV]?.trim() ?? "";
  const database = process.env[DATABASE_ENV]?.trim() ?? "";
  const memberId = `sso-member-${RUN}`;
  const userId = `sso-user-${RUN}`;
  const otherMemberId = `sso-member-${RUN}-b`;
  const authorId = randomUUID();
  const otherAuthorId = randomUUID();
  const uniqueName = `ssotest${RUN}`;
  let validatorApplied = false;
  let envCaptured = false;
  let previousSecret: string | undefined;
  let previousMode: string | undefined;
  let previousOrigin: string | undefined;

  before(async () => {
    assertExplicitIsolatedMongoTestTarget({ uri, database });
    setSsoMemoryForTests(null);
    setFindAuthUserByIdForTests(null);
    setAuthSessionWriterForTests(null);
    setExternalAuthorLinkStoreForTests(null);
    previousSecret = process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV];
    previousMode = process.env.PLATFORM_MODE;
    previousOrigin = process.env.WEB_ORIGIN;
    envCaptured = true;
    process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV] = TEST_SECRET;
    process.env.PLATFORM_MODE = "staging";
    process.env.WEB_ORIGIN = "https://staging.huws.org";
    MockEmailProvider.clearForTests();

    lockExplicitIsolatedMongoTestConfig({ uri, database });
    await connectMongoClient();
    await ensureIsolatedIndexes();
    await seedSyntheticIdentity();
  });

  after(async () => {
    if (validatorApplied) {
      await disableSessionInsertFailure();
    }
    if (mongoIsConnected()) {
      await deleteSyntheticRecords();
    }
    await disconnectMongoClient();
    if (envCaptured) {
      restoreEnv(INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV, previousSecret);
      restoreEnv("PLATFORM_MODE", previousMode);
      restoreEnv("WEB_ORIGIN", previousOrigin);
    }
    setSsoMemoryForTests(null);
    setFindAuthUserByIdForTests(null);
    setAuthSessionWriterForTests(null);
    setExternalAuthorLinkStoreForTests(null);
  });

  it("lets one of two concurrent completions create the only session", async () => {
    const requestId = `sso-consume-${RUN}-ab`;
    const grant = await registerGrant(requestId, authorId, memberId, 4, "staging");
    await deleteSessions();

    const outcomes = await Promise.allSettled([complete(grant), complete(grant)]);
    const succeeded = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const failed = outcomes.filter((outcome) => outcome.status === "rejected");
    if (succeeded.length !== 1 || failed.length !== 1) {
      throw new Error("Expected one successful completion and one refusal.");
    }
    assertSessionCompletion(succeeded[0].status === "fulfilled" ? succeeded[0].value : null);
    const failure = failed[0].status === "rejected" ? failed[0].reason : null;
    if (!(failure instanceof SsoRequestError) || failure.code !== "grant_consumed") {
      throw new Error("The losing completion was not refused as an already used grant.");
    }
    if ((await countSessions()) !== 1) {
      throw new Error("Concurrent completion created more or fewer than one session.");
    }
    if ((await countOpenGrants(requestId)) !== 0 || (await countGrants(requestId)) !== 1) {
      throw new Error("Concurrent completion did not leave exactly one consumed grant.");
    }
  });

  it("rolls back grant consumption when session insertion fails, then retries once", async () => {
    const requestId = `sso-rollback-${RUN}-cd`;
    const grant = await registerGrant(requestId, authorId, memberId, 4, "staging");
    await deleteSessions();
    await enableSessionInsertFailure();

    try {
      await complete(grant);
      throw new Error("Session insert failure did not abort completion.");
    } catch (error) {
      if (error instanceof Error && error.message === "Session insert failure did not abort completion.") {
        throw error;
      }
      if (mongoErrorCode(error) !== 121) {
        throw new Error("Session insert failure did not abort the transaction.");
      }
    }

    if ((await countOpenGrants(requestId)) !== 1) {
      throw new Error("Grant consumption was not rolled back.");
    }
    if ((await countSessions()) !== 0) {
      throw new Error("A failed session insert left a session behind.");
    }

    await disableSessionInsertFailure();
    assertSessionCompletion(await complete(grant));
    if ((await countSessions()) !== 1 || (await countOpenGrants(requestId)) !== 0) {
      throw new Error("The retry did not consume the grant into one session.");
    }

    await assert.rejects(() => complete(grant), (error: unknown) => {
      return error instanceof SsoRequestError && error.code === "grant_consumed";
    });
    if ((await countSessions()) !== 1 || (await countGrants(requestId)) !== 1) {
      throw new Error("A second retry created another session or grant.");
    }
  });

  it("keeps one durable grant when the same request is registered concurrently", async () => {
    const requestId = `sso-register-${RUN}-e1`;
    const [first, second] = await Promise.all([
      registerGrant(requestId, authorId, memberId, 4, "staging"),
      registerGrant(requestId, authorId, memberId, 4, "staging"),
    ]);
    if (first !== second) {
      throw new Error("Concurrent registration did not return the same grant.");
    }
    if ((await countGrants(requestId)) !== 1 || (await countOpenGrants(requestId)) !== 1) {
      throw new Error("Concurrent registration did not keep one open grant.");
    }
  });

  it("rejects a changed author, member, revision, or target for the same request", async () => {
    const requestId = `sso-conflict-${RUN}-f1`;
    await registerGrant(requestId, authorId, memberId, 4, "staging");

    await assert.rejects(
      () => registerGrant(requestId, otherAuthorId, memberId, 4, "staging"),
      (error: unknown) => error instanceof SsoRequestError && error.code === "request_conflict",
    );
    await assert.rejects(
      () => registerGrant(requestId, authorId, otherMemberId, 4, "staging"),
      (error: unknown) => error instanceof SsoRequestError && error.code === "request_conflict",
    );
    await assert.rejects(
      () => registerGrant(requestId, authorId, memberId, 5, "staging"),
      (error: unknown) => error instanceof SsoRequestError && error.code === "request_conflict",
    );

    process.env.PLATFORM_MODE = "production";
    process.env.WEB_ORIGIN = "https://huws.org";
    try {
      await assert.rejects(
        () => registerGrant(requestId, authorId, memberId, 4, "production"),
        (error: unknown) => error instanceof SsoRequestError && error.code === "request_conflict",
      );
    } finally {
      process.env.PLATFORM_MODE = "staging";
      process.env.WEB_ORIGIN = "https://staging.huws.org";
    }

    if ((await countGrants(requestId)) !== 1) {
      throw new Error("A conflicting request created another grant.");
    }
    if (MockEmailProvider.sentMessages.length !== 0) {
      throw new Error("The isolated SSO test sent email.");
    }
  });

  async function seedSyntheticIdentity(): Promise<void> {
    const now = new Date().toISOString();
    const member: MemberMongoDocument = {
      memberId,
      identityId: userId,
      displayName: "SSO Test",
      uniqueName,
      languages: ["en"],
      status: "active",
      verificationLevel: "none",
      roles: ["member"],
      registrationStatus: "registered",
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    const user: AuthUserRecord = {
      userId,
      email: `sso-test-${RUN}@example.com`,
      passwordHash: "sso-test-not-a-password",
      displayName: "SSO Test",
      role: "member",
      status: "active",
      memberId,
      emailVerificationStatus: "verified",
      createdAt: now,
      updatedAt: now,
    };
    await getMongoCollection<MemberMongoDocument>(MONGO_COLLECTIONS.members).insertOne(member);
    await getMongoCollection<AuthUserRecord>(MONGO_COLLECTIONS.authUsers).insertOne(user);
    await getMongoCollection(MONGO_COLLECTIONS.externalAuthorLinks).insertOne({
      source: INTEGRITY_MEDIA_SOURCE,
      externalAuthorId: authorId,
      memberId,
      state: "linked",
      createdAt: now,
      updatedAt: now,
      confirmedAt: now,
      disconnectedAt: null,
      linkRevision: 4,
      linkFinalization: "confirmed",
      linkInstanceId: randomUUID(),
      authorActivationPending: false,
      collaborationStatus: "active",
    });
  }

  async function ensureIsolatedIndexes(): Promise<void> {
    await getMongoCollection(MONGO_COLLECTIONS.externalAuthorSsoGrants).createIndexes(
      EXTERNAL_AUTHOR_SSO_GRANT_INDEXES,
    );
    await getMongoCollection(MONGO_COLLECTIONS.externalAuthorLinks).createIndexes(
      EXTERNAL_AUTHOR_LINK_INDEXES,
    );
    await getMongoCollection(MONGO_COLLECTIONS.authSessions).createIndexes([
      { key: { sessionId: 1 }, unique: true, name: "auth_session_id_unique" },
    ]);
    await getMongoCollection(MONGO_COLLECTIONS.members).createIndexes([
      { key: { memberId: 1 }, unique: true, name: "members_member_id_unique" },
      { key: { identityId: 1 }, unique: true, name: "members_identity_id_unique" },
      { key: { uniqueName: 1 }, unique: true, name: "members_unique_name_unique" },
    ]);
    await getMongoCollection(MONGO_COLLECTIONS.authUsers).createIndexes([
      { key: { email: 1 }, unique: true, name: "auth_user_email_unique" },
    ]);
  }

  async function enableSessionInsertFailure(): Promise<void> {
    const db = getMongoDatabase();
    const name = MONGO_COLLECTIONS.authSessions;
    const existing = await db.listCollections({ name }).toArray();
    if (existing.length === 0) {
      await db.createCollection(name);
    }
    await db.command({
      collMod: name,
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["ssoIsolatedTestReject"],
        },
      },
      validationLevel: "strict",
      validationAction: "error",
    });
    validatorApplied = true;
  }

  async function disableSessionInsertFailure(): Promise<void> {
    await getMongoDatabase().command({
      collMod: MONGO_COLLECTIONS.authSessions,
      validator: {},
      validationLevel: "off",
    });
    validatorApplied = false;
  }

  async function deleteSyntheticRecords(): Promise<void> {
    await getMongoCollection(MONGO_COLLECTIONS.externalAuthorSsoGrants).deleteMany({
      externalAuthorId: { $in: [authorId, otherAuthorId] },
    });
    await getMongoCollection(MONGO_COLLECTIONS.externalAuthorLinks).deleteMany({
      externalAuthorId: { $in: [authorId, otherAuthorId] },
    });
    await getMongoCollection(MONGO_COLLECTIONS.members).deleteMany({
      memberId: { $in: [memberId, otherMemberId] },
    });
    await getMongoCollection(MONGO_COLLECTIONS.authUsers).deleteMany({ userId });
    await deleteSessions();
  }

  async function deleteSessions(): Promise<void> {
    await getMongoCollection(MONGO_COLLECTIONS.authSessions).deleteMany({ userId });
  }

  async function countSessions(): Promise<number> {
    return getMongoCollection(MONGO_COLLECTIONS.authSessions).countDocuments({ userId });
  }

  async function countGrants(requestId: string): Promise<number> {
    return getMongoCollection(MONGO_COLLECTIONS.externalAuthorSsoGrants).countDocuments({
      requestId,
    });
  }

  async function countOpenGrants(requestId: string): Promise<number> {
    return getMongoCollection(MONGO_COLLECTIONS.externalAuthorSsoGrants).countDocuments({
      requestId,
      consumedAt: null,
    });
  }

  async function registerGrant(
    requestId: string,
    externalAuthorId: string,
    signedMemberId: string,
    linkRevision: number,
    target: string,
  ): Promise<string> {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signIntegrityMediaLinkRedeem(
      TEST_SECRET,
      buildSsoGrantPayload({
        timestamp,
        requestId,
        externalAuthorId,
        memberId: signedMemberId,
        linkRevision: String(linkRevision),
        target,
      }),
    );
    const result = await registerSsoGrant({
      timestamp,
      signature,
      body: {
        timestamp: Number(timestamp),
        requestId,
        externalAuthorId,
        memberId: signedMemberId,
        linkRevision,
        target,
      },
    });
    return opaqueGrant(result.grantUrl, target === "production" ? "https://huws.org" : "https://staging.huws.org");
  }

  async function complete(grant: string) {
    return completeSsoGrant({ body: { grant } });
  }
});

function opaqueGrant(grantUrl: string, origin: string): string {
  let url: URL;
  try {
    url = new URL(grantUrl);
  } catch {
    throw new Error("Grant URL was not usable.");
  }
  if (url.origin !== origin || url.pathname !== "/connect/integrity-media/sso") {
    throw new Error("Grant URL did not use the environment web origin.");
  }
  const grant = url.searchParams.get("grant");
  if (!grant || !/^[A-Za-z0-9_-]{43}$/.test(grant) || [...url.searchParams.keys()].some((key) => key !== "grant")) {
    throw new Error("Grant URL did not contain one opaque grant.");
  }
  return grant;
}

function assertSessionCompletion(result: { kind?: string; destination?: string; tokens?: { accessToken?: string; refreshToken?: string } } | null): void {
  if (!result || result.kind !== "session" || result.destination !== "/workspace") {
    throw new Error("Completion did not issue one workspace session.");
  }
  if (!result.tokens?.accessToken || !result.tokens.refreshToken) {
    throw new Error("Completion did not issue session credentials.");
  }
}

function mongoErrorCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  if ("code" in error && typeof error.code === "number") {
    return error.code;
  }
  if ("cause" in error) {
    return mongoErrorCode(error.cause);
  }
  return undefined;
}

function mongoIsConnected(): boolean {
  try {
    getMongoClient();
    return true;
  } catch {
    return false;
  }
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
