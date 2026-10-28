import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";

import cookieParser from "cookie-parser";
import express from "express";

import { setAuthUserLookupOverrideForTests } from "../../../src/modules/auth/auth-active-account-gate.js";
import { createAccessToken } from "../../../src/modules/auth/auth-tokens.js";
import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import {
  buildIntegrityMediaBindingRecoveryStatePayload,
  classifyIntegrityMediaConfirmationState,
  encodeIntegrityMediaBindingRecoveryState,
  type IntegrityMediaBindingRecoveryStateFields,
} from "../../../src/modules/external-author-link/external-author-link.binding-recovery-state.js";
import {
  INTEGRITY_MEDIA_ATTEMPT_STATE_PATTERN,
  INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV,
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_SOURCE,
} from "../../../src/modules/external-author-link/external-author-link.constants.js";
import {
  buildIntegrityMediaBindingRecoveryPayload,
  buildIntegrityMediaLinkRedeemPayload,
  resetIntegrityMediaBindingRecoveryReplayCacheForTests,
  resetIntegrityMediaRedeemReplayCacheForTests,
  signIntegrityMediaLinkRedeem,
} from "../../../src/modules/external-author-link/external-author-link.hmac.js";
import {
  createMemoryProvisionState,
  setProvisionMemoryForTests,
  type MemoryProvisionState,
} from "../../../src/modules/external-author-link/external-author-link.provision.database.js";
import externalAuthorLinkRouter from "../../../src/modules/external-author-link/external-author-link.routes.js";
import {
  setIntegrityMediaAuthorCapabilityEnsurerForTests,
  setIntegrityMediaDisplayNameResolverForTests,
} from "../../../src/modules/external-author-link/external-author-link.service.js";
import {
  createMemoryExternalAuthorLinkStore,
  setExternalAuthorLinkStoreForTests,
  type ExternalAuthorLinkStore,
} from "../../../src/modules/external-author-link/external-author-link.store.js";

/** Shared Workflow 06B vector. Integrity Media must produce this exact state. */
const VECTOR_SECRET = "hu-im-binding-recovery-state-vector-secret";
const VECTOR_FIELDS: IntegrityMediaBindingRecoveryStateFields = {
  huTarget: "staging",
  issuedAt: 1793145600,
  expiresAt: 1793146200,
  externalAuthorId: "a3d8f2c4-5b6e-4f7a-8c9d-0e1f2a3b4c5d",
  nonce: "AAECAwQFBgcICQoLDA0ODw",
  recoveryId: "rcv_0123456789abcdefABCD",
};
const VECTOR_PAYLOAD = [
  "integrity-media-binding-recovery-state",
  "1",
  "staging",
  "1793145600",
  "1793146200",
  "a3d8f2c4-5b6e-4f7a-8c9d-0e1f2a3b4c5d",
  "AAECAwQFBgcICQoLDA0ODw",
  "rcv_0123456789abcdefABCD",
].join("\n");
const VECTOR_SIGNATURE = "131dc9b09b144b70c0082a124320cc26ac73c70051462c4a637121ce7f749dfe";
const VECTOR_STATE =
  "hur1s17931456001793146200a3d8f2c45b6e4f7a8c9d0e1f2a3b4c5dAAECAwQFBgcICQoLDA0ODwrcv_0123456789abcdefABCD131dc9b09b144b70c0082a124320cc26ac73c70051462c4a637121ce7f749dfe";
const VECTOR_NOW = new Date(1793145700 * 1000);

const SECRET = "binding-recovery-state-test-secret";
const AUTHOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_AUTHOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const HISTORICAL_MEMBER = "11111111-1111-4111-8111-111111111111";
const SESSION_MEMBER = "22222222-2222-4222-8222-222222222222";
const OTHER_SESSION_MEMBER = "33333333-3333-4333-8333-333333333333";
const HISTORICAL_INSTANCE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const HISTORICAL_REVISION = 4;
const RECOVERY_ID = "rcv_session_binding_0001";
const SESSION_EMAIL = "replacement@example.com";

