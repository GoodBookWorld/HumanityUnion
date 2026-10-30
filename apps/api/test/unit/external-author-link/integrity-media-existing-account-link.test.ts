import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { describe, it, before, after, beforeEach, afterEach } from "node:test";

import cookieParser from "cookie-parser";
import express from "express";

import { setAuthUserLookupOverrideForTests } from "../../../src/modules/auth/auth-active-account-gate.js";
import { clearAuthRateLimitBucketsForTests } from "../../../src/modules/auth/auth-rate-limit.js";
import { createAccessToken } from "../../../src/modules/auth/auth-tokens.js";
import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import {
  clearAllAuthCodeSendLogsForTests,
  clearEmailConfirmationCodesForTests,
  getLastIssuedConfirmationCodeForTests,
  setConfirmationCodeNowMsForTests,
} from "../../../src/modules/email/email-confirmation-code.repository.js";
import { MockEmailProvider } from "../../../src/modules/email/providers/mock.provider.js";
import {
  DEFAULT_INTEGRITY_MEDIA_RETURN_PATH,
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV,
  INTEGRITY_MEDIA_SOURCE,
} from "../../../src/modules/external-author-link/external-author-link.constants.js";
import {
  buildIntegrityMediaLinkAcknowledgePayload,
  buildIntegrityMediaLinkRedeemPayload,
  signIntegrityMediaLinkRedeem,
} from "../../../src/modules/external-author-link/external-author-link.hmac.js";
import {
  createMemoryProvisionState,
  setProvisionMemoryForTests,
  type MemoryProvisionState,
} from "../../../src/modules/external-author-link/external-author-link.provision.database.js";
import {
  buildProvisionAttemptPayload,
  resetProvisionAttemptReplayCacheForTests,
} from "../../../src/modules/external-author-link/external-author-link.provision.hmac.js";
import externalAuthorLinkRouter from "../../../src/modules/external-author-link/external-author-link.routes.js";
import {
  setIntegrityMediaAuthorCapabilityEnsurerForTests,
  setIntegrityMediaDisplayNameResolverForTests,
  setIntegrityMediaStoredAccountRoleResolverForTests,
} from "../../../src/modules/external-author-link/external-author-link.service.js";
import {
  createMemoryExternalAuthorLinkStore,
  setExternalAuthorLinkStoreForTests,
  type ExternalAuthorLinkStore,
} from "../../../src/modules/external-author-link/external-author-link.store.js";
import type { ExternalAuthorLinkRecord } from "../../../src/modules/external-author-link/external-author-link.types.js";

const SECRET = "dummy-secret-not-real";
const AUTHOR = "11111111-1111-4111-8111-111111111111";
const OTHER_AUTHOR = "22222222-2222-4222-8222-222222222222";
const MEMBER = "33333333-3333-4333-8333-333333333333";
const OTHER_MEMBER = "44444444-4444-4444-8444-444444444444";
const EMAIL = "author@example.com";
const STATE = "existingAccountAttempt01";
const PURPOSE = "integrity_media_account_link" as const;
const RETURN_PATH = "/api/author/humanity-union-link/complete";

interface ApiBody {
  success: boolean;
  data: Record<string, unknown> | null;
  meta: { code?: string };
  message: string;
}

let server: Server;
let baseUrl = "";
let memory: MemoryProvisionState;
let linkStore: ExternalAuthorLinkStore;
let lookupUser: AuthUserRecord | null = null;
const savedEnv = new Map<string, string | undefined>();

