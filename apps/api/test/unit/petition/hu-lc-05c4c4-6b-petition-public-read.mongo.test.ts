/**
 * HU-LC-05C.4C.6B — Petition public read hardening.
 *
 * Legacy `/api/v1/petitions` reads and the public `/api/v1/public/petitions`
 * routes return only publicly readable Petitions (public status + an
 * ordinary-public Initiative), never signer identities or internal policy,
 * and sign / withdraw responses no longer carry other signers' identities.
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
process.env.JWT_ACCESS_SECRET = "hu-lc-05c4c4-6b-test-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET = "hu-lc-05c4c4-6b-test-refresh-secret-0123456789abcdef";
process.env.AUTH_BOOTSTRAP_FALLBACK = "false";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import express from "express";
import type { Collection } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import type { Initiative, PetitionState } from "@hu/types";

import type * as AuthTokens from "../../../src/modules/auth/auth-tokens.js";
import type * as PetitionStore from "../../../src/modules/petition/petition.store.js";
import type * as PetitionTestHelpers from "./petition-test-helpers.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_pet_public_read_${RUN}`;

const STEWARD = { userId: `user-6b-steward-${RUN}`, memberId: `member-6b-steward-${RUN}` };
const OUTSIDER = { userId: `user-6b-outsider-${RUN}`, memberId: `member-6b-outsider-${RUN}` };
const SIGNER_1 = { userId: `user-6b-signer1-${RUN}`, memberId: `member-6b-signer1-${RUN}` };
const SIGNER_2 = { userId: `user-6b-signer2-${RUN}`, memberId: `member-6b-signer2-${RUN}` };

const INITIATIVE = {
  public: `initiative-6b-public-${RUN}`,
  private: `initiative-6b-private-${RUN}`,
  unprojected: `initiative-6b-unprojected-${RUN}`,
  blocked: `initiative-6b-blocked-${RUN}`,
  orphanSource: `initiative-6b-orphan-source-${RUN}`,
};
const MISSING_INITIATIVE = `initiative-6b-missing-${RUN}`;

type Caller = "anonymous" | "steward" | "outsider" | "signer1" | "signer2";

type Mods = {
  store: typeof PetitionStore;
  helpers: typeof PetitionTestHelpers;
  tokens: typeof AuthTokens;
  petitions: () => Collection<{ petitionId: string; subject: { initiativeId: string } }>;
};

let mods: Mods;
let replSet: MongoMemoryReplSet | null = null;
let server: Server | null = null;
let baseUrl = "";
let connected = false;
let counter = 0;
const ids: Record<string, string> = {};

function headersFor(caller: Caller): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const user = {
    anonymous: null,
    steward: STEWARD,
    outsider: OUTSIDER,
    signer1: SIGNER_1,
    signer2: SIGNER_2,
  }[caller];
  if (user) {
    headers.Authorization = `Bearer ${mods.tokens.createAccessToken({
      sub: user.userId,
      memberId: user.memberId,
      role: "member",
      displayName: `6B ${caller}`,
      email: `${user.userId}@example.test`,
    })}`;
  }
  return headers;
}

async function call(
  method: "GET" | "POST",
  path: string,
  caller: Caller = "anonymous",
  body?: unknown,
): Promise<{ status: number; text: string; data: Record<string, unknown> | null }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headersFor(caller),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  const json = (() => {
    try {
      return JSON.parse(text) as { data?: Record<string, unknown> | null };
    } catch {
      return {};
    }
  })();
  return { status: response.status, text, data: json.data ?? null };
}

async function seedPetition(
  key: string,
  initiativeId: string,
  status: PetitionState,
): Promise<string> {
  counter += 1;
  const petitionId = `petition-6b-${key}-${counter}-${RUN}`;
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
    if (status === "Draft") {
      break;
    }
    await step(petitionId);
    if (reached === status) {
      break;
    }
  }
  ids[key] = petitionId;
  return petitionId;
}

const HIDDEN_KEYS = ["draft", "ready", "private", "unprojected", "blocked", "orphan"] as const;

function assertPublicSafeShape(record: Record<string, unknown>): void {
  assert.equal("signatures" in record, false, "no signatures array");
  assert.deepEqual(
    Object.keys(record.policy as Record<string, unknown>).sort(),
    ["endorsementPeriod", "withdrawalPolicy"],
    "only the public policy parts",
  );
  for (const field of [
    "petitionId",
    "status",
    "subject",
    "collectiveDecisionId",
    "supportMetrics",
    "createdAt",
  ]) {
    assert.ok(field in record, `consumer field ${field} kept`);
  }
}

function assertNoSignerIdentity(text: string): void {
  for (const signer of [SIGNER_1, SIGNER_2]) {
    assert.equal(text.includes(signer.memberId), false, `${signer.memberId} must not appear`);
    assert.equal(text.includes(signer.userId), false, `${signer.userId} must not appear`);
  }
}

describe("HU-LC-05C.4C.6B — Petition public read hardening", () => {
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
        title: `6B ${initiativeId}`,
        description: "Fixture Initiative for Petition public read hardening.",
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
    // member documents directly into this test's isolated database.
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
              displayName: `6B ${signer.memberId}`,
              uniqueName: signer.memberId,
            }),
          ),
        );
    }

    mods = {
      store: await import("../../../src/modules/petition/petition.store.js"),
      helpers: await import("./petition-test-helpers.js"),
      tokens: await import("../../../src/modules/auth/auth-tokens.js"),
      petitions: () =>
        database
          .getMongoDatabase()
          .collection<{ petitionId: string; subject: { initiativeId: string } }>("petitions"),
    };

    await seedPetition("open", INITIATIVE.public, "Open");
    await seedPetition("draft", INITIATIVE.public, "Draft");
    await seedPetition("ready", INITIATIVE.public, "Ready");
    await seedPetition("private", INITIATIVE.private, "Open");
    await seedPetition("unprojected", INITIATIVE.unprojected, "Open");
    await seedPetition("blocked", INITIATIVE.blocked, "Open");
    await seedPetition("orphan", INITIATIVE.orphanSource, "Open");
    // Orphan: the Petition points at an Initiative that no longer exists.
    await mods
      .petitions()
      .updateOne(
        { petitionId: ids.orphan },
        { $set: { "subject.initiativeId": MISSING_INITIATIVE } },
      );

    const petitionRouter = (await import("../../../src/modules/petition/petition.routes.js"))
      .default;
    const publicPetitionRouter = (
      await import("../../../src/modules/petition/public-petition.routes.js")
    ).default;
    const app = express();
    app.use(express.json());
    app.use("/api/v1/petitions", petitionRouter);
    app.use("/api/v1/public/petitions", publicPetitionRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;

    // Two real signatures on the public Open Petition.
    for (const signer of ["signer1", "signer2"] as const) {
      const signed = await call("POST", `/api/v1/petitions/${ids.open}/signatures`, signer, {});
      assert.equal(signed.status, 201, signed.text);
    }
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

  it("anonymous list returns only publicly readable Petitions in the public-safe shape", async () => {
    const result = await call("GET", "/api/v1/petitions");
    assert.equal(result.status, 200);
    const list = result.data as unknown as Array<Record<string, unknown>>;
    assert.deepEqual(
      list.map((petition) => petition.petitionId),
      [ids.open],
    );
    list.forEach(assertPublicSafeShape);
    assertNoSignerIdentity(result.text);
    assert.equal(result.text.includes("membershipRequired"), false, "no eligibility internals");
  });

  it("anonymous reads by id / decision / Initiative never expose hidden Petitions", async () => {
    for (const key of HIDDEN_KEYS) {
      const petitionId = ids[key]!;
      assert.equal(
        (await call("GET", `/api/v1/petitions/${petitionId}`)).status,
        404,
        `${key} by id`,
      );
      assert.equal(
        (await call("GET", `/api/v1/petitions/by-collective-decision/decision-${petitionId}`))
          .status,
        404,
        `${key} by decision`,
      );
      assert.equal(
        (await call("GET", `/api/v1/public/petitions/${petitionId}`)).status,
        404,
        `${key} public detail`,
      );
      assert.equal(
        (await call("POST", `/api/v1/public/petitions/${petitionId}/visitor-signal`)).status,
        404,
        `${key} visitor signal`,
      );
    }
    for (const initiativeId of [
      INITIATIVE.private,
      INITIATIVE.unprojected,
      INITIATIVE.blocked,
      MISSING_INITIATIVE,
    ]) {
      assert.equal(
        (await call("GET", `/api/v1/petitions/by-initiative/${initiativeId}`)).status,
        404,
        initiativeId,
      );
    }
  });

  it("authorized public reading of a public Petition keeps every consumer field", async () => {
    const byId = await call("GET", `/api/v1/petitions/${ids.open}`);
    assert.equal(byId.status, 200);
    assertPublicSafeShape(byId.data!);
    assertNoSignerIdentity(byId.text);
    assert.equal(
      (byId.data!.supportMetrics as { totalSignatures: number }).totalSignatures,
      2,
      "aggregate counts stay public",
    );

    const byDecision = await call(
      "GET",
      `/api/v1/petitions/by-collective-decision/decision-${ids.open}`,
    );
    assert.equal(byDecision.status, 200);
    assert.equal(byDecision.data!.petitionId, ids.open);
    assertNoSignerIdentity(byDecision.text);

    // A newer Draft and Ready exist on the same Initiative; anonymous callers get the Open one.
    const byInitiative = await call("GET", `/api/v1/petitions/by-initiative/${INITIATIVE.public}`);
    assert.equal(byInitiative.status, 200);
    assert.equal(byInitiative.data!.petitionId, ids.open);
    assertNoSignerIdentity(byInitiative.text);

    const publicDetail = await call("GET", `/api/v1/public/petitions/${ids.open}`);
    assert.equal(publicDetail.status, 200);
    assertNoSignerIdentity(publicDetail.text);

    const visitor = await call("POST", `/api/v1/public/petitions/${ids.open}/visitor-signal`);
    assert.equal(visitor.status, 200);
  });

  it("sign and withdraw responses never carry other signers' identities", async () => {
    const withdrawn = await call(
      "POST",
      `/api/v1/petitions/${ids.open}/signatures/withdraw`,
      "signer2",
    );
    assert.equal(withdrawn.status, 200, withdrawn.text);
    assertPublicSafeShape(withdrawn.data!);
    assertNoSignerIdentity(withdrawn.text);

    const resigned = await call("POST", `/api/v1/petitions/${ids.open}/signatures`, "signer2", {});
    assert.equal(resigned.status, 201, resigned.text);
    assertPublicSafeShape(resigned.data!);
    assertNoSignerIdentity(resigned.text);

    // The signatures themselves are untouched: two Active signers remain stored.
    const stored = await mods.store.getPetition(ids.open!);
    assert.deepEqual(
      stored!.signatures
        .filter((signature) => signature.status === "Active")
        .map((signature) => signature.participantId)
        .sort(),
      [SIGNER_1.memberId, SIGNER_2.memberId].sort(),
    );
  });

  it("the verified steward may still read their own hidden Petitions; others may not", async () => {
    for (const key of HIDDEN_KEYS.filter((key) => key !== "orphan")) {
      const asSteward = await call("GET", `/api/v1/petitions/${ids[key]}`, "steward");
      assert.equal(asSteward.status, 200, `${key} as steward`);
      assertPublicSafeShape(asSteward.data!);
      assert.equal(
        (await call("GET", `/api/v1/petitions/${ids[key]}`, "outsider")).status,
        404,
        `${key} as outsider`,
      );
      assert.equal(
        (await call("GET", `/api/v1/petitions/${ids[key]}`, "signer1")).status,
        404,
        `${key} as signer`,
      );
    }
    // Missing Initiative: nobody owns it, so the orphan stays hidden even from the former steward.
    assert.equal((await call("GET", `/api/v1/petitions/${ids.orphan}`, "steward")).status, 404);

    const privatePreview = await call("GET", `/api/v1/public/petitions/${ids.private}`, "steward");
    assert.equal(privatePreview.status, 200, "steward preview of a private Initiative's Petition");
    assert.equal(
      (await call("GET", `/api/v1/public/petitions/${ids.private}`, "outsider")).status,
      404,
    );
  });

  it("existing WEB consumer fields are preserved for the legacy Petition workspace", async () => {
    const record = (await call("GET", `/api/v1/petitions/${ids.open}`)).data!;
    const subject = record.subject as Record<string, unknown>;
    const policy = record.policy as {
      endorsementPeriod: Record<string, unknown>;
      withdrawalPolicy: { withdrawalPermitted: boolean };
    };
    assert.equal(record.status, "Open");
    assert.equal(subject.initiativeId, INITIATIVE.public);
    assert.ok(typeof subject.title === "string" && typeof subject.summary === "string");
    assert.ok("opensAt" in policy.endorsementPeriod && "closesAt" in policy.endorsementPeriod);
    assert.equal(typeof policy.withdrawalPolicy.withdrawalPermitted, "boolean");
    assert.ok("outcome" in record && "shareLink" in record);
  });
});
