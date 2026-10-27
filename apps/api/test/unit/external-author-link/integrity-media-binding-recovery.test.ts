import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";

import cookieParser from "cookie-parser";
import express from "express";

import {
  setIntegrityMediaBindingRecoveryInterruptForTests,
  type IntegrityMediaBindingRecoveryRequest,
} from "../../../src/modules/external-author-link/external-author-link.binding-recovery.js";
import { isOrdinaryIntegrityMediaCollaborationAllowed } from "../../../src/modules/external-author-link/external-author-link.collaboration.js";
import {
  INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV,
  INTEGRITY_MEDIA_BINDING_RECOVERY_PURPOSE,
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_SOURCE,
} from "../../../src/modules/external-author-link/external-author-link.constants.js";
import {
  buildIntegrityMediaAuthorDisconnectCanonical,
  resetIntegrityMediaAuthorDisconnectReplayCacheForTests,
  signIntegrityMediaAuthorDisconnect,
} from "../../../src/modules/external-author-link/external-author-link.disconnect-hmac.js";
import { acceptIntegrityMediaAuthorDisconnect } from "../../../src/modules/external-author-link/external-author-link.disconnect.js";
import {
  buildIntegrityMediaBindingRecoveryPayload,
  buildIntegrityMediaLinkAcknowledgePayload,
  buildIntegrityMediaLinkRedeemPayload,
  resetIntegrityMediaAcknowledgeReplayCacheForTests,
  resetIntegrityMediaBindingRecoveryReplayCacheForTests,
  resetIntegrityMediaRedeemReplayCacheForTests,
  signIntegrityMediaLinkRedeem,
} from "../../../src/modules/external-author-link/external-author-link.hmac.js";
import {
  createMemoryProvisionState,
  setProvisionMemoryForTests,
} from "../../../src/modules/external-author-link/external-author-link.provision.database.js";
import externalAuthorLinkRouter from "../../../src/modules/external-author-link/external-author-link.routes.js";
import { setIntegrityMediaAuthorCapabilityEnsurerForTests } from "../../../src/modules/external-author-link/external-author-link.service.js";
import {
  createMemoryExternalAuthorLinkStore,
  setExternalAuthorLinkStoreForTests,
  type ExternalAuthorLinkStore,
} from "../../../src/modules/external-author-link/external-author-link.store.js";
import type {
  ExternalAuthorLinkRecord,
  ExternalAuthorLinkResultRecord,
} from "../../../src/modules/external-author-link/external-author-link.types.js";

const SECRET = "binding-recovery-test-secret";
const AUTHOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_AUTHOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const HISTORICAL_MEMBER = "11111111-1111-4111-8111-111111111111";
const REPLACEMENT_MEMBER = "22222222-2222-4222-8222-222222222222";
const OTHER_MEMBER = "33333333-3333-4333-8333-333333333333";
const HISTORICAL_INSTANCE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_INSTANCE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const RESULT_CODE = "recoveryResultCode_0123456789abcdefABCDEF";
const RECOVERY_ID = "recovery-id-0001-abcdef";
const HISTORICAL_REVISION = 4;
const CREATED_AT = "2026-01-01T00:00:00.000Z";
const CONFIRMED_AT = "2026-01-02T00:00:00.000Z";

interface ApiBody {
  success: boolean;
  data: Record<string, unknown> | null;
  meta: { code?: string };
  message: string;
}

interface RecoverOptions {
  body?: Partial<Record<keyof IntegrityMediaBindingRecoveryRequest, unknown>> & Record<string, unknown>;
  timestamp?: string;
  signature?: string;
  query?: string;
}

const savedEnv = {
  enabled: process.env[INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV],
  secret: process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV],
  platformMode: process.env.PLATFORM_MODE,
};

let server: Server;
let baseUrl = "";
let store: ExternalAuthorLinkStore;
let grants: string[] = [];