describe("Integrity Media existing account linking", () => {
  before(async () => {
    for (const name of [
      "PLATFORM_MODE",
      INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
      INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV,
      "LOGIN_EMAIL_CODE_RESEND_COOLDOWN_SECONDS",
    ]) {
      savedEnv.set(name, process.env[name]);
    }
    setAuthUserLookupOverrideForTests(async () => lookupUser);
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use("/api/v1/integrity-media/link", externalAuthorLinkRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Test server did not bind.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    setAuthUserLookupOverrideForTests(null);
    setProvisionMemoryForTests(null);
    setExternalAuthorLinkStoreForTests(null);
    setIntegrityMediaAuthorCapabilityEnsurerForTests(null);
    setIntegrityMediaDisplayNameResolverForTests(null);
    setIntegrityMediaStoredAccountRoleResolverForTests(null);
    for (const [name, value] of savedEnv) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  beforeEach(async () => {
    process.env.PLATFORM_MODE = "staging";
    process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV] = SECRET;
    process.env[INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV] = "https://integrity.website";
    process.env.LOGIN_EMAIL_CODE_RESEND_COOLDOWN_SECONDS = "0";
    resetProvisionAttemptReplayCacheForTests();
    clearEmailConfirmationCodesForTests();
    await clearAllAuthCodeSendLogsForTests();
    clearAuthRateLimitBucketsForTests();
    MockEmailProvider.sentMessages.length = 0;
    memory = createMemoryProvisionState();
    setProvisionMemoryForTests(memory);
    linkStore = createMemoryExternalAuthorLinkStore();
    setExternalAuthorLinkStoreForTests(linkStore);
    setIntegrityMediaAuthorCapabilityEnsurerForTests(async () => ({
      changed: true,
      capabilities: ["author"],
      publishWithoutManualReview: false,
    }));
    setIntegrityMediaStoredAccountRoleResolverForTests(null);
    lookupUser = null;
  });

  afterEach(() => {
    setConfirmationCodeNowMsForTests(null);
  });

  it("links an existing Participant after the emailed code and returns to Integrity Media", async () => {
    await memory.view().insertUser(account(EMAIL, MEMBER));
    assert.equal((await register()).status, 200);

    const collided = await post("/provision-confirm", { state: STATE });
    assert.equal(collided.status, 409);
    assert.equal(collided.body.meta.code, "existing_email_collision");

    const sent = await post("/existing-account/send-code", { state: STATE, email: " Author@Example.com " });
    assert.equal(sent.status, 200);
    assert.equal(sent.body.data?.accepted, true);
    assert.equal(JSON.stringify(sent.body).includes(MEMBER), false);
    assert.equal(MockEmailProvider.sentMessages.length, 1);
    assert.equal(MockEmailProvider.sentMessages[0]?.to, EMAIL);
    assert.equal(MockEmailProvider.sentMessages[0]?.template, "integrity_media_account_link_code");

    const verified = await post("/existing-account/verify", {
      state: STATE,
      code: codeFor(MEMBER),
      authorize: true,
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.data?.provisionOutcome, "CONFIRMED_MAPPING_EXISTS");

    const url = new URL(String(verified.body.data?.redirectUrl));
    assert.equal(url.origin, "https://integrity.website");
    assert.equal(url.pathname, DEFAULT_INTEGRITY_MEDIA_RETURN_PATH);
    assert.equal(url.searchParams.get("state"), STATE);
    assert.equal(url.searchParams.get("status"), "confirmed");

    assert.equal(memory.users().length, 1);
    assert.equal(memory.participants().length, 0);
    assert.equal(memory.profiles().length, 0);
    assert.equal(memory.grants().length, 0);
    assert.equal(memory.links().length, 1);
    assert.equal(memory.links()[0]?.memberId, MEMBER);
    assert.equal(memory.links()[0]?.linkFinalization, "provisional");
    const attempt = memory.attempts()[0];
    assert.equal(attempt?.memberId, MEMBER);
    assert.equal(attempt?.createdMember, false);
    assert.ok(attempt?.existingAccountLink?.verifiedAt);

    await copyProvisionLinkAndResult();
    const redeemed = await redeem(String(url.searchParams.get("code")));
    assert.equal(redeemed.status, 200);
    assert.equal(redeemed.body.data?.memberId, MEMBER);
    const acknowledged = await acknowledge(redeemed.body);
    assert.equal(acknowledged.status, 200);
    assert.equal(acknowledged.body.data?.finalization, "confirmed");
    assert.equal((await linkStore.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR))?.memberId, MEMBER);
  });

  it("keeps the new-Participant provisioning path unchanged", async () => {
    assert.equal((await register()).status, 200);
    const confirmed = await post("/provision-confirm", { state: STATE });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.data?.provisionOutcome, "NEW_AUTHOR");
    assert.equal(memory.users().length, 1);
    assert.equal(memory.participants().length, 1);
    assert.equal(memory.links().length, 1);
    assert.equal(memory.attempts()[0]?.existingAccountLink, undefined);
    assert.equal(MockEmailProvider.sentMessages.some((message) => message.template === "integrity_media_account_link_code"), false);
  });

  it("never sends a code to an administrator, disabled, or already linked account", async () => {
    await memory.view().insertUser({ ...account(EMAIL, MEMBER), role: "admin" });
    assert.equal((await register()).status, 200);
    const admin = await post("/existing-account/send-code", { state: STATE, email: EMAIL });
    assert.equal(admin.status, 200);
    assert.equal(admin.body.data?.accepted, true);
    assert.equal(MockEmailProvider.sentMessages.length, 0);
    assert.equal(memory.attempts()[0]?.existingAccountLink, undefined);
    const refused = await post("/existing-account/verify", { state: STATE, code: "123456", authorize: true });
    assert.equal(refused.status, 409);
    assert.equal(refused.body.meta.code, "code_not_requested");
    assert.equal(memory.links().length, 0);

    memory = createMemoryProvisionState();
    setProvisionMemoryForTests(memory);
    resetProvisionAttemptReplayCacheForTests();
    await memory.view().insertUser({ ...account(EMAIL, MEMBER), status: "disabled" });
    assert.equal((await register()).status, 200);
    assert.equal((await post("/existing-account/send-code", { state: STATE, email: EMAIL })).status, 200);
    assert.equal(MockEmailProvider.sentMessages.length, 0);

    memory = createMemoryProvisionState();
    setProvisionMemoryForTests(memory);
    resetProvisionAttemptReplayCacheForTests();
    await memory.view().insertUser(account(EMAIL, MEMBER));
    await memory.view().insertLink(provisionalLink(OTHER_AUTHOR, MEMBER));
    assert.equal((await register()).status, 200);
    assert.equal((await post("/existing-account/send-code", { state: STATE, email: EMAIL })).status, 200);
    assert.equal(MockEmailProvider.sentMessages.length, 0);
  });

  it("ignores an active administrator session on the code endpoints", async () => {
    await memory.view().insertUser(account(EMAIL, MEMBER));
    assert.equal((await register()).status, 200);
    const adminToken = tokenFor(OTHER_MEMBER, "admin");
    const sent = await post("/existing-account/send-code", { state: STATE, email: EMAIL }, adminToken);
    assert.equal(sent.status, 200);
    const verified = await post(
      "/existing-account/verify",
      { state: STATE, code: codeFor(MEMBER), authorize: true },
      adminToken,
    );
    assert.equal(verified.status, 200);
    assert.equal(memory.links()[0]?.memberId, MEMBER);
    assert.equal(memory.links().some((link) => link.memberId === OTHER_MEMBER), false);
  });

  it("refuses an incorrect code, locks after the attempt limit, and refuses an expired code", async () => {
    await memory.view().insertUser(account(EMAIL, MEMBER));
    assert.equal((await register()).status, 200);
    assert.equal((await post("/existing-account/send-code", { state: STATE, email: EMAIL })).status, 200);
    const valid = codeFor(MEMBER);
    const wrong = valid === "000000" ? "111111" : "000000";

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const response = await post("/existing-account/verify", { state: STATE, code: wrong, authorize: true });
      assert.equal(response.status, 400);
      assert.equal(response.body.meta.code, "invalid_code");
    }
    const locked = await post("/existing-account/verify", { state: STATE, code: wrong, authorize: true });
    assert.equal(locked.status, 429);
    assert.equal(locked.body.meta.code, "code_locked");
    const afterLock = await post("/existing-account/verify", { state: STATE, code: valid, authorize: true });
    assert.equal(afterLock.status, 410);
    assert.equal(afterLock.body.meta.code, "code_expired");
    assert.equal(memory.links().length, 0);

    assert.equal((await post("/existing-account/send-code", { state: STATE, email: EMAIL })).status, 200);
    const fresh = codeFor(MEMBER);
    setConfirmationCodeNowMsForTests(Date.now() + 11 * 60_000);
    const expired = await post("/existing-account/verify", { state: STATE, code: fresh, authorize: true });
    assert.equal(expired.status, 410);
    assert.equal(expired.body.meta.code, "code_expired");
    assert.equal(memory.links().length, 0);
    assert.equal(memory.attempts()[0]?.memberId, null);
  });

  it("requires explicit authorization before consuming the code", async () => {
    await memory.view().insertUser(account(EMAIL, MEMBER));
    assert.equal((await register()).status, 200);
    assert.equal((await post("/existing-account/send-code", { state: STATE, email: EMAIL })).status, 200);
    const code = codeFor(MEMBER);

    for (const authorize of [undefined, false, "true"]) {
      const response = await post("/existing-account/verify", { state: STATE, code, authorize });
      assert.equal(response.status, 400);
      assert.equal(response.body.meta.code, "authorization_required");
    }
    assert.equal(memory.links().length, 0);
    const verified = await post("/existing-account/verify", { state: STATE, code, authorize: true });
    assert.equal(verified.status, 200);
  });

  it("binds the code to its attempt and never lets a spent code authorize another attempt", async () => {
    await memory.view().insertUser(account(EMAIL, MEMBER));
    const first = "existingAccountAttemptA1";
    const second = "existingAccountAttemptB2";
    assert.equal((await register(first)).status, 200);
    assert.equal((await register(second)).status, 200);

    assert.equal((await post("/existing-account/send-code", { state: first, email: EMAIL })).status, 200);
    const firstCode = codeFor(MEMBER);
    assert.equal((await post("/existing-account/send-code", { state: second, email: EMAIL })).status, 200);
    const secondCode = codeFor(MEMBER);

    const revoked = await post("/existing-account/verify", { state: first, code: firstCode, authorize: true });
    assert.equal(revoked.status, 410);
    const crossed = await post("/existing-account/verify", { state: first, code: secondCode, authorize: true });
    assert.equal(crossed.status, 409);
    assert.equal(crossed.body.meta.code, "code_not_for_attempt");
    const spent = await post("/existing-account/verify", { state: second, code: secondCode, authorize: true });
    assert.equal(spent.status, 410);
    assert.equal(spent.body.meta.code, "code_expired");
    assert.equal(memory.links().length, 0);
    assert.equal(memory.attempts().every((attempt) => attempt.memberId === null), true);
  });

  it("creates one link when the same code is verified concurrently", async () => {
    await memory.view().insertUser(account(EMAIL, MEMBER));
    assert.equal((await register()).status, 200);
    assert.equal((await post("/existing-account/send-code", { state: STATE, email: EMAIL })).status, 200);
    const code = codeFor(MEMBER);

    const responses = await Promise.all(
      Array.from({ length: 4 }, () => post("/existing-account/verify", { state: STATE, code, authorize: true })),
    );
    const succeeded = responses.filter((response) => response.status === 200);
    assert.ok(succeeded.length >= 1);
    for (const response of responses) {
      assert.ok([200, 410].includes(response.status), `unexpected status ${response.status}`);
    }
    const codes = new Set(
      succeeded.map((response) => new URL(String(response.body.data?.redirectUrl)).searchParams.get("code")),
    );
    assert.equal(codes.size, 1);
    assert.equal(memory.links().length, 1);
    assert.equal(memory.users().length, 1);
    assert.equal(memory.participants().length, 0);
  });

  it("finishes a verified attempt after a temporary failure without reusing the code", async () => {
    await memory.view().insertUser(account(EMAIL, MEMBER));
    assert.equal((await register()).status, 200);
    assert.equal((await post("/existing-account/send-code", { state: STATE, email: EMAIL })).status, 200);
    const code = codeFor(MEMBER);

    memory.failNextLinkInsert = true;
    const failed = await post("/existing-account/verify", { state: STATE, code, authorize: true });
    assert.equal(failed.status, 503);
    assert.equal(memory.links().length, 0);
    assert.equal(memory.attempts()[0]?.memberId, null);
    assert.ok(memory.attempts()[0]?.existingAccountLink?.verifiedAt);

    const resumed = await post("/existing-account/verify", { state: STATE, code: "000000", authorize: true });
    assert.equal(resumed.status, 200);
    assert.equal(memory.links().length, 1);
    assert.equal(memory.links()[0]?.memberId, MEMBER);
  });

  it("rejects an author with a deletion tombstone", async () => {
    await memory.view().insertUser(account(EMAIL, MEMBER));
    assert.equal((await register()).status, 200);
    await linkStore.insertLink(confirmedLink(AUTHOR, OTHER_MEMBER));
    const command = {
      operationId: randomUUID(),
      externalAuthorId: AUTHOR,
      huTarget: "staging",
      expectedMemberId: OTHER_MEMBER,
      expectedLinkRevision: 4,
      expectedLinkInstanceId: "55555555-5555-4555-8555-555555555555",
      nowIso: new Date().toISOString(),
    };
    assert.equal((await linkStore.applyAuthorDeletion(command)).status, "pending");
    assert.ok(await linkStore.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR));

    const refused = await post("/existing-account/send-code", { state: STATE, email: EMAIL });
    assert.equal(refused.status, 409);
    assert.equal(refused.body.meta.code, "author_deletion_pending");
    assert.equal(MockEmailProvider.sentMessages.length, 0);
    assert.equal(memory.links().length, 0);

    assert.equal((await linkStore.completeAuthorDeletion(command)).status, "completed");
    const removed = await post("/existing-account/send-code", { state: STATE, email: EMAIL });
    assert.equal(removed.status, 404);
    resetProvisionAttemptReplayCacheForTests();
    const reused = await register("existingAccountAttemptC3");
    assert.equal(reused.status, 409);
  });

  it("refuses an email that differs from the Integrity Media email", async () => {
    await memory.view().insertUser(account(EMAIL, MEMBER));
    await memory.view().insertUser(account("someone-else@example.com", OTHER_MEMBER));
    assert.equal((await register()).status, 200);
    const mismatch = await post("/existing-account/send-code", { state: STATE, email: "someone-else@example.com" });
    assert.equal(mismatch.status, 409);
    assert.equal(mismatch.body.meta.code, "email_mismatch");
    assert.equal(MockEmailProvider.sentMessages.length, 0);
    assert.equal(memory.attempts()[0]?.existingAccountLink, undefined);
  });

  it("refuses an author that is already linked to another account", async () => {
    await memory.view().insertUser(account(EMAIL, MEMBER));
    await memory.view().insertLink(provisionalLink(AUTHOR, OTHER_MEMBER));
    assert.equal((await register()).status, 200);
    const refused = await post("/existing-account/send-code", { state: STATE, email: EMAIL });
    assert.equal(refused.status, 409);
    assert.equal(refused.body.meta.code, "author_already_linked");
    assert.equal(MockEmailProvider.sentMessages.length, 0);
  });

  it("refuses a Binding Recovery state and unexpected fields", async () => {
    const recoveryState = `hur1s${"1".repeat(20)}${"a".repeat(32)}${"b".repeat(22)}recovery-id-0001${"c".repeat(64)}`;
    const recovery = await post("/existing-account/send-code", { state: recoveryState, email: EMAIL });
    assert.equal(recovery.status, 404);
    const unexpected = await post("/existing-account/send-code", { state: STATE, email: EMAIL, memberId: MEMBER });
    assert.equal(unexpected.status, 400);
    assert.equal(unexpected.body.meta.code, "unexpected_field");
  });

  it("refuses an administrator session on the signed-in Confirm path", async () => {
    setIntegrityMediaDisplayNameResolverForTests(async () => "Participant");
    lookupUser = { ...account("admin@example.com", OTHER_MEMBER), role: "admin" };
    const adminSession = await post("/confirm", { state: STATE }, tokenFor(OTHER_MEMBER, "admin"));
    assert.equal(adminSession.status, 403);
    assert.equal(adminSession.body.meta.code, "administrator_session");

    lookupUser = account("member@example.com", MEMBER);
    setIntegrityMediaStoredAccountRoleResolverForTests(async () => "admin");
    const storedAdmin = await post("/confirm", { state: STATE }, tokenFor(MEMBER, "member"));
    assert.equal(storedAdmin.status, 403);
    assert.equal(storedAdmin.body.meta.code, "administrator_session");
    assert.equal((await linkStore.listLinks()).length, 0);

    setIntegrityMediaStoredAccountRoleResolverForTests(async () => "member");
    const participant = await post("/confirm", { state: STATE }, tokenFor(MEMBER, "member"));
    assert.equal(participant.status, 200);
    assert.equal(participant.body.data?.confirmed, true);
  });
});

