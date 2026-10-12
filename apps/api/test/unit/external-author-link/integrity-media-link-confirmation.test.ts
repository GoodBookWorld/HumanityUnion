import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, before, after, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";

import cookieParser from "cookie-parser";
import express from "express";

import type { BlogCapabilityGrant } from "@hu/types";

import { resolveAuthConfig } from "../../../src/config/auth.config.js";
import { setAuthUserLookupOverrideForTests } from "../../../src/modules/auth/auth-active-account-gate.js";
import { createAccessToken } from "../../../src/modules/auth/auth-tokens.js";
import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import { ensureBlogAuthorCapability } from "../../../src/modules/blog/blog-author-capability.js";
import {
  canCreateBlogDraft,
  canDirectPublish,
  canEditorialPublish,
} from "../../../src/modules/blog/blog-permissions.js";
import { buildIntegrityMediaReturnUrl } from "../../../src/modules/external-author-link/external-author-link.config.js";
import {
  INTEGRITY_MEDIA_AUTHOR_ACTIVATION_ATTEMPTS,
  INTEGRITY_MEDIA_AUTHOR_ACTIVATION_RECONCILE_BACKOFF_MS,
  INTEGRITY_MEDIA_AUTHOR_ACTIVATION_RECONCILE_INTERVAL_MS,
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV,
  INTEGRITY_MEDIA_LINK_RETURN_PATH_ENV,
  INTEGRITY_MEDIA_SOURCE,
} from "../../../src/modules/external-author-link/external-author-link.constants.js";
import { reconcilePendingIntegrityMediaAuthorActivations } from "../../../src/modules/external-author-link/external-author-link.reconciliation.js";
import {
  startIntegrityMediaAuthorActivationScheduler,
  stopIntegrityMediaAuthorActivationScheduler,
} from "../../../src/modules/external-author-link/external-author-link.scheduler.js";
import {
  buildIntegrityMediaLinkRedeemPayload,
  integrityMediaLinkSignaturesEqual,
  resetIntegrityMediaRedeemReplayCacheForTests,
  signIntegrityMediaLinkRedeem,
} from "../../../src/modules/external-author-link/external-author-link.hmac.js";
import { resolveIntegrityMediaCollaborationStatus } from "../../../src/modules/external-author-link/external-author-link.collaboration.js";
import { EXTERNAL_AUTHOR_LINK_INDEXES } from "../../../src/modules/external-author-link/external-author-link.indexes.js";
import externalAuthorLinkRouter from "../../../src/modules/external-author-link/external-author-link.routes.js";
import {
  confirmIntegrityMediaLink,
  disableIntegrityMediaAuthorLink,
  isIntegrityMediaAuthorLinkOperational,
  recoverProvenIntegrityMediaAuthorLink,
  redeemIntegrityMediaLink,
  setIntegrityMediaAuthorCapabilityEnsurerForTests,
  setIntegrityMediaDisplayNameResolverForTests,
} from "../../../src/modules/external-author-link/external-author-link.service.js";
import {
  createMemoryExternalAuthorLinkStore,
  setExternalAuthorLinkStoreForTests,
  type ExternalAuthorLinkStore,
} from "../../../src/modules/external-author-link/external-author-link.store.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");
const MEMBER_A = "11111111-1111-4111-8111-111111111111";
const MEMBER_B = "22222222-2222-4222-8222-222222222222";
const AUTHOR_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AUTHOR_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DATABASE_MEMBER = "99999999-9999-4999-8999-999999999999";
const SECRET = randomBytes(32).toString("hex");

interface ApiBody {
  success: boolean;
  data: Record<string, unknown> | null;
  meta: { code?: string };
  message: string;
}

let server: Server;
let baseUrl = "";
let store: ExternalAuthorLinkStore;
let grants = new Map<string, BlogCapabilityGrant>();
let grantWrites = 0;
let ensureCalls = 0;
let ensureFailuresRemaining = 0;
let ensureDelayMs = 0;
const blogPosts = [
  { postId: "post-existing", authorParticipantId: MEMBER_A, title: "Existing post" },
];
const authRoles = new Map<string, "member">([
  [MEMBER_A, "member"],
  [MEMBER_B, "member"],
]);

