/**
 * HU-LC-05C.4C — publishing one selected working draft (draftId) as a new
 * Petition in the draft's own slot (draft → reserved → published), with a
 * unique publication version, the event in the transactional outbox, a draft
 * mutation lock while it runs, and safe recovery/retry.
 *
 * Real Express router + auth middleware over a process-owned single-node
 * MongoMemoryReplSet (one hu_test_ database, dropped afterwards).
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_PETITION_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
process.env.NOTIFICATION_PERSISTENCE = "memory";
process.env.JWT_ACCESS_SECRET = "hu-lc-05c4c-test-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET = "hu-lc-05c4c-test-refresh-secret-0123456789abcdef";
process.env.AUTH_BOOTSTRAP_FALLBACK = "false";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { after, afterEach, before, describe, it } from "node:test";

import express from "express";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import type { Initiative, Petition } from "@hu/types";

import type * as AuthTokens from "../../../src/modules/auth/auth-tokens.js";
import type * as MongoCollections from "../../../src/infrastructure/mongodb/mongo-collections.js";
import type * as MongoDatabase from "../../../src/infrastructure/mongodb/mongo-database.js";
import type * as Initiatives from "../../../src/modules/initiatives/initiative.store.js";
import type * as PetitionLifecycle from "../../../src/modules/initiative-petition-lifecycle/initiative-petition-lifecycle.service.js";
import type * as RevisionService from "../../../src/modules/initiative-version-revision/initiative-version-revision.service.js";
import type * as RevisionStore from "../../../src/modules/initiative-version-revision/initiative-version-revision.store.js";
import type * as SlotService from "../../../src/modules/initiative-petition-slots/petition-slot.service.js";
import type * as PetitionStore from "../../../src/modules/petition/petition.store.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_draft_publication_${RUN}`;
const STEWARD = { userId: `user-lc05c4c-steward-${RUN}`, memberId: `member-lc05c4c-${RUN}` };
const OTHER = { userId: `user-lc05c4c-other-${RUN}`, memberId: `member-lc05c4c-other-${RUN}` };
const DISABLED = { userId: `user-lc05c4c-disabled-${RUN}`, memberId: STEWARD.memberId };
const identity = { participantId: STEWARD.memberId };
const SHORT_LEASE_MS = 300;

/** Loaded after the environment above is set; persistence adapters bind at import. */
type Mods = {
  tokens: typeof AuthTokens;
  store: typeof PetitionStore;
  lifecycle: typeof PetitionLifecycle;
  initiatives: typeof Initiatives;
  revisions: typeof RevisionService;
  revisionStore: typeof RevisionStore;
  slots: typeof SlotService;
  database: typeof MongoDatabase;
  collections: typeof MongoCollections;
  signerId: string;
};