function account(email: string, memberId: string): AuthUserRecord {
  const now = new Date().toISOString();
  return {
    userId: `user-${memberId}`,
    email,
    passwordHash: "existing-hash",
    displayName: "Existing Person",
    role: "member",
    status: "active",
    memberId,
    emailVerificationStatus: "verified",
    createdAt: now,
    updatedAt: now,
  };
}

function codeFor(memberId: string): string {
  const code = getLastIssuedConfirmationCodeForTests(`user-${memberId}`, PURPOSE);
  assert.ok(code, "a code should have been issued");
  return code;
}

function tokenFor(memberId: string, role: "admin" | "member"): string {
  return createAccessToken({
    sub: `user-${memberId}`,
    memberId,
    role,
    displayName: "Session Person",
    email: `${role}@example.com`,
  });
}

function provisionalLink(authorId: string, memberId: string): ExternalAuthorLinkRecord {
  const now = new Date().toISOString();
  return {
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: authorId,
    memberId,
    state: "linked",
    createdAt: now,
    updatedAt: now,
    confirmedAt: now,
    disconnectedAt: null,
    collaborationStatus: "active",
    linkRevision: 1,
    linkFinalization: "provisional",
    linkInstanceId: randomUUID(),
  };
}

function confirmedLink(authorId: string, memberId: string): ExternalAuthorLinkRecord {
  return {
    ...provisionalLink(authorId, memberId),
    linkRevision: 4,
    linkFinalization: "confirmed",
    linkInstanceId: "55555555-5555-4555-8555-555555555555",
  };
}