describe("Integrity Media identity confirmation", () => {
  before(async () => {
    setAuthUserLookupOverrideForTests(async () => activeLookupUser());
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
      throw new Error("Failed to bind the confirmation test server.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    setAuthUserLookupOverrideForTests(null);
    setExternalAuthorLinkStoreForTests(null);
    setIntegrityMediaDisplayNameResolverForTests(null);
    setIntegrityMediaAuthorCapabilityEnsurerForTests(null);
    stopIntegrityMediaAuthorActivationScheduler();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    store = createMemoryExternalAuthorLinkStore();
    setExternalAuthorLinkStoreForTests(store);
    resetIntegrityMediaRedeemReplayCacheForTests();
    setIntegrityMediaDisplayNameResolverForTests(async (memberId) => `Profile ${memberId}`);
    grants = new Map();
    grantWrites = 0;
    ensureCalls = 0;
    ensureFailuresRemaining = 0;
    ensureDelayMs = 0;
    installAuthorCapabilityEnsurer();
    process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV] = SECRET;
    process.env[INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV] = "https://integrity.example";
    delete process.env[INTEGRITY_MEDIA_LINK_RETURN_PATH_ENV];
  });

  it("rejects an unauthenticated confirmation", async () => {
    const response = await post("/confirm", { state: attemptState() });

    assert.equal(response.status, 401);
    assert.equal((await store.listResults()).length, 0);
    assert.equal((await store.listLinks()).length, 0);
  });

  it("confirms the member id from the authenticated session", async () => {
    const state = attemptState();
    const response = await post("/confirm", { state }, tokenFor(MEMBER_A));
    const redirectUrl = String(response.body.data?.redirectUrl ?? "");
    const code = new URL(redirectUrl).searchParams.get("code");

    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(response.body.data ?? {}).sort(), ["confirmed", "redirectUrl"]);
    assert.equal(redirectUrl.includes(MEMBER_A), false);
    assert.ok(code);

    const redeemed = await redeem(String(code), AUTHOR_A);

    assert.equal(redeemed.status, 200);
    assert.equal(redeemed.body.data?.memberId, MEMBER_A);
    assert.equal(redeemed.body.data?.memberId === DATABASE_MEMBER, false);
    assert.equal("email" in (redeemed.body.data ?? {}), false);
    assert.equal("userId" in (redeemed.body.data ?? {}), false);
    assert.equal((await store.listLinks())[0]?.memberId, MEMBER_A);
  });

  it("rejects a browser-supplied member id even when it matches the session", async () => {
    const response = await post(
      "/confirm",
      { state: attemptState(), memberId: MEMBER_A },
      tokenFor(MEMBER_A),
    );

    assert.equal(response.status, 400);
    assert.equal(response.body.meta.code, "browser_member_id");
    assert.equal((await store.listResults()).length, 0);
  });

  it("rejects an arbitrary return origin from the browser", async () => {
    const bodyResponse = await post(
      "/confirm",
      { state: attemptState(), returnUrl: "https://evil.example/steal" },
      tokenFor(MEMBER_A),
    );
    const queryResponse = await post(
      "/confirm?returnUrl=https://evil.example/steal",
      { state: attemptState() },
      tokenFor(MEMBER_A),
    );
    const allowed = await post("/confirm", { state: attemptState() }, tokenFor(MEMBER_A));
    const redirectUrl = String(allowed.body.data?.redirectUrl ?? "");

    assert.equal(bodyResponse.status, 400);
    assert.equal(bodyResponse.body.meta.code, "return_origin_rejected");
    assert.equal(queryResponse.status, 400);
    assert.equal(redirectUrl.startsWith("https://integrity.example/"), true);
    assert.equal(redirectUrl.includes("evil.example"), false);
    assert.equal(
      buildIntegrityMediaReturnUrl({
        status: "confirmed",
        attemptState: attemptState(),
        resultCode: "a".repeat(43),
        config: {
          hmacSecret: null,
          returnOrigin: "javascript://integrity.example",
          returnPath: "/api/author/humanity-union-link/complete",
        },
      }),
      null,
    );
    assert.equal(
      buildIntegrityMediaReturnUrl({
        status: "confirmed",
        attemptState: attemptState(),
        resultCode: "a".repeat(43),
        nodeEnv: "production",
        config: {
          hmacSecret: null,
          returnOrigin: "http://integrity.example",
          returnPath: "/api/author/humanity-union-link/complete",
        },
      }),
      null,
    );
    assert.equal(
      buildIntegrityMediaReturnUrl({
        status: "confirmed",
        attemptState: attemptState(),
        resultCode: "a".repeat(43),
        config: {
          hmacSecret: null,
          returnOrigin: "https://integrity.example",
          returnPath: "//evil.example",
        },
      }),
      null,
    );
  });

  it("rejects an expired result and leaves no durable link", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const confirmed = await confirmIntegrityMediaLink({
      memberId: MEMBER_A,
      attemptState: attemptState(),
      now: createdAt,
    });
    assert.equal(confirmed.ok, true);
    if (!confirmed.ok) {
      return;
    }

    const redeemAt = new Date(createdAt.getTime() + 6 * 60 * 1000);
    const redeemed = await redeemAtTime(confirmed.resultCode, AUTHOR_A, redeemAt);

    assert.equal(redeemed.ok, false);
    if (redeemed.ok) {
      return;
    }
    assert.equal(redeemed.code, "result_expired");
    assert.equal((await store.listLinks()).length, 0);
    assert.equal(
      (await store.listAudits()).some((event) => event.action === "link_expired"),
      true,
    );
  });

  it("accepts a result code only once", async () => {
    const code = await confirmCode(MEMBER_A);
    const first = await redeem(code, AUTHOR_A);
    const timestamp = String(Math.floor(Date.now() / 1000) + 1);
    const second = await redeem(code, AUTHOR_A, { timestamp });

    assert.equal(first.status, 200);
    assert.equal(second.status, 409);
    assert.equal(second.body.meta.code, "result_already_used");
    assert.equal((await store.listLinks()).length, 1);
  });

  it("rejects an invalid HMAC without consuming the result", async () => {
    const code = await confirmCode(MEMBER_A);
    const invalid = await redeem(code, AUTHOR_A, { signature: "a".repeat(64) });
    const valid = await redeem(code, AUTHOR_A);

    assert.equal(invalid.status, 401);
    assert.equal(invalid.body.meta.code, "invalid_signature");
    assert.equal(valid.status, 200);
    assert.equal(integrityMediaLinkSignaturesEqual("ab", "abcd"), false);
  });

  it("rejects a stale timestamp without consuming the result", async () => {
    const code = await confirmCode(MEMBER_A);
    const stale = String(Math.floor(Date.now() / 1000) - 301);
    const rejected = await redeem(code, AUTHOR_A, { timestamp: stale });
    const accepted = await redeem(code, AUTHOR_A);

    assert.equal(rejected.status, 401);
    assert.equal(rejected.body.meta.code, "stale_timestamp");
    assert.equal(accepted.status, 200);
  });

  it("rejects a replay of the same signed request", async () => {
    const code = await confirmCode(MEMBER_A);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const payload = buildIntegrityMediaLinkRedeemPayload({
      timestamp,
      resultCode: code,
      externalAuthorId: AUTHOR_A,
    });
    const signature = signIntegrityMediaLinkRedeem(SECRET, payload);
    const first = await redeem(code, AUTHOR_A, { timestamp, signature });
    const replay = await redeem(code, AUTHOR_A, { timestamp, signature });

    assert.equal(first.status, 200);
    assert.equal(replay.status, 401);
    assert.equal(replay.body.meta.code, "replayed");
  });

  it("refuses to link one external author to two Humanity Union members", async () => {
    await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    const before = await store.listLinks();
    const conflict = await redeem(await confirmCode(MEMBER_B), AUTHOR_A);
    const after = await store.listLinks();

    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.meta.code, "external_author_already_linked");
    assert.equal(after.length, 1);
    assert.equal(after[0]?.memberId, MEMBER_A);
    assert.equal(after[0]?.externalAuthorId, before[0]?.externalAuthorId);
    assert.equal(after[0]?.confirmedAt, before[0]?.confirmedAt);
    assert.equal(after[0]?.memberId === MEMBER_B, false);
  });

  it("refuses to link one Humanity Union member to two external authors", async () => {
    await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    const before = await store.listLinks();
    const conflict = await redeem(await confirmCode(MEMBER_A), AUTHOR_B);
    const after = await store.listLinks();

    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.meta.code, "member_already_linked");
    assert.equal(after.length, 1);
    assert.equal(after[0]?.externalAuthorId, AUTHOR_A);
    assert.equal(after[0]?.memberId, before[0]?.memberId);
    assert.equal(after[0]?.confirmedAt, before[0]?.confirmedAt);
  });

  it("does not link accounts by email, name, or profile similarity", async () => {
    const rejected = await post(
      "/redeem",
      {
        resultCode: "a".repeat(43),
        externalAuthorId: AUTHOR_A,
        email: "shared-name@example.com",
        displayName: "Ada Lovelace",
        photo: "https://example.test/a.png",
      },
      undefined,
      signedHeaders("a".repeat(43), AUTHOR_A),
    );

    assert.equal(rejected.status, 400);
    assert.equal((await store.listLinks()).length, 0);

    const first = await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    const second = await redeem(await confirmCode(MEMBER_B), AUTHOR_B);
    const links = await store.listLinks();

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(links.length, 2);
    assert.equal(links[0]?.memberId === links[1]?.memberId, false);
  });

  it("uses a separate signature purpose and keeps an unconfigured secret dormant", async () => {
    const code = await confirmCode(MEMBER_A);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const publishSignature = signIntegrityMediaLinkRedeem(
      SECRET,
      buildIntegrityMediaLinkRedeemPayload({
        timestamp,
        resultCode: code,
        externalAuthorId: AUTHOR_A,
        purpose: "integrity-media-publish",
      }),
    );
    const wrongPurpose = await redeem(code, AUTHOR_A, { timestamp, signature: publishSignature });

    delete process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV];
    const unconfigured = await redeem(code, AUTHOR_A);

    process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV] = SECRET;
    const redeemed = await redeem(code, AUTHOR_A);

    assert.equal(wrongPurpose.status, 401);
    assert.equal(wrongPurpose.body.meta.code, "invalid_signature");
    assert.equal(unconfigured.status, 503);
    assert.equal(unconfigured.body.meta.code, "link_redeem_not_configured");
    assert.equal(redeemed.status, 200);
  });

  it("disables a link without forgetting the proven member", async () => {
    await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    const disabled = await disableIntegrityMediaAuthorLink(AUTHOR_A);
    const links = await store.listLinks();

    assert.equal(disabled, "disabled");
    assert.equal(links.length, 1);
    assert.equal(links[0]?.state, "disabled");
    assert.equal(links[0]?.memberId, MEMBER_A);
    assert.equal(links[0]?.externalAuthorId, AUTHOR_A);
    assert.ok(links[0]?.disconnectedAt);

    const reconnect = await redeem(await confirmCode(MEMBER_A), AUTHOR_A);

    assert.equal(reconnect.status, 200);
    assert.equal(reconnect.body.data?.reconnected, true);
    assert.equal((await store.listLinks())[0]?.state, "linked");
    assert.equal((await store.listLinks())[0]?.memberId, MEMBER_A);
    assert.equal((await store.listLinks()).length, 1);
  });

  it("initializes a new link as an active collaboration", async () => {
    const redeemed = await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    const link = (await store.listLinks())[0];

    assert.equal(redeemed.status, 200);
    assert.equal(link?.state, "linked");
    assert.equal(link?.collaborationStatus, "active");
    assert.equal(link?.memberId, MEMBER_A);
    assert.equal(link?.externalAuthorId, AUTHOR_A);
    assert.equal(
      EXTERNAL_AUTHOR_LINK_INDEXES.some((index) =>
        Object.keys(index.key ?? {}).includes("collaborationStatus"),
      ),
      false,
    );
  });

  it("keeps an active collaboration active across reconnect", async () => {
    await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    assert.equal((await store.listLinks())[0]?.collaborationStatus, "active");

    const again = await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    assert.equal(again.body.data?.reconnected, false);
    assert.equal((await store.listLinks())[0]?.collaborationStatus, "active");

    await disableIntegrityMediaAuthorLink(AUTHOR_A);
    const reconnect = await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    const link = (await store.listLinks())[0];

    assert.equal(reconnect.body.data?.reconnected, true);
    assert.equal(link?.state, "linked");
    assert.equal(link?.collaborationStatus, "active");
    assert.equal(link?.memberId, MEMBER_A);
    assert.equal(link?.externalAuthorId, AUTHOR_A);
  });

  it("does not clear a blocked collaboration on redeem or reconnect", async () => {
    await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    await setStoredCollaborationStatus(AUTHOR_A, "blocked");

    const again = await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    assert.equal(again.body.data?.reconnected, false);
    assert.equal((await store.listLinks())[0]?.collaborationStatus, "blocked");
    assert.equal((await store.listLinks())[0]?.state, "linked");

    await disableIntegrityMediaAuthorLink(AUTHOR_A);
    const reconnect = await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    const link = (await store.listLinks())[0];

    assert.equal(reconnect.body.data?.reconnected, true);
    assert.equal(link?.state, "linked");
    assert.equal(link?.collaborationStatus, "blocked");
    assert.equal(link?.memberId, MEMBER_A);
    assert.equal(link?.externalAuthorId, AUTHOR_A);
    assert.equal(resolveIntegrityMediaCollaborationStatus(link!), "blocked");
  });

  it("does not clear an archived collaboration on redeem or reconnect", async () => {
    await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    await setStoredCollaborationStatus(AUTHOR_A, "archived");

    const again = await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    assert.equal(again.body.data?.reconnected, false);
    assert.equal((await store.listLinks())[0]?.collaborationStatus, "archived");

    await disableIntegrityMediaAuthorLink(AUTHOR_A);
    const reconnect = await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    const link = (await store.listLinks())[0];

    assert.equal(reconnect.body.data?.reconnected, true);
    assert.equal(link?.state, "linked");
    assert.equal(link?.collaborationStatus, "archived");
    assert.equal(link?.memberId, MEMBER_A);
    assert.equal(link?.externalAuthorId, AUTHOR_A);
    assert.equal(resolveIntegrityMediaCollaborationStatus(link!), "archived");
  });

  it("normalizes a legacy reconnect that has no collaborationStatus to active", async () => {
    await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    await setStoredCollaborationStatus(AUTHOR_A, undefined);
    assert.equal((await store.listLinks())[0]?.collaborationStatus, undefined);
    assert.equal(
      resolveIntegrityMediaCollaborationStatus((await store.listLinks())[0]!),
      "active",
    );

    await disableIntegrityMediaAuthorLink(AUTHOR_A);
    const reconnect = await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    const link = (await store.listLinks())[0];

    assert.equal(reconnect.body.data?.reconnected, true);
    assert.equal(link?.state, "linked");
    assert.equal(link?.collaborationStatus, "active");
    assert.equal(link?.memberId, MEMBER_A);
  });

  it("shows the profile display name and records audit events without secrets", async () => {
    const state = attemptState();
    const preview = await get(`/preview?state=${state}`, tokenFor(MEMBER_A));
    const confirmed = await post("/confirm", { state }, tokenFor(MEMBER_A));
    const code = new URL(String(confirmed.body.data?.redirectUrl)).searchParams.get("code") ?? "";
    const redeemed = await redeem(code, AUTHOR_A);
    const serialized = JSON.stringify(await store.listAudits());

    assert.equal(preview.status, 200);
    assert.equal(preview.body.data?.displayName, `Profile ${MEMBER_A}`);
    assert.equal(preview.body.data?.displayName === "Ada Lovelace", false);
    assert.equal(redeemed.status, 200);
    assert.equal(serialized.includes(SECRET), false);
    assert.equal(serialized.includes(code), false);
    assert.equal(serialized.includes(state), false);
    assert.equal(serialized.includes("link_confirmation_created"), true);
    assert.equal(serialized.includes("result_redeemed"), true);
  });

  it("authenticates the browser confirmation with the access cookie", async () => {
    const cookieName = resolveAuthConfig().accessCookieName;
    const response = await post("/confirm", { state: attemptState() }, undefined, {
      cookie: `${cookieName}=${tokenFor(MEMBER_B)}`,
    });
    const code = new URL(String(response.body.data?.redirectUrl)).searchParams.get("code") ?? "";
    const redeemed = await redeem(code, AUTHOR_B);

    assert.equal(response.status, 200);
    assert.equal(redeemed.body.data?.memberId, MEMBER_B);
  });

  it("keeps the durable identity indexes unique for both sides of the mapping", () => {
    const names = EXTERNAL_AUTHOR_LINK_INDEXES.map((index) => index.name);

    assert.deepEqual(names, [
      "external_author_links_source_author_unique",
      "external_author_links_source_member_unique",
    ]);
    assert.equal(
      EXTERNAL_AUTHOR_LINK_INDEXES.every((index) => index.unique === true),
      true,
    );
    assert.deepEqual(EXTERNAL_AUTHOR_LINK_INDEXES[0]?.key, { source: 1, externalAuthorId: 1 });
    assert.deepEqual(EXTERNAL_AUTHOR_LINK_INDEXES[1]?.key, { source: 1, memberId: 1 });
  });

  it("leaves login, registration, blog, localization, search, and video chat unchanged", () => {
    const authService = readRepo("apps/api/src/modules/auth/auth.service.ts");
    const loginForm = readRepo("apps/web/src/features/auth/components/LoginForm.tsx");
    const registerForm = readRepo("apps/web/src/features/auth/components/RegisterForm.tsx");
    const returnTo = readRepo("apps/web/src/features/auth/lib/resolve-safe-return-to.ts");
    const productionEnv = readRepo("apps/api/src/config/validate-production-environment.ts");
    const example = readRepo("apps/api/.env.example");
    const app = readRepo("apps/api/src/app.ts");
    const linkSource = [
      "external-author-link.routes.ts",
      "external-author-link.service.ts",
      "external-author-link.store.ts",
    ]
      .map((file) => readRepo(`apps/api/src/modules/external-author-link/${file}`))
      .join("\n");

    assert.match(authService, /const memberId = randomUUID\(\);/);
    assert.equal(authService.includes("INTEGRITY_MEDIA"), false);
    assert.match(loginForm, /resolveSafeReturnTo/);
    assert.equal(loginForm.includes("integrity-media"), false);
    assert.match(registerForm, /router\.push\("\/confirm-email"\)/);
    assert.equal(registerForm.includes("connect/integrity-media"), false);
    assert.match(returnTo, /!value\.startsWith\("\/"\)/);
    assert.equal(productionEnv.includes("INTEGRITY_MEDIA"), false);
    assert.match(example, /^# INTEGRITY_MEDIA_LINK_HMAC_SECRET=$/m);
    assert.doesNotMatch(example, /^INTEGRITY_MEDIA_LINK_HMAC_SECRET=.+/m);
    assert.match(app, /app\.use\("\/api\/v1\/blog", blogRouter\)/);
    assert.equal(
      readRepo("apps/api/src/modules/blog/blog.routes.ts").includes("integrity-media"),
      false,
    );
    assert.equal(
      readRepo("apps/api/src/modules/language/language.routes.ts").includes("integrity-media"),
      false,
    );
    assert.equal(readRepo("apps/web/src/lib/seo/index.ts").includes("integrity-media"), false);
    assert.equal(
      readRepo("apps/api/src/modules/direct-conversation-calls/index.ts").includes(
        "integrity-media",
      ),
      false,
    );
    assert.equal(linkSource.includes("registerAuthUser"), false);
    assert.equal(linkSource.includes("blog.routes"), false);
    assert.equal(INTEGRITY_MEDIA_SOURCE, "integrity-media");
    assert.equal(
      readRepo("apps/api/src/modules/blog/blog-author-capability.ts").includes("AuthRole"),
      false,
    );
    assert.equal(
      readRepo("apps/api/src/modules/language/content-translation-validity.ts").includes(
        "ensureBlogAuthorCapability",
      ),
      false,
    );
    assert.equal(
      readRepo("apps/api/src/modules/global-search/global-search.index.ts").includes(
        "ensureBlogAuthorCapability",
      ),
      false,
    );
    assert.equal(
      readRepo("apps/web/src/lib/seo/sitemap/providers/blog-posts.ts").includes(
        "integrity-media",
      ),
      false,
    );
    assert.equal(
      readRepo("apps/api/src/modules/direct-conversation-calls/index.ts").includes(
        "ensureBlogAuthorCapability",
      ),
      false,
    );
    assert.equal(
      readRepo(
        "apps/api/src/modules/external-author-link/external-author-link.routes.ts",
      ).includes("recoverProvenIntegrityMediaAuthorLink"),
      false,
    );
    assert.match(
      readRepo("apps/api/src/index.ts"),
      /startIntegrityMediaAuthorActivationScheduler\(\)/,
    );
    assert.match(
      readRepo("apps/api/src/modules/external-author-link/external-author-link.scheduler.ts"),
      /setInterval/,
    );
    assert.match(
      readRepo("apps/api/src/modules/external-author-link/external-author-link.reconciliation.ts"),
      /recoverProvenIntegrityMediaAuthorLink/,
    );
    assert.equal(
      readRepo("apps/api/src/modules/external-author-link/external-author-link.scheduler.ts").includes(
        "console.",
      ),
      false,
    );
    assert.ok(INTEGRITY_MEDIA_AUTHOR_ACTIVATION_RECONCILE_INTERVAL_MS >= 60_000);
  });

  it("establishes the durable link and Blog author capability on first redemption", async () => {
    const postsBefore = structuredClone(blogPosts);
    const redeemed = await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    const grant = grants.get(MEMBER_A);
    const link = (await store.listLinks())[0];

    assert.equal(redeemed.status, 200);
    assert.equal(redeemed.body.success, true);
    assert.equal(link?.state, "linked");
    assert.equal(link?.memberId, MEMBER_A);
    assert.equal(link?.externalAuthorId, AUTHOR_A);
    assert.deepEqual(grant?.capabilities, ["author"]);
    assert.equal(grantWrites, 1);
    assert.deepEqual(blogPosts, postsBefore);
    assert.equal(
      (await store.listAudits()).filter((event) => event.action === "author_capability_ensured")
        .length,
      1,
    );
  });

  it("does not grant Blog author from Confirm before trusted redemption", async () => {
    await confirmCode(MEMBER_A);

    assert.equal((await store.listLinks()).length, 0);
    assert.equal(grants.size, 0);
    assert.equal(grantWrites, 0);
    assert.equal(
      (await store.listAudits()).some((event) => event.action === "author_capability_ensured"),
      false,
    );
  });

  it("gives an ordinary member only Blog author and no stronger publishing power", async () => {
    await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    const grant = grants.get(MEMBER_A);
    const capabilities = new Set(grant?.capabilities ?? []);

    assert.deepEqual(grant?.capabilities, ["author"]);
    assert.equal(grant?.publishWithoutManualReview, undefined);
    assert.equal(canCreateBlogDraft(capabilities), true);
    assert.equal(canDirectPublish(capabilities), false);
    assert.equal(canEditorialPublish(capabilities), false);
    assert.equal(publishingWorkspaceHref(grant), "/workspace/publishing");
    assert.equal(authRoles.get(MEMBER_A), "member");
    assert.equal(capabilities.has("trusted_author"), false);
    assert.equal(capabilities.has("editor"), false);
    assert.equal(capabilities.has("administrator"), false);
  });

  it("preserves an existing stronger Blog grant without a second write", async () => {
    const existing: BlogCapabilityGrant = {
      participantId: MEMBER_A,
      capabilities: ["editor"],
      updatedAt: "2026-01-01T00:00:00.000Z",
      publishWithoutManualReview: true,
      grantedByParticipantId: "33333333-3333-4333-8333-333333333333",
    };
    grants.set(MEMBER_A, existing);

    const redeemed = await redeem(await confirmCode(MEMBER_A), AUTHOR_A);

    assert.equal(redeemed.status, 200);
    assert.equal(grants.get(MEMBER_A), existing);
    assert.deepEqual(grants.get(MEMBER_A)?.capabilities, ["editor"]);
    assert.equal(grants.get(MEMBER_A)?.publishWithoutManualReview, true);
    assert.equal(grantWrites, 0);
    assert.equal(
      (await store.listAudits()).some((event) => event.action === "author_capability_ensured"),
      false,
    );
    assert.equal(canDirectPublish(new Set(existing.capabilities)), true);
  });

  it("repeats redemption and reconnect without another grant or identity change", async () => {
    const postsBefore = structuredClone(blogPosts);
    await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    const firstLink = (await store.listLinks())[0];
    const again = await redeem(await confirmCode(MEMBER_A), AUTHOR_A);

    assert.equal(again.status, 200);
    assert.equal(again.body.data?.reconnected, false);
    assert.equal(grantWrites, 1);
    assert.equal(grants.size, 1);
    assert.deepEqual(grants.get(MEMBER_A)?.capabilities, ["author"]);

    const disabled = await disableIntegrityMediaAuthorLink(AUTHOR_A);
    const reconnect = await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    const link = (await store.listLinks())[0];

    assert.equal(disabled, "disabled");
    assert.equal(reconnect.status, 200);
    assert.equal(reconnect.body.data?.reconnected, true);
    assert.equal(link?.memberId, firstLink?.memberId);
    assert.equal(link?.externalAuthorId, firstLink?.externalAuthorId);
    assert.equal(link?.state, "linked");
    assert.equal(grantWrites, 1);
    assert.deepEqual(grants.get(MEMBER_A)?.capabilities, ["author"]);
    assert.deepEqual(blogPosts, postsBefore);
    assert.equal(
      (await store.listAudits()).filter((event) => event.action === "author_capability_ensured")
        .length,
      1,
    );
  });

  it("keeps a different-member conflict from granting or remapping", async () => {
    await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    const conflict = await redeem(await confirmCode(MEMBER_B), AUTHOR_A);

    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.meta.code, "external_author_already_linked");
    assert.equal(conflict.body.success, false);
    assert.equal(grants.has(MEMBER_B), false);
    assert.deepEqual(grants.get(MEMBER_A)?.capabilities, ["author"]);
    assert.equal((await store.listLinks())[0]?.memberId, MEMBER_A);
  });

  it("finishes author setup after one transient failure without another Confirm", async () => {
    ensureFailuresRemaining = 1;
    const postsBefore = structuredClone(blogPosts);
    const code = await confirmCode(MEMBER_A);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const payload = buildIntegrityMediaLinkRedeemPayload({
      timestamp,
      resultCode: code,
      externalAuthorId: AUTHOR_A,
    });
    const signature = signIntegrityMediaLinkRedeem(SECRET, payload);
    const redeemed = await redeem(code, AUTHOR_A, { timestamp, signature });
    const replay = await redeem(code, AUTHOR_A, { timestamp, signature });
    const reusedResult = await redeem(code, AUTHOR_A, {
      timestamp: String(Number(timestamp) + 1),
    });
    const link = (await store.listLinks())[0];

    assert.equal((await store.listResults()).length, 1);
    assert.equal(redeemed.status, 200);
    assert.equal(redeemed.body.success, true);
    assert.equal(link?.memberId, MEMBER_A);
    assert.equal(link?.externalAuthorId, AUTHOR_A);
    assert.equal(link?.authorActivationPending === true, false);
    assert.deepEqual(grants.get(MEMBER_A)?.capabilities, ["author"]);
    assert.equal(grantWrites, 1);
    assert.equal((await store.listLinks()).length, 1);
    assert.equal(replay.status, 401);
    assert.equal(replay.body.meta.code, "replayed");
    assert.equal(reusedResult.status, 409);
    assert.equal(reusedResult.body.meta.code, "result_already_used");
    assert.equal(publishingWorkspaceHref(grants.get(MEMBER_A)), "/workspace/publishing");
    assert.equal(canDirectPublish(new Set(grants.get(MEMBER_A)?.capabilities ?? [])), false);
    assert.equal(canEditorialPublish(new Set(grants.get(MEMBER_A)?.capabilities ?? [])), false);
    assert.deepEqual(blogPosts, postsBefore);
    assert.equal(authRoles.get(MEMBER_A), "member");
    assert.equal(
      (await store.listAudits()).filter((event) => event.action === "author_capability_ensured")
        .length,
      1,
    );
    assert.equal(
      (await store.listAudits()).some((event) => event.action === "author_capability_failed"),
      false,
    );
  });

  it("finishes a pending proven pair without a new confirmation result", async () => {
    ensureFailuresRemaining = INTEGRITY_MEDIA_AUTHOR_ACTIVATION_ATTEMPTS;
    const postsBefore = structuredClone(blogPosts);
    const code = await confirmCode(MEMBER_A);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const payload = buildIntegrityMediaLinkRedeemPayload({
      timestamp,
      resultCode: code,
      externalAuthorId: AUTHOR_A,
    });
    const signature = signIntegrityMediaLinkRedeem(SECRET, payload);
    const pending = await redeem(code, AUTHOR_A, { timestamp, signature });
    const pendingAudits = await store.listAudits();
    const pendingSerialized = JSON.stringify(pendingAudits);
    const tampered = await redeem(code, AUTHOR_A, { timestamp, signature: "0".repeat(64) });
    const replay = await redeem(code, AUTHOR_A, { timestamp, signature });
    const reusedResult = await redeem(code, AUTHOR_A, {
      timestamp: String(Number(timestamp) + 1),
    });

    assert.equal(pending.status, 503);
    assert.equal(pending.body.success, false);
    assert.equal(pending.body.meta.code, "author_setup_pending");
    assert.equal(grants.size, 0);
    assert.equal((await store.listLinks()).length, 1);
    assert.equal((await store.listLinks())[0]?.authorActivationPending, true);
    assert.equal((await store.listLinks())[0]?.memberId, MEMBER_A);
    assert.equal((await store.listLinks())[0]?.externalAuthorId, AUTHOR_A);
    assert.equal((await store.listResults()).length, 1);
    assert.equal(
      pendingAudits.filter((event) => event.action === "author_capability_failed").length,
      1,
    );
    assert.equal(
      pendingAudits.filter((event) => event.action === "author_activation_pending").length,
      1,
    );
    assert.equal(
      pendingAudits.some((event) => event.action === "result_redeemed"),
      false,
    );
    assert.equal(pendingSerialized.includes(code), false);
    assert.equal(pendingSerialized.includes(SECRET), false);
    assert.equal(pendingSerialized.includes(signature), false);
    assert.equal(pendingSerialized.includes("author capability store unavailable"), false);
    assert.equal(tampered.status, 401);
    assert.equal(tampered.body.meta.code, "invalid_signature");
    assert.equal(replay.status, 401);
    assert.equal(replay.body.meta.code, "replayed");
    assert.equal(reusedResult.status, 409);
    assert.equal(reusedResult.body.meta.code, "result_already_used");
    assert.equal(grants.size, 0);

    const recovered = await recoverProvenIntegrityMediaAuthorLink({
      externalAuthorId: AUTHOR_A,
    });
    const again = await recoverProvenIntegrityMediaAuthorLink({
      externalAuthorId: AUTHOR_A,
    });
    const link = (await store.listLinks())[0];
    const audits = await store.listAudits();

    assert.equal(recovered.ok, true);
    assert.equal(again.ok, true);
    assert.equal(link?.memberId, MEMBER_A);
    assert.equal(link?.externalAuthorId, AUTHOR_A);
    assert.equal(link?.state, "linked");
    assert.equal(link?.authorActivationPending, false);
    assert.deepEqual(grants.get(MEMBER_A)?.capabilities, ["author"]);
    assert.equal(grants.get(MEMBER_A)?.publishWithoutManualReview, undefined);
    assert.equal(grantWrites, 1);
    assert.equal((await store.listLinks()).length, 1);
    assert.equal((await store.listResults()).length, 1);
    assert.equal(audits.filter((event) => event.action === "author_capability_ensured").length, 1);
    assert.equal(
      audits.filter((event) => event.action === "author_capability_recovered").length,
      1,
    );
    assert.equal(publishingWorkspaceHref(grants.get(MEMBER_A)), "/workspace/publishing");
    assert.equal(canDirectPublish(new Set(grants.get(MEMBER_A)?.capabilities ?? [])), false);
    assert.equal(canEditorialPublish(new Set(grants.get(MEMBER_A)?.capabilities ?? [])), false);
    assert.deepEqual(blogPosts, postsBefore);
    assert.equal(authRoles.get(MEMBER_A), "member");
    assert.equal(JSON.stringify(audits).includes(code), false);
    assert.equal(JSON.stringify(audits).includes(signature), false);
  });

  it("does not report success while automatic author recovery is still pending", async () => {
    ensureFailuresRemaining = INTEGRITY_MEDIA_AUTHOR_ACTIVATION_ATTEMPTS * 2;
    const pending = await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    const recovered = await recoverProvenIntegrityMediaAuthorLink({
      externalAuthorId: AUTHOR_A,
    });
    const audits = await store.listAudits();

    assert.equal(pending.status, 503);
    assert.equal(pending.body.success, false);
    assert.equal(pending.body.meta.code, "author_setup_pending");
    assert.equal(recovered.ok, false);
    if (!recovered.ok) {
      assert.equal(recovered.status, 503);
      assert.equal(recovered.code, "author_setup_pending");
    }
    assert.equal(grants.size, 0);
    assert.equal((await store.listLinks()).length, 1);
    assert.equal((await store.listLinks())[0]?.authorActivationPending, true);
    assert.equal((await store.listLinks())[0]?.memberId, MEMBER_A);
    assert.equal(audits.filter((event) => event.action === "author_capability_failed").length, 2);
    assert.equal(audits.filter((event) => event.action === "author_activation_pending").length, 1);
    assert.equal(audits.some((event) => event.action === "result_redeemed"), false);
    assert.equal(audits.some((event) => event.action === "author_capability_recovered"), false);
    assert.equal(audits.some((event) => event.action === "author_capability_ensured"), false);
  });

  it("recovers two transient author-setup failures inside the original redemption", async () => {
    ensureFailuresRemaining = 2;
    const redeemed = await redeem(await confirmCode(MEMBER_A), AUTHOR_A);

    assert.equal(redeemed.status, 200);
    assert.equal(redeemed.body.success, true);
    assert.equal(ensureCalls, 3);
    assert.equal(grantWrites, 1);
    assert.deepEqual(grants.get(MEMBER_A)?.capabilities, ["author"]);
    assert.equal((await store.listLinks())[0]?.authorActivationPending === true, false);
  });

  it("finishes durable pending activation from reconciliation without another Confirm", async () => {
    ensureFailuresRemaining = INTEGRITY_MEDIA_AUTHOR_ACTIVATION_ATTEMPTS;
    const postsBefore = structuredClone(blogPosts);
    const code = await confirmCode(MEMBER_A);
    const pending = await redeem(code, AUTHOR_A);
    const pair = (await store.listLinks())[0];
    const tooSoon = await reconcilePendingIntegrityMediaAuthorActivations({
      now: new Date(),
    });

    assert.equal(pending.status, 503);
    assert.equal(pending.body.meta.code, "author_setup_pending");
    assert.equal(isIntegrityMediaAuthorLinkOperational(pair!), false);
    assert.equal(tooSoon.examined, 0);
    assert.equal(grants.size, 0);
    assert.equal((await store.listResults()).length, 1);

    const later = new Date(Date.now() + INTEGRITY_MEDIA_AUTHOR_ACTIVATION_RECONCILE_BACKOFF_MS + 1000);
    const recovered = await reconcilePendingIntegrityMediaAuthorActivations({ now: later });
    const repeated = await reconcilePendingIntegrityMediaAuthorActivations({
      now: new Date(later.getTime() + INTEGRITY_MEDIA_AUTHOR_ACTIVATION_RECONCILE_BACKOFF_MS + 1000),
    });
    const link = (await store.listLinks())[0];
    const audits = await store.listAudits();

    assert.equal(recovered.examined, 1);
    assert.equal(recovered.recovered, 1);
    assert.equal(repeated.examined, 0);
    assert.equal(link?.memberId, pair?.memberId);
    assert.equal(link?.externalAuthorId, pair?.externalAuthorId);
    assert.equal(link?.authorActivationPending, false);
    assert.equal(isIntegrityMediaAuthorLinkOperational(link!), true);
    assert.deepEqual(grants.get(MEMBER_A)?.capabilities, ["author"]);
    assert.equal(grants.get(MEMBER_A)?.publishWithoutManualReview, undefined);
    assert.equal(grantWrites, 1);
    assert.equal((await store.listLinks()).length, 1);
    assert.equal((await store.listResults()).length, 1);
    assert.equal(audits.filter((event) => event.action === "author_capability_recovered").length, 1);
    assert.equal(audits.filter((event) => event.action === "author_capability_ensured").length, 1);
    assert.equal(canDirectPublish(new Set(grants.get(MEMBER_A)?.capabilities ?? [])), false);
    assert.equal(publishingWorkspaceHref(grants.get(MEMBER_A)), "/workspace/publishing");
    assert.deepEqual(blogPosts, postsBefore);
    assert.equal(authRoles.get(MEMBER_A), "member");
    assert.equal(JSON.stringify(audits).includes(code), false);
    assert.equal(JSON.stringify(audits).includes(SECRET), false);
  });

  it("leaves a failed reconciliation pending for a later automatic attempt", async () => {
    ensureFailuresRemaining = INTEGRITY_MEDIA_AUTHOR_ACTIVATION_ATTEMPTS * 2;
    await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    const later = new Date(Date.now() + INTEGRITY_MEDIA_AUTHOR_ACTIVATION_RECONCILE_BACKOFF_MS + 1000);
    const failed = await reconcilePendingIntegrityMediaAuthorActivations({ now: later });
    const immediate = await reconcilePendingIntegrityMediaAuthorActivations({ now: later });

    assert.equal(failed.examined, 1);
    assert.equal(failed.recovered, 0);
    assert.equal(failed.pending, 1);
    assert.equal(immediate.examined, 0);
    assert.equal(grants.size, 0);
    assert.equal((await store.listLinks())[0]?.authorActivationPending, true);
    assert.equal((await store.listLinks())[0]?.memberId, MEMBER_A);
    assert.equal(
      (await store.listAudits()).some((event) => event.action === "author_capability_recovered"),
      false,
    );

    const afterward = new Date(later.getTime() + INTEGRITY_MEDIA_AUTHOR_ACTIVATION_RECONCILE_BACKOFF_MS + 1000);
    const recovered = await reconcilePendingIntegrityMediaAuthorActivations({ now: afterward });

    assert.equal(recovered.recovered, 1);
    assert.equal(grantWrites, 1);
    assert.deepEqual(grants.get(MEMBER_A)?.capabilities, ["author"]);
    assert.equal((await store.listLinks())[0]?.authorActivationPending, false);
    assert.equal((await store.listLinks()).length, 1);
  });

  it("lets only one overlapping reconciliation write the author grant", async () => {
    ensureFailuresRemaining = INTEGRITY_MEDIA_AUTHOR_ACTIVATION_ATTEMPTS;
    await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    ensureDelayMs = 40;
    const later = new Date(Date.now() + INTEGRITY_MEDIA_AUTHOR_ACTIVATION_RECONCILE_BACKOFF_MS + 1000);
    const [first, second] = await Promise.all([
      reconcilePendingIntegrityMediaAuthorActivations({ now: later }),
      reconcilePendingIntegrityMediaAuthorActivations({ now: later }),
    ]);

    assert.equal(first.examined + second.examined, 1);
    assert.equal(first.recovered + second.recovered, 1);
    assert.equal(grantWrites, 1);
    assert.equal((await store.listLinks()).length, 1);
    assert.deepEqual(grants.get(MEMBER_A)?.capabilities, ["author"]);
    assert.equal((await store.listLinks())[0]?.memberId, MEMBER_A);
  });

  it("does not activate a disconnected pending link and resumes on reconnect", async () => {
    ensureFailuresRemaining = INTEGRITY_MEDIA_AUTHOR_ACTIVATION_ATTEMPTS;
    const postsBefore = structuredClone(blogPosts);
    await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    const disabled = await disableIntegrityMediaAuthorLink(AUTHOR_A);
    const later = new Date(Date.now() + INTEGRITY_MEDIA_AUTHOR_ACTIVATION_RECONCILE_BACKOFF_MS + 1000);
    const skipped = await reconcilePendingIntegrityMediaAuthorActivations({ now: later });

    assert.equal(disabled, "disabled");
    assert.equal(skipped.examined, 0);
    assert.equal(grants.size, 0);
    assert.equal((await store.listLinks())[0]?.state, "disabled");
    assert.equal((await store.listLinks())[0]?.authorActivationPending, true);
    assert.equal((await store.listLinks())[0]?.memberId, MEMBER_A);
    assert.deepEqual(blogPosts, postsBefore);

    const reconnect = await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    const link = (await store.listLinks())[0];

    assert.equal(reconnect.status, 200);
    assert.equal(reconnect.body.data?.reconnected, true);
    assert.equal(link?.state, "linked");
    assert.equal(link?.memberId, MEMBER_A);
    assert.equal(link?.externalAuthorId, AUTHOR_A);
    assert.equal(link?.authorActivationPending, false);
    assert.equal(isIntegrityMediaAuthorLinkOperational(link!), true);
    assert.deepEqual(grants.get(MEMBER_A)?.capabilities, ["author"]);
    assert.equal(grantWrites, 1);
    assert.equal((await store.listLinks()).length, 1);
    assert.deepEqual(blogPosts, postsBefore);
  });

  it("starts one bounded scheduler and can stop it", async () => {
    startIntegrityMediaAuthorActivationScheduler();
    startIntegrityMediaAuthorActivationScheduler();
    await new Promise((resolve) => setTimeout(resolve, 30));
    stopIntegrityMediaAuthorActivationScheduler();
    assert.equal(grants.size, 0);
    assert.equal((await store.listLinks()).length, 0);
  });

  it("leaves the Blog author capability in place when the link is disconnected", async () => {
    const postsBefore = structuredClone(blogPosts);
    await redeem(await confirmCode(MEMBER_A), AUTHOR_A);
    const disabled = await disableIntegrityMediaAuthorLink(AUTHOR_A);

    assert.equal(disabled, "disabled");
    assert.equal((await store.listLinks())[0]?.state, "disabled");
    assert.equal((await store.listLinks())[0]?.memberId, MEMBER_A);
    assert.deepEqual(grants.get(MEMBER_A)?.capabilities, ["author"]);
    assert.equal(grantWrites, 1);
    assert.deepEqual(blogPosts, postsBefore);
    assert.equal(publishingWorkspaceHref(grants.get(MEMBER_A)), "/workspace/publishing");
  });
});

