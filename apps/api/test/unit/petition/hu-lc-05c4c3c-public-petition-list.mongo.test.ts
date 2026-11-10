/**
 * HU-LC-05C.4C.3C — GET /api/v1/public/petitions/by-initiative/:initiativeId
 * lists only an Initiative's active (Open) Petitions, in deterministic order,
 * without authentication and without exposing drafts or internal records.
 *
 * Real public Petition router over a process-owned single-node
 * MongoMemoryReplSet (one hu_test_ database, dropped afterwards).
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_PETITION_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
process.env.NOTIFICATION_PERSISTENCE = "memory";
process.env.PETITION_VISITOR_SIGNAL_PERSISTENCE = "memory";
process.env.JWT_ACCESS_SECRET = "hu-lc-05c4c3c-test-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET = "hu-lc-05c4c3c-test-refresh-secret-0123456789abcdef";
process.env.AUTH_BOOTSTRAP_FALLBACK = "false";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import express from "express";
import type { Collection } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import type { Initiative, PetitionState, PublicInitiativePetitionList } from "@hu/types";

import type * as DraftStore from "../../../src/modules/initiative-petition-lifecycle/initiative-petition-draft.store.js";
import type * as PetitionStore from "../../../src/modules/petition/petition.store.js";
import type * as PetitionTestHelpers from "./petition-test-helpers.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_petition_list_${RUN}`;
const INITIATIVE_A = `initiative-lc05c4c3c-a-${RUN}`;
const INITIATIVE_B = `initiative-lc05c4c3c-b-${RUN}`;
const INITIATIVE_EMPTY = `initiative-lc05c4c3c-empty-${RUN}`;
const INITIATIVE_UNKNOWN = `initiative-lc05c4c3c-unknown-${RUN}`;
const INITIATIVE_PRIVATE = `initiative-lc05c4c3c-private-${RUN}`;
const INITIATIVE_UNPROJECTED = `initiative-lc05c4c3c-unprojected-${RUN}`;
const INITIATIVE_BLOCKED = `initiative-lc05c4c3c-blocked-${RUN}`;
const STEWARD = `member-lc05c4c3c-steward-${RUN}`;

type Mods = {
  store: typeof PetitionStore;
  drafts: typeof DraftStore;
  helpers: typeof PetitionTestHelpers;
  sampleMemberId: string;
  petitions: () => Collection<{ petitionId: string; createdAt: string }>;
};

let mods: Mods;
let replSet: MongoMemoryReplSet | null = null;
let server: Server | null = null;
let baseUrl = "";
let connected = false;

const ids: Record<string, string> = {};

/** Seeds a Petition with an explicit creation time and advances it to `status`. */
async function seedPetition(input: {
  readonly key: string;
  readonly initiativeId: string;
  readonly status: PetitionState;
  readonly createdAt: string;
  readonly petitionId?: string;
}): Promise<string> {
  const petitionId = input.petitionId ?? `petition-lc05c4c3c-${input.key}-${RUN}`;
  const decisionId = `decision-${petitionId}`;
  await mods.helpers.seedApprovedDecision(decisionId, input.initiativeId);
  const fixture = mods.helpers.buildFixturePetition({
    petitionId,
    decisionId,
    initiativeId: input.initiativeId,
  });
  await mods.store.createPetition({
    ...fixture,
    subject: { ...fixture.subject, title: `Petition ${input.key}` },
    policy: {
      ...fixture.policy,
      withdrawalPolicy: { ...fixture.policy.withdrawalPolicy, withdrawalPermitted: true },
    },
  });
  // createPetition stamps its own creation time; pin it to make ordering deterministic.
  await mods.petitions().updateOne({ petitionId }, { $set: { createdAt: input.createdAt } });
  const steps: Array<[PetitionState, (id: string) => Promise<unknown>]> = [
    ["Ready", mods.store.preparePetition],
    ["Published", mods.store.publishPetitionForTests],
    ["Open", mods.store.openPetition],
    ["Closed", mods.store.closePetition],
    ["Archived", mods.store.archivePetition],
  ];
  for (const [reached, step] of steps) {
    if (input.status === "Draft") {
      break;
    }
    await step(petitionId);
    if (reached === input.status) {
      break;
    }
  }
  assert.equal((await mods.store.getPetition(petitionId))?.status, input.status);
  ids[input.key] = petitionId;
  return petitionId;
}