async function register(attemptId = STATE): Promise<{ status: number; body: ApiBody }> {
  const body = {
    attemptId,
    externalAuthorId: AUTHOR,
    email: EMAIL,
    displayName: "Example Author",
    target: "staging",
    expiresAt: Math.floor(Date.now() / 1000) + 600,
    returnPath: RETURN_PATH,
    emailVerification: "pending",
  };
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signIntegrityMediaLinkRedeem(
    SECRET,
    buildProvisionAttemptPayload({
      timestamp,
      attemptId: body.attemptId,
      externalAuthorId: body.externalAuthorId,
      email: body.email,
      displayName: body.displayName,
      target: body.target,
      expiresAt: String(body.expiresAt),
      returnPath: body.returnPath,
      emailVerification: body.emailVerification,
    }),
  );
  return post("/provision-attempt", body, undefined, {
    "x-hu-integrity-media-timestamp": timestamp,
    "x-hu-integrity-media-signature": signature,
  });
}

async function copyProvisionLinkAndResult(): Promise<void> {
  const link = memory.links()[0];
  const result = memory.results()[0];
  assert.ok(link);
  assert.ok(result);
  assert.equal(await linkStore.insertLink(link), "inserted");
  await linkStore.insertResult(result);
}

async function redeem(code: string): Promise<{ status: number; body: ApiBody }> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signIntegrityMediaLinkRedeem(
    SECRET,
    buildIntegrityMediaLinkRedeemPayload({ timestamp, resultCode: code, externalAuthorId: AUTHOR }),
  );
  return post("/redeem", { resultCode: code, externalAuthorId: AUTHOR }, undefined, {
    "x-hu-integrity-media-timestamp": timestamp,
    "x-hu-integrity-media-signature": signature,
  });
}

async function acknowledge(body: ApiBody): Promise<{ status: number; body: ApiBody }> {
  const data = body.data ?? {};
  const eventId = randomUUID();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const memberId = String(data.memberId);
  const linkRevision = Number(data.linkRevision);
  const linkInstanceId = String(data.linkInstanceId);
  const signature = signIntegrityMediaLinkRedeem(
    SECRET,
    buildIntegrityMediaLinkAcknowledgePayload({
      timestamp,
      eventId,
      externalAuthorId: AUTHOR,
      memberId,
      linkRevision,
      linkInstanceId,
    }),
  );
  return post(
    "/acknowledge",
    { eventId, externalAuthorId: AUTHOR, memberId, linkRevision, linkInstanceId },
    undefined,
    {
      "x-hu-integrity-media-timestamp": timestamp,
      "x-hu-integrity-media-signature": signature,
    },
  );
}

async function post(
  path: string,
  body: unknown,
  accessToken?: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: ApiBody }> {
  const response = await fetch(`${baseUrl}/api/v1/integrity-media/link${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as ApiBody };
}