function installAuthorCapabilityEnsurer(): void {
  setIntegrityMediaAuthorCapabilityEnsurerForTests(async (participantId) => {
    ensureCalls += 1;
    if (ensureFailuresRemaining > 0) {
      ensureFailuresRemaining -= 1;
      throw new Error("author capability store unavailable");
    }

    if (ensureDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, ensureDelayMs));
    }

    return ensureBlogAuthorCapability(participantId, {
      findGrant: async (id) => grants.get(id) ?? null,
      saveGrant: async (grant) => {
        grantWrites += 1;
        const saved: BlogCapabilityGrant = {
          ...grant,
          capabilities: [...grant.capabilities],
        };
        grants.set(grant.participantId, saved);
        return saved;
      },
    });
  });
}

function publishingWorkspaceHref(grant: BlogCapabilityGrant | undefined): string | null {
  const capabilities = new Set(grant?.capabilities ?? []);
  const hasAuthor =
    capabilities.has("author") ||
    capabilities.has("trusted_author") ||
    capabilities.has("editor") ||
    capabilities.has("administrator");
  const blockedAuthorOnly =
    grant?.administrativelyBlocked === true &&
    !capabilities.has("editor") &&
    !capabilities.has("administrator");

  return hasAuthor && !blockedAuthorOnly ? "/workspace/publishing" : null;
}

