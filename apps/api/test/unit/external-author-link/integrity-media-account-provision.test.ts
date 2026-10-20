import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { describe, it, before, after, beforeEach } from "node:test";

import cookieParser from "cookie-parser";
import express from "express";

import { buildIntegrityMediaReturnUrl } from "../../../src/modules/external-author-link/external-author-link.config.js";
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
import externalAuthorLinkRouter from "../../../src/modules/external-author-link/external-author-link.routes.js";
import { setIntegrityMediaAuthorCapabilityEnsurerForTests } from "../../../src/modules/external-author-link/external-author-link.service.js";
import {
  createMemoryProvisionState,
  setProvisionMemoryForTests,
  type MemoryProvisionState,
} from "../../../src/modules/external-author-link/external-author-link.provision.database.js";
import { buildProvisionAttemptPayload, resetProvisionAttemptReplayCacheForTests } from "../../../src/modules/external-author-link/external-author-link.provision.hmac.js";
import {
  createMemoryExternalAuthorLinkStore,
  setExternalAuthorLinkStoreForTests,
  type ExternalAuthorLinkStore,
} from "../../../src/modules/external-author-link/external-author-link.store.js";
import type { ExternalAuthorLinkRecord } from "../../../src/modules/external-author-link/external-author-link.types.js";
import { buildDefaultMemberProfile } from "../../../src/modules/member-profile/member-profile.repository.js";
const SECRET = "dummy-secret-not-real";
const DIGEST = "bcb5016507f8fd5c0c32bb502ae88cd8b11f1182542a56d2dad893493af3580b";
const AUTHOR = "11111111-1111-4111-8111-111111111111";
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
let previousMode: string | undefined;
let previousSecret: string | undefined;
let previousOrigin: string | undefined;

