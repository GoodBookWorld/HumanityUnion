/**
 * HU-LC-05C.4C.6C — Petition signature security hardening.
 *
 * Signing and withdrawal are accepted only on Open Petitions whose Initiative
 * passes the canonical public contract (`canExposePublicInitiativeProjection`),
 * withdrawal only while Open and only for the caller's own signature, and every
 * refusal answers with an identifier-free message while leaving signatures and
 * counters untouched.
 *
 * Real Express routers + auth middleware over a process-owned single-node
 * MongoMemoryReplSet (one hu_test_ database, dropped afterwards).
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_PETITION_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
process.env.NOTIFICATION_PERSISTENCE = "memory";
process.env.PETITION_VISITOR_SIGNAL_PERSISTENCE = "memory";
process.env.JWT_ACCESS_SECRET = "hu-lc-05c4c4-6c-test-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET = "hu-lc-05c4c4-6c-test-refresh-secret-0123456789abcdef";
process.env.AUTH_BOOTSTRAP_FALLBACK = "false";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import express from "express";
import type { Collection, Document } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import type { Initiative, PetitionState } from "@hu/types";

import type * as AuthTokens from "../../../src/modules/auth/auth-tokens.js";
import type * as PetitionStore from "../../../src/modules/petition/petition.store.js";
import type * as PetitionTestHelpers from "./petition-test-helpers.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_pet_sig_sec_${RUN}`;

const STEWARD = { userId: `user-6c-steward-${RUN}`, memberId: `member-6c-steward-${RUN}` };
const SIGNER_1 = { userId: `user-6c-signer1-${RUN}`, memberId: `member-6c-signer1-${RUN}` };
const SIGNER_2 = { userId: `user-6c-signer2-${RUN}`, memberId: `member-6c-signer2-${RUN}` };
const INELIGIBLE = {
  userId: `user-6c-ineligible-${RUN}`,
  memberId: `member-6c-ineligible-${RUN}`,
};
const USERS = { steward: STEWARD, signer1: SIGNER_1, signer2: SIGNER_2, ineligible: INELIGIBLE };

const INITIATIVE = {
  public: `initiative-6c-public-${RUN}`,
  private: `initiative-6c-private-${RUN}`,
  unprojected: `initiative-6c-unprojected-${RUN}`,
  blocked: `initiative-6c-blocked-${RUN}`,
  orphanSource: `initiative-6c-orphan-source-${RUN}`,
};
const MISSING_INITIATIVE = `initiative-6c-missing-${RUN}`;

type Caller = keyof typeof USERS;

type Mods = {
  store: typeof PetitionStore;
  helpers: typeof PetitionTestHelpers;
  tokens: typeof AuthTokens;
  petitions: () => Collection<Document>;
};

let mods: Mods;
let replSet: MongoMemoryReplSet | null = null;
let server: Server | null = null;
let baseUrl = "";
let connected = false;
let counter = 0;

function headersFor(caller: Caller): Record<string, string> {
  const user = USERS[caller];
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${mods.tokens.createAccessToken({
      sub: user.userId,
      memberId: user.memberId,
      role: "member",
      displayName: `6C ${caller}`,
      email: `${user.userId}@example.test`,
    })}`,
  };
}

type CallResult = {
  status: number;
  text: string;
  message: string;
  data: Record<string, unknown> | null;
};

async function call(
  action: "sign" | "withdraw",
  petitionId: string,
  caller: Caller,
  body: unknown = {},
): Promise<CallResult> {
  const suffix = action === "sign" ? "signatures" : "signatures/withdraw";
  const response = await fetch(`${baseUrl}/api/v1/petitions/${petitionId}/${suffix}`, {
    method: "POST",
    headers: headersFor(caller),
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const json = JSON.parse(text) as { message?: string; data?: Record<string, unknown> | null };
  return { status: response.status, text, message: json.message ?? "", data: json.data ?? null };
}

async function seedPetition(initiativeId: string, status: PetitionState = "Open"): Promise<string> {
  counter += 1;
  const petitionId = `petition-6c-${counter}-${RUN}`;
  const decisionId = `decision-${petitionId}`;
  await mods.helpers.seedApprovedDecision(decisionId, initiativeId);
  const fixture = mods.helpers.buildFixturePetition({ petitionId, decisionId, initiativeId });
  await mods.store.createPetition({
    ...fixture,
    policy: {
      ...fixture.policy,
      withdrawalPolicy: { ...fixture.policy.withdrawalPolicy, withdrawalPermitted: true },
    },
  });
  const steps: Array<[PetitionState, (id: string) => Promise<unknown>]> = [
    ["Ready", mods.store.preparePetition],
    ["Published", mods.store.publishPetitionForTests],
    ["Open", mods.store.openPetition],
  ];
  for (const [reached, step] of steps) {
    await step(petitionId);
    if (reached === status) {
      break;
    }
  }
  return petitionId;
}

async function repointInitiative(petitionId: string, initiativeId: string): Promise<void> {
  await mods
    .petitions()
    .updateOne({ petitionId }, { $set: { "subject.initiativeId": initiativeId } });
}

/** Stored signatures + counters, used to prove a refused call changed nothing. */
async function snapshot(petitionId: string) {
  const petition = await mods.store.getPetition(petitionId);
  assert.ok(petition, `${petitionId} exists`);
  return { signatures: petition.signatures, supportMetrics: petition.supportMetrics };
}