function attemptState(): string {
  return `state-${randomBytes(12).toString("hex")}`;
}

function tokenFor(memberId: string): string {
  return createAccessToken({
    sub: `user-${memberId}`,
    memberId,
    role: "member",
    displayName: "Ada Lovelace",
    email: "shared-name@example.com",
  });
}

function activeLookupUser(): AuthUserRecord {
  const now = new Date().toISOString();

  return {
    userId: "user-from-database",
    email: "shared-name@example.com",
    passwordHash: "not-a-credential",
    displayName: "Ada Lovelace",
    role: "member",
    status: "active",
    memberId: DATABASE_MEMBER,
    emailVerificationStatus: "verified",
    createdAt: now,
    updatedAt: now,
  };
}

async function setStoredCollaborationStatus(
  authorId: string,
  collaborationStatus: "active" | "blocked" | "archived" | undefined,
): Promise<void> {
  const link = (await store.listLinks()).find((item) => item.externalAuthorId === authorId);
  assert.ok(link);
  const next = { ...link };
  if (collaborationStatus === undefined) {
    delete next.collaborationStatus;
  } else {
    next.collaborationStatus = collaborationStatus;
  }
  assert.equal(await store.updateLink(next), "updated");
}

async function confirmCode(memberId: string): Promise<string> {
  const response = await post("/confirm", { state: attemptState() }, tokenFor(memberId));
  const redirectUrl = String(response.body.data?.redirectUrl ?? "");
  const code = new URL(redirectUrl).searchParams.get("code");

  assert.equal(response.status, 200);
  assert.ok(code);
  return String(code);
}