type Caller = "anonymous" | "invalid" | "disabled" | "other" | "steward";
type Draft = {
  draftId: string;
  initiativeId: string;
  title: string;
  publicSummary: string;
  requestStatement: string;
  expectedOutcome: string;
  supportingContext: string;
  keyArguments: string[];
  recipients: string[];
  revisionId: string | null;
  revisionVersion: number | null;
  analysisId: string | null;
  analysisVersion: number | null;
  proposalIds: string[];
  updatedAt: string;
};
type Slot = {
  slotNumber: number;
  state: "draft" | "reserved" | "published";
  draftId: string | null;
  petitionId: string | null;
  attemptId: string | null;
  publicationVersion?: number | null;
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
      displayName: "LC-05C.4C Test",
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
const publish = (initiativeId: string, draftId: string, caller: Caller = "steward") =>
  call("POST", `${draftPath(initiativeId, draftId)}/publish`, caller);

function createInitiative(
  options: { profile?: "STANDARD" | "PUBLIC_CHOICE"; stewardId?: string } = {},
): string {
  counter += 1;
  const stewardId = options.stewardId ?? STEWARD.memberId;
  const now = new Date().toISOString();
  const initiative = mods.initiatives.createInitiative({
    initiativeId: `initiative-lc05c4c-${counter}-${RUN}`,
    stewardId,
    title: `River Petition ${counter}`,
    description: "Fixture Initiative for working-draft publication.",
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

/** A generated (publishable) working draft, optionally with recipients. */
async function readyDraft(initiativeId: string, recipients: string[] = []): Promise<Draft> {
  const created = await call("POST", draftsPath(initiativeId));
  assert.equal(created.status, 201, created.message);
  const draftId = (created.data as Draft).draftId;
  const generated = await call("POST", `${draftPath(initiativeId, draftId)}/generate`);
  assert.equal(generated.status, 200, generated.message);
  if (recipients.length === 0) {
    return generated.data as Draft;
  }
  const patched = await call("PATCH", draftPath(initiativeId, draftId), "steward", { recipients });
  assert.equal(patched.status, 200, patched.message);
  return patched.data as Draft;
}

async function getDraft(initiativeId: string, draftId: string): Promise<Draft | null> {
  const result = await call("GET", draftPath(initiativeId, draftId));
  return result.status === 200 ? (result.data as Draft) : null;
}

async function slotsOf(initiativeId: string): Promise<Slot[]> {
  return mods.database
    .getMongoCollection<Slot>(mods.collections.MONGO_COLLECTIONS.initiativePetitionSlots)
    .find(
      { initiativeId },
      { projection: { _id: 0, initiativeId: 0, createdAt: 0, leaseExpiresAt: 0 } },
    )
    .sort({ slotNumber: 1 })
    .toArray();
}

async function slotOfDraft(draftId: string): Promise<Slot | null> {
  return mods.database
    .getMongoCollection<Slot>(mods.collections.MONGO_COLLECTIONS.initiativePetitionSlots)
    .findOne({ draftId }, { projection: { _id: 0 } });
}

async function petitionEvents(initiativeId: string) {
  return mods.database
    .getMongoCollection<{ eventId: string; envelope: string }>(
      mods.collections.MONGO_COLLECTIONS.outbox,
    )
    .find({
      eventId: { $regex: `^initiative-lifecycle-stage-published:${initiativeId}:petition:` },
    })
    .sort({ eventId: 1 })
    .toArray();
}

const eventVersion = (eventId: string) => Number(eventId.split(":").at(-2));

function storedFields(petition: Petition | null) {
  if (!petition) {
    return null;
  }
  const { petitionId, collectiveDecisionId, status, updatedAt, subject, traceability, signatures } =
    petition;
  return { petitionId, collectiveDecisionId, status, updatedAt, subject, traceability, signatures };
}

const petitionIdOf = (draftId: string) => `petition-${draftId}`;

describe("HU-LC-05C.4C — independent Petition publication", () => {
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
      initiatives: await import("../../../src/modules/initiatives/initiative.store.js"),
      revisions:
        await import("../../../src/modules/initiative-version-revision/initiative-version-revision.service.js"),
      revisionStore:
        await import("../../../src/modules/initiative-version-revision/initiative-version-revision.store.js"),
      slots:
        await import("../../../src/modules/initiative-petition-slots/petition-slot.service.js"),
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

  afterEach(() => {
    mods.slots.setPetitionSlotFaultForTests(null);
    mods.slots.setPetitionReservationLeaseMsForTests(null);
    mods.slots.setPetitionFinalizePauseForTests(null);
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

  describe("publication in the draft's own slot", () => {
    it("publishes a first, second and third Petition with three slots occupied — never a fourth", async () => {
      const initiativeId = createInitiative();
      const drafts = [
        await readyDraft(initiativeId),
        await readyDraft(initiativeId),
        await readyDraft(initiativeId),
      ];
      const slotsBefore = await slotsOf(initiativeId);
      assert.deepEqual(
        slotsBefore.map((slot) => [slot.state, slot.draftId]),
        drafts.map((draft) => ["draft", draft.draftId]),
      );

      for (const [index, draft] of drafts.entries()) {
        const result = await publish(initiativeId, draft.draftId);
        assert.equal(result.status, 200, result.message);
        const petition = result.data as Petition;
        assert.equal(petition.petitionId, petitionIdOf(draft.draftId));
        assert.equal(petition.status, "Open");
        assert.equal(petition.collectiveDecisionId, `decision-${petition.petitionId}`);
        assert.equal((await slotsOf(initiativeId)).length, 3, `after publication ${index + 1}`);
      }

      assert.deepEqual(
        (await slotsOf(initiativeId)).map(({ attemptId: _attemptId, ...slot }) => slot),
        slotsBefore.map((slot, index) => ({
          slotNumber: slot.slotNumber,
          state: "published",
          draftId: slot.draftId,
          petitionId: petitionIdOf(slot.draftId!),
          publicationVersion: index + 1,
        })),
      );
      assert.deepEqual(((await call("GET", draftsPath(initiativeId))).data as Draft[]).length, 0);
      assert.deepEqual(
        (await mods.store.listPetitionsByInitiativeId(initiativeId)).map((petition) => [
          petition.petitionId,
          petition.status,
        ]),
        drafts.map((draft) => [petitionIdOf(draft.draftId), "Open"]),
      );

      // A fourth independent Petition cannot even start as a draft.
      const fourth = await call("POST", draftsPath(initiativeId));
      assert.equal(fourth.status, 409, fourth.message);
    });

    it("preserves content, recipients and Revision traceability; signatures stay independent", async () => {
      const initiativeId = createInitiative();
      const a = await readyDraft(initiativeId, ["City Council", "Mayor"]);
      const b = await readyDraft(initiativeId);

      const first = (await publish(initiativeId, a.draftId)).data as Petition;
      const second = (await publish(initiativeId, b.draftId)).data as Petition;
      const stored = await mods.store.getPetition(first.petitionId);
      assert.deepEqual(stored?.subject.recipients, ["City Council", "Mayor"]);
      assert.equal(stored?.subject.title, a.title);
      assert.equal(stored?.subject.summary, a.publicSummary);
      assert.equal(stored?.subject.requestStatement, a.requestStatement);
      assert.deepEqual(stored?.subject.keyArguments, a.keyArguments);
      assert.equal(stored?.subject.initiativeId, initiativeId);
      assert.deepEqual(stored?.traceability, {
        revisionId: a.revisionId,
        revisionVersion: a.revisionVersion,
        proposalIds: a.proposalIds,
        analysisId: a.analysisId,
        analysisVersion: a.analysisVersion,
      });
      assert.deepEqual((await mods.store.getPetition(second.petitionId))?.subject.recipients, []);

      // HU-LC-05C.4C.4 — published recipients reach the public document; none → omitted.
      const { toPublicPetitionProjection } =
        await import("../../../src/modules/petition/public-petition.projection.js");
      const publicFirst = await toPublicPetitionProjection(stored!);
      assert.deepEqual(publicFirst?.petitionSubject.recipients, ["City Council", "Mayor"]);
      const publicSecond = await toPublicPetitionProjection(
        (await mods.store.getPetition(second.petitionId))!,
      );
      assert.equal(Object.hasOwn(publicSecond!.petitionSubject, "recipients"), false);

      await mods.store.signPetition(first.petitionId, mods.signerId);
      const active = (petition: Petition | null) =>
        (petition?.signatures ?? []).filter((signature) => signature.status === "Active").length;
      assert.equal(active(await mods.store.getPetition(first.petitionId)), 1);
      assert.equal(active(await mods.store.getPetition(second.petitionId)), 0);
    });

    it("rejects never-generated, incomplete and outdated drafts with 409 and changes nothing", async () => {
      const initiativeId = createInitiative();
      const blank = (await call("POST", draftsPath(initiativeId))).data as Draft;
      const blankResult = await publish(initiativeId, blank.draftId);
      assert.equal(blankResult.status, 409, blankResult.message);

      const typedOnly = (await call("POST", draftsPath(initiativeId))).data as Draft;
      await call("PATCH", draftPath(initiativeId, typedOnly.draftId), "steward", {
        title: "Typed",
        publicSummary: "Typed",
        requestStatement: "Typed",
        expectedOutcome: "Typed",
      });
      const neverGenerated = await publish(initiativeId, typedOnly.draftId);
      assert.equal(neverGenerated.status, 409, neverGenerated.message);
      assert.match(neverGenerated.message, /Published Revision before publishing/);

      const generated = await readyDraft(initiativeId);
      await call("PATCH", draftPath(initiativeId, generated.draftId), "steward", { title: "   " });
      const incomplete = await publish(initiativeId, generated.draftId);
      assert.equal(incomplete.status, 409, incomplete.message);
      assert.match(incomplete.message, /title is required before publishing/);

      // A newer Published Revision makes a generated draft outdated.
      const stale = await call("PATCH", draftPath(initiativeId, generated.draftId), "steward", {
        title: "Restored title",
      });
      assert.equal(stale.status, 200, stale.message);
      const latest = mods.revisionStore.getLatestRevisionForInitiative(initiativeId)!;
      mods.revisionStore.createRevision({
        ...latest,
        revisionId: `${latest.revisionId}-v2`,
        version: 2,
      });
      const outdated = await publish(initiativeId, generated.draftId);
      assert.equal(outdated.status, 409, outdated.message);
      assert.match(outdated.message, /no longer current/);

      assert.deepEqual(
        (await slotsOf(initiativeId)).map((slot) => slot.state),
        ["draft", "draft", "draft"],
      );
      assert.deepEqual(await mods.store.listPetitionsByInitiativeId(initiativeId), []);
      assert.deepEqual(await petitionEvents(initiativeId), []);

      // Regenerating against the current Revision makes it publishable again.
      await call("POST", `${draftPath(initiativeId, generated.draftId)}/generate`, "steward", {
        overwrite: true,
      });
      assert.equal((await publish(initiativeId, generated.draftId)).status, 200);
    });
  });

  describe("event versions", () => {
    it("allocates versions in publication order, not draft creation order", async () => {
      const initiativeId = createInitiative();
      const older = await readyDraft(initiativeId);
      const newer = await readyDraft(initiativeId);

      assert.equal((await publish(initiativeId, newer.draftId)).status, 200);
      assert.equal((await publish(initiativeId, older.draftId)).status, 200);

      assert.equal((await slotOfDraft(newer.draftId))?.publicationVersion, 1);
      assert.equal((await slotOfDraft(older.draftId))?.publicationVersion, 2);
      const events = await petitionEvents(initiativeId);
      assert.deepEqual(
        events.map((event) => eventVersion(event.eventId)),
        [1, 2],
      );
      assert.match(events[0]!.envelope, new RegExp(petitionIdOf(newer.draftId)));
      assert.match(events[1]!.envelope, new RegExp(petitionIdOf(older.draftId)));
    });

    it("concurrent publication of different drafts: unique versions, one event each", async () => {
      const initiativeId = createInitiative();
      const drafts = [
        await readyDraft(initiativeId),
        await readyDraft(initiativeId),
        await readyDraft(initiativeId),
      ];

      const results = await Promise.all(
        drafts.map((draft) => publish(initiativeId, draft.draftId)),
      );
      for (const result of results) {
        assert.equal(result.status, 200, result.message);
      }

      const versions = (await slotsOf(initiativeId)).map((slot) => slot.publicationVersion);
      assert.deepEqual([...versions].sort(), [1, 2, 3]);
      const events = await petitionEvents(initiativeId);
      assert.deepEqual(
        events.map((event) => eventVersion(event.eventId)),
        [1, 2, 3],
      );
      for (const draft of drafts) {
        const slot = await slotOfDraft(draft.draftId);
        const event = events.find(
          (entry) => eventVersion(entry.eventId) === slot?.publicationVersion,
        );
        assert.match(event!.envelope, new RegExp(petitionIdOf(draft.draftId)));
      }
    });

    it("concurrent duplicate publication of one draft: one Petition, one event, one slot", async () => {
      const initiativeId = createInitiative();
      const draft = await readyDraft(initiativeId);

      const results = await Promise.all(
        Array.from({ length: 5 }, () => publish(initiativeId, draft.draftId)),
      );
      assert.ok(results.some((result) => result.status === 200));
      for (const result of results) {
        assert.ok([200, 409].includes(result.status), `${result.status}: ${result.message}`);
      }

      assert.deepEqual(
        (await mods.store.listPetitionsByInitiativeId(initiativeId)).map((p) => [
          p.petitionId,
          p.status,
        ]),
        [[petitionIdOf(draft.draftId), "Open"]],
      );
      assert.equal((await petitionEvents(initiativeId)).length, 1);
      assert.deepEqual(
        (await slotsOf(initiativeId)).map((slot) => [slot.state, slot.publicationVersion]),
        [["published", 1]],
      );
    });

    it("continues after a legacy-published Petition without colliding with its event", async () => {
      const initiativeId = createInitiative();
      await mods.lifecycle.generateInitiativePetitionDraft(identity, initiativeId);
      const legacy = await mods.lifecycle.publishInitiativePetitionStage(identity, initiativeId);
      const legacyBefore = storedFields(await mods.store.getPetition(legacy.petitionId));
      const draft = await readyDraft(initiativeId);

      assert.equal((await publish(initiativeId, draft.draftId)).status, 200);
      assert.deepEqual(
        (await petitionEvents(initiativeId)).map((event) => eventVersion(event.eventId)),
        [1, 2],
      );
      assert.equal((await slotOfDraft(draft.draftId))?.publicationVersion, 2);
      assert.deepEqual(storedFields(await mods.store.getPetition(legacy.petitionId)), legacyBefore);

      // The legacy route keeps its single-Petition guard.
      await mods.lifecycle.generateInitiativePetitionDraft(identity, initiativeId);
      await assert.rejects(
        () => mods.lifecycle.publishInitiativePetitionStage(identity, initiativeId),
        /already been published/,
      );
    });
  });

  describe("draft lock, rollback and recovery", () => {
    it("locks PATCH, generate and DELETE while the publication runs", async () => {
      const initiativeId = createInitiative();
      const draft = await readyDraft(initiativeId);

      let entered!: () => void;
      const inside = new Promise<void>((resolve) => (entered = resolve));
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      mods.slots.setPetitionFinalizePauseForTests(async () => {
        entered();
        await gate;
      });

      const publication = publish(initiativeId, draft.draftId);
      await inside;
      mods.slots.setPetitionFinalizePauseForTests(null);
      for (const [method, path, body] of [
        ["PATCH", draftPath(initiativeId, draft.draftId), { title: "Changed" }],
        ["POST", `${draftPath(initiativeId, draft.draftId)}/generate`, { overwrite: true }],
        ["DELETE", draftPath(initiativeId, draft.draftId), undefined],
      ] as const) {
        const result = await call(method, path, "steward", body);
        assert.equal(result.status, 409, `${method}: ${result.message}`);
        assert.match(result.message, /being published/);
      }
      release();

      const published = await publication;
      assert.equal(published.status, 200, published.message);
      assert.equal((published.data as Petition).subject.title, draft.title);
    });

    it("rolls back the whole finalization: Ready Petition kept, slot back to draft, no event", async () => {
      const initiativeId = createInitiative();
      const draft = await readyDraft(initiativeId);
      const slotBefore = await slotOfDraft(draft.draftId);
      mods.slots.setPetitionFinalizePauseForTests(async () => {
        throw new Error("Injected finalization failure.");
      });

      const failed = await publish(initiativeId, draft.draftId);
      assert.notEqual(failed.status, 200);
      mods.slots.setPetitionFinalizePauseForTests(null);

      assert.equal((await mods.store.getPetition(petitionIdOf(draft.draftId)))?.status, "Ready");
      assert.deepEqual(await slotOfDraft(draft.draftId), slotBefore);
      assert.deepEqual(await petitionEvents(initiativeId), []);
      const editable = await call("PATCH", draftPath(initiativeId, draft.draftId), "steward", {
        title: "Edited after the failure",
      });
      assert.equal(editable.status, 200, editable.message);

      // The retry resumes the same Petition with the draft's current content.
      const retried = await publish(initiativeId, draft.draftId);
      assert.equal(retried.status, 200, retried.message);
      assert.equal((retried.data as Petition).petitionId, petitionIdOf(draft.draftId));
      assert.equal((retried.data as Petition).subject.title, "Edited after the failure");
      assert.equal((await mods.store.listPetitionsByInitiativeId(initiativeId)).length, 1);
      assert.equal((await petitionEvents(initiativeId)).length, 1);
    });

    it("a crash after reservation keeps the lock until the lease expires, then recovery restores the draft", async () => {
      const initiativeId = createInitiative();
      const draft = await readyDraft(initiativeId);
      mods.slots.setPetitionReservationLeaseMsForTests(SHORT_LEASE_MS);
      mods.slots.setPetitionSlotFaultForTests("crash-after-prepare");
      assert.notEqual((await publish(initiativeId, draft.draftId)).status, 200);
      mods.slots.setPetitionSlotFaultForTests(null);

      const reserved = await slotOfDraft(draft.draftId);
      assert.equal(reserved?.state, "reserved");
      assert.equal(reserved?.petitionId, petitionIdOf(draft.draftId));
      assert.equal((await mods.store.getPetition(petitionIdOf(draft.draftId)))?.status, "Ready");
      assert.equal(
        (await call("PATCH", draftPath(initiativeId, draft.draftId), "steward", { title: "X" }))
          .status,
        409,
      );
      assert.equal((await publish(initiativeId, draft.draftId)).status, 409);

      await sleep(SHORT_LEASE_MS * 2);
      mods.slots.setPetitionReservationLeaseMsForTests(null);
      await mods.slots.recoverExpiredPetitionReservations(initiativeId);

      const restored = await slotOfDraft(draft.draftId);
      assert.deepEqual(
        {
          state: restored?.state,
          petitionId: restored?.petitionId,
          slotNumber: restored?.slotNumber,
        },
        { state: "draft", petitionId: null, slotNumber: reserved?.slotNumber },
      );
      assert.deepEqual(await getDraft(initiativeId, draft.draftId), draft);
      assert.equal(
        (await call("PATCH", draftPath(initiativeId, draft.draftId), "steward", { title: "After" }))
          .status,
        200,
      );

      const retried = await publish(initiativeId, draft.draftId);
      assert.equal(retried.status, 200, retried.message);
      assert.equal((retried.data as Petition).subject.title, "After");
      assert.equal((await mods.store.listPetitionsByInitiativeId(initiativeId)).length, 1);
    });

    it("a retry after the lease expired takes the reservation over and publishes", async () => {
      const initiativeId = createInitiative();
      const draft = await readyDraft(initiativeId);
      mods.slots.setPetitionReservationLeaseMsForTests(SHORT_LEASE_MS);
      mods.slots.setPetitionSlotFaultForTests("crash-after-reserve");
      assert.notEqual((await publish(initiativeId, draft.draftId)).status, 200);
      mods.slots.setPetitionSlotFaultForTests(null);
      mods.slots.setPetitionReservationLeaseMsForTests(null);
      const crashed = await slotOfDraft(draft.draftId);
      await sleep(SHORT_LEASE_MS * 2);

      const retried = await publish(initiativeId, draft.draftId);
      assert.equal(retried.status, 200, retried.message);
      const slot = await slotOfDraft(draft.draftId);
      assert.equal(slot?.state, "published");
      assert.equal(slot?.slotNumber, crashed?.slotNumber);
      assert.notEqual(slot?.attemptId, crashed?.attemptId);
    });

    it("a failure after commit is completed by retrying the same request, without a second event", async () => {
      const initiativeId = createInitiative();
      const draft = await readyDraft(initiativeId);
      mods.slots.setPetitionSlotFaultForTests("crash-after-finalize");
      assert.notEqual((await publish(initiativeId, draft.draftId)).status, 200);
      mods.slots.setPetitionSlotFaultForTests(null);

      const petitionId = petitionIdOf(draft.draftId);
      assert.equal((await mods.store.getPetition(petitionId))?.status, "Published");
      assert.equal(await getDraft(initiativeId, draft.draftId), null);
      assert.equal((await petitionEvents(initiativeId)).length, 1);

      const completed = await publish(initiativeId, draft.draftId);
      assert.equal(completed.status, 200, completed.message);
      assert.equal((completed.data as Petition).status, "Open");
      assert.equal((await petitionEvents(initiativeId)).length, 1);
      assert.equal((await mods.store.listPetitionsByInitiativeId(initiativeId)).length, 1);
    });
  });

  describe("security and compatibility", () => {
    it("requires a verified, active steward; never the bootstrap identity", async () => {
      const initiativeId = createInitiative();
      const draft = await readyDraft(initiativeId);
      for (const [caller, expected] of [
        ["anonymous", 401],
        ["invalid", 401],
        ["disabled", 403],
        ["other", 403],
      ] as Array<[Caller, number]>) {
        const result = await publish(initiativeId, draft.draftId, caller);
        assert.equal(result.status, expected, `${caller}: ${result.message}`);
      }
      process.env.AUTH_BOOTSTRAP_FALLBACK = "true";
      try {
        assert.equal((await publish(initiativeId, draft.draftId, "anonymous")).status, 401);
      } finally {
        process.env.AUTH_BOOTSTRAP_FALLBACK = "false";
      }
      assert.equal((await slotOfDraft(draft.draftId))?.state, "draft");
      assert.deepEqual(await mods.store.listPetitionsByInitiativeId(initiativeId), []);
    });

    it("rejects foreign, deleted and missing drafts", async () => {
      const owner = createInitiative();
      const sibling = createInitiative();
      const draft = await readyDraft(owner);
      const deleted = await readyDraft(owner);
      await call("DELETE", draftPath(owner, deleted.draftId));

      for (const [initiativeId, draftId] of [
        [sibling, draft.draftId],
        [owner, deleted.draftId],
        [owner, `initiative-petition-draft-missing-${RUN}`],
      ] as const) {
        const result = await publish(initiativeId, draftId);
        assert.equal(result.status, 404, `${draftId}: ${result.message}`);
      }
      assert.equal((await slotOfDraft(draft.draftId))?.state, "draft");
    });

    it("rejects PUBLIC_CHOICE Initiatives", async () => {
      const initiativeId = createInitiative({ profile: "PUBLIC_CHOICE" });
      const draft = await readyDraft(initiativeId);

      const result = await publish(initiativeId, draft.draftId);
      assert.equal(result.status, 409, result.message);
      assert.match(result.message, /lifecycle profile/);
      assert.equal((await slotOfDraft(draft.draftId))?.state, "draft");
      assert.deepEqual(await mods.store.listPetitionsByInitiativeId(initiativeId), []);
    });

    it("leaves earlier published Petitions and their signatures unchanged", async () => {
      const initiativeId = createInitiative();
      const first = await readyDraft(initiativeId);
      const second = await readyDraft(initiativeId);
      const published = (await publish(initiativeId, first.draftId)).data as Petition;
      await mods.store.signPetition(published.petitionId, mods.signerId);
      const before = storedFields(await mods.store.getPetition(published.petitionId));

      assert.equal((await publish(initiativeId, second.draftId)).status, 200);
      assert.deepEqual(storedFields(await mods.store.getPetition(published.petitionId)), before);
    });
  });
});
