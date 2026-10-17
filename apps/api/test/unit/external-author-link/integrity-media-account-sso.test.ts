import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { describe, it, before, after, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";

import cookieParser from "cookie-parser";
import express from "express";

import { resolveAuthConfig } from "../../../src/config/auth.config.js";
import { setAuthSessionWriterForTests } from "../../../src/modules/auth/auth-session.repository.js";
import { setFindAuthUserByIdForTests } from "../../../src/modules/auth/auth-user.repository.js";
import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import {
  clearEmailConfirmationCodesForTests,
  findActiveEmailConfirmationCode,
  getLastIssuedConfirmationCodeForTests,
} from "../../../src/modules/email/email-confirmation-code.repository.js";
import { resetEmailProviderCacheForTests } from "../../../src/modules/email/email.provider.js";
import { MockEmailProvider } from "../../../src/modules/email/providers/mock.provider.js";
import {
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_SOURCE,
} from "../../../src/modules/external-author-link/external-author-link.constants.js";
import { signIntegrityMediaLinkRedeem } from "../../../src/modules/external-author-link/external-author-link.hmac.js";
import {
  createMemoryExternalAuthorLinkStore,
  setExternalAuthorLinkStoreForTests,
  type ExternalAuthorLinkStore,
} from "../../../src/modules/external-author-link/external-author-link.store.js";
import type { ExternalAuthorLinkRecord } from "../../../src/modules/external-author-link/external-author-link.types.js";
import {
  createMemorySsoState,
  setSsoMemoryForTests,
  type MemorySsoState,
} from "../../../src/modules/external-author-link/external-author-link.sso.database.js";
import { buildSsoGrantPayload } from "../../../src/modules/external-author-link/external-author-link.sso.hmac.js";
import integrityMediaAccountSsoRouter from "../../../src/modules/external-author-link/external-author-link.sso.routes.js";
import { setSsoNowForTests } from "../../../src/modules/external-author-link/external-author-link.sso.service.js";

const SECRET = "dummy-secret-not-real";
const DIGEST = "51292fa0fb2ac4e5c22b368c878d11f29a61c4bbd31379515aadbdbfa0414d8b";
const AUTHOR = "11111111-1111-4111-8111-111111111111";
const OTHER_AUTHOR = "22222222-2222-4222-8222-222222222222";
const MEMBER = "member-1";
const USER_ID = "user-member-1";
const DECOY_ID = "user-decoy";
const EMAIL = "linked-author@huws.org";
const WEB_ORIGIN = "https://staging.huws.org";

interface JsonBody {
  success: boolean;
  grantUrl?: string;
  data: {
    authenticationComplete?: boolean;
    destination?: string;
    emailConfirmationRequired?: boolean;
    emailSent?: boolean;
    maskedEmail?: string;
    resendAvailableAt?: string | null;
    emailDeliveryError?: string;
    pendingConfirmationToken?: string;
    accessToken?: string;
    refreshToken?: string;
  } | null;
  meta?: { code?: string };
  message?: string;
}

interface SignedRequest {
  status: number;
  body: JsonBody;
  cookies: string[];
  text: string;
  signature: string;
  timestamp: string;
  requestId: string;
}

let server: Server;
let baseUrl = "";
let memory: MemorySsoState;
let linkStore: ExternalAuthorLinkStore;
let previousMode: string | undefined;
let previousSecret: string | undefined;
let previousWebOrigin: string | undefined;
let previousCorsOrigin: string | undefined;
let previousNodeEnv: string | undefined;

describe("Integrity Media account SSO", () => {
  before(async () => {
    previousMode = process.env.PLATFORM_MODE;
    previousSecret = process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV];
    previousWebOrigin = process.env.WEB_ORIGIN;
    previousCorsOrigin = process.env.CORS_ORIGIN;
    previousNodeEnv = process.env.NODE_ENV;
    process.env.PLATFORM_MODE = "staging";
    process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV] = SECRET;
    process.env.WEB_ORIGIN = WEB_ORIGIN;
    process.env.CORS_ORIGIN = WEB_ORIGIN;
    resetEmailProviderCacheForTests();

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use("/api/v1/integrity-media/account", integrityMediaAccountSsoRouter);
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
    setSsoMemoryForTests(null);
    setSsoNowForTests(null);
    setExternalAuthorLinkStoreForTests(null);
    setFindAuthUserByIdForTests(null);
    setAuthSessionWriterForTests(null);
    restoreEnv("PLATFORM_MODE", previousMode);
    restoreEnv(INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV, previousSecret);
    restoreEnv("WEB_ORIGIN", previousWebOrigin);
    restoreEnv("CORS_ORIGIN", previousCorsOrigin);
    restoreEnv("NODE_ENV", previousNodeEnv);
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    process.env.PLATFORM_MODE = "staging";
    process.env.WEB_ORIGIN = WEB_ORIGIN;
    process.env.CORS_ORIGIN = WEB_ORIGIN;
    process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV] = SECRET;
    setSsoNowForTests(null);
    clearEmailConfirmationCodesForTests();
    MockEmailProvider.clearForTests();
    memory = createMemorySsoState();
    setSsoMemoryForTests(memory);
    linkStore = createMemoryExternalAuthorLinkStore();
    setExternalAuthorLinkStoreForTests(linkStore);
    setFindAuthUserByIdForTests(async (userId) => {
      return memory.users().find((user) => user.userId === userId) ?? null;
    });
  });

  it("matches the seven-line canonical digest", () => {
    const payload = buildSsoGrantPayload({
      timestamp: "1700000000",
      requestId: "exampleSsoRequest_01",
      externalAuthorId: AUTHOR,
      memberId: MEMBER,
      linkRevision: "1",
      target: "staging",
    });
    assert.equal(payload.split("\n").length, 7);
    assert.equal(payload.endsWith("\n"), false);
    assert.equal(Buffer.byteLength(payload), 115);
    assert.equal(signIntegrityMediaLinkRedeem(SECRET, payload), DIGEST);
  });

  it("accepts a valid signature and returns only the environment grant URL", async () => {
    await seed();
    const logs: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    let created: SignedRequest;
    try {
      created = await register();
    } finally {
      console.log = original;
    }

    assert.equal(created.status, 200);
    assert.deepEqual(Object.keys(created.body).sort(), ["grantUrl", "success"]);
    assert.equal(created.body.success, true);
    const grantUrl = new URL(created.body.grantUrl ?? "");
    assert.equal(grantUrl.origin, WEB_ORIGIN);
    assert.equal(grantUrl.pathname, "/connect/integrity-media/sso");
    assert.equal(grantUrl.searchParams.get("grant")?.length, 43);
    assert.equal(memory.sessionCount, 0);
    assert.equal(memory.users().length, 2);
    assert.equal(memory.members().length, 1);
    const logged = logs.join("\n");
    assert.equal(logged.includes("grant_created"), true);
    assert.equal(logged.includes(SECRET), false);
    assert.equal(logged.includes(created.signature), false);
    assert.equal(logged.includes(grantUrl.searchParams.get("grant") ?? "missing-grant"), false);
    assert.equal(logged.includes(created.body.grantUrl ?? "missing-url"), false);
    assert.equal(logged.includes(EMAIL), false);
  });

  it("rejects an invalid signature, a stale timestamp, a timestamp mismatch, and malformed input", async () => {
    await seed();
    const invalid = await register({}, { signature: "a".repeat(64) });
    assert.equal(invalid.status, 401);
    assert.equal(invalid.body.meta?.code, "invalid_signature");

    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 301);
    const stale = await register({ timestamp: staleTimestamp });
    assert.equal(stale.status, 401);
    assert.equal(stale.body.meta?.code, "stale_timestamp");

    const mismatch = await register({}, { headerTimestamp: String(Math.floor(Date.now() / 1000) - 5) });
    assert.equal(mismatch.status, 400);
    assert.equal(mismatch.body.meta?.code, "timestamp_mismatch");

    const redirect = await request("POST", "/sso", { ...signedBody(baseFields()), redirect: "https://evil.example" }, signedHeaders(baseFields()));
    assert.equal(redirect.status, 400);
    assert.equal(redirect.body.meta?.code, "invalid_request");

    const revision = await request("POST", "/sso", { ...signedBody(baseFields()), linkRevision: 1.5 }, signedHeaders(baseFields()));
    assert.equal(revision.status, 400);
    assert.equal(revision.body.meta?.code, "invalid_request");
    assert.equal(memory.grants().length, 0);
    assert.equal(memory.sessionCount, 0);
  });

  it("rejects the wrong environment and an origin that is not this Humanity Union web origin", async () => {
    await seed();
    process.env.PLATFORM_MODE = "production";
    const crossed = await register();
    assert.equal(crossed.status, 403);
    assert.equal(crossed.body.meta?.code, "target_mismatch");
    process.env.PLATFORM_MODE = "staging";

    const otherTarget = await register({ target: "production" });
    assert.equal(otherTarget.status, 403);
    assert.equal(otherTarget.body.meta?.code, "target_mismatch");

    await assertOriginRejected({ WEB_ORIGIN: "" });
    await assertOriginRejected({ WEB_ORIGIN: undefined, CORS_ORIGIN: "https://staging.huws.org" });
    await assertOriginRejected({ WEB_ORIGIN: "https://huws.org" });
    await assertOriginRejected({ WEB_ORIGIN: "https://staging.huws.org/app" });
    await assertOriginRejected({ WEB_ORIGIN: "https://user:secret@staging.huws.org" });
    await assertOriginRejected({ WEB_ORIGIN: "http://staging.huws.org" });
    await assertOriginRejected({ WEB_ORIGIN: "https://staging.huws.org/" });
    await assertOriginRejected({ PLATFORM_MODE: "beta", WEB_ORIGIN: "https://staging.huws.org" });
    await assertOriginRejected({ PLATFORM_MODE: "development", WEB_ORIGIN: "http://localhost:3000" });

    process.env.PLATFORM_MODE = "production";
    process.env.WEB_ORIGIN = "https://huws.org";
    const production = await register({ target: "production", requestId: requestId() });
    assert.equal(production.status, 200);
    assert.equal(new URL(production.body.grantUrl ?? "").origin, "https://huws.org");
    assert.equal(new URL(production.body.grantUrl ?? "").pathname, "/connect/integrity-media/sso");

    process.env.PLATFORM_MODE = "staging";
    process.env.WEB_ORIGIN = WEB_ORIGIN;
    const staging = await register({ requestId: requestId() });
    assert.equal(staging.status, 200);
    assert.equal(new URL(staging.body.grantUrl ?? "").origin, "https://staging.huws.org");
    assert.equal(memory.sessionCount, 0);
    assert.equal(memory.grants().length, 2);
  });

  it("rejects unknown, provisional, disabled, mismatched, and inactive accounts", async () => {
    const unknown = await register();
    assert.equal(unknown.status, 404);
    assert.equal(unknown.body.meta?.code, "author_not_found");

    await seed({ link: confirmedLink({ linkFinalization: "provisional" }) });
    const provisional = await register();
    assert.equal(provisional.status, 409);
    assert.equal(provisional.body.meta?.code, "link_not_confirmed");

    await replaceLink(confirmedLink({ state: "disabled", linkFinalization: "confirmed" }));
    const disabled = await register({ requestId: requestId() });
    assert.equal(disabled.status, 409);
    assert.equal(disabled.body.meta?.code, "link_disabled");

    await replaceLink(confirmedLink());
    const wrongMember = await register({ requestId: requestId(), memberId: "member-2" });
    assert.equal(wrongMember.status, 409);
    assert.equal(wrongMember.body.meta?.code, "member_mismatch");

    const wrongRevision = await register({ requestId: requestId(), linkRevision: "5" });
    assert.equal(wrongRevision.status, 409);
    assert.equal(wrongRevision.body.meta?.code, "revision_mismatch");

    memory.addUser(user({ status: "disabled" }));
    const inactive = await register({ requestId: requestId() });
    assert.equal(inactive.status, 403);
    assert.equal(inactive.body.meta?.code, "account_disabled");

    memory.addUser(user({ userId: USER_ID, memberId: "member-other" }));
    const identity = await register({ requestId: requestId() });
    assert.equal(identity.status, 409);
    assert.equal(identity.body.meta?.code, "identity_mismatch");
    assert.equal(memory.grants().length, 0);
    assert.equal(memory.sessionCount, 0);
    assert.equal(memory.members().length, 1);
  });

  it("preserves a legacy linked mapping and does not require collaboration to be active", async () => {
    await seed({
      link: confirmedLink({
        linkFinalization: undefined,
        linkRevision: undefined,
        collaborationStatus: "blocked",
        authorActivationPending: true,
      }),
    });
    const legacy = await register({ linkRevision: "1" });
    assert.equal(legacy.status, 200);
    assert.equal(memory.grants()[0]?.linkRevision, 1);
    const stored = await linkStore.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR);
    assert.equal(stored?.linkFinalization, undefined);
    assert.equal(stored?.state, "linked");
    assert.equal(memory.sessionCount, 0);
  });

  it("reuses an identical signed retry and rejects a changed payload", async () => {
    await seed();
    const fields = baseFields();
    const [first, second] = await Promise.all([register(fields), register(fields)]);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(first.body.grantUrl, second.body.grantUrl);
    assert.equal(memory.grants().length, 1);

    const changedMember = await register({ ...fields, memberId: "member-2" });
    assert.equal(changedMember.status, 409);
    assert.equal(changedMember.body.meta?.code, "request_conflict");

    const changedRevision = await register({ ...fields, linkRevision: "2" });
    assert.equal(changedRevision.status, 409);
    assert.equal(changedRevision.body.meta?.code, "request_conflict");

    const changedAuthor = await register({ ...fields, externalAuthorId: OTHER_AUTHOR });
    assert.equal(changedAuthor.status, 409);
    assert.equal(changedAuthor.body.meta?.code, "request_conflict");

    process.env.PLATFORM_MODE = "production";
    process.env.WEB_ORIGIN = "https://huws.org";
    const changedTarget = await register({ ...fields, target: "production" });
    process.env.PLATFORM_MODE = "staging";
    process.env.WEB_ORIGIN = WEB_ORIGIN;
    assert.equal(changedTarget.status, 409);
    assert.equal(changedTarget.body.meta?.code, "request_conflict");
    assert.equal(memory.grants().length, 1);
    assert.equal(memory.grants()[0]?.memberId, MEMBER);
    assert.equal(memory.grants()[0]?.target, "staging");
    assert.equal(memory.sessionCount, 0);
  });

  it("expires a grant and does not mint a replacement for the same request", async () => {
    await seed();
    const started = Date.now();
    setSsoNowForTests(() => new Date(started));
    const created = await register({ timestamp: String(Math.floor(started / 1000)) });
    assert.equal(created.status, 200);
    const grant = grantId(created.body.grantUrl);
    setSsoNowForTests(() => new Date(started + 61_000));

    const expired = await complete(grant);
    assert.equal(expired.status, 409);
    assert.equal(expired.body.meta?.code, "grant_expired");
    assert.equal(memory.grants()[0]?.consumedAt, null);
    assert.equal(memory.sessionCount, 0);

    const retry = await register({
      timestamp: String(Math.floor(started / 1000)),
      requestId: created.requestId,
    });
    assert.equal(retry.status, 409);
    assert.equal(retry.body.meta?.code, "grant_expired");
    assert.equal(memory.grants().length, 1);
    assert.equal(memory.sessionCount, 0);
  });

  it("does not consume a grant on GET and allows only one completion", async () => {
    await seed();
    const created = await register();
    const grant = grantId(created.body.grantUrl);
    const fetched = await request("GET", `/sso/complete?grant=${encodeURIComponent(grant)}`);
    assert.equal(fetched.status, 405);
    assert.equal(fetched.body.meta?.code, "method_not_allowed");
    assert.equal(memory.grants()[0]?.consumedAt, null);
    assert.equal(memory.sessionCount, 0);

    const ignoredQuery = await request("POST", `/sso/complete?grant=${encodeURIComponent(grant)}`, {});
    assert.equal(ignoredQuery.status, 400);
    assert.equal(memory.grants()[0]?.consumedAt, null);

    const [first, second] = await Promise.all([complete(grant), complete(grant)]);
    const statuses = [first.status, second.status].sort((left, right) => left - right);
    assert.deepEqual(statuses, [200, 409]);
    const success = first.status === 200 ? first : second;
    const conflict = first.status === 200 ? second : first;
    assert.equal(success.body.data?.destination, "/workspace");
    assert.equal(conflict.body.meta?.code, "grant_consumed");
    assert.equal(memory.sessionCount, 1);
    assert.equal(memory.sessions()[0]?.userId, USER_ID);
    assert.notEqual(memory.grants()[0]?.consumedAt, null);
  });

  it("issues one normal session for a verified account and rechecks the link", async () => {
    await seed({ user: user({ loginEmailTwoStepEnabled: true }) });
    const beforeLink = structuredClone(await linkStore.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR));
    const created = await register();
    const grant = grantId(created.body.grantUrl);
    const completed = await complete(grant);
    assert.equal(completed.status, 200);
    assert.equal(completed.body.data?.authenticationComplete, true);
    assert.equal(completed.body.data?.destination, "/workspace");
    assert.equal(completed.body.data?.accessToken, undefined);
    assert.equal(completed.body.data?.refreshToken, undefined);
    assert.equal(completed.text.includes("eyJ"), false);
    assert.equal(cookieNames(completed.cookies).includes(resolveAuthConfig().accessCookieName), true);
    assert.equal(cookieNames(completed.cookies).includes(resolveAuthConfig().refreshCookieName), true);
    assert.equal(cookieNames(completed.cookies).includes(resolveAuthConfig().pendingConfirmationCookieName), false);
    assert.equal(MockEmailProvider.sentMessages.length, 0);
    assert.equal(memory.sessionCount, 1);
    assert.equal(memory.users().find((entry) => entry.userId === USER_ID)?.emailVerificationStatus, "verified");
    assert.deepEqual(await linkStore.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR), beforeLink);

    const again = await complete(grant);
    assert.equal(again.status, 409);
    assert.equal(again.body.meta?.code, "grant_consumed");
    const retry = await register({ requestId: created.requestId, timestamp: created.timestamp });
    assert.equal(retry.status, 409);
    assert.equal(retry.body.meta?.code, "grant_consumed");
    assert.equal(memory.sessionCount, 1);

    const fresh = await register({ requestId: requestId() });
    const stored = await linkStore.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR);
    assert.ok(stored);
    await linkStore.updateLink({ ...stored, linkRevision: 9 });
    const staleRevision = await complete(grantId(fresh.body.grantUrl));
    assert.equal(staleRevision.status, 409);
    assert.equal(staleRevision.body.meta?.code, "revision_mismatch");
    assert.equal(memory.sessionCount, 1);

    await linkStore.updateLink({ ...stored, linkRevision: 4, state: "disabled" });
    const disabledGrant = await register({ requestId: requestId() });
    assert.equal(disabledGrant.status, 409);
    assert.equal(disabledGrant.body.meta?.code, "link_disabled");
    assert.equal(memory.members().length, 1);
    assert.equal(memory.users().length, 2);
  });

  it("starts the existing email ceremony for a pending account without verifying it", async () => {
    await seed({ user: user({ emailVerificationStatus: "pending" }) });
    const created = await register();
    const completed = await complete(grantId(created.body.grantUrl));
    assert.equal(completed.status, 200);
    assert.equal(completed.body.data?.emailConfirmationRequired, true);
    assert.equal(completed.body.data?.emailSent, true);
    assert.equal(completed.body.data?.destination, "/confirm-email");
    assert.equal(completed.body.data?.pendingConfirmationToken, undefined);
    assert.equal(typeof completed.body.data?.maskedEmail, "string");
    assert.equal(completed.body.data?.maskedEmail?.includes(EMAIL), false);
    assert.equal(cookieNames(completed.cookies).includes(resolveAuthConfig().pendingConfirmationCookieName), true);
    assert.equal(cookieNames(completed.cookies).includes(resolveAuthConfig().accessCookieName), false);
    assert.equal(memory.sessionCount, 0);
    assert.equal(memory.users().find((entry) => entry.userId === USER_ID)?.emailVerificationStatus, "pending");
    assert.equal(memory.members().length, 1);
    assert.equal(memory.users().length, 2);
    assert.equal(MockEmailProvider.sentMessages.length, 1);
    assert.equal(MockEmailProvider.sentMessages[0]?.to, EMAIL);
    const code = getLastIssuedConfirmationCodeForTests(USER_ID);
    assert.ok(code);
    assert.equal(completed.text.includes(code), false);
    assert.ok(await findActiveEmailConfirmationCode({ userId: USER_ID, purpose: "registration_email_confirmation" }));
    assert.equal(
      await findActiveEmailConfirmationCode({ userId: DECOY_ID, purpose: "registration_email_confirmation" }),
      null,
    );
  });

  it("keeps a pending account recoverable when email delivery fails", async () => {
    await seed({ user: user({ emailVerificationStatus: "pending" }) });
    MockEmailProvider.failNextSendsForTests(1);
    const created = await register();
    const completed = await complete(grantId(created.body.grantUrl));
    assert.equal(completed.status, 200);
    assert.equal(completed.body.data?.emailConfirmationRequired, true);
    assert.equal(completed.body.data?.emailSent, false);
    assert.equal(typeof completed.body.data?.emailDeliveryError, "string");
    assert.equal(completed.body.data?.destination, "/confirm-email");
    assert.equal(cookieNames(completed.cookies).includes(resolveAuthConfig().pendingConfirmationCookieName), true);
    assert.equal(cookieNames(completed.cookies).includes(resolveAuthConfig().accessCookieName), false);
    assert.equal(memory.sessionCount, 0);
    assert.equal(memory.users().find((entry) => entry.userId === USER_ID)?.emailVerificationStatus, "pending");
    assert.equal(memory.members().length, 1);
    const code = getLastIssuedConfirmationCodeForTests(USER_ID);
    assert.ok(code);
    assert.equal(completed.text.includes(code), false);
    assert.equal(
      await findActiveEmailConfirmationCode({ userId: USER_ID, purpose: "registration_email_confirmation" }),
      null,
    );
  });

  it("does not consume a grant when confirmation sending is rate limited", async () => {
    await seed({ user: user({ emailVerificationStatus: "pending" }) });
    const first = await complete(grantId((await register()).body.grantUrl));
    assert.equal(first.status, 200);
    assert.equal(first.body.data?.emailSent, true);
    const secondGrant = await register({ requestId: requestId() });
    const limited = await complete(grantId(secondGrant.body.grantUrl));
    assert.equal(limited.status, 429);
    assert.equal(limited.body.meta?.code, "auth_code_rate_limited");
    assert.equal(memory.grants().find((grant) => grant.requestId === secondGrant.requestId)?.consumedAt, null);
    assert.equal(memory.sessionCount, 0);
    assert.equal(memory.users().find((entry) => entry.userId === USER_ID)?.emailVerificationStatus, "pending");
    assert.equal(memory.members().length, 1);
  });

  it("does not change password login or account provisioning", () => {
    const authSource = readFileSync(sourcePath("auth/auth.service.ts"), "utf8");
    const provisionSource = readFileSync(
      sourcePath("external-author-link/external-author-link.provision.service.ts"),
      "utf8",
    );
    const ssoSource = readFileSync(sourcePath("external-author-link/external-author-link.sso.service.ts"), "utf8");

    assert.match(authSource, /verifyPassword\(input\.password, user\.passwordHash\)/);
    assert.match(authSource, /emailVerificationStatus !== "verified"/);
    assert.match(authSource, /kind: "email_confirmation_required"/);
    assert.match(provisionSource, /export async function registerProvisionAttempt/);
    assert.match(provisionSource, /export async function confirmProvisionAttempt/);
    assert.equal(provisionSource.includes("registerSsoGrant"), false);
    assert.equal(provisionSource.includes("issueAuthSession"), false);
    assert.equal(ssoSource.includes("findAuthUserByEmail"), false);
    assert.equal(ssoSource.includes("registerAuthUser"), false);
    assert.equal(ssoSource.includes("loginAuthUser"), false);
    assert.equal(ssoSource.includes("confirmMemberRegistration"), false);
    assert.equal(ssoSource.includes("markAuthUserEmailVerified"), false);
  });
});

