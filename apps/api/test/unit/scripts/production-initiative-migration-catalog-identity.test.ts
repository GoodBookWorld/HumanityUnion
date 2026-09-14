import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db, Document } from "mongodb";

import {
  CANONICAL_PRODUCTION_INITIATIVE_IDS,
  ProductionInitiativeMigrationError,
  assertNoIntraBatchPrimaryCollisions,
  findIntraBatchPrimaryCollisions,
  getCollectionCatalogEntry,
  getDeclaredPrimaryIdentityFields,
  inventoryMustMigrateCivicChildren,
  loadMustMigrateParentMaps,
  resolveDocumentAncestry,
  resolveMigrationPrimaryIdentity,
} from "../../../src/modules/production-initiative-migration/index.js";

type MemDoc = Document & { _id?: string };

function getPath(doc: MemDoc, path: string): unknown {
  if (!path.includes(".")) return doc[path];
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[part];
  }, doc);
}

function matchesFilter(doc: MemDoc, filter: Document): boolean {
  if (filter.$or && Array.isArray(filter.$or)) {
    return (filter.$or as Document[]).some((part) => matchesFilter(doc, part));
  }
  for (const [key, value] of Object.entries(filter)) {
    if (key === "$or") continue;
    const actual = getPath(doc, key);
    if (value && typeof value === "object" && !Array.isArray(value) && "$in" in (value as object)) {
      const list = (value as { $in: unknown[] }).$in;
      if (!list.some((candidate) => String(candidate) === String(actual))) return false;
      continue;
    }
    if (String(actual) !== String(value)) return false;
  }
  return true;
}

class MemoryCursor {
  constructor(private readonly docs: MemDoc[]) {}
  project(_p: Document) {
    return this;
  }
  async toArray() {
    return this.docs.map((d) => ({ ...d }));
  }
}

class MemoryDb {
  readonly store = new Map<string, MemDoc[]>();
  collection(name: string) {
    if (!this.store.has(name)) this.store.set(name, []);
    const rows = () => this.store.get(name) ?? [];
    return {
      find: (filter: Document) =>
        new MemoryCursor(rows().filter((doc) => matchesFilter(doc, filter))),
      findOne: async (filter: Document) =>
        rows().find((doc) => matchesFilter(doc, filter)) ?? null,
    };
  }
  seed(name: string, docs: MemDoc[]) {
    this.store.set(
      name,
      docs.map((d) => ({ ...d })),
    );
  }
  asDb(): Db {
    return this as unknown as Db;
  }
}

