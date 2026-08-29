import type { Db, Document } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { resolveDocumentAncestry } from "./ancestry.js";
import { listCollectionsByClassification } from "./collection-plan.js";
import { CANONICAL_PRODUCTION_INITIATIVE_IDS } from "./constants.js";
import { ProductionInitiativeMigrationError } from "./errors.js";
import {
  assertNoIntraBatchPrimaryCollisions,
  resolveMigrationPrimaryIdentity,
} from "./primary-identity.js";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function loadParentMaps(db: Db, initiativeIds: string[]) {
  const decisions = await db
    .collection(MONGO_COLLECTIONS.initiativeCollectiveDecisions)
    .find({ initiativeId: { $in: initiativeIds } })
    .project({ decisionId: 1, initiativeId: 1 })
    .toArray();
  const decisionMap = new Map<string, string | null>();
  for (const d of decisions) {
    const id = asString(d.decisionId);
    if (id) decisionMap.set(id, asString(d.initiativeId));
  }
  const trackings = await db
    .collection(MONGO_COLLECTIONS.initiativeImplementationTrackings)
    .find({ initiativeId: { $in: initiativeIds } })
    .project({ trackingId: 1, initiativeId: 1 })
    .toArray();
  const trackingMap = new Map<string, string | null>();
  for (const t of trackings) {
    const id = asString(t.trackingId);
    if (id) trackingMap.set(id, asString(t.initiativeId));
  }
  const petitions = await db
    .collection(MONGO_COLLECTIONS.petitions)
    .find({ initiativeId: { $in: initiativeIds } })
    .project({ petitionId: 1, initiativeId: 1 })
    .toArray();
  const petitionMap = new Map<string, string | null>();
  for (const p of petitions) {
    const id = asString(p.petitionId);
    if (id) petitionMap.set(id, asString(p.initiativeId));
  }
  return { decisionMap, trackingMap, petitionMap };
}

export interface CivicChildRef {
  collection: string;
  recordId: string;
  initiativeId: string;
}

export interface PlannedCivicChildDocument {
  collection: string;
  initiativeId: string;
  doc: Document;
  recordId: string;
}

function mustMigrateChildCollections() {
  return listCollectionsByClassification("MUST_MIGRATE").filter(
    (entry) =>
      entry.collection !== "initiatives" &&
      entry.ancestryMethod !== "participant-scoped" &&
      !entry.collection.includes(".") &&
      entry.collection !== "media_upload_records",
  );
}

/**
 * Inventory MUST_MIGRATE civic children for the nine allow-listed Initiatives
 * (execute / verifier / inline preflight compatible).
 */
export async function inventoryMustMigrateCivicChildren(db: Db): Promise<{
  children: CivicChildRef[];
  byCollection: Record<string, number>;
  plannedDocuments: PlannedCivicChildDocument[];
}> {
  const allowList = new Set<string>([...CANONICAL_PRODUCTION_INITIATIVE_IDS]);
  const initiativeIds = [...CANONICAL_PRODUCTION_INITIATIVE_IDS];
  const parentMaps = await loadParentMaps(db, initiativeIds);
  const mustCollections = mustMigrateChildCollections();

  const children: CivicChildRef[] = [];
  const plannedDocuments: PlannedCivicChildDocument[] = [];
  const byCollection: Record<string, number> = {};

  for (const initiativeId of initiativeIds) {
    for (const entry of mustCollections) {
      let filter: Document = { initiativeId };
      if (entry.ancestryMethod === "direct:subject.initiativeId") {
        filter = {
          $or: [{ initiativeId }, { "subject.initiativeId": initiativeId }],
        };
      } else if (entry.ancestryMethod === "pk:initiativeId") {
        filter = { $or: [{ initiativeId }, { _id: initiativeId }] };
      } else if (entry.ancestryMethod === "parent:decisionId") {
        const ids = [...parentMaps.decisionMap.entries()]
          .filter(([, iid]) => iid === initiativeId)
          .map(([id]) => id);
        filter = ids.length ? { decisionId: { $in: ids } } : { _id: "__none__" };
      } else if (entry.ancestryMethod === "parent:trackingId") {
        const ids = [...parentMaps.trackingMap.entries()]
          .filter(([, iid]) => iid === initiativeId)
          .map(([id]) => id);
        filter = ids.length ? { trackingId: { $in: ids } } : { _id: "__none__" };
      } else if (entry.ancestryMethod === "parent:petitionId") {
        const ids = [...parentMaps.petitionMap.entries()]
          .filter(([, iid]) => iid === initiativeId)
          .map(([id]) => id);
        filter = ids.length ? { petitionId: { $in: ids } } : { _id: "__none__" };
      } else if (entry.ancestryMethod === "optional:initiativeId") {
        filter = { initiativeId };
      } else if (entry.ancestryMethod.startsWith("parent:")) {
        continue;
      }

      const docs = await db.collection(entry.collection).find(filter).toArray();
      for (const doc of docs) {
        const parentMap =
          entry.ancestryMethod === "parent:decisionId"
            ? parentMaps.decisionMap
            : entry.ancestryMethod === "parent:trackingId"
              ? parentMaps.trackingMap
              : entry.ancestryMethod === "parent:petitionId"
                ? parentMaps.petitionMap
                : undefined;
        const ancestry = resolveDocumentAncestry({
          doc,
          method: entry.ancestryMethod,
          allowList,
          parentInitiativeById: parentMap,
        });
        if (ancestry.ambiguous || ancestry.initiativeId !== initiativeId) {
          throw new ProductionInitiativeMigrationError(
            `Ambiguous/unresolved MUST ancestry in ${entry.collection} for ${initiativeId}`,
            "AMBIGUOUS_ANCESTRY",
          );
        }
        let recordId: string;
        try {
          recordId = resolveMigrationPrimaryIdentity({
            collection: entry.collection,
            doc,
          }).recordId;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new ProductionInitiativeMigrationError(
            `Civic child identity unresolved in ${entry.collection}: ${message}`,
            "MISSING_PRIMARY_KEY",
          );
        }
        children.push({ collection: entry.collection, recordId, initiativeId });
        plannedDocuments.push({
          collection: entry.collection,
          initiativeId,
          doc,
          recordId,
        });
        byCollection[entry.collection] = (byCollection[entry.collection] ?? 0) + 1;
      }
    }
  }

  return { children, byCollection, plannedDocuments };
}

/** Assert planned MUST children have unique destination primary identities. */
export async function assertSourceIntraBatchPrimaryIdentitiesUnique(
  sourceDb: Db,
): Promise<{ plannedCount: number }> {
  const inventory = await inventoryMustMigrateCivicChildren(sourceDb);
  assertNoIntraBatchPrimaryCollisions(
    inventory.plannedDocuments.map((row) => ({
      collection: row.collection,
      doc: row.doc,
    })),
  );
  return { plannedCount: inventory.plannedDocuments.length };
}
