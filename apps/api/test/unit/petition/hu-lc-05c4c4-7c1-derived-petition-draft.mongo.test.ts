/**
 * HU-LC-05C.4C.7C.1 — a new, independent working draft based on a published
 * Petition of the same STANDARD Initiative: the stored (canonical,
 * lifecycle-token) content and its sources are copied into a new draft in its
 * own slot; the published Petition is never changed.
 *
 * Real Express router + auth middleware over a process-owned single-node
 * MongoMemoryReplSet (one hu_test_ database, dropped afterwards).
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_PETITION_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
process.env.NOTIFICATION_PERSISTENCE = "memory";
process.env.JWT_ACCESS_SECRET = "hu-lc-05c4c4-7c1-test-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET = "hu-lc-05c4c4-7c1-test-refresh-secret-0123456789abcdef";
process.env.AUTH_BOOTSTRAP_FALLBACK = "false";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import express from "express";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import type { Initiative, Petition } from "@hu/types";

import type * as AuthTokens from "../../../src/modules/auth/auth-tokens.js";
import type * as MongoCollections from "../../../src/infrastructure/mongodb/mongo-collections.js";
import type * as MongoDatabase from "../../../src/infrastructure/mongodb/mongo-database.js";
import type * as Initiatives from "../../../src/modules/initiatives/initiative.store.js";
import type * as RevisionService from "../../../src/modules/initiative-version-revision/initiative-version-revision.service.js";
import type * as PetitionStore from "../../../src/modules/petition/petition.store.js";
import type * as PetitionTestHelpers from "./petition-test-helpers.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_derived_draft_${RUN}`;
const STEWARD = { userId: `user-lc7c1-steward-${RUN}`, memberId: `member-lc7c1-${RUN}` };
const OTHER = { userId: `user-lc7c1-other-${RUN}`, memberId: `member-lc7c1-other-${RUN}` };
const DISABLED = { userId: `user-lc7c1-disabled-${RUN}`, memberId: STEWARD.memberId };

const TOKEN_TITLE = "Safer crossings after the {lifecycleStage:analysis}";
const TOKEN_SUMMARY = "Builds on the {lifecycleStage:proposal} and the {lifecycleStage:analysis}.";
const TOKEN_ARGUMENT = "The {lifecycleStage:decision_session} will follow this Petition.";
const SOURCE_CONTENT = {
  title: TOKEN_TITLE,
  publicSummary: TOKEN_SUMMARY,
  requestStatement: "We ask the City Council to fund safe crossings.",
  expectedOutcome: "Crossings near every school by next year.",
  supportingContext: "Context from the {lifecycleStage:analysis}.",
  keyArguments: [TOKEN_ARGUMENT, "Children walk to school daily."],
};
const SOURCE_RECIPIENTS = ["City Council", "Department of Transport"];

/** Loaded after the environment above is set; persistence adapters bind at import. */
type Mods = {
  tokens: typeof AuthTokens;
  store: typeof PetitionStore;
  helpers: typeof PetitionTestHelpers;
  initiatives: typeof Initiatives;
  revisions: typeof RevisionService;
  database: typeof MongoDatabase;
  collections: typeof MongoCollections;
  signerId: string;
};

type Caller = "anonymous" | "invalid" | "disabled" | "other" | "steward";
type Draft = {
  draftId: string;
  initiativeId: string;
  authorId: string;
  title: string;
  publicSummary: string;
  requestStatement: string;
  expectedOutcome: string;
  supportingContext: string;
  keyArguments: string[];
  recipients: string[];
  derivedFromPetitionId: string | null;
  revisionId: string | null;
  revisionVersion: number | null;
  analysisId: string | null;
  analysisVersion: number | null;
  proposalIds: string[];
  createdAt: string;
  updatedAt: string;
};

let mods: Mods;
let replSet: MongoMemoryReplSet | null = null;
let server: Server | null = null;
let baseUrl = "";
let connected = false;
let counter = 0;

function headersFor(caller: Caller): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const user = { disabled: DISABLED, other: OTHER, steward: STEWARD }[caller as string];
  if (caller === "invalid") {
    headers.Authorization = "Bearer not-a-real-token";
  } else if (user) {
    headers.Authorization = `Bearer ${mods.tokens.createAccessToken({
      sub: user.userId,
      memberId: user.memberId,
      role: "member",
      displayName: "LC-05C.4C.7C.1 Test",
      email: `${user.userId}@example.test`,
    })}`;
  }
  return headers;
}