async function activeSigners(petitionId: string): Promise<string[]> {
  return (await snapshot(petitionId)).signatures
    .filter((signature) => signature.status === "Active")
    .map((signature) => signature.participantId)
    .sort();
}

function assertNoSignerIdentifiers(result: CallResult): void {
  for (const user of Object.values(USERS)) {
    assert.equal(result.text.includes(user.memberId), false, `${user.memberId} leaked`);
    assert.equal(result.text.includes(user.userId), false, `${user.userId} leaked`);
  }
}

/** Error responses: no identifiers and no implementation details. */
function assertNoInternalIdentifiers(result: CallResult): void {
  assertNoSignerIdentifiers(result);
  for (const marker of ["signature-", 'Participant "', "_id", "Mongo", "E11000", "    at "]) {
    assert.equal(result.text.includes(marker), false, `internal detail "${marker}" leaked`);
  }
}

async function assertRefused(
  action: "sign" | "withdraw",
  petitionId: string,
  caller: Caller,
  expected: { status: number; message: string },
  body: unknown = {},
): Promise<void> {
  const before = await snapshot(petitionId);
  const result = await call(action, petitionId, caller, body);
  assert.equal(result.status, expected.status, result.text);
  assert.equal(result.message, expected.message);
  assert.equal(result.data, null);
  assertNoInternalIdentifiers(result);
  assert.deepEqual(await snapshot(petitionId), before, "signatures and counters unchanged");
}

const NOT_FOUND = { status: 404, message: "Petition not found." };

