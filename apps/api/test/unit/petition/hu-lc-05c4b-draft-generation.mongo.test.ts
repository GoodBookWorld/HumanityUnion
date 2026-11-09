/**
 * HU-LC-05C.4B — Petition content is generated into one selected independent
 * draft (by draftId), with its Revision / Analysis / Proposal traceability,
 * without touching other drafts, slots or published Petitions.
 *
 * Real Express router + auth middleware over a process-owned single-node
 * MongoMemoryReplSet (one hu_test_ database, dropped afterwards).
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_PETITION_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
process.env.NOTIFICATION_PERSISTENCE = "memory";
process.env.JWT_ACCESS_SECRET = "hu-lc-05c4b-test-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET = "hu-lc-05c4b-test-refresh-secret-0123456789abcdef";
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
import type * as DraftBuilder from "../../../src/modules/initiative-petition-lifecycle/initiative-petition-draft-builder.js";
import type * as Intelligence from "../../../src/modules/initiative-petition-lifecycle/initiative-petition-intelligence.service.js";
import type * as PetitionLifecycle from "../../../src/modules/initiative-petition-lifecycle/initiative-petition-lifecycle.service.js";
import type * as LegacyDraftStore from "../../../src/modules/initiative-petition-lifecycle/initiative-petition-draft.store.js";
import type * as RevisionService from "../../../src/modules/initiative-version-revision/initiative-version-revision.service.js";
import type * as PetitionStore from "../../../src/modules/petition/petition.store.js";
import type * as PetitionTestHelpers from "./petition-test-helpers.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_petition_draft_gen_${RUN}`;
const STEWARD = {
  userId: `user-lc05c4b-steward-${RUN}`,
  memberId: `member-lc05c4b-steward-${RUN}`,
};
const OTHER = { userId: `user-lc05c4b-other-${RUN}`, memberId: `member-lc05c4b-other-${RUN}` };
const DISABLED = { userId: `user-lc05c4b-disabled-${RUN}`, memberId: STEWARD.memberId };
const identity = { participantId: STEWARD.memberId };

/** Loaded after the environment above is set; persistence adapters bind at import. */
type Mods = {
  tokens: typeof AuthTokens;
  store: typeof PetitionStore;
  lifecycle: typeof PetitionLifecycle;
  legacyDrafts: typeof LegacyDraftStore;
  builder: typeof DraftBuilder;
  intelligence: typeof Intelligence;
  initiatives: typeof Initiatives;
  revisions: typeof RevisionService;
  helpers: typeof PetitionTestHelpers;
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
      displayName: "LC-05C.4B Test",
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
const generatePath = (initiativeId: string, draftId: string) =>
  `/initiative/${initiativeId}/drafts/${draftId}/generate`;

function createInitiative(options: { withRevision?: boolean; stewardId?: string } = {}): string {
  counter += 1;
  const stewardId = options.stewardId ?? STEWARD.memberId;
  const now = new Date().toISOString();
  const initiative = mods.initiatives.createInitiative({
    initiativeId: `initiative-lc05c4b-${counter}-${RUN}`,
    stewardId,
    title: `LC-05C.4B fixture ${counter}`,
    description: "Fixture Initiative for draft-scoped Petition generation.",
    status: "implementation",
    lifecyclePhase: "projected",
    lifecycleProfile: "STANDARD",
    visibility: { policy: "public" },
    metadata: { activityArea: "Environment", communitySlug: "fixture-community" },
    timeline: [],
    createdAt: now,
    updatedAt: now,
  } as unknown as Initiative);
  if (options.withRevision !== false) {
    mods.revisions.createInitialInitiativeVersionRevision(initiative, stewardId);
  }
  return initiative.initiativeId;
}

async function createDraft(initiativeId: string, body: unknown = {}): Promise<Draft> {
  const result = await call("POST", draftsPath(initiativeId), "steward", body);
  assert.equal(result.status, 201, result.message);
  return result.data as Draft;
}

async function getDraft(initiativeId: string, draftId: string): Promise<Draft | null> {
  const result = await call("GET", `${draftsPath(initiativeId)}/${draftId}`);
  return result.status === 200 ? (result.data as Draft) : null;
}

async function listDraftIds(initiativeId: string, caller: Caller = "steward"): Promise<string[]> {
  const result = await call("GET", draftsPath(initiativeId), caller);
  assert.equal(result.status, 200, result.message);
  return (result.data as Draft[]).map((draft) => draft.draftId);
}

async function generate(
  initiativeId: string,
  draftId: string,
  body: unknown = {},
  caller: Caller = "steward",
) {
  return call("POST", generatePath(initiativeId, draftId), caller, body);
}

async function slotsOf(initiativeId: string) {
  return mods.database
    .getMongoCollection(mods.collections.MONGO_COLLECTIONS.initiativePetitionSlots)
    .find({ initiativeId }, { projection: { _id: 0 } })
    .sort({ slotNumber: 1 })
    .toArray();
}

/** What the existing builder produces for the Initiative right now. */
async function expectedGeneration(initiativeId: string) {
  const snapshot =
    await mods.intelligence.buildInitiativePetitionIntelligenceSnapshot(initiativeId);
  const content = await mods.builder.generatePetitionDraftContent(snapshot);
  return {
    content: {
      title: content.title,
      publicSummary: content.publicSummary,
      requestStatement: content.requestStatement,
      expectedOutcome: content.expectedOutcome,
      supportingContext: content.supportingContext,
      keyArguments: [...content.keyArguments],
    },
    traceability: mods.builder.buildPetitionDraftTraceability(snapshot),
    snapshot,
  };
}

const contentOf = (draft: Draft) => ({
  title: draft.title,
  publicSummary: draft.publicSummary,
  requestStatement: draft.requestStatement,
  expectedOutcome: draft.expectedOutcome,
  supportingContext: draft.supportingContext,
  keyArguments: draft.keyArguments,
});

const traceabilityOf = (draft: Draft) => ({
  revisionId: draft.revisionId,
  revisionVersion: draft.revisionVersion,
  analysisId: draft.analysisId,
  analysisVersion: draft.analysisVersion,
  proposalIds: draft.proposalIds,
});

async function seedOpenPetition(initiativeId: string): Promise<string> {
  counter += 1;
  const petitionId = `petition-lc05c4b-${counter}-${RUN}`;
  const decisionId = `decision-${petitionId}`;
  await mods.helpers.seedApprovedDecision(decisionId, initiativeId);
  await mods.store.createPetition(
    mods.helpers.buildFixturePetition({ petitionId, decisionId, initiativeId }),
  );
  await mods.store.preparePetition(petitionId);
  await mods.store.publishPetitionForTests(petitionId);
  await mods.store.openPetition(petitionId);
  return petitionId;
}

function storedFields(petition: Petition | null) {
  if (!petition) {
    return null;
  }
  const { petitionId, collectiveDecisionId, status, updatedAt, subject, traceability, signatures } =
    petition;
  return { petitionId, collectiveDecisionId, status, updatedAt, subject, traceability, signatures };
}

describe("HU-LC-05C.4B — draft-scoped Petition generation", () => {
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
      lifecycle:
        await import("../../../src/modules/initiative-petition-lifecycle/initiative-petition-lifecycle.service.js"),
      legacyDrafts:
        await import("../../../src/modules/initiative-petition-lifecycle/initiative-petition-draft.store.js"),
      builder:
        await import("../../../src/modules/initiative-petition-lifecycle/initiative-petition-draft-builder.js"),
      intelligence:
        await import("../../../src/modules/initiative-petition-lifecycle/initiative-petition-intelligence.service.js"),
      initiatives: await import("../../../src/modules/initiatives/initiative.store.js"),
      revisions:
        await import("../../../src/modules/initiative-version-revision/initiative-version-revision.service.js"),
      helpers: await import("./petition-test-helpers.js"),
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

  describe("generation into the selected draft", () => {
    it("1 — generates the existing builder's content into the selected draft only", async () => {
      const initiativeId = createInitiative();
      const draft = await createDraft(initiativeId);
      const expected = await expectedGeneration(initiativeId);
      assert.ok(expected.content.title.trim());

      const result = await generate(initiativeId, draft.draftId);
      assert.equal(result.status, 200, result.message);
      const generated = result.data as Draft;

      assert.deepEqual(contentOf(generated), expected.content);
      assert.equal(generated.draftId, draft.draftId);
      assert.equal(generated.initiativeId, initiativeId);
      assert.equal(generated.authorId, draft.authorId);
      assert.equal(generated.createdAt, draft.createdAt);
      assert.ok(generated.updatedAt > draft.updatedAt);
      assert.deepEqual(await getDraft(initiativeId, draft.draftId), generated);
    });

    it("2/3 — other drafts, slots and the draft count are unchanged", async () => {
      const initiativeId = createInitiative();
      const [a, b, c] = [
        await createDraft(initiativeId),
        await createDraft(initiativeId),
        await createDraft(initiativeId),
      ];
      const slotsBefore = await slotsOf(initiativeId);
      assert.equal(slotsBefore.length, 3);

      const result = await generate(initiativeId, b!.draftId);
      assert.equal(result.status, 200, result.message);

      assert.deepEqual(await getDraft(initiativeId, a!.draftId), a);
      assert.deepEqual(await getDraft(initiativeId, c!.draftId), c);
      assert.deepEqual(await listDraftIds(initiativeId), [a!.draftId, b!.draftId, c!.draftId]);
      assert.deepEqual(await slotsOf(initiativeId), slotsBefore);
      assert.deepEqual(await mods.store.listPetitionsByInitiativeId(initiativeId), []);
    });

    it("4 — records the Revision, Analysis and Proposals used, and keeps them across edits", async () => {
      const initiativeId = createInitiative();
      const draft = await createDraft(initiativeId);
      assert.deepEqual(traceabilityOf(draft), {
        revisionId: null,
        revisionVersion: null,
        analysisId: null,
        analysisVersion: null,
        proposalIds: [],
      });
      const expected = await expectedGeneration(initiativeId);
      assert.ok(expected.snapshot.revisionReference);

      const generated = (await generate(initiativeId, draft.draftId)).data as Draft;
      assert.deepEqual(traceabilityOf(generated), expected.traceability);
      assert.equal(generated.revisionId, expected.snapshot.revisionReference.revisionId);
      assert.equal(generated.revisionVersion, expected.snapshot.revisionReference.version);
      assert.equal(generated.analysisId, expected.snapshot.analysisReference?.analysisId ?? null);

      const stored = await mods.database
        .getMongoCollection(mods.collections.MONGO_COLLECTIONS.initiativePetitionWorkingDrafts)
        .findOne({ draftId: draft.draftId }, { projection: { _id: 0 } });
      assert.equal(stored?.revisionId, expected.traceability.revisionId);
      assert.deepEqual(stored?.proposalIds, expected.traceability.proposalIds);

      // Author edits keep the provenance of the generation; it cannot be patched.
      const edited = await call(
        "PATCH",
        `${draftsPath(initiativeId)}/${draft.draftId}`,
        "steward",
        {
          title: "Edited by the author",
          revisionId: "forged-revision",
          proposalIds: ["forged"],
        },
      );
      assert.equal(edited.status, 200, edited.message);
      assert.deepEqual(traceabilityOf(edited.data as Draft), expected.traceability);
    });

    it("5 — generation without a Published Revision is rejected and writes nothing", async () => {
      const initiativeId = createInitiative({ withRevision: false });
      const draft = await createDraft(initiativeId);

      const result = await generate(initiativeId, draft.draftId);
      assert.equal(result.status, 409, result.message);
      assert.match(result.message, /Published Revision/);
      assert.deepEqual(await getDraft(initiativeId, draft.draftId), draft);
    });

    it("6/7 — recipients and derivedFromPetitionId are preserved, recipients are not invented", async () => {
      const initiativeId = createInitiative();
      const published = await seedOpenPetition(initiativeId);
      const derived = await createDraft(initiativeId, { derivedFromPetitionId: published });
      const withRecipients = await call(
        "PATCH",
        `${draftsPath(initiativeId)}/${derived.draftId}`,
        "steward",
        { recipients: ["City Council", "Mayor"] },
      );
      assert.equal(withRecipients.status, 200, withRecipients.message);
      const plain = await createDraft(initiativeId);

      const generated = (await generate(initiativeId, derived.draftId)).data as Draft;
      assert.deepEqual(generated.recipients, ["City Council", "Mayor"]);
      assert.equal(generated.derivedFromPetitionId, published);
      assert.ok(generated.title.trim());

      const generatedPlain = (await generate(initiativeId, plain.draftId)).data as Draft;
      assert.deepEqual(generatedPlain.recipients, []);
      assert.equal(generatedPlain.derivedFromPetitionId, null);
    });
  });

  describe("regeneration", () => {
    it("8 — replacing existing content requires overwrite: true", async () => {
      const initiativeId = createInitiative();
      const draft = await createDraft(initiativeId);
      const first = (await generate(initiativeId, draft.draftId)).data as Draft;

      const again = await generate(initiativeId, draft.draftId);
      assert.equal(again.status, 409, again.message);
      assert.match(again.message, /overwrite: true/);
      assert.deepEqual(await getDraft(initiativeId, draft.draftId), first);

      const edit = await call("PATCH", `${draftsPath(initiativeId)}/${draft.draftId}`, "steward", {
        title: "Author's own title",
        keyArguments: ["Author's argument"],
      });
      const authored = edit.data as Draft;
      for (const body of [{}, { overwrite: false }, { overwrite: null }]) {
        const refused = await generate(initiativeId, draft.draftId, body);
        assert.equal(refused.status, 409, `${JSON.stringify(body)}: ${refused.message}`);
      }
      for (const body of [{ overwrite: "true" }, { overwrite: 1 }]) {
        const invalid = await generate(initiativeId, draft.draftId, body);
        assert.equal(invalid.status, 400, `${JSON.stringify(body)}: ${invalid.message}`);
      }
      assert.deepEqual(await getDraft(initiativeId, draft.draftId), authored);

      const replaced = await generate(initiativeId, draft.draftId, { overwrite: true });
      assert.equal(replaced.status, 200, replaced.message);
      const regenerated = replaced.data as Draft;
      assert.deepEqual(contentOf(regenerated), contentOf(first));
      assert.equal(regenerated.draftId, draft.draftId);
      assert.equal(regenerated.authorId, draft.authorId);
      assert.equal(regenerated.createdAt, draft.createdAt);
      assert.ok(regenerated.updatedAt > authored.updatedAt);
    });

    it("12 — concurrent generation creates no drafts or slots and never loses an author edit", async () => {
      const initiativeId = createInitiative();
      const draft = await createDraft(initiativeId);
      await createDraft(initiativeId);
      const slotsBefore = await slotsOf(initiativeId);
      const draftsBefore = await listDraftIds(initiativeId);

      const results = await Promise.all([
        ...Array.from({ length: 4 }, () => generate(initiativeId, draft.draftId)),
        ...Array.from({ length: 2 }, () =>
          generate(initiativeId, draft.draftId, { overwrite: true }),
        ),
      ]);
      assert.ok(results.some((result) => result.status === 200));
      for (const result of results) {
        assert.ok([200, 409].includes(result.status), `${result.status}: ${result.message}`);
      }
      assert.deepEqual(await listDraftIds(initiativeId), draftsBefore);
      assert.deepEqual(await slotsOf(initiativeId), slotsBefore);

      // An author edit racing a non-overwriting generation always survives.
      const fresh = await createDraft(createInitiative());
      const [edit] = await Promise.all([
        call("PATCH", `${draftsPath(fresh.initiativeId)}/${fresh.draftId}`, "steward", {
          title: "Typed by the author",
        }),
        generate(fresh.initiativeId, fresh.draftId),
      ]);
      assert.equal(edit.status, 200, edit.message);
      assert.equal(
        (await getDraft(fresh.initiativeId, fresh.draftId))?.title,
        "Typed by the author",
      );
    });
  });

  describe("authorization and isolation", () => {
    it("9 — unauthenticated, invalid, foreign and disabled callers are rejected", async () => {
      const initiativeId = createInitiative();
      const draft = await createDraft(initiativeId);
      for (const [caller, expected] of [
        ["anonymous", 401],
        ["invalid", 401],
        ["other", 403],
        ["disabled", 403],
      ] as Array<[Caller, number]>) {
        const result = await generate(initiativeId, draft.draftId, { overwrite: true }, caller);
        assert.equal(result.status, expected, `${caller}: ${result.message}`);
      }
      process.env.AUTH_BOOTSTRAP_FALLBACK = "true";
      try {
        const bootstrap = await generate(initiativeId, draft.draftId, {}, "anonymous");
        assert.equal(bootstrap.status, 401, bootstrap.message);
      } finally {
        process.env.AUTH_BOOTSTRAP_FALLBACK = "false";
      }
      assert.deepEqual(await getDraft(initiativeId, draft.draftId), draft);
    });

    it("10 — a draft cannot be generated through another Initiative", async () => {
      const owner = createInitiative();
      const sibling = createInitiative();
      const foreign = createInitiative({ stewardId: OTHER.memberId });
      const draft = await createDraft(owner);

      for (const [initiativeId, caller] of [
        [sibling, "steward"],
        [foreign, "other"],
      ] as Array<[string, Caller]>) {
        const result = await generate(initiativeId, draft.draftId, { overwrite: true }, caller);
        assert.equal(result.status, 404, `${caller}: ${result.message}`);
        assert.deepEqual(await listDraftIds(initiativeId, caller), []);
      }
      assert.deepEqual(await getDraft(owner, draft.draftId), draft);
    });

    it("11 — deleted and nonexistent drafts are rejected and not recreated", async () => {
      const initiativeId = createInitiative();
      const draft = await createDraft(initiativeId);
      assert.equal(
        (await call("DELETE", `${draftsPath(initiativeId)}/${draft.draftId}`)).status,
        200,
      );

      for (const draftId of [draft.draftId, `initiative-petition-draft-missing-${RUN}`]) {
        const result = await generate(initiativeId, draftId, { overwrite: true });
        assert.equal(result.status, 404, result.message);
      }
      assert.deepEqual(await listDraftIds(initiativeId), []);
      assert.deepEqual(await slotsOf(initiativeId), []);
    });
  });

  describe("compatibility", () => {
    it("13 — legacy generation is unchanged and independent of draft-scoped generation", async () => {
      const initiativeId = createInitiative();
      const draft = await createDraft(initiativeId);
      const generated = (await generate(initiativeId, draft.draftId)).data as Draft;
      assert.equal(mods.legacyDrafts.getInitiativePetitionDraftByInitiativeId(initiativeId), null);

      const legacy = await mods.lifecycle.generateInitiativePetitionDraft(identity, initiativeId);
      assert.deepEqual(
        {
          title: legacy.title,
          publicSummary: legacy.publicSummary,
          requestStatement: legacy.requestStatement,
          expectedOutcome: legacy.expectedOutcome,
          supportingContext: legacy.supportingContext,
          keyArguments: legacy.keyArguments,
        },
        contentOf(generated),
      );
      assert.deepEqual(
        {
          revisionId: legacy.revisionId,
          revisionVersion: legacy.revisionVersion,
          analysisId: legacy.analysisId,
          analysisVersion: legacy.analysisVersion,
          proposalIds: legacy.proposalIds,
        },
        traceabilityOf(generated),
      );
      assert.notEqual(legacy.draftId, draft.draftId);
      assert.deepEqual(await getDraft(initiativeId, draft.draftId), generated);
      assert.deepEqual(await listDraftIds(initiativeId), [draft.draftId]);
    });

    it("14 — published Petitions and signatures are unchanged; nothing is published", async () => {
      const initiativeId = createInitiative();
      const published = await seedOpenPetition(initiativeId);
      await mods.store.signPetition(published, mods.signerId);
      const before = storedFields(await mods.store.getPetition(published));
      assert.equal(before?.signatures.length, 1);
      const draft = await createDraft(initiativeId, { derivedFromPetitionId: published });

      await generate(initiativeId, draft.draftId);
      await generate(initiativeId, draft.draftId, { overwrite: true });

      assert.deepEqual(storedFields(await mods.store.getPetition(published)), before);
      assert.deepEqual(
        (await mods.store.listPetitionsByInitiativeId(initiativeId)).map(
          (petition) => petition.petitionId,
        ),
        [published],
      );
      const events = await mods.database
        .getMongoCollection(mods.collections.MONGO_COLLECTIONS.outbox)
        .countDocuments({
          eventId: { $regex: `^initiative-lifecycle-stage-published:${initiativeId}:` },
        });
      assert.equal(events, 0);
    });
  });
});