interface ApiBody {
  success: boolean;
  data: Record<string, unknown> | null;
  meta: { code?: string };
  message: string;
}

const ENV_KEYS = [
  "PLATFORM_MODE",
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV,
];
const savedEnv = new Map<string, string | undefined>();

let server: Server;
let baseUrl = "";
let store: ExternalAuthorLinkStore;
let provision: MemoryProvisionState;

describe("Integrity Media signed Binding Recovery state", () => {
  describe("contract", () => {
    it("matches the shared Workflow 06B HMAC vector exactly", () => {
      assert.equal(buildIntegrityMediaBindingRecoveryStatePayload(VECTOR_FIELDS), VECTOR_PAYLOAD);
      assert.equal(signIntegrityMediaLinkRedeem(VECTOR_SECRET, VECTOR_PAYLOAD), VECTOR_SIGNATURE);
      assert.equal(encodeIntegrityMediaBindingRecoveryState(VECTOR_FIELDS, VECTOR_SECRET), VECTOR_STATE);
      assert.equal(VECTOR_STATE.length, 167);

      const classified = classify(VECTOR_STATE, { secret: VECTOR_SECRET, now: VECTOR_NOW });
      assert.deepEqual(classified, { kind: "recovery", fields: VECTOR_FIELDS });
    });

    it("keeps every valid state within the 16 to 200 character state grammar", () => {
      const shortest = encode({ recoveryId: "a".repeat(16) });
      const longest = encode({ recoveryId: "b".repeat(48) });

      assert.equal(shortest.length, 159);
      assert.equal(longest.length, 191);
      for (const state of [shortest, longest, VECTOR_STATE]) {
        assert.match(state, INTEGRITY_MEDIA_ATTEMPT_STATE_PATTERN);
      }
      assert.equal(classify(shortest).kind, "recovery");
      assert.equal(classify(longest).kind, "recovery");
    });

    it("rejects malformed fields as invalid_recovery_state", () => {
      const valid = encode();
      const malformed = [
        encode({ recoveryId: "a".repeat(15) }),
        encode({ recoveryId: "b".repeat(49) }),
        valid.replace(/^hur1s/, "hur1x"),
        valid.slice(0, 5) + "17931x5600" + valid.slice(15),
        valid.slice(0, 25) + valid.slice(25, 57).toUpperCase() + valid.slice(57),
        valid.slice(0, 37) + "5" + valid.slice(38),
        valid.slice(0, -64) + valid.slice(-64).toUpperCase(),
        valid.slice(0, -1),
      ];

      for (const state of malformed) {
        assert.deepEqual(rejection(classify(state)), [400, "invalid_recovery_state"], state);
      }
    });

    it("rejects a tampered state or another secret", () => {
      const valid = encode();
      const lastChar = valid.at(-1) === "0" ? "1" : "0";
      const tamperedSignature = valid.slice(0, -1) + lastChar;
      const tamperedAuthor = valid.replace(AUTHOR.replaceAll("-", ""), OTHER_AUTHOR.replaceAll("-", ""));

      for (const state of [tamperedSignature, tamperedAuthor]) {
        assert.deepEqual(rejection(classify(state)), [400, "invalid_recovery_state"]);
      }
      assert.deepEqual(rejection(classify(valid, { secret: "other-secret" })), [
        400,
        "invalid_recovery_state",
      ]);
    });

    it("enforces the 600-second lifetime and 60-second future allowance", () => {
      const now = Math.floor(Date.now() / 1000);
      const at = new Date(now * 1000);

      assert.equal(classify(encode({ issuedAt: now, expiresAt: now + 600 }), { now: at }).kind, "recovery");
      assert.equal(classify(encode({ issuedAt: now + 60, expiresAt: now + 600 }), { now: at }).kind, "recovery");

      const expired = [
        encode({ issuedAt: now - 600, expiresAt: now }),
        encode({ issuedAt: now - 10, expiresAt: now + 591 }),
        encode({ issuedAt: now, expiresAt: now }),
        encode({ issuedAt: now + 5, expiresAt: now + 1 }),
        encode({ issuedAt: now + 61, expiresAt: now + 600 }),
      ];
      for (const state of expired) {
        assert.deepEqual(rejection(classify(state, { now: at })), [410, "recovery_state_expired"]);
      }
    });

    it("requires the signed target to equal PLATFORM_MODE", () => {
      const production = encode({ huTarget: "production" });

      assert.deepEqual(rejection(classify(production)), [409, "environment_rejected"]);
      assert.deepEqual(
        rejection(classify(encode(), { env: { ...enabledEnv(), PLATFORM_MODE: "beta" } })),
        [409, "environment_rejected"],
      );
      assert.equal(
        classify(production, { env: { ...enabledEnv(), PLATFORM_MODE: "production" } }).kind,
        "recovery",
      );
    });

    it("rejects an unsupported recovery version without fallback", () => {
      const v1 = encode();
      for (const state of [`hur2${v1.slice(4)}`, `hur9${v1.slice(4)}`, "hur0abcdefghijklmnop"]) {
        assert.deepEqual(rejection(classify(state)), [400, "invalid_recovery_state"]);
      }
    });

    it("fails closed while recovery is disabled or unconfigured", () => {
      const valid = encode();
      for (const flag of [undefined, "", "TRUE", "1"]) {
        const env = { ...enabledEnv() };
        if (flag === undefined) {
          delete env[INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV];
        } else {
          env[INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV] = flag;
        }
        assert.deepEqual(rejection(classify(valid, { env })), [503, "binding_recovery_disabled"]);
      }
      assert.deepEqual(rejection(classify(valid, { secret: null })), [
        503,
        "binding_recovery_not_configured",
      ]);
    });

    it("leaves ordinary states outside the recovery family", () => {
      for (const state of [
        randomBytes(32).toString("base64url").replace(/^hur[0-9]/, "abcd"),
        "hurricane-attempt-state",
        "HUR1abcdefghijklmnop",
        "ordinaryAttemptState01",
      ]) {
        assert.deepEqual(classify(state), { kind: "not_recovery" });
        assert.deepEqual(classify(state, { env: {} }), { kind: "not_recovery" });
      }
    });
  });

  describe("confirmation", () => {
    before(async () => {
      for (const key of ENV_KEYS) {
        savedEnv.set(key, process.env[key]);
      }
      setAuthUserLookupOverrideForTests(async (userId) => activeUser(userId));
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
      for (const [key, value] of savedEnv) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
      setAuthUserLookupOverrideForTests(null);
      setExternalAuthorLinkStoreForTests(null);
      setProvisionMemoryForTests(null);
      setIntegrityMediaDisplayNameResolverForTests(null);
      setIntegrityMediaAuthorCapabilityEnsurerForTests(null);
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    });

    beforeEach(async () => {
      process.env.PLATFORM_MODE = "staging";
      process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV] = SECRET;
      process.env[INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV] = "true";
      store = createMemoryExternalAuthorLinkStore();
      setExternalAuthorLinkStoreForTests(store);
      provision = createMemoryProvisionState();
      setProvisionMemoryForTests(provision);
      setIntegrityMediaDisplayNameResolverForTests(async () => "Replacement Participant");
      setIntegrityMediaAuthorCapabilityEnsurerForTests(async () => ({
        changed: false,
        capabilities: ["author"],
        publishWithoutManualReview: false,
      }));
      resetIntegrityMediaRedeemReplayCacheForTests();
      resetIntegrityMediaBindingRecoveryReplayCacheForTests();
      await store.insertLink({
        source: INTEGRITY_MEDIA_SOURCE,
        externalAuthorId: AUTHOR,
        memberId: HISTORICAL_MEMBER,
        state: "linked",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        confirmedAt: "2026-01-02T00:00:00.000Z",
        disconnectedAt: null,
        collaborationStatus: "active",
        linkRevision: HISTORICAL_REVISION,
        linkInstanceId: HISTORICAL_INSTANCE,
        linkFinalization: "confirmed",
      });
    });

    it("previews a verified recovery state with the session name and email only", async () => {
      const response = await get(`/preview?state=${encodeURIComponent(liveState())}`, SESSION_MEMBER);

      assert.equal(response.status, 200);
      assert.deepEqual(response.body.data, {
        source: INTEGRITY_MEDIA_SOURCE,
        displayName: "Replacement Participant",
        purpose: "binding_recovery",
        email: SESSION_EMAIL,
      });
      assert.doesNotMatch(JSON.stringify(response.body), new RegExp(HISTORICAL_MEMBER));
    });

    it("keeps the ordinary preview and confirmation unchanged", async () => {
      const state = ordinaryState();
      const preview = await get(`/preview?state=${state}`, SESSION_MEMBER);
      const confirmed = await post("/confirm", { state }, SESSION_MEMBER);
      const stored = (await store.listResults())[0];

      assert.equal(preview.status, 200);
      assert.deepEqual(preview.body.data, {
        source: INTEGRITY_MEDIA_SOURCE,
        displayName: "Replacement Participant",
      });
      assert.equal(confirmed.status, 200);
      assert.equal(stored?.memberId, SESSION_MEMBER);
      assert.equal(stored?.attemptState, state);
      for (const key of ["purpose", "externalAuthorId", "bindingRecoveryId", "huTarget"] as const) {
        assert.equal(stored?.[key], undefined);
      }

      const redeemed = await redeem(stored!.resultCode, OTHER_AUTHOR);
      assert.equal(redeemed.status, 200);
      assert.equal(redeemed.body.data?.memberId, SESSION_MEMBER);
    });

    it("binds a recovery confirmation code to the session member, author, recovery id, and target", async () => {
      const state = liveState();
      const confirmed = await post("/confirm", { state }, SESSION_MEMBER);
      const other = await post("/confirm", { state }, OTHER_SESSION_MEMBER);
      const results = await store.listResults();

      assert.equal(confirmed.status, 200);
      assert.equal(other.status, 200);
      assert.deepEqual(
        results.map((row) => row.memberId),
        [SESSION_MEMBER, OTHER_SESSION_MEMBER],
      );
      for (const row of results) {
        assert.equal(row.purpose, "binding_recovery");
        assert.equal(row.externalAuthorId, AUTHOR);
        assert.equal(row.bindingRecoveryId, RECOVERY_ID);
        assert.equal(row.huTarget, "staging");
        assert.equal(row.attemptState, state);
        assert.equal(row.consumedAt, null);
      }

      const browserMember = await post("/confirm", { state, memberId: HISTORICAL_MEMBER }, SESSION_MEMBER);
      assert.equal(browserMember.status, 400);
      assert.equal(browserMember.body.meta.code, "browser_member_id");

      const audit = (await store.listAudits()).find((row) => row.action === "link_confirmation_created");
      assert.equal(audit?.externalAuthorId, AUTHOR);
      assert.equal(audit?.reason, "binding_recovery");
    });

    it("lets the bound code recover the link to the session member and refuses ordinary redeem", async () => {
      await post("/confirm", { state: liveState() }, SESSION_MEMBER);
      const code = (await store.listResults())[0]!.resultCode;

      const ordinary = await redeem(code, AUTHOR);
      assert.equal(ordinary.status, 409);
      assert.equal(ordinary.body.meta.code, "result_already_used");
      assert.equal((await store.listResults())[0]?.consumedAt, null);

      const recovered = await recover(code, RECOVERY_ID);
      assert.equal(recovered.status, 200);
      assert.equal(recovered.body.data?.memberId, SESSION_MEMBER);
      assert.equal(recovered.body.data?.replacedMemberId, HISTORICAL_MEMBER);
    });

    it("rejects the code for another recovery id or author", async () => {
      await post("/confirm", { state: liveState() }, SESSION_MEMBER);
      const code = (await store.listResults())[0]!.resultCode;

      const otherRecovery = await recover(code, "rcv_other_request_000001");
      assert.equal(otherRecovery.status, 409);
      assert.equal(otherRecovery.body.meta.code, "result_recovery_mismatch");

      await post("/confirm", { state: liveState({ externalAuthorId: OTHER_AUTHOR }) }, SESSION_MEMBER);
      const otherAuthorCode = (await store.listResults())[1]!.resultCode;
      const otherAuthor = await recover(otherAuthorCode, RECOVERY_ID);
      assert.equal(otherAuthor.status, 409);
      assert.equal(otherAuthor.body.meta.code, "result_author_mismatch");
    });

    it("fails closed on invalid recovery states without minting a code", async () => {
      const valid = liveState();
      const now = Math.floor(Date.now() / 1000);
      const cases: Array<[string, number, string]> = [
        [valid.slice(0, -1) + (valid.at(-1) === "0" ? "1" : "0"), 400, "invalid_recovery_state"],
        [`hur2${valid.slice(4)}`, 400, "invalid_recovery_state"],
        [liveState({ issuedAt: now - 700, expiresAt: now - 100 }), 410, "recovery_state_expired"],
        [liveState({ huTarget: "production" }), 409, "environment_rejected"],
      ];

      for (const [state, status, code] of cases) {
        const preview = await get(`/preview?state=${encodeURIComponent(state)}`, SESSION_MEMBER);
        const confirmed = await post("/confirm", { state }, SESSION_MEMBER);
        assert.equal(preview.status, status, code);
        assert.equal(preview.body.meta.code, code);
        assert.equal(confirmed.status, status, code);
        assert.equal(confirmed.body.meta.code, code);
      }

      process.env[INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV] = "false";
      const disabled = await post("/confirm", { state: valid }, SESSION_MEMBER);
      assert.equal(disabled.status, 503);
      assert.equal(disabled.body.meta.code, "binding_recovery_disabled");

      assert.deepEqual(await store.listResults(), []);
    });

    it("keeps account creation for registered attempts and refuses it for recovery states", async () => {
      const attemptId = ordinaryState();
      await provision.view().insertAttempt({
        attemptId,
        externalAuthorId: OTHER_AUTHOR,
        email: "new-author@example.com",
        displayName: "New Author",
        target: "staging",
        expiresAt: Math.floor(Date.now() / 1000) + 600,
        returnPath: "/api/author/humanity-union-link/complete",
        emailVerification: "pending",
        memberId: null,
        userId: null,
        createdMember: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const consent = await get(`/provision-consent?state=${attemptId}`);
      assert.equal(consent.status, 200);
      assert.deepEqual(consent.body.data, { displayName: "New Author", email: "new-author@example.com" });

      const state = liveState();
      const recoveryConsent = await get(`/provision-consent?state=${encodeURIComponent(state)}`);
      const recoveryConfirm = await post("/provision-confirm", { state });
      assert.equal(recoveryConsent.status, 404);
      assert.equal(recoveryConsent.body.meta.code, "attempt_not_found");
      assert.equal(recoveryConfirm.status, 404);
      assert.equal(recoveryConfirm.body.meta.code, "attempt_not_found");
      assert.equal(provision.users().length, 0);
    });
  });
});

function enabledEnv(): NodeJS.ProcessEnv {
  return {
    PLATFORM_MODE: "staging",
    [INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV]: "true",
  };
}

function classify(
  state: string,
  options: { secret?: string | null; now?: Date; env?: NodeJS.ProcessEnv } = {},
) {
  return classifyIntegrityMediaConfirmationState({
    state,
    secret: options.secret === undefined ? SECRET : options.secret,
    now: options.now ?? new Date(),
    env: options.env ?? enabledEnv(),
  });
}

function rejection(result: ReturnType<typeof classify>): [number, string] | null {
  return result.kind === "recovery_rejected" ? [result.status, result.code] : null;
}

function encode(overrides: Partial<IntegrityMediaBindingRecoveryStateFields> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  return encodeIntegrityMediaBindingRecoveryState(
    {
      huTarget: "staging",
      issuedAt: now,
      expiresAt: now + 600,
      externalAuthorId: AUTHOR,
      nonce: randomBytes(16).toString("base64url"),
      recoveryId: RECOVERY_ID,
      ...overrides,
    },
    SECRET,
  );
}

function liveState(overrides: Partial<IntegrityMediaBindingRecoveryStateFields> = {}): string {
  return encode(overrides);
}

function ordinaryState(): string {
  return `a${randomBytes(32).toString("base64url")}`.slice(0, 43);
}

function activeUser(userId: string): AuthUserRecord {
  const now = new Date().toISOString();
  return {
    userId,
    email: SESSION_EMAIL,
    passwordHash: "not-a-credential",
    displayName: "Replacement Participant",
    role: "member",
    status: "active",
    memberId: userId.replace(/^user-/, ""),
    emailVerificationStatus: "verified",
    createdAt: now,
    updatedAt: now,
  };
}

function tokenFor(memberId: string): string {
  return createAccessToken({
    sub: `user-${memberId}`,
    memberId,
    role: "member",
    displayName: "Replacement Participant",
    email: SESSION_EMAIL,
  });
}

async function get(pathName: string, memberId?: string): Promise<{ status: number; body: ApiBody }> {
  return send(pathName, { method: "GET" }, memberId);
}

async function post(
  pathName: string,
  body: unknown,
  memberId?: string,
): Promise<{ status: number; body: ApiBody }> {
  return send(
    pathName,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    memberId,
  );
}

async function send(
  pathName: string,
  init: RequestInit,
  memberId?: string,
): Promise<{ status: number; body: ApiBody }> {
  const headers = new Headers(init.headers);
  if (memberId) {
    headers.set("authorization", `Bearer ${tokenFor(memberId)}`);
  }
  const response = await fetch(`${baseUrl}/api/v1/integrity-media/link${pathName}`, { ...init, headers });
  return { status: response.status, body: (await response.json()) as ApiBody };
}

async function redeem(resultCode: string, externalAuthorId: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signIntegrityMediaLinkRedeem(
    SECRET,
    buildIntegrityMediaLinkRedeemPayload({ timestamp, resultCode, externalAuthorId }),
  );
  const response = await fetch(`${baseUrl}/api/v1/integrity-media/link/redeem`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hu-integrity-media-timestamp": timestamp,
      "x-hu-integrity-media-signature": signature,
    },
    body: JSON.stringify({ resultCode, externalAuthorId }),
  });
  return { status: response.status, body: (await response.json()) as ApiBody };
}

async function recover(resultCode: string, recoveryId: string) {
  const request = {
    resultCode,
    externalAuthorId: AUTHOR,
    huTarget: "staging",
    expectedHuMemberId: HISTORICAL_MEMBER,
    expectedHuLinkRevision: HISTORICAL_REVISION,
    expectedHuLinkInstanceId: HISTORICAL_INSTANCE,
    recoveryId,
  };
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signIntegrityMediaLinkRedeem(
    SECRET,
    buildIntegrityMediaBindingRecoveryPayload({ timestamp, ...request }),
  );
  const response = await fetch(`${baseUrl}/api/v1/integrity-media/link/binding-recovery/redeem`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hu-integrity-media-timestamp": timestamp,
      "x-hu-integrity-media-signature": signature,
    },
    body: JSON.stringify(request),
  });
  return { status: response.status, body: (await response.json()) as ApiBody };
}