describe("HU-LC-05C.4C.6C — Petition signature security", () => {
  before(async () => {
    const isolation =
      await import("../../../src/infrastructure/mongodb/explicit-isolated-mongo-test.js");
    const connection = await import("../../../src/infrastructure/mongodb/mongo-connection.js");
    const database = await import("../../../src/infrastructure/mongodb/mongo-database.js");
    const indexes = await import("../../../src/infrastructure/mongodb/mongo-indexes.js");

    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    const uri = replSet.getUri(DATABASE);
    assert.match(new URL(uri.replace(/^mongodb:/, "http:")).hostname, /^(127\.0\.0\.1|localhost)$/);
    isolation.assertExplicitIsolatedMongoTestTarget({ uri, database: DATABASE });
    isolation.lockExplicitIsolatedMongoTestConfig({ uri, database: DATABASE });
    await connection.connectMongoClient();
    connected = true;
    assert.equal(database.getMongoDatabase().databaseName, DATABASE);
    await indexes.ensureMongoIndexes();

    const gate = await import("../../../src/modules/auth/auth-active-account-gate.js");
    gate.setAuthUserLookupOverrideForTests(
      async (userId: string) => ({ id: userId, userId, status: "active" }) as never,
    );

    const initiatives = await import("../../../src/modules/initiatives/initiative.store.js");
    const now = new Date().toISOString();
    const fixtures: Array<[string, Partial<Initiative>]> = [
      [INITIATIVE.public, {}],
      [INITIATIVE.private, { visibility: { policy: "steward_only" } }],
      [INITIATIVE.unprojected, { lifecyclePhase: "published" as Initiative["lifecyclePhase"] }],
      [INITIATIVE.blocked, { administrativelyBlocked: true }],
      [INITIATIVE.orphanSource, {}],
    ];
    for (const [initiativeId, overrides] of fixtures) {
      initiatives.createInitiative({
        initiativeId,
        stewardId: STEWARD.memberId,
        title: `6C ${initiativeId}`,
        description: "Fixture Initiative for Petition signature security.",
        status: "implementation",
        lifecyclePhase: "projected",
        lifecycleProfile: "STANDARD",
        visibility: { policy: "public" },
        metadata: { activityArea: "Environment", communitySlug: "fixture-community" },
        timeline: [],
        createdAt: now,
        updatedAt: now,
        ...overrides,
      } as unknown as Initiative);
    }

    // The member repository refuses writes under NODE_TEST_ENV; seed the canonical
    // member documents directly into this test's isolated database. INELIGIBLE has
    // no member record and so fails the default membership-required policy.
    const memberPersistence =
      await import("../../../src/modules/member/infrastructure/member.persistence.js");
    for (const signer of [SIGNER_1, SIGNER_2]) {
      await database
        .getMongoDatabase()
        .collection("members")
        .insertOne(
          memberPersistence.toMemberMongoDocument(
            memberPersistence.buildNewPersistedMember({
              memberId: signer.memberId,
              identityId: signer.userId,
              displayName: `6C ${signer.memberId}`,
              uniqueName: signer.memberId,
            }),
          ),
        );
    }

    mods = {
      store: await import("../../../src/modules/petition/petition.store.js"),
      helpers: await import("./petition-test-helpers.js"),
      tokens: await import("../../../src/modules/auth/auth-tokens.js"),
      petitions: () => database.getMongoDatabase().collection("petitions"),
    };

    const petitionRouter = (await import("../../../src/modules/petition/petition.routes.js"))
      .default;
    const app = express();
    app.use(express.json());
    app.use("/api/v1/petitions", petitionRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  });

  after(async () => {
    const gate = await import("../../../src/modules/auth/auth-active-account-gate.js");
    gate.setAuthUserLookupOverrideForTests(null);
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    const connection = await import("../../../src/infrastructure/mongodb/mongo-connection.js");
    const database = await import("../../../src/infrastructure/mongodb/mongo-database.js");
    try {
      if (connected && database.getMongoDatabase().databaseName === DATABASE) {
        await database.getMongoDatabase().dropDatabase();
      }
    } finally {
      if (connected) {
        await connection.disconnectMongoClient();
      }
      await replSet?.stop({ doCleanup: true });
    }
  });

  it("1. an eligible signer signs a public Open Petition", async () => {
    const petitionId = await seedPetition(INITIATIVE.public);
    const result = await call("sign", petitionId, "signer1");
    assert.equal(result.status, 201, result.text);
    assert.equal("signatures" in result.data!, false);
    assert.equal((result.data!.supportMetrics as { totalSignatures: number }).totalSignatures, 1);
    assertNoSignerIdentifiers(result);
    assert.deepEqual(await activeSigners(petitionId), [SIGNER_1.memberId]);
  });

  it("2. duplicate signing is refused without changes", async () => {
    const petitionId = await seedPetition(INITIATIVE.public);
    assert.equal((await call("sign", petitionId, "signer1")).status, 201);
    await assertRefused("sign", petitionId, "signer1", {
      status: 409,
      message: "You have already signed this Petition.",
    });
    assert.deepEqual(await activeSigners(petitionId), [SIGNER_1.memberId]);
  });

  it("3. the original signer may withdraw; the record is kept, not deleted", async () => {
    const petitionId = await seedPetition(INITIATIVE.public);
    assert.equal((await call("sign", petitionId, "signer1")).status, 201);
    const signedAt = (await snapshot(petitionId)).signatures[0]!.signedAt;

    const result = await call("withdraw", petitionId, "signer1");
    assert.equal(result.status, 200, result.text);
    assertNoSignerIdentifiers(result);
    assert.equal((result.data!.supportMetrics as { totalSignatures: number }).totalSignatures, 0);
    const { signatures } = await snapshot(petitionId);
    assert.equal(signatures.length, 1);
    assert.equal(signatures[0]!.status, "Withdrawn");
    assert.equal(signatures[0]!.signedAt, signedAt);
  });

  it("4. another user can never withdraw someone else's signature", async () => {
    const petitionId = await seedPetition(INITIATIVE.public);
    assert.equal((await call("sign", petitionId, "signer1")).status, 201);
    const notSigned = { status: 409, message: "You have not signed this Petition." };
    await assertRefused("withdraw", petitionId, "signer2", notSigned);
    // A body naming the original signer is ignored: the actor is always the caller.
    await assertRefused("withdraw", petitionId, "signer2", notSigned, {
      participantId: SIGNER_1.memberId,
    });
    assert.deepEqual(await activeSigners(petitionId), [SIGNER_1.memberId]);
  });

  it("5. signing after the Petition closes is refused", async () => {
    const petitionId = await seedPetition(INITIATIVE.public);
    assert.equal((await call("sign", petitionId, "signer1")).status, 201);
    await mods.store.closePetition(petitionId);
    await assertRefused("sign", petitionId, "signer2", {
      status: 409,
      message: "This Petition is no longer open for signatures.",
    });
  });

  it("6. withdrawal after the Petition closes is refused and the signature stands", async () => {
    const petitionId = await seedPetition(INITIATIVE.public);
    assert.equal((await call("sign", petitionId, "signer1")).status, 201);
    await mods.store.closePetition(petitionId);
    await assertRefused("withdraw", petitionId, "signer1", {
      status: 409,
      message: "This Petition is no longer open for signatures.",
    });
    assert.deepEqual(await activeSigners(petitionId), [SIGNER_1.memberId]);
  });

  for (const [label, initiativeId] of [
    ["7. a private", INITIATIVE.private],
    ["8. a blocked", INITIATIVE.blocked],
    ["9. an unprojected", INITIATIVE.unprojected],
  ] as const) {
    it(`${label} Initiative refuses signing and withdrawal`, async () => {
      const petitionId = await seedPetition(initiativeId);
      await assertRefused("sign", petitionId, "signer1", NOT_FOUND);
      await assertRefused("withdraw", petitionId, "signer1", NOT_FOUND);
      assert.deepEqual(await activeSigners(petitionId), []);

      // A signature given while the Initiative was public cannot be withdrawn once
      // it is hidden, and is never touched.
      const signedWhilePublic = await seedPetition(INITIATIVE.public);
      assert.equal((await call("sign", signedWhilePublic, "signer1")).status, 201);
      await repointInitiative(signedWhilePublic, initiativeId);
      await assertRefused("withdraw", signedWhilePublic, "signer1", NOT_FOUND);
      await assertRefused("sign", signedWhilePublic, "signer2", NOT_FOUND);
      assert.deepEqual(await activeSigners(signedWhilePublic), [SIGNER_1.memberId]);
    });
  }

  it("7b. the steward of a private Initiative cannot sign either", async () => {
    const petitionId = await seedPetition(INITIATIVE.private);
    await assertRefused("sign", petitionId, "steward", {
      status: 409,
      message: "This Petition is not open for signatures.",
    });
  });

  it("10. a missing Initiative refuses signing and withdrawal", async () => {
    const petitionId = await seedPetition(INITIATIVE.orphanSource);
    await repointInitiative(petitionId, MISSING_INITIATIVE);
    await assertRefused("sign", petitionId, "signer1", NOT_FOUND);
    await assertRefused("withdraw", petitionId, "signer1", NOT_FOUND);
    assert.deepEqual(await activeSigners(petitionId), []);
  });

  it("11. error responses never carry signer identifiers or internals", async () => {
    const petitionId = await seedPetition(INITIATIVE.public);
    await assertRefused("sign", petitionId, "ineligible", {
      status: 403,
      message: "You are not eligible to sign this Petition.",
    });
    await assertRefused(
      "sign",
      petitionId,
      "signer2",
      { status: 403, message: "You can sign a Petition only as yourself." },
      { participantId: SIGNER_1.memberId },
    );
    const unknown = await call("sign", `petition-6c-unknown-${RUN}`, "signer1");
    assert.equal(unknown.status, 404, unknown.text);
    assert.equal(unknown.message, NOT_FOUND.message);
    assertNoInternalIdentifiers(unknown);

    // Unexpected failures: generic message to the client, details in server logs.
    const broken = await seedPetition(INITIATIVE.public);
    assert.equal((await call("sign", broken, "signer1")).status, 201);
    await mods
      .petitions()
      .updateOne({ petitionId: broken }, { $set: { "policy.withdrawalPolicy": null } });
    const logged: string[] = [];
    const originalError = console.error;
    console.error = (line: unknown) => {
      logged.push(String(line));
    };
    let result: CallResult;
    try {
      result = await call("withdraw", broken, "signer1");
    } finally {
      console.error = originalError;
    }
    assert.equal(result.status, 500, result.text);
    assert.equal(result.message, "We could not withdraw your signature. Please try again later.");
    assertNoInternalIdentifiers(result);
    assert.equal(result.text.includes("withdrawalPermitted"), false);
    assert.equal(result.text.includes("Cannot read"), false);
    const diagnostic = logged.find((line) => line.includes("petition.signature.request_failed"));
    assert.ok(diagnostic, "server-side diagnostic logged");
    assert.match(diagnostic, /"action":"withdraw"/);
    assert.match(diagnostic, /withdrawalPermitted/);
    assert.deepEqual(await activeSigners(broken), [SIGNER_1.memberId]);
  });

  it("12. signatures of Petitions in the same Initiative are accounted independently", async () => {
    const petitionA = await seedPetition(INITIATIVE.public);
    const petitionB = await seedPetition(INITIATIVE.public);

    assert.equal((await call("sign", petitionA, "signer1")).status, 201);
    assert.equal((await call("sign", petitionB, "signer1")).status, 201);
    assert.equal((await call("sign", petitionB, "signer2")).status, 201);
    const bBefore = await snapshot(petitionB);

    assert.equal((await call("withdraw", petitionA, "signer1")).status, 200);
    await assertRefused("sign", petitionB, "signer1", {
      status: 409,
      message: "You have already signed this Petition.",
    });

    assert.deepEqual(await activeSigners(petitionA), []);
    assert.deepEqual(await snapshot(petitionB), bBefore, "Petition B untouched by A");
    assert.deepEqual(await activeSigners(petitionB), [SIGNER_1.memberId, SIGNER_2.memberId].sort());
    assert.equal(bBefore.supportMetrics.totalSignatures, 2);
  });
});