describe("Production Initiative migration catalog identities — Task 07.7.4", () => {
  it("proposals collection resolves collectionId; nested proposalId is not root identity", () => {
    const entry = getCollectionCatalogEntry("initiative_improvement_proposals_collections");
    assert.deepEqual(getDeclaredPrimaryIdentityFields(entry), {
      mode: "single",
      fields: ["collectionId"],
    });
    const identity = resolveMigrationPrimaryIdentity({
      collection: "initiative_improvement_proposals_collections",
      doc: {
        collectionId: "initiative-proposals-collection-abc",
        initiativeId: CANONICAL_PRODUCTION_INITIATIVE_IDS[0],
        proposals: [{ proposalId: "nested-proposal-1" }],
      },
    });
    assert.deepEqual(identity.filter, {
      collectionId: "initiative-proposals-collection-abc",
    });
    assert.equal(identity.recordId, "initiative-proposals-collection-abc");
    assert.throws(
      () =>
        resolveMigrationPrimaryIdentity({
          collection: "initiative_improvement_proposals_collections",
          doc: {
            initiativeId: CANONICAL_PRODUCTION_INITIATIVE_IDS[0],
            proposals: [{ proposalId: "nested-only" }],
          },
        }),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "MISSING_PRIMARY_KEY" &&
        /collectionId/.test(error.message),
    );
  });

  it("official response record resolves responseId", () => {
    const entry = getCollectionCatalogEntry("initiative_official_response_package_records");
    assert.deepEqual(getDeclaredPrimaryIdentityFields(entry), {
      mode: "single",
      fields: ["responseId"],
    });
    const identity = resolveMigrationPrimaryIdentity({
      collection: "initiative_official_response_package_records",
      doc: {
        responseId: "official-response-1",
        initiativeId: CANONICAL_PRODUCTION_INITIATIVE_IDS[0],
      },
    });
    assert.equal(identity.recordId, "official-response-1");
    assert.throws(
      () =>
        resolveMigrationPrimaryIdentity({
          collection: "initiative_official_response_package_records",
          doc: { recordId: "legacy-wrong", initiativeId: "i1" },
        }),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        /responseId/.test((error as Error).message),
    );
  });

  it("civic archive version resolves archiveVersionId", () => {
    const entry = getCollectionCatalogEntry("initiative_civic_archive_versions");
    assert.deepEqual(getDeclaredPrimaryIdentityFields(entry), {
      mode: "single",
      fields: ["archiveVersionId"],
    });
    const identity = resolveMigrationPrimaryIdentity({
      collection: "initiative_civic_archive_versions",
      doc: {
        archiveVersionId: "civic-archive-version-1",
        initiativeId: CANONICAL_PRODUCTION_INITIATIVE_IDS[0],
      },
    });
    assert.equal(identity.recordId, "civic-archive-version-1");
    assert.throws(
      () =>
        resolveMigrationPrimaryIdentity({
          collection: "initiative_civic_archive_versions",
          doc: { versionId: "wrong", initiativeId: "i1" },
        }),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        /archiveVersionId/.test((error as Error).message),
    );
  });

  it("two attendances same session/different participant → distinct composite identities", () => {
    const sessionId = "collab-session-1";
    const a = resolveMigrationPrimaryIdentity({
      collection: "initiative_collaboration_session_attendances",
      doc: { sessionId, participantId: "p-a", status: "attended" },
    });
    const b = resolveMigrationPrimaryIdentity({
      collection: "initiative_collaboration_session_attendances",
      doc: { sessionId, participantId: "p-b", status: "attended" },
    });
    assert.deepEqual(a.filter, { sessionId, participantId: "p-a" });
    assert.deepEqual(b.filter, { sessionId, participantId: "p-b" });
    assert.equal(a.recordId, `${sessionId}::p-a`);
    assert.equal(b.recordId, `${sessionId}::p-b`);
    assert.equal(
      findIntraBatchPrimaryCollisions([
        { collection: "initiative_collaboration_session_attendances", doc: a.filter },
        { collection: "initiative_collaboration_session_attendances", doc: b.filter },
      ]).length,
      0,
    );
  });

  it("duplicate attendance composite → preflight collision failure", () => {
    const doc = { sessionId: "s1", participantId: "p1" };
    assert.throws(
      () =>
        assertNoIntraBatchPrimaryCollisions([
          { collection: "initiative_collaboration_session_attendances", doc },
          { collection: "initiative_collaboration_session_attendances", doc: { ...doc } },
        ]),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "INTRA_BATCH_PRIMARY_COLLISION",
    );
  });

  it("missing sessionId or participantId → fail closed", () => {
    assert.throws(
      () =>
        resolveMigrationPrimaryIdentity({
          collection: "initiative_collaboration_session_attendances",
          doc: { sessionId: "s1" },
        }),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        /participantId/.test((error as Error).message),
    );
    assert.throws(
      () =>
        resolveMigrationPrimaryIdentity({
          collection: "initiative_collaboration_session_attendances",
          doc: { participantId: "p1" },
        }),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        /sessionId/.test((error as Error).message),
    );
  });

  it("attendance parent session resolves to correct initiative; unresolved fails closed", async () => {
    const initiativeId = CANONICAL_PRODUCTION_INITIATIVE_IDS[0]!;
    const sessionId = "session-owned";
    const allowList = new Set<string>([...CANONICAL_PRODUCTION_INITIATIVE_IDS]);
    const maps = new Map<string, string | null>([[sessionId, initiativeId]]);

    const ok = resolveDocumentAncestry({
      doc: { sessionId, participantId: "p1" },
      method: "parent:sessionId",
      allowList,
      parentInitiativeById: maps,
    });
    assert.equal(ok.initiativeId, initiativeId);
    assert.equal(ok.ambiguous, false);

    const missing = resolveDocumentAncestry({
      doc: { sessionId: "unknown-session", participantId: "p1" },
      method: "parent:sessionId",
      allowList,
      parentInitiativeById: maps,
    });
    assert.equal(missing.ambiguous, true);
    assert.equal(missing.initiativeId, null);

    const outside = resolveDocumentAncestry({
      doc: { sessionId: "foreign", participantId: "p1" },
      method: "parent:sessionId",
      allowList,
      parentInitiativeById: new Map([["foreign", "initiative-not-allowlisted"]]),
    });
    assert.equal(outside.ambiguous, true);

    const db = new MemoryDb();
    db.seed("initiative_collaboration_sessions", [
      { sessionId, initiativeId },
    ]);
    const loaded = await loadMustMigrateParentMaps(db.asDb(), [initiativeId]);
    assert.equal(loaded.sessionMap.get(sessionId), initiativeId);
  });

  it("inventory includes attendances exactly once via parent:sessionId", async () => {
    const initiativeId = CANONICAL_PRODUCTION_INITIATIVE_IDS[0]!;
    const sessionId = "session-inv-1";
    const db = new MemoryDb();
    for (const name of [
      "initiative_collective_decisions",
      "initiative_implementation_trackings",
      "petitions",
    ]) {
      db.seed(name, []);
    }
    db.seed("initiative_collaboration_sessions", [
      { sessionId, initiativeId },
      {
        sessionId: "session-other",
        initiativeId: CANONICAL_PRODUCTION_INITIATIVE_IDS[1]!,
      },
    ]);
    db.seed("initiative_collaboration_session_attendances", [
      { sessionId, participantId: "p-a", status: "attended" },
      { sessionId, participantId: "p-b", status: "attended" },
      {
        sessionId: "session-other",
        participantId: "p-c",
        status: "attended",
      },
    ]);

    const inventory = await inventoryMustMigrateCivicChildren(db.asDb());
    const attendances = inventory.children.filter(
      (c) => c.collection === "initiative_collaboration_session_attendances",
    );
    assert.equal(attendances.length, 3);
    assert.equal(
      attendances.filter((a) => a.initiativeId === initiativeId).length,
      2,
    );
    assert.deepEqual(
      attendances
        .filter((a) => a.initiativeId === initiativeId)
        .map((a) => a.recordId)
        .sort(),
      [`${sessionId}::p-a`, `${sessionId}::p-b`].sort(),
    );
    assert.equal(inventory.byCollection["initiative_collaboration_session_attendances"], 3);
  });

  it("existing Allies composite regression + single-field collections unchanged", () => {
    const allies = getDeclaredPrimaryIdentityFields(
      getCollectionCatalogEntry("initiative_allies"),
    );
    assert.deepEqual(allies, {
      mode: "composite",
      fields: ["initiativeId", "participantId"],
    });
    const analysis = resolveMigrationPrimaryIdentity({
      collection: "initiative_analyses",
      doc: { analysisId: "a1", initiativeId: "i1" },
    });
    assert.deepEqual(analysis.filter, { analysisId: "a1" });
  });

  it("attendance missing composite identity in inventory → fail closed", async () => {
    const initiativeId = CANONICAL_PRODUCTION_INITIATIVE_IDS[0]!;
    const db = new MemoryDb();
    for (const name of [
      "initiative_collective_decisions",
      "initiative_implementation_trackings",
      "petitions",
    ]) {
      db.seed(name, []);
    }
    db.seed("initiative_collaboration_sessions", [
      { sessionId: "s-ok", initiativeId },
    ]);
    db.seed("initiative_collaboration_session_attendances", [
      { sessionId: "s-ok", status: "attended" },
    ]);
    await assert.rejects(
      () => inventoryMustMigrateCivicChildren(db.asDb()),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "MISSING_PRIMARY_KEY",
    );
  });
});