async function redeem(
  code: string,
  authorId: string,
  override: { timestamp?: string; signature?: string } = {},
): Promise<{ status: number; body: ApiBody }> {
  const timestamp = override.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature =
    override.signature ??
    signIntegrityMediaLinkRedeem(
      SECRET,
      buildIntegrityMediaLinkRedeemPayload({
        timestamp,
        resultCode: code,
        externalAuthorId: authorId,
      }),
    );

  return post("/redeem", { resultCode: code, externalAuthorId: authorId }, undefined, {
    "x-hu-integrity-media-timestamp": timestamp,
    "x-hu-integrity-media-signature": signature,
  });
}

async function redeemAtTime(code: string, authorId: string, now: Date) {
  const timestamp = String(Math.floor(now.getTime() / 1000));

  return redeemIntegrityMediaLink({
    resultCode: code,
    externalAuthorId: authorId,
    timestamp,
    signature: signIntegrityMediaLinkRedeem(
      SECRET,
      buildIntegrityMediaLinkRedeemPayload({
        timestamp,
        resultCode: code,
        externalAuthorId: authorId,
      }),
    ),
    secret: SECRET,
    now,
  });
}

function signedHeaders(code: string, authorId: string): Record<string, string> {
  const timestamp = String(Math.floor(Date.now() / 1000));

  return {
    "x-hu-integrity-media-timestamp": timestamp,
    "x-hu-integrity-media-signature": signIntegrityMediaLinkRedeem(
      SECRET,
      buildIntegrityMediaLinkRedeemPayload({
        timestamp,
        resultCode: code,
        externalAuthorId: authorId,
      }),
    ),
  };
}

async function get(
  pathName: string,
  accessToken?: string,
): Promise<{ status: number; body: ApiBody }> {
  return request(pathName, { method: "GET" }, accessToken);
}

async function post(
  pathName: string,
  body: unknown,
  accessToken?: string,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; body: ApiBody }> {
  return request(
    pathName,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    accessToken,
    extraHeaders,
  );
}

async function request(
  pathName: string,
  init: RequestInit,
  accessToken?: string,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; body: ApiBody }> {
  const headers = new Headers(init.headers);

  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }

  for (const [key, value] of Object.entries(extraHeaders ?? {})) {
    headers.set(key, value);
  }

  const response = await fetch(`${baseUrl}/api/v1/integrity-media/link${pathName}`, {
    ...init,
    headers,
  });
  const body = (await response.json()) as ApiBody;

  return { status: response.status, body };
}

function readRepo(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8");
}