function sourcePath(relativePath: string): string {
  return fileURLToPath(new URL(`../../../src/modules/${relativePath}`, import.meta.url));
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

function requestId(): string {
  return `sso${randomUUID().replaceAll("-", "")}`;
}

function baseFields(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    timestamp: String(Math.floor(Date.now() / 1000)),
    requestId: requestId(),
    externalAuthorId: AUTHOR,
    memberId: MEMBER,
    linkRevision: "4",
    target: "staging",
    ...overrides,
  };
}

function signedBody(fields: Record<string, string>): Record<string, unknown> {
  return {
    timestamp: Number(fields.timestamp),
    requestId: fields.requestId,
    externalAuthorId: fields.externalAuthorId,
    memberId: fields.memberId,
    linkRevision: Number(fields.linkRevision),
    target: fields.target,
  };
}

function signedHeaders(fields: Record<string, string>, signature = signFields(fields)): Record<string, string> {
  return {
    "x-hu-integrity-media-timestamp": fields.timestamp,
    "x-hu-integrity-media-signature": signature,
  };
}

function signFields(fields: Record<string, string>): string {
  return signIntegrityMediaLinkRedeem(
    SECRET,
    buildSsoGrantPayload({
      timestamp: fields.timestamp,
      requestId: fields.requestId,
      externalAuthorId: fields.externalAuthorId,
      memberId: fields.memberId,
      linkRevision: fields.linkRevision,
      target: fields.target,
    }),
  );
}

