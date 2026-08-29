import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db, Document } from "mongodb";

import {
  MigrationOwnershipLedger,
  ProductionInitiativeMigrationError,
  assertNoIntraBatchPrimaryCollisions,
  findIntraBatchPrimaryCollisions,
  getCollectionCatalogEntry,
  getDeclaredPrimaryIdentityFields,
  inventoryMustMigrateCivicChildren,
  resolveMigrationPrimaryIdentity,
  rollbackOwnedProfileVisibilityPatches,
} from "../../../src/modules/production-initiative-migration/index.js";

describe("Production Initiative migration Ally composite identity — Task 07.7.1", () => {
  it("catalog declares composite initiativeId+participantId (no allyId)", () => {
    const entry = getCollectionCatalogEntry("initiative_allies");
    assert.ok(entry);
    assert.deepEqual(entry!.compositePrimaryIdFields, ["initiativeId", "participantId"]);
    assert.equal(entry!.primaryIdFields, undefined);
    const declared = getDeclaredPrimaryIdentityFields(entry);
    assert.deepEqual(declared, {
      mode: "composite",
      fields: ["initiativeId", "participantId"],
    });
  });

  it("two Allies same Initiative different participants → distinct composite filters", () => {
    const initiativeId = "initiative-1784349613932";
    const a = resolveMigrationPrimaryIdentity({
      collection: "initiative_allies",
      doc: {
        initiativeId,
        participantId: "participant-a",
        status: "active",
      },
    });
    const b = resolveMigrationPrimaryIdentity({
      collection: "initiative_allies",
      doc: {
        initiativeId,
        participantId: "participant-b",
        status: "active",
      },
    });
    assert.deepEqual(a.filter, { initiativeId, participantId: "participant-a" });
    assert.deepEqual(b.filter, { initiativeId, participantId: "participant-b" });
    assert.equal(a.recordId, `${initiativeId}::participant-a`);
    assert.equal(b.recordId, `${initiativeId}::participant-b`);
    assert.notEqual(a.recordId, b.recordId);
    assert.equal(findIntraBatchPrimaryCollisions([
      { collection: "initiative_allies", doc: { initiativeId, participantId: "participant-a" } },
      { collection: "initiative_allies", doc: { initiativeId, participantId: "participant-b" } },
    ]).length, 0);
    assert.doesNotThrow(() =>
      assertNoIntraBatchPrimaryCollisions([
        { collection: "initiative_allies", doc: { initiativeId, participantId: "participant-a" } },
        { collection: "initiative_allies", doc: { initiativeId, participantId: "participant-b" } },
      ]),
    );
  });

  it("two identical Ally composites → intra-batch collision fails before writes", () => {
    const initiativeId = "initiative-1784349613932";
    const doc = { initiativeId, participantId: "participant-dup", status: "active" };
    const collisions = findIntraBatchPrimaryCollisions([
      { collection: "initiative_allies", doc },
      { collection: "initiative_allies", doc: { ...doc } },
    ]);
    assert.equal(collisions.length, 1);
    assert.equal(collisions[0]!.recordId, `${initiativeId}::participant-dup`);
    assert.throws(
      () =>
        assertNoIntraBatchPrimaryCollisions([
          { collection: "initiative_allies", doc },
          { collection: "initiative_allies", doc: { ...doc } },
        ]),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "INTRA_BATCH_PRIMARY_COLLISION",
    );
  });

  it("missing participantId or initiativeId → fail closed", () => {
    assert.throws(
      () =>
        resolveMigrationPrimaryIdentity({
          collection: "initiative_allies",
          doc: { initiativeId: "initiative-1", status: "active" },
        }),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "MISSING_PRIMARY_KEY" &&
        /participantId/.test(error.message),
    );
    assert.throws(
      () =>
        resolveMigrationPrimaryIdentity({
          collection: "initiative_allies",
          doc: { participantId: "p1", status: "active" },
        }),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "MISSING_PRIMARY_KEY" &&
        /initiativeId/.test(error.message),
    );
  });

  it("Ally verifier key is initiativeId::participantId — never unknown for valid data", async () => {
    const initiativeId = "initiative-1783748417899";
    const participantId = "a5e65d2f-3be7-4f8f-acd9-87c68027d662";
    const store = new Map<string, Document[]>();
    store.set("initiative_allies", [
      {
        _id: { toString: () => "objectid-not-string" },
        initiativeId,
        participantId,
        status: "active",
        requestedByParticipantId: participantId,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    // Minimal MemoryDb for inventory
    const db = {
      collection(name: string) {
        const rows = store.get(name) ?? [];
        return {
          find(filter: Document) {
            const matched = rows.filter((doc) => {
              if (filter.initiativeId) return doc.initiativeId === filter.initiativeId;
              return true;
            });
            return {
              project() {
                return this;
              },
              async toArray() {
                return matched.map((d) => ({ ...d }));
              },
            };
          },
        };
      },
    } as unknown as Db;

    // Seed empty parent maps collections
    for (const name of [
      "initiative_collective_decisions",
      "initiative_implementation_trackings",
      "petitions",
    ]) {
      store.set(name, []);
    }

    const inventory = await inventoryMustMigrateCivicChildren(db);
    const allies = inventory.children.filter((c) => c.collection === "initiative_allies");
    assert.equal(allies.length, 1);
    assert.equal(allies[0]!.recordId, `${initiativeId}::${participantId}`);
    assert.doesNotMatch(allies[0]!.recordId, /unknown/);
  });

  it("existing single-field primary-key collections unchanged", () => {
    const analysis = resolveMigrationPrimaryIdentity({
      collection: "initiative_analyses",
      doc: { analysisId: "analysis-1", initiativeId: "initiative-1" },
    });
    assert.equal(analysis.mode, "single");
    assert.deepEqual(analysis.filter, { analysisId: "analysis-1" });
    assert.equal(analysis.recordId, "analysis-1");
  });

  it("generic intra-batch collision detection works across collections", () => {
    const collisions = findIntraBatchPrimaryCollisions([
      {
        collection: "initiative_analyses",
        doc: { analysisId: "a1", initiativeId: "i1" },
      },
      {
        collection: "initiative_analyses",
        doc: { analysisId: "a1", initiativeId: "i2" },
      },
      {
        collection: "initiative_comments",
        doc: { commentId: "c1", initiativeId: "i1" },
      },
    ]);
    assert.equal(collisions.length, 1);
    assert.equal(collisions[0]!.collection, "initiative_analyses");
    assert.equal(collisions[0]!.recordId, "a1");
  });

  it("membershipPubliclyVisible rollback restores only migration-applied value", async () => {
    const profiles = new Map<string, Document>([
      ["prof-1", { profileId: "prof-1", membershipPubliclyVisible: false }],
      ["prof-2", { profileId: "prof-2", membershipPubliclyVisible: true }],
    ]);
    const db = {
      collection() {
        return {
          async findOne(filter: Document) {
            return profiles.get(String(filter.profileId)) ?? null;
          },
          async updateOne(filter: Document, update: Document) {
            const row = profiles.get(String(filter.profileId));
            if (!row) return { matchedCount: 0 };
            if (update.$set) {
              Object.assign(row, update.$set);
            }
            if (update.$unset?.membershipPubliclyVisible !== undefined) {
              delete row.membershipPubliclyVisible;
            }
            return { matchedCount: 1, modifiedCount: 1 };
          },
        };
      },
    } as unknown as Db;

    const ledger = new MigrationOwnershipLedger("mig_test_profile");
    // Migration changed prof-1 true→false; still false → restore true
    ledger.recordProfileVisibilityPatch({
      profileId: "prof-1",
      previousValue: true,
      appliedValue: false,
      phase: "B_membership",
    });
    // Migration changed prof-2 false→true; concurrent edit left it true already? 
    // Actually: applied true, but concurrent set to false → skip
    ledger.recordProfileVisibilityPatch({
      profileId: "prof-2",
      previousValue: false,
      appliedValue: true,
      phase: "B_membership",
    });
    // Simulate concurrent change on prof-2 away from appliedValue
    profiles.set("prof-2", { profileId: "prof-2", membershipPubliclyVisible: false });

    const restored = await rollbackOwnedProfileVisibilityPatches(db, ledger);
    assert.equal(restored, 1);
    assert.equal(profiles.get("prof-1")!.membershipPubliclyVisible, true);
    assert.equal(profiles.get("prof-2")!.membershipPubliclyVisible, false);
  });

  it("documents prior Phase B behavior: patch was not ledgered before 07.7.1", () => {
    // Before fix: updateOne without ledger meant failed execute left membershipPubliclyVisible
    // mutated. After fix: ledger + conditional restore (covered above).
    const ledger = new MigrationOwnershipLedger("mig_doc");
    assert.equal(ledger.listProfileVisibilityPatches().length, 0);
    ledger.recordProfileVisibilityPatch({
      profileId: "p",
      previousValue: undefined,
      appliedValue: false,
      phase: "B_membership",
    });
    assert.equal(ledger.rollbackEligibleProfileVisibilityPatches().length, 1);
  });
});