describe("Integrity Media binding recovery", () => {
  before(async () => {
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
    setExternalAuthorLinkStoreForTests(null);
    setIntegrityMediaAuthorCapabilityEnsurerForTests(null);
    setIntegrityMediaBindingRecoveryInterruptForTests(null);
    setProvisionMemoryForTests(null);
    restoreEnv(INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV, savedEnv.enabled);
    restoreEnv(INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV, savedEnv.secret);
    restoreEnv("PLATFORM_MODE", savedEnv.platformMode);
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(async () => {
    store = createMemoryExternalAuthorLinkStore();
    setExternalAuthorLinkStoreForTests(store);
    setProvisionMemoryForTests(createMemoryProvisionState());
    setIntegrityMediaBindingRecoveryInterruptForTests(null);
    resetIntegrityMediaBindingRecoveryReplayCacheForTests();
    resetIntegrityMediaAcknowledgeReplayCacheForTests();
    resetIntegrityMediaRedeemReplayCacheForTests();
    resetIntegrityMediaAuthorDisconnectReplayCacheForTests();
    grants = [];
    setIntegrityMediaAuthorCapabilityEnsurerForTests(async (participantId) => {
      grants.push(participantId);
      return { changed: true, capabilities: ["author"], publishWithoutManualReview: false };
    });
    process.env[INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV] = "true";
    process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV] = SECRET;
    process.env.PLATFORM_MODE = "staging";
    await store.insertLink(confirmedLink());
    await store.insertResult(result());
  });

  describe("gates", () => {
    it("is disabled unless the flag is exactly true, before reading the body", async () => {
      for (const value of [undefined, "", "TRUE", "1", "yes", " false "]) {
        if (value === undefined) {
          delete process.env[INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV];
        } else {
          process.env[INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV] = value;
        }

        const response = await recover({ body: { memberId: REPLACEMENT_MEMBER } });
        assert.equal(response.status, 503, `flag ${String(value)}`);
        assert.equal(response.body.meta.code, "binding_recovery_disabled");
        assert.equal(response.body.message, "Integrity Media binding recovery is disabled.");
      }

      process.env[INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV] = " true ";
      assert.equal((await recover()).status, 200);
    });

    it("leaves the link, result, receipts, and audits untouched while disabled", async () => {
      delete process.env[INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV];
      const before = await snapshot();
      const response = await recover();

      assert.equal(response.status, 503);
      assert.deepEqual(await snapshot(), before);
    });

    it("rejects extra body fields, a browser member id, and query parameters", async () => {
      const extra = await recover({ body: { ...requestBody(), state: "x" } });
      const member = await recover({ body: { ...requestBody(), memberId: REPLACEMENT_MEMBER } });
      const query = await recover({ query: "?recoveryId=other" });

      assert.equal(extra.status, 400);
      assert.equal(extra.body.meta.code, "unexpected_field");
      assert.equal(member.status, 400);
      assert.equal(member.body.meta.code, "browser_member_id");
      assert.equal(query.status, 400);
      assert.equal(query.body.meta.code, "unexpected_field");
      assert.equal((await linkFor(AUTHOR))?.memberId, HISTORICAL_MEMBER);
    });

    it("rejects malformed fields as invalid_request before the signature", async () => {
      const cases: Array<Record<string, unknown>> = [
        { resultCode: "short" },
        { externalAuthorId: "not-a-uuid" },
        { expectedHuMemberId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA" },
        { expectedHuLinkInstanceId: "x" },
        { recoveryId: "too-short" },
        { huTarget: "beta" },
        { expectedHuLinkRevision: 0 },
        { expectedHuLinkRevision: 1.5 },
        { expectedHuLinkRevision: "4" },
      ];

      for (const override of cases) {
        const response = await recover({ body: { ...requestBody(), ...override }, signature: "0".repeat(64) });
        assert.equal(response.status, 400, JSON.stringify(override));
        assert.equal(response.body.meta.code, "invalid_request");
        assert.equal(response.body.message, "The recovery request is not valid.");
      }

      const badTimestamp = await recover({ timestamp: "123" });
      assert.equal(badTimestamp.body.meta.code, "invalid_request");
    });

    it("reports not configured without a secret and writes nothing", async () => {
      delete process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV];
      const before = await snapshot();
      const response = await recover({ signature: "0".repeat(64) });

      assert.equal(response.status, 503);
      assert.equal(response.body.meta.code, "binding_recovery_not_configured");
      assert.deepEqual(await snapshot(), before);
    });

    it("rejects a bad signature and signatures from other purposes", async () => {
      const timestamp = nowTimestamp();
      const redeemSignature = signIntegrityMediaLinkRedeem(
        SECRET,
        buildIntegrityMediaLinkRedeemPayload({ timestamp, resultCode: RESULT_CODE, externalAuthorId: AUTHOR }),
      );
      const acknowledgeSignature = signIntegrityMediaLinkRedeem(
        SECRET,
        buildIntegrityMediaLinkAcknowledgePayload({
          timestamp,
          eventId: OTHER_INSTANCE,
          externalAuthorId: AUTHOR,
          memberId: HISTORICAL_MEMBER,
          linkRevision: HISTORICAL_REVISION,
          linkInstanceId: HISTORICAL_INSTANCE,
        }),
      );
      const wrongSecret = signIntegrityMediaLinkRedeem(
        "other-secret",
        buildIntegrityMediaBindingRecoveryPayload({ timestamp, ...requestBody() }),
      );

      for (const signature of [redeemSignature, acknowledgeSignature, wrongSecret, "A".repeat(64)]) {
        const response = await recover({ timestamp, signature });
        assert.equal(response.status, 401);
        assert.equal(response.body.meta.code, "invalid_signature");
      }

      assert.equal(
        buildIntegrityMediaBindingRecoveryPayload({ timestamp: "1700000000", ...requestBody() }),
        [
          INTEGRITY_MEDIA_BINDING_RECOVERY_PURPOSE,
          "1700000000",
          RESULT_CODE,
          AUTHOR,
          "staging",
          HISTORICAL_MEMBER,
          String(HISTORICAL_REVISION),
          HISTORICAL_INSTANCE,
          RECOVERY_ID,
        ].join("\n"),
      );
      assert.equal((await store.listBindingRecoveryReceipts()).length, 0);
    });

    it("rejects a stale timestamp", async () => {
      const response = await recover({ timestamp: String(Math.floor(Date.now() / 1000) - 301) });

      assert.equal(response.status, 401);
      assert.equal(response.body.meta.code, "stale_timestamp");
      assert.equal((await store.listBindingRecoveryReceipts()).length, 0);
    });

    it("rejects a target that is not this environment", async () => {
      const production = await recover({ body: { ...requestBody(), huTarget: "production" } });
      process.env.PLATFORM_MODE = "beta";
      const beta = await recover();

      assert.equal(production.status, 409);
      assert.equal(production.body.meta.code, "environment_rejected");
      assert.equal(beta.status, 409);
      assert.equal(beta.body.meta.code, "environment_rejected");
      assert.equal((await store.listBindingRecoveryReceipts()).length, 0);
    });
  });

  describe("confirmation result", () => {
    it("rejects a missing result and binds the rejection to the recovery id", async () => {
      const response = await recover({ body: { ...requestBody(), resultCode: "missingResultCode_0123456789abcdefABCD" } });
      const receipt = (await store.listBindingRecoveryReceipts())[0];

      assert.equal(response.status, 404);
      assert.equal(response.body.meta.code, "result_not_found");
      assert.equal(receipt?.status, "rejected");
      assert.equal(receipt?.rejectionCode, "result_not_found");

      const corrected = await recover();
      assert.equal(corrected.status, 409);
      assert.equal(corrected.body.meta.code, "recovery_conflict");
      assert.equal((await linkFor(AUTHOR))?.memberId, HISTORICAL_MEMBER);
    });

    it("rejects an expired result", async () => {
      store = await freshStoreWith(result({ expiresAt: "2020-01-01T00:00:00.000Z" }));
      const response = await recover();

      assert.equal(response.status, 410);
      assert.equal(response.body.meta.code, "result_expired");
      assert.equal((await linkFor(AUTHOR))?.memberId, HISTORICAL_MEMBER);
    });

    it("rejects a consumed result", async () => {
      store = await freshStoreWith(result({ consumedAt: "2026-01-03T00:00:00.000Z" }));
      const response = await recover();

      assert.equal(response.status, 409);
      assert.equal(response.body.meta.code, "result_already_used");
    });

    it("rejects a result bound to another author on the result or its provision attempt", async () => {
      store = await freshStoreWith(result({ externalAuthorId: OTHER_AUTHOR }));
      const onResult = await recover();
      assert.equal(onResult.status, 409);
      assert.equal(onResult.body.meta.code, "result_author_mismatch");

      const provisionAttempt = "provisionAttemptState01";
      const memory = createMemoryProvisionState();
      setProvisionMemoryForTests(memory);
      await memory.view().insertAttempt(provisionAttemptRecord(provisionAttempt, OTHER_AUTHOR));
      store = await freshStoreWith(result({ attemptState: provisionAttempt }));
      const onAttempt = await recover({ body: { ...requestBody(), recoveryId: "recovery-id-0002-abcdef" } });

      assert.equal(onAttempt.status, 409);
      assert.equal(onAttempt.body.meta.code, "result_author_mismatch");
      assert.equal((await store.listResults())[0]?.consumedAt, null);
    });

    it("accepts a result whose provision attempt names the same author", async () => {
      const provisionAttempt = "provisionAttemptState02";
      const memory = createMemoryProvisionState();
      setProvisionMemoryForTests(memory);
      await memory.view().insertAttempt(provisionAttemptRecord(provisionAttempt, AUTHOR));
      store = await freshStoreWith(result({ attemptState: provisionAttempt }));

      assert.equal((await recover()).status, 200);
    });

    it("rejects a replacement member that is the historical member", async () => {
      store = await freshStoreWith(result({ memberId: HISTORICAL_MEMBER }));
      const response = await recover();

      assert.equal(response.status, 409);
      assert.equal(response.body.meta.code, "replacement_member_unchanged");
    });

    it("rejects a replacement member already linked to another author", async () => {
      await store.insertLink(confirmedLink({ externalAuthorId: OTHER_AUTHOR, memberId: REPLACEMENT_MEMBER, linkInstanceId: OTHER_INSTANCE }));
      const response = await recover();

      assert.equal(response.status, 409);
      assert.equal(response.body.meta.code, "member_already_linked");
      assert.equal((await linkFor(AUTHOR))?.memberId, HISTORICAL_MEMBER);
      assert.equal((await store.listResults())[0]?.consumedAt, null);
      assert.equal((await store.listResults())[0]?.bindingRecoveryReservationId, undefined);
    });
  });

  describe("historical link", () => {
    it("rejects a missing link", async () => {
      const response = await recover({ body: { ...requestBody(), externalAuthorId: OTHER_AUTHOR } });

      assert.equal(response.status, 404);
      assert.equal(response.body.meta.code, "link_not_found");
    });

    it("rejects member, revision, and instance mismatches", async () => {
      const cases: Array<[Record<string, unknown>, string]> = [
        [{ expectedHuMemberId: OTHER_MEMBER }, "historical_member_mismatch"],
        [{ expectedHuLinkRevision: HISTORICAL_REVISION - 1 }, "historical_revision_mismatch"],
        [{ expectedHuLinkInstanceId: OTHER_INSTANCE }, "historical_instance_mismatch"],
      ];

      for (const [index, [override, code]] of cases.entries()) {
        const response = await recover({
          body: { ...requestBody(), ...override, recoveryId: `recovery-mismatch-${index}-abc` },
        });
        assert.equal(response.status, 409);
        assert.equal(response.body.meta.code, code);
      }

      assert.deepEqual(await linkFor(AUTHOR), confirmedLink());
    });

    it("does not rewrite a legacy, provisional, or disabled row", async () => {
      const rows: Array<[ExternalAuthorLinkRecord, string]> = [
        [legacyLink(), "legacy_binding"],
        [confirmedLink({ linkInstanceId: undefined }), "legacy_binding"],
        [confirmedLink({ linkRevision: undefined }), "legacy_binding"],
        [confirmedLink({ linkFinalization: "provisional" }), "link_provisional"],
        [confirmedLink({ state: "disabled", disconnectedAt: CONFIRMED_AT }), "link_not_recoverable"],
      ];

      for (const [index, [row, code]] of rows.entries()) {
        store = createMemoryExternalAuthorLinkStore();
        setExternalAuthorLinkStoreForTests(store);
        await store.insertLink(row);
        await store.insertResult(result());
        const response = await recover({
          body: { ...requestBody(), recoveryId: `recovery-row-${index}-abcdef` },
        });

        assert.equal(response.status, 409, code);
        assert.equal(response.body.meta.code, code);
        assert.deepEqual(await linkFor(AUTHOR), row);
      }
    });
  });

  describe("rebinding", () => {
    it("reassigns one row to the result member with the next revision and a new instance", async () => {
      const auditsBefore = await store.listAudits();
      const response = await recover();
      const link = await linkFor(AUTHOR);
      const links = await store.listLinks();

      assert.equal(response.status, 200);
      assert.equal(response.body.message, "Integrity Media binding recovered.");
      assert.deepEqual(Object.keys(response.body.data ?? {}).sort(), [
        "externalAuthorId",
        "huTarget",
        "linkInstanceId",
        "linkRevision",
        "memberId",
        "replacedLinkInstanceId",
        "replacedLinkRevision",
        "replacedMemberId",
        "source",
      ]);
      assert.equal(response.body.data?.source, INTEGRITY_MEDIA_SOURCE);
      assert.equal(response.body.data?.huTarget, "staging");
      assert.equal(response.body.data?.memberId, REPLACEMENT_MEMBER);
      assert.equal(response.body.data?.linkRevision, HISTORICAL_REVISION + 1);
      assert.notEqual(response.body.data?.linkInstanceId, HISTORICAL_INSTANCE);
      assert.match(String(response.body.data?.linkInstanceId), /^[0-9a-f-]{36}$/);
      assert.equal(response.body.data?.replacedMemberId, HISTORICAL_MEMBER);
      assert.equal(response.body.data?.replacedLinkRevision, HISTORICAL_REVISION);
      assert.equal(response.body.data?.replacedLinkInstanceId, HISTORICAL_INSTANCE);

      assert.equal(links.length, 1);
      assert.equal(link?.memberId, REPLACEMENT_MEMBER);
      assert.equal(link?.linkRevision, HISTORICAL_REVISION + 1);
      assert.equal(link?.linkInstanceId, response.body.data?.linkInstanceId);
      assert.equal(link?.linkFinalization, "provisional");
      assert.equal(link?.state, "linked");
      assert.equal(link?.collaborationStatus, "blocked");
      assert.equal(link?.createdAt, CREATED_AT);
      assert.equal(link?.confirmedAt, CONFIRMED_AT);
      assert.equal(link?.disconnectedAt, null);
      assert.equal(link?.authorActivationPending, false);
      assert.equal(link?.bindingRecoveryId, RECOVERY_ID);
      assert.equal(link?.bindingRecoveryResultCode, RESULT_CODE);
      assert.equal(link?.bindingRecoveryHuTarget, "staging");
      assert.equal(link?.bindingRecoveryReplacedMemberId, HISTORICAL_MEMBER);
      assert.equal(link?.bindingRecoveryReplacedLinkRevision, HISTORICAL_REVISION);
      assert.equal(link?.bindingRecoveryReplacedLinkInstanceId, HISTORICAL_INSTANCE);
      assert.equal(await store.findLinkByMember(INTEGRITY_MEDIA_SOURCE, HISTORICAL_MEMBER), null);
      assert.equal(isOrdinaryIntegrityMediaCollaborationAllowed(link!), false);

      const consumed = (await store.listResults())[0];
      assert.ok(consumed?.consumedAt);
      assert.equal(consumed?.bindingRecoveryReservationId, RECOVERY_ID);

      const audits = await store.listAudits();
      assert.deepEqual(audits.slice(0, auditsBefore.length), auditsBefore);
      const recovered = audits.filter((audit) => audit.action === "link_binding_recovered");
      assert.equal(recovered.length, 1);
      assert.equal(recovered[0]?.reason, "reassigned");
      assert.equal(recovered[0]?.recoveryId, RECOVERY_ID);
      assert.equal(recovered[0]?.memberId, REPLACEMENT_MEMBER);
      assert.equal(recovered[0]?.replacedMemberId, HISTORICAL_MEMBER);
      assert.equal(recovered[0]?.linkRevision, HISTORICAL_REVISION + 1);
      assert.equal(recovered[0]?.replacedLinkRevision, HISTORICAL_REVISION);
      assert.equal(recovered[0]?.replacedLinkInstanceId, HISTORICAL_INSTANCE);
      assert.equal(recovered[0]?.attemptStateHash, null);
      assert.doesNotMatch(JSON.stringify(recovered[0]), new RegExp(RESULT_CODE));

      const receipt = (await store.listBindingRecoveryReceipts())[0];
      assert.equal(receipt?.status, "completed");
      assert.doesNotMatch(JSON.stringify(receipt), /signature/i);
      assert.deepEqual(grants, []);
    });

    it("grants Blog author only when the new tuple is acknowledged and refuses the old tuple", async () => {
      const recovered = await recover();
      const data = recovered.body.data!;

      const oldTuple = await acknowledge(HISTORICAL_MEMBER, HISTORICAL_REVISION, HISTORICAL_INSTANCE);
      assert.equal(oldTuple.status, 409);
      assert.equal(oldTuple.body.meta.code, "acknowledgement_mismatch");
      assert.deepEqual(grants, []);

      const newTuple = await acknowledge(
        REPLACEMENT_MEMBER,
        data.linkRevision as number,
        data.linkInstanceId as string,
      );
      assert.equal(newTuple.status, 200);
      assert.equal(newTuple.body.data?.finalization, "confirmed");
      assert.deepEqual(grants, [REPLACEMENT_MEMBER]);
      assert.equal((await linkFor(AUTHOR))?.linkFinalization, "confirmed");
    });

    it("returns the stored outcome for a repeated recovery id without moving the link again", async () => {
      const first = await recover();
      const afterFirst = await linkFor(AUTHOR);
      const second = await recover({ timestamp: String(Math.floor(Date.now() / 1000) - 1) });

      assert.equal(second.status, 200);
      assert.deepEqual(second.body.data, first.body.data);
      assert.deepEqual(await linkFor(AUTHOR), afterFirst);
      assert.equal(
        (await store.listAudits()).filter((audit) => audit.action === "link_binding_recovered").length,
        1,
      );
    });

    it("returns the stored outcome for a lost response after the replay cache is cleared", async () => {
      const timestamp = nowTimestamp();
      const first = await recover({ timestamp });
      resetIntegrityMediaBindingRecoveryReplayCacheForTests();
      const lost = await recover({ timestamp });

      assert.equal(lost.status, 200);
      assert.deepEqual(lost.body.data, first.body.data);
    });

    it("returns the stored outcome for the identical signed request even while it is cached", async () => {
      const timestamp = nowTimestamp();
      const first = await recover({ timestamp });
      const identical = await recover({ timestamp });

      assert.equal(identical.status, 200);
      assert.deepEqual(identical.body.data, first.body.data);
    });

    it("reports a changed body under the same recovery id as a conflict", async () => {
      await recover();
      const after = await linkFor(AUTHOR);
      const changed = await recover({ body: { ...requestBody(), expectedHuLinkInstanceId: OTHER_INSTANCE } });

      assert.equal(changed.status, 409);
      assert.equal(changed.body.meta.code, "recovery_conflict");
      assert.deepEqual(await linkFor(AUTHOR), after);
    });

    it("refuses a second recovery id after success because the historical tuple moved", async () => {
      const first = await recover();
      await store.insertResult(result({ resultCode: "secondResultCode_0123456789abcdefABCD", memberId: OTHER_MEMBER }));
      const secondBody = {
        ...requestBody(),
        resultCode: "secondResultCode_0123456789abcdefABCD",
      };

      const whileProvisional = await recover({
        body: { ...secondBody, recoveryId: "recovery-id-0099-abcdef" },
      });
      assert.equal(whileProvisional.status, 409);
      assert.equal(whileProvisional.body.meta.code, "link_provisional");

      await acknowledge(
        REPLACEMENT_MEMBER,
        first.body.data?.linkRevision as number,
        first.body.data?.linkInstanceId as string,
      );
      const afterAcknowledgement = await recover({
        body: { ...secondBody, recoveryId: "recovery-id-0097-abcdef" },
      });
      assert.equal(afterAcknowledgement.status, 409);
      assert.equal(afterAcknowledgement.body.meta.code, "historical_member_mismatch");
      assert.equal((await linkFor(AUTHOR))?.memberId, REPLACEMENT_MEMBER);
      assert.equal((await store.listResults()).find((row) => row.memberId === OTHER_MEMBER)?.consumedAt, null);
    });

    it("refuses another recovery id on a link that was already recovered and acknowledged", async () => {
      const first = await recover();
      await acknowledge(
        REPLACEMENT_MEMBER,
        first.body.data?.linkRevision as number,
        first.body.data?.linkInstanceId as string,
      );
      await store.insertResult(result({ resultCode: "secondResultCode_0123456789abcdefABCD", memberId: OTHER_MEMBER }));
      const second = await recover({
        body: {
          ...requestBody(),
          recoveryId: "recovery-id-0098-abcdef",
          resultCode: "secondResultCode_0123456789abcdefABCD",
          expectedHuMemberId: REPLACEMENT_MEMBER,
          expectedHuLinkRevision: first.body.data?.linkRevision as number,
          expectedHuLinkInstanceId: first.body.data?.linkInstanceId as string,
        },
      });

      assert.equal(second.status, 409);
      assert.equal(second.body.meta.code, "historical_binding_mismatch");
      assert.equal((await linkFor(AUTHOR))?.memberId, REPLACEMENT_MEMBER);
    });

    it("lets one of two concurrent requests with one recovery id move the link", async () => {
      const [first, second] = await Promise.all([
        recover(),
        recover({ timestamp: String(Math.floor(Date.now() / 1000) - 2) }),
      ]);

      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.deepEqual(first.body.data, second.body.data);
      assert.equal((await linkFor(AUTHOR))?.linkRevision, HISTORICAL_REVISION + 1);
      assert.equal((await store.listBindingRecoveryReceipts()).length, 1);
    });

    it("lets one of two concurrent requests with different recovery ids move the link", async () => {
      await store.insertResult(result({ resultCode: "secondResultCode_0123456789abcdefABCD", memberId: OTHER_MEMBER }));
      const responses = await Promise.all([
        recover(),
        recover({
          body: { ...requestBody(), recoveryId: "recovery-id-0002-abcdef", resultCode: "secondResultCode_0123456789abcdefABCD" },
        }),
      ]);
      const statuses = responses.map((response) => response.status).sort();

      assert.deepEqual(statuses, [200, 409]);
      assert.equal((await linkFor(AUTHOR))?.linkRevision, HISTORICAL_REVISION + 1);
      assert.equal((await store.listLinks()).length, 1);
    });

    it("rejects the identical signature after an attempt that committed nothing", async () => {
      const inner = store;
      let failNext = true;
      const rollingBack: ExternalAuthorLinkStore = {
        ...inner,
        async applyBindingRecovery(input) {
          if (failNext) {
            failNext = false;
            const error = new Error("Transaction numbers are only allowed on a replica set member or mongos");
            throw error;
          }
          return inner.applyBindingRecovery(input);
        },
      };
      setExternalAuthorLinkStoreForTests(rollingBack);
      const timestamp = nowTimestamp();

      await assert.rejects(async () => {
        const response = await recover({ timestamp });
        if (response.status >= 500) {
          throw new Error(`server error ${response.status}`);
        }
      });
      const replay = await recover({ timestamp });
      assert.equal(replay.status, 401);
      assert.equal(replay.body.meta.code, "replayed");
      assert.equal((await linkFor(AUTHOR))?.memberId, HISTORICAL_MEMBER);

      const fresh = await recover({ timestamp: String(Number(timestamp) - 1) });
      assert.equal(fresh.status, 200);
    });

    it("finishes after an interruption following the rebind", async () => {
      setIntegrityMediaBindingRecoveryInterruptForTests("after_rebind");
      const interrupted = await recover();
      assert.equal(interrupted.status, 503);
      assert.equal(interrupted.body.meta.code, "recovery_incomplete");
      assert.equal((await store.listResults())[0]?.consumedAt, null);
      assert.equal((await store.listResults())[0]?.bindingRecoveryReservationId, RECOVERY_ID);

      const ordinary = await redeem(RESULT_CODE, OTHER_AUTHOR);
      assert.equal(ordinary.status, 409);
      assert.equal(ordinary.body.meta.code, "result_already_used");
      assert.equal((await store.listResults())[0]?.consumedAt, null);

      setIntegrityMediaBindingRecoveryInterruptForTests(null);
      const moved = await linkFor(AUTHOR);
      const finished = await recover({ timestamp: String(Math.floor(Date.now() / 1000) - 1) });

      assert.equal(finished.status, 200);
      assert.equal(finished.body.data?.linkInstanceId, moved?.linkInstanceId);
      assert.equal(finished.body.data?.linkRevision, HISTORICAL_REVISION + 1);
      assert.ok((await store.listResults())[0]?.consumedAt);
      assert.equal((await store.listBindingRecoveryReceipts())[0]?.status, "completed");
    });

    it("finishes after an interruption following consumption and writes one audit", async () => {
      setIntegrityMediaBindingRecoveryInterruptForTests("after_consume");
      const interrupted = await recover();
      assert.equal(interrupted.status, 503);
      assert.equal(interrupted.body.meta.code, "recovery_incomplete");

      setIntegrityMediaBindingRecoveryInterruptForTests(null);
      const finished = await recover({ timestamp: String(Math.floor(Date.now() / 1000) - 1) });

      assert.equal(finished.status, 200);
      assert.equal(finished.body.data?.memberId, REPLACEMENT_MEMBER);
      assert.equal(
        (await store.listAudits()).filter((audit) => audit.action === "link_binding_recovered").length,
        1,
      );
    });
  });

  describe("existing flows", () => {
    it("records a disconnect of the old generation as superseded without disabling the new row", async () => {
      await recover();
      const disconnect = await disconnectRevision(HISTORICAL_REVISION);

      assert.equal(disconnect.ok, true);
      assert.equal(disconnect.ok && disconnect.superseded, true);
      assert.equal((await linkFor(AUTHOR))?.state, "linked");
      assert.equal((await linkFor(AUTHOR))?.memberId, REPLACEMENT_MEMBER);
    });

    it("disconnects the new generation through the ordinary path", async () => {
      const recovered = await recover();
      const disconnect = await disconnectRevision(recovered.body.data?.linkRevision as number);

      assert.equal(disconnect.ok, true);
      assert.equal(disconnect.ok && disconnect.superseded, false);
      assert.equal((await linkFor(AUTHOR))?.state, "disabled");
    });

    it("does not let the old generation hold a reply", async () => {
      await recover();
      const held = await store.holdAuthorReplyLink({
        source: INTEGRITY_MEDIA_SOURCE,
        externalAuthorId: AUTHOR,
        memberId: HISTORICAL_MEMBER,
        linkRevision: HISTORICAL_REVISION,
      });

      assert.equal(held, null);
    });

    it("keeps ordinary connect working for another author", async () => {
      await recover();
      await store.insertResult(result({ resultCode: "ordinaryResultCode_0123456789abcdefABC", memberId: OTHER_MEMBER }));
      const redeemed = await redeem("ordinaryResultCode_0123456789abcdefABC", OTHER_AUTHOR);

      assert.equal(redeemed.status, 200);
      assert.equal(redeemed.body.data?.memberId, OTHER_MEMBER);
      assert.equal((await linkFor(OTHER_AUTHOR))?.linkFinalization, "provisional");
      assert.equal((await linkFor(AUTHOR))?.memberId, REPLACEMENT_MEMBER);
    });

    it("keeps memory stores isolated from each other", async () => {
      const other = createMemoryExternalAuthorLinkStore();
      await recover();

      assert.deepEqual(await other.listLinks(), []);
      assert.deepEqual(await other.listBindingRecoveryReceipts(), []);
      assert.equal(await other.findBindingRecoveryReceipt(RECOVERY_ID), null);
    });
  });
});

function requestBody(): IntegrityMediaBindingRecoveryRequest {
  return {
    resultCode: RESULT_CODE,
    externalAuthorId: AUTHOR,
    huTarget: "staging",
    expectedHuMemberId: HISTORICAL_MEMBER,
    expectedHuLinkRevision: HISTORICAL_REVISION,
    expectedHuLinkInstanceId: HISTORICAL_INSTANCE,
    recoveryId: RECOVERY_ID,
  };
}

async function recover(options: RecoverOptions = {}): Promise<{ status: number; body: ApiBody }> {
  const body = options.body ?? requestBody();
  const timestamp = options.timestamp ?? nowTimestamp();
  const signature =
    options.signature ??
    signIntegrityMediaLinkRedeem(
      SECRET,
      buildIntegrityMediaBindingRecoveryPayload({
        timestamp,
        resultCode: String(body.resultCode),
        externalAuthorId: String(body.externalAuthorId),
        huTarget: String(body.huTarget),
        expectedHuMemberId: String(body.expectedHuMemberId),
        expectedHuLinkRevision: Number(body.expectedHuLinkRevision),
        expectedHuLinkInstanceId: String(body.expectedHuLinkInstanceId),
        recoveryId: String(body.recoveryId),
      }),
    );
  const response = await fetch(
    `${baseUrl}/api/v1/integrity-media/link/binding-recovery/redeem${options.query ?? ""}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hu-integrity-media-timestamp": ` ${timestamp} `,
        "x-hu-integrity-media-signature": signature,
      },
      body: JSON.stringify(body),
    },
  );
  return { status: response.status, body: (await response.json().catch(() => ({}))) as ApiBody };
}

async function acknowledge(
  memberId: string,
  linkRevision: number,
  linkInstanceId: string,
): Promise<{ status: number; body: ApiBody }> {
  const eventId = randomUUID();
  const timestamp = nowTimestamp();
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
  const response = await fetch(`${baseUrl}/api/v1/integrity-media/link/acknowledge`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hu-integrity-media-timestamp": timestamp,
      "x-hu-integrity-media-signature": signature,
    },
    body: JSON.stringify({ eventId, externalAuthorId: AUTHOR, memberId, linkRevision, linkInstanceId }),
  });
  return { status: response.status, body: (await response.json()) as ApiBody };
}

async function redeem(resultCode: string, externalAuthorId: string): Promise<{ status: number; body: ApiBody }> {
  const timestamp = nowTimestamp();
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

async function disconnectRevision(linkRevision: number) {
  const eventId = randomUUID();
  const timestamp = nowTimestamp();
  return acceptIntegrityMediaAuthorDisconnect({
    eventId,
    authorId: AUTHOR,
    timestamp,
    signature: signIntegrityMediaAuthorDisconnect(
      SECRET,
      buildIntegrityMediaAuthorDisconnectCanonical({ timestamp, eventId, authorId: AUTHOR, linkRevision }),
    ),
    secret: SECRET,
    protocol: { kind: "numbered", linkRevision },
  });
}

function confirmedLink(overrides: Partial<ExternalAuthorLinkRecord> = {}): ExternalAuthorLinkRecord {
  return {
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: AUTHOR,
    memberId: HISTORICAL_MEMBER,
    state: "linked",
    createdAt: CREATED_AT,
    updatedAt: CONFIRMED_AT,
    confirmedAt: CONFIRMED_AT,
    disconnectedAt: null,
    collaborationStatus: "blocked",
    authorActivationPending: false,
    linkRevision: HISTORICAL_REVISION,
    linkInstanceId: HISTORICAL_INSTANCE,
    linkFinalization: "confirmed",
    ...overrides,
  };
}

function legacyLink(): ExternalAuthorLinkRecord {
  const { linkFinalization: _finalization, linkInstanceId: _instance, ...legacy } = confirmedLink();
  return legacy;
}

function result(overrides: Partial<ExternalAuthorLinkResultRecord> = {}): ExternalAuthorLinkResultRecord {
  return {
    resultCode: RESULT_CODE,
    source: INTEGRITY_MEDIA_SOURCE,
    attemptState: "ordinaryAttemptState01",
    memberId: REPLACEMENT_MEMBER,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    consumedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function provisionAttemptRecord(attemptId: string, externalAuthorId: string) {
  const now = new Date().toISOString();
  return {
    attemptId,
    externalAuthorId,
    email: "author@example.com",
    displayName: "Example Author",
    target: "staging",
    expiresAt: Math.floor(Date.now() / 1000) + 600,
    returnPath: "/api/author/humanity-union-link/complete",
    emailVerification: "pending" as const,
    memberId: REPLACEMENT_MEMBER,
    userId: randomUUID(),
    createdMember: true,
    createdAt: now,
    updatedAt: now,
  };
}

async function freshStoreWith(record: ExternalAuthorLinkResultRecord): Promise<ExternalAuthorLinkStore> {
  const fresh = createMemoryExternalAuthorLinkStore();
  setExternalAuthorLinkStoreForTests(fresh);
  await fresh.insertLink(confirmedLink());
  await fresh.insertResult(record);
  return fresh;
}

async function linkFor(externalAuthorId: string): Promise<ExternalAuthorLinkRecord | undefined> {
  return (await store.listLinks()).find((link) => link.externalAuthorId === externalAuthorId);
}

async function snapshot() {
  return {
    links: await store.listLinks(),
    results: await store.listResults(),
    audits: await store.listAudits(),
    receipts: await store.listBindingRecoveryReceipts(),
  };
}

function nowTimestamp(): string {
  return String(Math.floor(Date.now() / 1000));
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