async function register(
  overrides: Partial<Record<string, string>> = {},
  options: { signature?: string; headerTimestamp?: string } = {},
): Promise<SignedRequest> {
  const fields = baseFields(overrides);
  const signature = options.signature ?? signFields(fields);
  const response = await request("POST", "/sso", signedBody(fields), {
    ...signedHeaders(fields, signature),
    ...(options.headerTimestamp ? { "x-hu-integrity-media-timestamp": options.headerTimestamp } : {}),
  });
  return { ...response, signature, timestamp: fields.timestamp, requestId: fields.requestId };
}

async function complete(grant: string): Promise<{ status: number; body: JsonBody; cookies: string[]; text: string }> {
  return request("POST", "/sso/complete", { grant });
}

async function request(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: JsonBody; cookies: string[]; text: string }> {
  const response = await fetch(`${baseUrl}/api/v1/integrity-media/account${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? (JSON.parse(text) as JsonBody) : { success: false, data: null },
    cookies: typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [],
    text,
  };
}

function cookieNames(cookies: string[]): string[] {
  return cookies.map((cookie) => cookie.split("=", 1)[0] ?? "");
}

async function assertOriginRejected(env: {
  WEB_ORIGIN?: string;
  CORS_ORIGIN?: string;
  PLATFORM_MODE?: string;
}): Promise<void> {
  const before = memory.grants().length;
  if (env.PLATFORM_MODE !== undefined) {
    process.env.PLATFORM_MODE = env.PLATFORM_MODE;
  }
  if (env.WEB_ORIGIN === undefined) {
    delete process.env.WEB_ORIGIN;
  } else {
    process.env.WEB_ORIGIN = env.WEB_ORIGIN;
  }
  if (env.CORS_ORIGIN !== undefined) {
    process.env.CORS_ORIGIN = env.CORS_ORIGIN;
  }
  const rejected = await register({
    requestId: requestId(),
    target: env.PLATFORM_MODE ?? "staging",
  });
  assert.equal(rejected.status, 503);
  assert.equal(rejected.body.meta?.code, "sso_not_configured");
  assert.equal(rejected.body.grantUrl, undefined);
  assert.equal(memory.grants().length, before);
  process.env.PLATFORM_MODE = "staging";
  process.env.WEB_ORIGIN = WEB_ORIGIN;
  process.env.CORS_ORIGIN = WEB_ORIGIN;
}

function grantId(grantUrl: string | undefined): string {
  return new URL(grantUrl ?? "").searchParams.get("grant") ?? "";
}

async function seed(input: { link?: ExternalAuthorLinkRecord; user?: AuthUserRecord } = {}): Promise<void> {
  memory.addMember({ memberId: MEMBER, identityId: USER_ID });
  memory.addUser(input.user ?? user());
  memory.addUser(user({ userId: DECOY_ID, memberId: "member-decoy", email: EMAIL }));
  await linkStore.insertLink(input.link ?? confirmedLink());
}

async function replaceLink(record: ExternalAuthorLinkRecord): Promise<void> {
  linkStore = createMemoryExternalAuthorLinkStore();
  setExternalAuthorLinkStoreForTests(linkStore);
  await linkStore.insertLink(record);
}

function user(overrides: Partial<AuthUserRecord> = {}): AuthUserRecord {
  const now = new Date().toISOString();
  return {
    userId: USER_ID,
    email: EMAIL,
    passwordHash: "existing-hash",
    displayName: "Linked Author",
    role: "member",
    status: "active",
    memberId: MEMBER,
    emailVerificationStatus: "verified",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function confirmedLink(overrides: Partial<ExternalAuthorLinkRecord> = {}): ExternalAuthorLinkRecord {
  const now = new Date().toISOString();
  return {
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: AUTHOR,
    memberId: MEMBER,
    state: "linked",
    createdAt: now,
    updatedAt: now,
    confirmedAt: now,
    disconnectedAt: null,
    collaborationStatus: "active",
    linkRevision: 4,
    linkFinalization: "confirmed",
    linkInstanceId: "44444444-4444-4444-8444-444444444444",
    ...overrides,
  };
}