async function listFor(
  initiativeId: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: { data: PublicInitiativePetitionList | null } }> {
  const response = await fetch(
    `${baseUrl}/api/v1/public/petitions/by-initiative/${encodeURIComponent(initiativeId)}`,
    { headers },
  );
  return {
    status: response.status,
    body: (await response.json()) as { data: PublicInitiativePetitionList | null },
  };
}

describe("HU-LC-05C.4C.3C — public Initiative Petition list", () => {
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

    const initiatives = await import("../../../src/modules/initiatives/initiative.store.js");
    const now = new Date().toISOString();
    const fixtureInitiatives: Array<[string, Partial<Initiative>]> = [
      [INITIATIVE_A, {}],
      [INITIATIVE_B, {}],
      [INITIATIVE_EMPTY, {}],
      [INITIATIVE_PRIVATE, { visibility: { policy: "steward_only" } }],
      [INITIATIVE_UNPROJECTED, { lifecyclePhase: "published" as Initiative["lifecyclePhase"] }],
      [INITIATIVE_BLOCKED, { administrativelyBlocked: true }],
    ];
    for (const [initiativeId, overrides] of fixtureInitiatives) {
      initiatives.createInitiative({
        initiativeId,
        stewardId: STEWARD,
        title: `LC-05C.4C.3C ${initiativeId}`,
        description: "Fixture Initiative for the public Petition list.",
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

    mods = {
      store: await import("../../../src/modules/petition/petition.store.js"),
      drafts:
        await import("../../../src/modules/initiative-petition-lifecycle/initiative-petition-draft.store.js"),
      helpers: await import("./petition-test-helpers.js"),
      sampleMemberId: (await import("../../../src/modules/member/member.sample.js")).sampleMember
        .id,
      petitions: () =>
        database
          .getMongoDatabase()
          .collection<{ petitionId: string; createdAt: string }>("petitions"),
    };

    // Initiative A: one Petition per lifecycle state, plus an ordering tie.
    await seedPetition({
      key: "late-open",
      initiativeId: INITIATIVE_A,
      status: "Open",
      createdAt: "2026-01-04T00:00:00.000Z",
    });
    await seedPetition({
      key: "early-open",
      initiativeId: INITIATIVE_A,
      status: "Open",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await seedPetition({
      key: "tie-b",
      initiativeId: INITIATIVE_A,
      status: "Open",
      createdAt: "2026-01-02T00:00:00.000Z",
      petitionId: `petition-lc05c4c3c-tie-b-${RUN}`,
    });
    await seedPetition({
      key: "tie-a",
      initiativeId: INITIATIVE_A,
      status: "Open",
      createdAt: "2026-01-02T00:00:00.000Z",
      petitionId: `petition-lc05c4c3c-tie-a-${RUN}`,
    });
    await seedPetition({
      key: "draft",
      initiativeId: INITIATIVE_A,
      status: "Draft",
      createdAt: "2026-01-01T01:00:00.000Z",
    });
    await seedPetition({
      key: "ready",
      initiativeId: INITIATIVE_A,
      status: "Ready",
      createdAt: "2026-01-01T02:00:00.000Z",
    });
    await seedPetition({
      key: "published",
      initiativeId: INITIATIVE_A,
      status: "Published",
      createdAt: "2026-01-01T03:00:00.000Z",
    });
    await seedPetition({
      key: "closed",
      initiativeId: INITIATIVE_A,
      status: "Closed",
      createdAt: "2026-01-01T04:00:00.000Z",
    });
    await seedPetition({
      key: "archived",
      initiativeId: INITIATIVE_A,
      status: "Archived",
      createdAt: "2026-01-01T05:00:00.000Z",
    });

    // Initiative B: its own Open Petition must never leak into A's list.
    await seedPetition({
      key: "foreign-open",
      initiativeId: INITIATIVE_B,
      status: "Open",
      createdAt: "2025-12-31T00:00:00.000Z",
    });

    // Open Petitions of Initiatives that are not ordinary-public.
    for (const [key, initiativeId] of [
      ["private-open", INITIATIVE_PRIVATE],
      ["unprojected-open", INITIATIVE_UNPROJECTED],
      ["blocked-open", INITIATIVE_BLOCKED],
    ] as const) {
      await seedPetition({
        key,
        initiativeId,
        status: "Open",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
    }

    // A working draft for Initiative A lives in the draft store only.
    const draftTime = new Date().toISOString();
    mods.drafts.upsertInitiativePetitionDraft({
      draftId: `draft-lc05c4c3c-${RUN}`,
      initiativeId: INITIATIVE_A,
      authorId: STEWARD,
      title: "Working draft title must stay private",
      publicSummary: "",
      requestStatement: "",
      expectedOutcome: "",
      supportingContext: "",
      keyArguments: [],
      revisionId: null,
      revisionVersion: null,
      analysisId: null,
      analysisVersion: null,
      proposalIds: [],
      createdAt: draftTime,
      updatedAt: draftTime,
    });

    const publicPetitionRouter = (
      await import("../../../src/modules/petition/public-petition.routes.js")
    ).default;
    const app = express();
    app.use(express.json());
    app.use("/api/v1/public/petitions", publicPetitionRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  });

  after(async () => {
    mods?.drafts.deleteInitiativePetitionDraft(INITIATIVE_A);
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

  it("1. lists only active (Open) Petitions, anonymously", async () => {
    const { status, body } = await listFor(INITIATIVE_A);

    assert.equal(status, 200);
    assert.equal(body.data?.initiativeId, INITIATIVE_A);
    assert.ok(body.data?.petitions.every((petition) => petition.lifecycleStatus === "Open"));
    assert.equal(body.data?.petitions.length, 4);
  });

  it("2. excludes Draft, Ready, Published-not-open, Closed, Archived and working drafts", async () => {
    const listed = new Set(
      (await listFor(INITIATIVE_A)).body.data?.petitions.map((p) => p.petitionId),
    );

    for (const key of ["draft", "ready", "published", "closed", "archived"]) {
      assert.equal(listed.has(ids[key]!), false, `${key} must not be listed`);
    }
    const raw = JSON.stringify((await listFor(INITIATIVE_A)).body);
    assert.equal(raw.includes("Working draft title must stay private"), false);
    assert.equal(raw.includes(`draft-lc05c4c3c-${RUN}`), false);
  });

  it("3. isolates Initiatives", async () => {
    const a = (await listFor(INITIATIVE_A)).body.data!;
    const b = (await listFor(INITIATIVE_B)).body.data!;
    const empty = await listFor(INITIATIVE_EMPTY);
    const unknown = await listFor(INITIATIVE_UNKNOWN);

    assert.equal(
      a.petitions.some((petition) => petition.petitionId === ids["foreign-open"]),
      false,
    );
    assert.deepEqual(
      b.petitions.map((petition) => petition.petitionId),
      [ids["foreign-open"]],
    );
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body.data, { initiativeId: INITIATIVE_EMPTY, petitions: [] });
    assert.equal(unknown.status, 404);
  });

  it("4. orders oldest first with petitionId tie-break, identically on every request", async () => {
    const expected = [ids["early-open"], ids["tie-a"], ids["tie-b"], ids["late-open"]];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      assert.deepEqual(
        (await listFor(INITIATIVE_A)).body.data?.petitions.map((petition) => petition.petitionId),
        expected,
      );
    }
  });

  it("returns only the public list fields with active signature counts", async () => {
    await mods.store.signPetition(ids["early-open"]!, mods.sampleMemberId);
    await mods.store.signPetition(ids["late-open"]!, mods.sampleMemberId);
    await mods.store.withdrawPetitionSignature(ids["late-open"]!, mods.sampleMemberId);

    const petitions = (await listFor(INITIATIVE_A)).body.data!.petitions;
    for (const petition of petitions) {
      assert.deepEqual(Object.keys(petition).sort(), [
        "lifecycleStatus",
        "petitionId",
        "publishedAt",
        "signatureCount",
        "supportStatus",
        "title",
      ]);
      assert.ok(petition.publishedAt && !Number.isNaN(Date.parse(petition.publishedAt)));
    }
    const byId = new Map(petitions.map((petition) => [petition.petitionId, petition]));
    assert.equal(byId.get(ids["early-open"]!)?.signatureCount, 1);
    assert.equal(byId.get(ids["late-open"]!)?.signatureCount, 0);
    assert.equal(byId.get(ids["early-open"]!)?.title, "Petition early-open");
  });

  it("HU-LC-05C.4C.4 — follows the ordinary-public Initiative policy (404, nothing leaked)", async () => {
    for (const [initiativeId, key] of [
      [INITIATIVE_PRIVATE, "private-open"],
      [INITIATIVE_UNPROJECTED, "unprojected-open"],
      [INITIATIVE_BLOCKED, "blocked-open"],
      [INITIATIVE_UNKNOWN, null],
    ] as const) {
      const response = await listFor(initiativeId);
      assert.equal(response.status, 404, initiativeId);
      assert.equal(response.body.data, null);
      if (key) {
        assert.equal(JSON.stringify(response.body).includes(ids[key]!), false);
        assert.equal((await mods.store.getPetition(ids[key]!))?.status, "Open");
      }
    }
  });

  it("HU-LC-05C.4C.4 — Open Petitions of one Initiative are signed independently", async () => {
    const before = new Map(
      (await listFor(INITIATIVE_A)).body.data!.petitions.map((p) => [
        p.petitionId,
        p.signatureCount,
      ]),
    );
    await mods.store.signPetition(ids["tie-a"]!, mods.sampleMemberId);

    const after = new Map(
      (await listFor(INITIATIVE_A)).body.data!.petitions.map((p) => [
        p.petitionId,
        p.signatureCount,
      ]),
    );
    assert.equal(after.get(ids["tie-a"]!), (before.get(ids["tie-a"]!) ?? 0) + 1);
    for (const key of ["tie-b", "early-open", "late-open"]) {
      assert.equal(after.get(ids[key]!), before.get(ids[key]!), key);
    }
    assert.equal(await mods.store.participantHasSigned(ids["tie-a"]!, mods.sampleMemberId), true);
    assert.equal(await mods.store.participantHasSigned(ids["tie-b"]!, mods.sampleMemberId), false);

    await mods.store.withdrawPetitionSignature(ids["tie-a"]!, mods.sampleMemberId);
    const withdrawn = new Map(
      (await listFor(INITIATIVE_A)).body.data!.petitions.map((p) => [
        p.petitionId,
        p.signatureCount,
      ]),
    );
    assert.deepEqual(withdrawn, before);
  });

  it("ignores credentials, rejects a blank id and keeps the single-Petition route", async () => {
    const withBadToken = await listFor(INITIATIVE_A, { Authorization: "Bearer not-a-real-token" });
    assert.equal(withBadToken.status, 200);
    assert.equal(withBadToken.body.data?.petitions.length, 4);

    const blank = await fetch(`${baseUrl}/api/v1/public/petitions/by-initiative/%20`);
    assert.equal(blank.status, 400);

    const single = await fetch(`${baseUrl}/api/v1/public/petitions/${ids["early-open"]}`);
    assert.equal(single.status, 200);
    const draftSingle = await fetch(`${baseUrl}/api/v1/public/petitions/${ids["draft"]}`);
    assert.equal(draftSingle.status, 404);
  });
});