describe("Integrity Media account provision", () => {
  before(async () => {
    previousMode = process.env.PLATFORM_MODE;
    previousSecret = process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV];
    previousOrigin = process.env[INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV];
    process.env.PLATFORM_MODE = "staging";
    process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV] = SECRET;
    process.env[INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV] = "https://integrity.website";

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use("/api/v1/integrity-media/link", externalAuthorLinkRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Test server did not bind.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    setProvisionMemoryForTests(null);
    setExternalAuthorLinkStoreForTests(null);
    setIntegrityMediaAuthorCapabilityEnsurerForTests(null);
    restoreEnv(INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV, previousSecret);
    restoreEnv(INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV, previousOrigin);
    restoreEnv("PLATFORM_MODE", previousMode);
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    process.env.PLATFORM_MODE = "staging";
    resetProvisionAttemptReplayCacheForTests();
    memory = createMemoryProvisionState();
    setProvisionMemoryForTests(memory);
    linkStore = createMemoryExternalAuthorLinkStore();
    setExternalAuthorLinkStoreForTests(linkStore);
    setIntegrityMediaAuthorCapabilityEnsurerForTests(async () => ({
      changed: false,
      capabilities: ["author"],
      publishWithoutManualReview: true,
    }));
  });

  it("matches the approved ten-line dummy digest", () => {
    const payload = buildProvisionAttemptPayload({
      timestamp: "1700000000",
      attemptId: "exampleAttemptToken_12",
      externalAuthorId: AUTHOR,
      email: "author@example.com",
      displayName: "Example Author",
      target: "staging",
      expiresAt: "1700000600",
      returnPath: RETURN_PATH,
      emailVerification: "pending",
    });
    assert.equal(payload.split("\n").length, 10);
    assert.equal(Buffer.byteLength(payload), 214);
    assert.equal(payload.endsWith("\n"), false);
    assert.equal(signIntegrityMediaLinkRedeem(SECRET, payload), DIGEST);
  });

  it("rejects an invalid signature, a stale timestamp, and a cross-environment target", async () => {
    const invalid = await register(attemptBody(), { signature: "a".repeat(64) });
    assert.equal(invalid.status, 401);
    assert.equal(invalid.body.meta.code, "invalid_signature");
    assert.equal(memory.attempts().length, 0);

    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 301);
    const stale = await register(attemptBody(), { timestamp: staleTimestamp });
    assert.equal(stale.status, 401);
    assert.equal(stale.body.meta.code, "stale_timestamp");

    process.env.PLATFORM_MODE = "production";
    const crossed = await register(attemptBody());
    assert.equal(crossed.status, 403);
    assert.equal(crossed.body.meta.code, "target_mismatch");
    process.env.PLATFORM_MODE = "staging";

    const otherTarget = await register(attemptBody({ target: "production" }));
    assert.equal(otherTarget.status, 403);
    assert.equal(otherTarget.body.meta.code, "target_mismatch");
    assert.equal(memory.users().length, 0);
  });

  it("stores an attempt idempotently and rejects a conflicting retry", async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 600;
    const body = attemptBody({ expiresAt });
    const created = await register(body);
    assert.equal(created.status, 200);
    assert.equal(created.body.data?.idempotent, false);
    assert.equal(created.body.data?.mapping, "none");
    assert.equal(memory.users().length, 0);
    assert.equal(memory.participants().length, 0);

    const replay = await register(body, { signature: created.signature, timestamp: created.timestamp });
    assert.equal(replay.status, 401);
    assert.equal(replay.body.meta.code, "replayed");

    const same = await register(body, {
      timestamp: String(Number(created.timestamp) + 1),
    });
    assert.equal(same.status, 200);
    assert.equal(same.body.data?.idempotent, true);
    assert.equal(memory.attempts().length, 1);
    assert.equal(memory.attempts()[0]?.expiresAt, expiresAt);

    const conflict = await register(attemptBody({ expiresAt, email: "other@example.com" }));
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.meta.code, "attempt_conflict");
    assert.equal(memory.users().length, 0);
  });

  it("does not store an expired attempt", async () => {
    const expired = await register(
      attemptBody({ expiresAt: Math.floor(Date.now() / 1000) - 60 }),
    );
    assert.equal(expired.status, 409);
    assert.equal(expired.body.meta.code, "attempt_expired");
    assert.equal(memory.attempts().length, 0);
  });

  it("shows consent without a session and keeps the session ceremony closed", async () => {
    assert.equal((await register(attemptBody())).status, 200);
    const consent = await request(
      "GET",
      `/provision-consent?state=${encodeURIComponent("exampleAttemptToken_12")}`,
    );
    assert.equal(consent.status, 200);
    assert.equal(consent.body.data?.displayName, "Example Author");
    assert.equal(consent.body.data?.email, "author@example.com");
    assert.equal("memberId" in (consent.body.data ?? {}), false);

    const unknown = await request("GET", "/provision-consent?state=missing-attempt-state");
    assert.equal(unknown.status, 404);
    const preview = await request("GET", "/preview?state=missing-attempt-state");
    assert.equal(preview.status, 401);
    const sessionConfirm = await request("POST", "/confirm", { state: "missing-attempt-state" });
    assert.equal(sessionConfirm.status, 401);
    const sessionCancel = await request("POST", "/cancel", { state: "missing-attempt-state" });
    assert.equal(sessionCancel.status, 401);
  });

  it("creates one pending author, one provisional link, and the existing callback order", async () => {
    assert.equal((await register(attemptBody())).status, 200);
    const confirmed = await request("POST", "/provision-confirm", {
      state: "exampleAttemptToken_12",
    });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.data?.provisionOutcome, "NEW_AUTHOR");
    assert.equal(JSON.stringify(confirmed.body).includes("password"), false);

    assert.equal(memory.users().length, 1);
    assert.equal(memory.users()[0]?.emailVerificationStatus, "pending");
    assert.equal(memory.users()[0]?.role, "member");
    assert.equal(memory.participants().length, 1);
    assert.equal(memory.participants()[0]?.verificationLevel, "none");
    assert.equal(memory.links().length, 1);
    assert.equal(memory.links()[0]?.linkFinalization, "provisional");
    assert.equal(memory.grants().length, 1);
    assert.deepEqual(memory.grants()[0]?.capabilities, ["author"]);
    assert.equal(memory.grants()[0]?.publishWithoutManualReview, true);

    const redirectUrl = String(confirmed.body.data?.redirectUrl);
    const url = new URL(redirectUrl);
    assert.deepEqual([...url.searchParams.keys()], ["state", "status", "code"]);
    assert.equal(url.origin, "https://integrity.website");
    assert.equal(url.pathname, RETURN_PATH);
    assert.equal(url.searchParams.get("state"), "exampleAttemptToken_12");
    assert.equal(url.searchParams.get("status"), "confirmed");
    assert.equal(DEFAULT_INTEGRITY_MEDIA_RETURN_PATH, RETURN_PATH);

    const repeated = await request("POST", "/provision-confirm", {
      state: "exampleAttemptToken_12",
    });
    assert.equal(repeated.status, 200);
    assert.equal(repeated.body.data?.provisionOutcome, "CONFIRMED_MAPPING_EXISTS");
    assert.equal(memory.users().length, 1);
    assert.equal(memory.results().length, 1);
    assert.equal(
      new URL(String(repeated.body.data?.redirectUrl)).searchParams.get("code"),
      url.searchParams.get("code"),
    );
  });

  it("rejects an email collision before any create, result, or redirect", async () => {
    await memory.view().insertUser(existingUser("author@example.com", "member-existing"));
    const before = memory.mutationCount;
    assert.equal((await register(attemptBody())).status, 200);
    const afterRegister = memory.mutationCount;
    const collided = await request("POST", "/provision-confirm", {
      state: "exampleAttemptToken_12",
    });
    assert.equal(collided.status, 409);
    assert.equal(collided.body.meta.code, "existing_email_collision");
    assert.equal(collided.body.message.includes("author@example.com"), false);
    assert.equal(memory.mutationCount, afterRegister);
    assert.equal(before < afterRegister, true);
    assert.equal(memory.users().length, 1);
    assert.equal(memory.links().length, 0);
    assert.equal(memory.results().length, 0);
    assert.equal(memory.grants().length, 0);
  });

  it("reuses one author across overlapping attempts and rolls back a failed create", async () => {
    const first = attemptBody({ attemptId: "firstAttemptToken_01" });
    const second = attemptBody({ attemptId: "secondAttemptToken02" });
    assert.equal((await register(first)).status, 200);
    assert.equal((await register(second)).status, 200);
    const [left, right] = await Promise.all([
      request("POST", "/provision-confirm", { state: first.attemptId }),
      request("POST", "/provision-confirm", { state: second.attemptId }),
    ]);
    assert.equal(left.status, 200);
    assert.equal(right.status, 200);
    assert.equal(memory.users().length, 1);
    assert.equal(memory.links().length, 1);
    assert.deepEqual(
      [left.body.data?.provisionOutcome, right.body.data?.provisionOutcome].sort(),
      ["CONFIRMED_MAPPING_EXISTS", "NEW_AUTHOR"],
    );

    resetProvisionAttemptReplayCacheForTests();
    const third = attemptBody({
      attemptId: "thirdAttemptToken_003",
      externalAuthorId: "22222222-2222-4222-8222-222222222222",
      email: "second@example.com",
    });
    assert.equal((await register(third)).status, 200);
    memory.failNextLinkInsert = true;
    const failed = await request("POST", "/provision-confirm", { state: third.attemptId });
    assert.equal(failed.status, 503);
    assert.equal(memory.users().filter((user) => user.email === "second@example.com").length, 0);
    assert.equal(
      memory.links().some((link) => link.externalAuthorId === third.externalAuthorId),
      false,
    );
  });

  it("recovers a bound author without selecting identity by email", async () => {
    const memberId = randomUUID();
    const userId = randomUUID();
    const attemptId = "recoveryAttemptToken1";
    await memory.view().insertAttempt({
      attemptId,
      externalAuthorId: AUTHOR,
      email: "author@example.com",
      displayName: "Example Author",
      target: "staging",
      expiresAt: Math.floor(Date.now() / 1000) + 600,
      returnPath: RETURN_PATH,
      emailVerification: "pending",
      memberId,
      userId,
      createdMember: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await memory.view().insertUser({
      ...existingUser("author@example.com", memberId),
      userId,
    });
    await memory.view().insertUser(existingUser("other-owner@example.com", "member-other"));

    const recovered = await request("POST", "/provision-confirm", { state: attemptId });
    assert.equal(recovered.status, 200);
    assert.equal(memory.users().filter((user) => user.email === "author@example.com").length, 1);
    assert.equal(memory.links()[0]?.memberId, memberId);
    assert.equal(memory.links()[0]?.linkFinalization, "provisional");
    assert.equal(memory.grants()[0]?.publishWithoutManualReview, true);
    assert.equal(memory.users().some((user) => user.memberId === "member-other"), true);
  });

  it("reuses a confirmed mapping without changing the grant or the link", async () => {
    const memberId = "33333333-3333-4333-8333-333333333333";
    const link = confirmedLink(AUTHOR, memberId);
    await memory.view().insertUser(existingUser("author@example.com", memberId));
    await memory.view().insertLink(link);
    await memory.view().insertGrant({
      participantId: memberId,
      capabilities: ["author"],
      publishWithoutManualReview: false,
      updatedAt: new Date().toISOString(),
    });

    const registered = await register(attemptBody());
    assert.equal(registered.status, 200);
    assert.equal(registered.body.data?.mapping, "exists");
    assert.equal(memory.users().length, 1);

    const confirmed = await request("POST", "/provision-confirm", {
      state: "exampleAttemptToken_12",
    });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.data?.provisionOutcome, "CONFIRMED_MAPPING_EXISTS");
    assert.equal(memory.users().length, 1);
    assert.equal(memory.links().length, 1);
    assert.equal(memory.links()[0]?.linkInstanceId, link.linkInstanceId);
    assert.equal(memory.links()[0]?.linkRevision, 4);
    assert.equal(memory.links()[0]?.linkFinalization, "confirmed");
    assert.equal(memory.grants()[0]?.publishWithoutManualReview, false);
    assert.deepEqual(memory.grants()[0]?.capabilities, ["author"]);
  });

  it("keeps the link provisional until the existing acknowledgement confirms it", async () => {
    assert.equal((await register(attemptBody())).status, 200);
    const confirmed = await request("POST", "/provision-confirm", {
      state: "exampleAttemptToken_12",
    });
    const redirectUrl = new URL(String(confirmed.body.data?.redirectUrl));
    const code = String(redirectUrl.searchParams.get("code"));
    await copyProvisionLinkAndResult();

    const redeemed = await redeem(code, AUTHOR);
    assert.equal(redeemed.status, 200);
    assert.equal(redeemed.body.data?.provisionOutcome, "NEW_AUTHOR");
    assert.equal((await linkStore.listLinks())[0]?.linkFinalization, "provisional");

    const acknowledged = await acknowledge(redeemed.body);
    assert.equal(acknowledged.status, 200);
    assert.equal(acknowledged.body.data?.finalization, "confirmed");
    assert.equal(acknowledged.body.data?.idempotent, false);
    const again = await acknowledge(redeemed.body, String(acknowledged.body.data?.linkInstanceId));
    assert.equal(again.status, 200);
    assert.equal(again.body.data?.idempotent, true);
    assert.equal((await linkStore.listLinks()).length, 1);
    assert.equal((await linkStore.listLinks())[0]?.linkFinalization, "confirmed");
  });

  it("does not replace Beta registration or resolve staging as beta", () => {
    const registration = readFileSync(
      new URL("../../../src/modules/auth/auth.service.ts", import.meta.url),
      "utf8",
    );
    const provision = readFileSync(
      new URL(
        "../../../src/modules/external-author-link/external-author-link.provision.service.ts",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(registration, /assertRegistrationInviteProvided/);
    assert.equal(provision.includes("registerAuthUser"), false);
    assert.equal(provision.includes("resolvePlatformMode"), false);
    const callback = buildIntegrityMediaReturnUrl({
      status: "confirmed",
      attemptState: "exampleAttemptToken_12",
      resultCode: "a".repeat(32),
      nodeEnv: "production",
      config: {
        hmacSecret: SECRET,
        returnOrigin: "https://integrity.website",
        returnPath: RETURN_PATH,
      },
    });
    assert.equal(
      new URL(String(callback)).search,
      "?state=exampleAttemptToken_12&status=confirmed&code=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
  });

  it("gives a new Integrity Media author a public profile and keeps later choices", async () => {
    const ordinary = buildDefaultMemberProfile({
      userId: "ordinary-user",
      displayName: "Ordinary Participant",
    });
    assert.equal(ordinary.profileVisibility, "members_only");

    assert.equal((await register(attemptBody())).status, 200);
    const created = await request("POST", "/provision-confirm", {
      state: "exampleAttemptToken_12",
    });
    assert.equal(created.status, 200);
    assert.equal(created.body.data?.provisionOutcome, "NEW_AUTHOR");
    assert.equal(memory.profiles().length, 1);
    assert.equal(memory.profiles()[0]?.profileVisibility, "public");
    assert.equal(memory.profiles()[0]?.participationVisibility, "members_only");
    assert.equal(memory.profiles()[0]?.skillsVisibility, "members_only");
    assert.equal(memory.grants()[0]?.capabilities.includes("author"), true);
    assert.equal(memory.grants()[0]?.publishWithoutManualReview, true);

    const userId = memory.profiles()[0]?.userId;
    assert.ok(userId);
    memory.patchProfile(userId, { profileVisibility: "private" });
    const again = await request("POST", "/provision-confirm", {
      state: "exampleAttemptToken_12",
    });
    assert.equal(again.status, 200);
    assert.equal(again.body.data?.provisionOutcome, "CONFIRMED_MAPPING_EXISTS");
    assert.equal(memory.profiles()[0]?.profileVisibility, "private");
    assert.equal(memory.profiles().length, 1);
  });

  it("keeps an existing participant profile visibility when Integrity Media links them", async () => {
    const memberId = "55555555-5555-4555-8555-555555555555";
    const userId = "user-existing-visibility";
    const profile = buildDefaultMemberProfile({
      userId,
      displayName: "Existing Person",
    });
    profile.profileVisibility = "private";
    await memory.view().insertUser({
      ...existingUser("existing-visibility@example.com", memberId),
      userId,
    });
    await memory.view().insertProfile(profile);
    await memory.view().insertLink(confirmedLink(AUTHOR, memberId));

    assert.equal(
      (
        await register(
          attemptBody({
            attemptId: "existingVisibilityToken",
            email: "existing-visibility@example.com",
          }),
        )
      ).status,
      200,
    );
    const linked = await request("POST", "/provision-confirm", {
      state: "existingVisibilityToken",
    });
    assert.equal(linked.status, 200);
    assert.equal(linked.body.data?.provisionOutcome, "CONFIRMED_MAPPING_EXISTS");
    assert.equal(memory.profiles().length, 1);
    assert.equal(memory.profiles()[0]?.userId, userId);
    assert.equal(memory.profiles()[0]?.profileVisibility, "private");
    assert.equal(memory.users().length, 1);
  });

  it("fails closed when a transaction is unavailable", async () => {
    setProvisionMemoryForTests(null);
    const response = await register(attemptBody());
    assert.equal(response.status, 503);
    assert.equal(response.body.meta.code, "unavailable");
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function attemptBody(
  override: Partial<{
    attemptId: string;
    externalAuthorId: string;
    email: string;
    displayName: string;
    target: string;
    expiresAt: number;
    returnPath: string;
    emailVerification: string;
  }> = {},
) {
  return {
    attemptId: "exampleAttemptToken_12",
    externalAuthorId: AUTHOR,
    email: "author@example.com",
    displayName: "Example Author",
    target: "staging",
    expiresAt: Math.floor(Date.now() / 1000) + 600,
    returnPath: RETURN_PATH,
    emailVerification: "pending",
    ...override,
  };
}

async function register(
  body: ReturnType<typeof attemptBody>,
  override: { timestamp?: string; signature?: string } = {},
): Promise<{ status: number; body: ApiBody; timestamp: string; signature: string }> {
  const timestamp = override.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature =
    override.signature ??
    signIntegrityMediaLinkRedeem(
      SECRET,
      buildProvisionAttemptPayload({
        timestamp,
        attemptId: body.attemptId,
        externalAuthorId: body.externalAuthorId,
        email: body.email.trim().toLowerCase(),
        displayName: body.displayName.trim(),
        target: body.target,
        expiresAt: String(body.expiresAt),
        returnPath: body.returnPath,
        emailVerification: body.emailVerification,
      }),
    );
  const response = await request("POST", "/provision-attempt", body, {
    "x-hu-integrity-media-timestamp": timestamp,
    "x-hu-integrity-media-signature": signature,
  });
  return { ...response, timestamp, signature };
}

async function request(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: ApiBody }> {
  const response = await fetch(`${baseUrl}/api/v1/integrity-media/link${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json()) as ApiBody,
  };
}

function existingUser(email: string, memberId: string) {
  const now = new Date().toISOString();
  return {
    userId: `user-${memberId}`,
    email,
    passwordHash: "existing-hash",
    displayName: "Existing Person",
    role: "member" as const,
    status: "active" as const,
    memberId,
    emailVerificationStatus: "verified" as const,
    createdAt: now,
    updatedAt: now,
  };
}

function confirmedLink(authorId: string, memberId: string): ExternalAuthorLinkRecord {
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
    linkRevision: 4,
    linkFinalization: "confirmed",
    linkInstanceId: "44444444-4444-4444-8444-444444444444",
  };
}

async function copyProvisionLinkAndResult(): Promise<void> {
  const link = memory.links()[0];
  const result = memory.results()[0];
  assert.ok(link);
  assert.ok(result);
  assert.equal(await linkStore.insertLink(link), "inserted");
  await linkStore.insertResult(result);
}

async function redeem(code: string, authorId: string): Promise<{ status: number; body: ApiBody }> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signIntegrityMediaLinkRedeem(
    SECRET,
    buildIntegrityMediaLinkRedeemPayload({
      timestamp,
      resultCode: code,
      externalAuthorId: authorId,
    }),
  );
  return request("POST", "/redeem", { resultCode: code, externalAuthorId: authorId }, {
    "x-hu-integrity-media-timestamp": timestamp,
    "x-hu-integrity-media-signature": signature,
  });
}

async function acknowledge(
  body: ApiBody,
  eventSeed = "",
): Promise<{ status: number; body: ApiBody }> {
  const data = body.data ?? {};
  const eventId = eventSeed || randomUUID();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const externalAuthorId = String(data.externalAuthorId);
  const memberId = String(data.memberId);
  const linkRevision = Number(data.linkRevision);
  const linkInstanceId = String(data.linkInstanceId);
  const signature = signIntegrityMediaLinkRedeem(
    SECRET,
    buildIntegrityMediaLinkAcknowledgePayload({
      timestamp,
      eventId,
      externalAuthorId,
      memberId,
      linkRevision,
      linkInstanceId,
    }),
  );
  return request(
    "POST",
    "/acknowledge",
    { eventId, externalAuthorId, memberId, linkRevision, linkInstanceId },
    {
      "x-hu-integrity-media-timestamp": timestamp,
      "x-hu-integrity-media-signature": signature,
    },
  );
}