async function call(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  caller: Caller = "steward",
  body?: unknown,
): Promise<{ status: number; message: string; data: unknown }> {
  const response = await fetch(`${baseUrl}/api/v1/initiative-petitions${path}`, {
    method,
    headers: headersFor(caller),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = (await response.json().catch(() => ({}))) as { message?: string; data?: unknown };
  return { status: response.status, message: json.message ?? "", data: json.data ?? null };
}

const draftsPath = (initiativeId: string) => `/initiative/${initiativeId}/drafts`;
const draftPath = (initiativeId: string, draftId: string) =>
  `${draftsPath(initiativeId)}/${draftId}`;
const derive = (initiativeId: string, petitionId: string, caller: Caller = "steward") =>
  call("POST", draftsPath(initiativeId), caller, { derivedFromPetitionId: petitionId });

function createInitiative(
  options: { profile?: "STANDARD" | "PUBLIC_CHOICE"; stewardId?: string } = {},
): string {
  counter += 1;
  const stewardId = options.stewardId ?? STEWARD.memberId;
  const now = new Date().toISOString();
  const initiative = mods.initiatives.createInitiative({
    initiativeId: `initiative-lc7c1-${counter}-${RUN}`,
    stewardId,
    title: `Crossings Initiative ${counter}`,
    description: "Fixture Initiative for derived Petition drafts.",
    status: "implementation",
    lifecyclePhase: "projected",
    lifecycleProfile: options.profile ?? "STANDARD",
    visibility: { policy: "public" },
    metadata: { activityArea: "Environment", communitySlug: "fixture-community" },
    timeline: [],
    createdAt: now,
    updatedAt: now,
  } as unknown as Initiative);
  mods.revisions.createInitialInitiativeVersionRevision(initiative, stewardId);
  return initiative.initiativeId;
}

/** Generates, writes token content into and publishes one working draft. */
async function publishedSource(initiativeId: string, caller: Caller = "steward"): Promise<Petition> {
  const created = await call("POST", draftsPath(initiativeId), caller);
  assert.equal(created.status, 201, created.message);
  const draftId = (created.data as Draft).draftId;
  const generated = await call("POST", `${draftPath(initiativeId, draftId)}/generate`, caller);
  assert.equal(generated.status, 200, generated.message);
  const patched = await call("PATCH", draftPath(initiativeId, draftId), caller, {
    ...SOURCE_CONTENT,
    recipients: SOURCE_RECIPIENTS,
  });
  assert.equal(patched.status, 200, patched.message);
  const published = await call("POST", `${draftPath(initiativeId, draftId)}/publish`, caller);
  assert.equal(published.status, 200, published.message);
  return published.data as Petition;
}

async function listDrafts(initiativeId: string): Promise<Draft[]> {
  const listed = await call("GET", draftsPath(initiativeId));
  assert.equal(listed.status, 200, listed.message);
  return listed.data as Draft[];
}

async function slotStates(initiativeId: string): Promise<string[]> {
  const slots = await mods.database
    .getMongoCollection<{ slotNumber: number; state: string }>(
      mods.collections.MONGO_COLLECTIONS.initiativePetitionSlots,
    )
    .find({ initiativeId })
    .sort({ slotNumber: 1 })
    .toArray();
  return slots.map((slot) => slot.state);
}

/** Everything a derivation must leave untouched on the published Petition. */
async function storedPetition(petitionId: string): Promise<string> {
  const petition = JSON.parse(JSON.stringify(await mods.store.getPetition(petitionId)));
  // The outcome is re-derived on every read.
  delete petition?.outcome?.derivedAt;
  return JSON.stringify(petition);
}

function expectedCopy(petition: Petition) {
  const { subject, traceability } = petition;
  return {
    title: subject.title,
    publicSummary: subject.summary,
    requestStatement: subject.requestStatement ?? "",
    expectedOutcome: subject.expectedOutcome ?? "",
    supportingContext: subject.supportingContext ?? "",
    keyArguments: [...(subject.keyArguments ?? [])],
    recipients: [...(subject.recipients ?? [])],
    revisionId: traceability?.revisionId || null,
    revisionVersion: traceability?.revisionId ? traceability.revisionVersion : null,
    analysisId: traceability?.analysisId ?? null,
    analysisVersion: traceability?.analysisVersion ?? null,
    proposalIds: [...(traceability?.proposalIds ?? [])],
  };
}

function copiedFields(draft: Draft) {
  const {
    title,
    publicSummary,
    requestStatement,
    expectedOutcome,
    supportingContext,
    keyArguments,
    recipients,
    revisionId,
    revisionVersion,
    analysisId,
    analysisVersion,
    proposalIds,
  } = draft;
  return {
    title,
    publicSummary,
    requestStatement,
    expectedOutcome,
    supportingContext,
    keyArguments,
    recipients,
    revisionId,
    revisionVersion,
    analysisId,
    analysisVersion,
    proposalIds,
  };
}

const PUBLICATION_ONLY_KEYS = [
  "petitionId",
  "collectiveDecisionId",
  "status",
  "signatures",
  "supportMetrics",
  "shareLink",
  "outcome",
  "policy",
  "publishedAt",
  "subject",
  "traceability",
];

describe("HU-LC-05C.4C.7C.1 — new Petition draft from a published Petition", () => {
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
      async (userId: string) =>
        ({ id: userId, status: userId === DISABLED.userId ? "disabled" : "active" }) as never,
    );

    mods = {
      tokens: await import("../../../src/modules/auth/auth-tokens.js"),
      store: await import("../../../src/modules/petition/petition.store.js"),
      helpers: await import("./petition-test-helpers.js"),
      initiatives: await import("../../../src/modules/initiatives/initiative.store.js"),
      revisions:
        await import("../../../src/modules/initiative-version-revision/initiative-version-revision.service.js"),
      database,
      collections: await import("../../../src/infrastructure/mongodb/mongo-collections.js"),
      signerId: (await import("../../../src/modules/member/member.sample.js")).sampleMember.id,
    };

    const { petitionWorkingDraftRouter } =
      await import("../../../src/modules/initiative-petition-drafts/index.js");
    const app = express();
    app.use(express.json());
    app.use("/api/v1/initiative-petitions", petitionWorkingDraftRouter);
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
    try {
      if (connected && mods.database.getMongoDatabase().databaseName === DATABASE) {
        await mods.database.getMongoDatabase().dropDatabase();
      }
    } finally {
      if (connected) {
        await connection.disconnectMongoClient();
      }
      await replSet?.stop({ doCleanup: true });
    }
  });

  it("copies the published Petition's canonical content and sources into a new independent draft", async () => {
    const initiativeId = createInitiative();
    const source = await publishedSource(initiativeId);
    await mods.store.signPetition(source.petitionId, mods.signerId);
    const signedSource = (await mods.store.getPetition(source.petitionId))!;
    assert.equal(signedSource.signatures.length, 1);
    const before = await storedPetition(source.petitionId);

    const result = await derive(initiativeId, source.petitionId);
    assert.equal(result.status, 201, result.message);
    const draft = result.data as Draft;

    assert.deepEqual(copiedFields(draft), expectedCopy(signedSource));
    assert.equal(draft.title, TOKEN_TITLE, "lifecycle tokens are copied, not resolved");
    assert.equal(draft.publicSummary, TOKEN_SUMMARY);
    assert.deepEqual(draft.keyArguments, SOURCE_CONTENT.keyArguments);
    assert.deepEqual(draft.recipients, SOURCE_RECIPIENTS);
    assert.ok(draft.revisionId, "the source's Revision reference is kept");

    assert.equal(draft.derivedFromPetitionId, source.petitionId);
    assert.equal(draft.initiativeId, initiativeId);
    assert.equal(draft.authorId, STEWARD.memberId);
    assert.match(draft.draftId, /^initiative-petition-draft-/);
    assert.notEqual(`petition-${draft.draftId}`, source.petitionId);
    assert.notEqual(draft.createdAt, source.createdAt);

    const stored = await mods.database
      .getMongoCollection<Record<string, unknown>>(
        mods.collections.MONGO_COLLECTIONS.initiativePetitionWorkingDrafts,
      )
      .findOne({ draftId: draft.draftId }, { projection: { _id: 0 } });
    assert.ok(stored);
    for (const key of PUBLICATION_ONLY_KEYS) {
      assert.equal(key in draft, false, `response must not carry ${key}`);
      assert.equal(key in stored!, false, `stored draft must not carry ${key}`);
    }

    assert.deepEqual(await slotStates(initiativeId), ["published", "draft"]);
    assert.equal(await storedPetition(source.petitionId), before);
  });

  it("the derived draft is edited, regenerated and published on its own", async () => {
    const initiativeId = createInitiative();
    const source = await publishedSource(initiativeId);
    const before = await storedPetition(source.petitionId);

    const first = (await derive(initiativeId, source.petitionId)).data as Draft;
    const edited = await call("PATCH", draftPath(initiativeId, first.draftId), "steward", {
      title: "Safer crossings — second Petition",
    });
    assert.equal(edited.status, 200, edited.message);
    assert.equal(await storedPetition(source.petitionId), before);

    const published = await call("POST", `${draftPath(initiativeId, first.draftId)}/publish`);
    assert.equal(published.status, 200, published.message);
    const petition = published.data as Petition;
    assert.equal(petition.petitionId, `petition-${first.draftId}`);
    assert.notEqual(petition.petitionId, source.petitionId);
    assert.equal(petition.subject.title, "Safer crossings — second Petition");
    assert.equal(petition.subject.summary, TOKEN_SUMMARY);
    assert.deepEqual(petition.subject.recipients, SOURCE_RECIPIENTS);
    assert.deepEqual(petition.signatures, []);
    assert.equal(await storedPetition(source.petitionId), before);

    const second = (await derive(initiativeId, source.petitionId)).data as Draft;
    const refused = await call("POST", `${draftPath(initiativeId, second.draftId)}/generate`);
    assert.equal(refused.status, 409, "copied content is never overwritten silently");
    const regenerated = await call(
      "POST",
      `${draftPath(initiativeId, second.draftId)}/generate`,
      "steward",
      { overwrite: true },
    );
    assert.equal(regenerated.status, 200, regenerated.message);
    assert.deepEqual((regenerated.data as Draft).recipients, SOURCE_RECIPIENTS);
    assert.equal((regenerated.data as Draft).derivedFromPetitionId, source.petitionId);

    assert.deepEqual(await slotStates(initiativeId), ["published", "published", "draft"]);
    assert.equal(await storedPetition(source.petitionId), before);
  });

  it("a legacy Petition without optional fields or sources yields empty copies", async () => {
    const initiativeId = createInitiative();
    const legacy = await mods.helpers.seedOpenPetition(
      `petition-lc7c1-legacy-${RUN}`,
      `decision-lc7c1-legacy-${RUN}`,
      initiativeId,
    );
    const before = await storedPetition(legacy.petitionId);

    const result = await derive(initiativeId, legacy.petitionId);
    assert.equal(result.status, 201, result.message);
    assert.deepEqual(copiedFields(result.data as Draft), {
      ...expectedCopy(legacy),
      requestStatement: "",
      expectedOutcome: "",
      supportingContext: "",
      keyArguments: [],
      recipients: [],
      revisionId: null,
      revisionVersion: null,
      analysisId: null,
      analysisVersion: null,
      proposalIds: [],
    });
    assert.equal(await storedPetition(legacy.petitionId), before);
  });

  it("rejects a source Petition of another Initiative", async () => {
    const initiativeId = createInitiative();
    const sameStewardOther = createInitiative();
    const otherStewards = createInitiative({ stewardId: OTHER.memberId });
    const foreignSources = [
      await publishedSource(sameStewardOther),
      await publishedSource(otherStewards, "other"),
    ];

    for (const foreign of foreignSources) {
      const before = await storedPetition(foreign.petitionId);
      const result = await derive(initiativeId, foreign.petitionId);
      assert.equal(result.status, 409, result.message);
      assert.equal(await storedPetition(foreign.petitionId), before);
    }
    assert.deepEqual(await listDrafts(initiativeId), []);
    assert.deepEqual(await slotStates(initiativeId), []);
  });

  it("rejects non-steward, disabled and anonymous callers without any write", async () => {
    const initiativeId = createInitiative();
    const source = await publishedSource(initiativeId);
    const before = await storedPetition(source.petitionId);

    for (const [caller, expected] of [
      ["anonymous", 401],
      ["invalid", 401],
      ["other", 403],
      ["disabled", 403],
    ] as Array<[Caller, number]>) {
      const result = await derive(initiativeId, source.petitionId, caller);
      assert.equal(result.status, expected, `${caller}: ${result.message}`);
    }

    assert.deepEqual(await listDrafts(initiativeId), []);
    assert.deepEqual(await slotStates(initiativeId), ["published"]);
    assert.equal(await storedPetition(source.petitionId), before);
  });

  it("a fourth Petition slot is rejected", async () => {
    const initiativeId = createInitiative();
    const source = await publishedSource(initiativeId);
    const before = await storedPetition(source.petitionId);

    assert.equal((await derive(initiativeId, source.petitionId)).status, 201);
    assert.equal((await derive(initiativeId, source.petitionId)).status, 201);
    const fourth = await derive(initiativeId, source.petitionId);
    assert.equal(fourth.status, 409, fourth.message);

    assert.deepEqual(await slotStates(initiativeId), ["published", "draft", "draft"]);
    assert.equal((await listDrafts(initiativeId)).length, 2);
    assert.equal(await storedPetition(source.petitionId), before);
  });

  it("concurrent derivations never occupy more than three slots", async () => {
    const initiativeId = createInitiative();
    const source = await publishedSource(initiativeId);

    const results = await Promise.all(
      Array.from({ length: 6 }, () => derive(initiativeId, source.petitionId)),
    );
    const statuses = results.map((result) => result.status).sort();
    assert.deepEqual(statuses, [201, 201, 409, 409, 409, 409], JSON.stringify(results));

    const drafts = await listDrafts(initiativeId);
    assert.equal(drafts.length, 2);
    assert.equal(new Set(drafts.map((draft) => draft.draftId)).size, 2);
    assert.deepEqual(await slotStates(initiativeId), ["published", "draft", "draft"]);
  });

  it("PUBLIC_CHOICE: plain drafts are unchanged and derivation is unavailable", async () => {
    const initiativeId = createInitiative({ profile: "PUBLIC_CHOICE" });
    const plain = await call("POST", draftsPath(initiativeId));
    assert.equal(plain.status, 201, plain.message);

    const petition = await mods.helpers.seedOpenPetition(
      `petition-lc7c1-choice-${RUN}`,
      `decision-lc7c1-choice-${RUN}`,
      initiativeId,
    );
    const before = await storedPetition(petition.petitionId);
    const derived = await derive(initiativeId, petition.petitionId);
    assert.equal(derived.status, 409, derived.message);

    assert.deepEqual(await listDrafts(initiativeId), [plain.data]);
    assert.equal(await storedPetition(petition.petitionId), before);
  });

  it("creating a draft without a source still yields an empty draft", async () => {
    const initiativeId = createInitiative();
    const result = await call("POST", draftsPath(initiativeId), "steward", {});
    assert.equal(result.status, 201, result.message);
    const draft = result.data as Draft;
    assert.deepEqual(copiedFields(draft), {
      title: "",
      publicSummary: "",
      requestStatement: "",
      expectedOutcome: "",
      supportingContext: "",
      keyArguments: [],
      recipients: [],
      revisionId: null,
      revisionVersion: null,
      analysisId: null,
      analysisVersion: null,
      proposalIds: [],
    });
    assert.equal(draft.derivedFromPetitionId, null);
  });

  it("the legacy initiative_petition_drafts collection is never written", async () => {
    const initiativeId = createInitiative();
    const source = await publishedSource(initiativeId);
    const legacy = mods.database.getMongoCollection<{ _id: string }>(
      mods.collections.MONGO_COLLECTIONS.initiativePetitionDrafts,
    );
    const before = await legacy.find({}).sort({ _id: 1 }).toArray();

    assert.equal((await derive(initiativeId, source.petitionId)).status, 201);
    assert.deepEqual(await legacy.find({}).sort({ _id: 1 }).toArray(), before);
  });
});
