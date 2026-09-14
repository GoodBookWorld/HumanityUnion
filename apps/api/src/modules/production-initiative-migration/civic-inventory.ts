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
import type { AncestryMethod } from "./types.js";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export interface MustMigrateParentMaps {
  decisionMap: Map<string, string | null>;
  trackingMap: Map<string, string | null>;
  petitionMap: Map<string, string | null>;
  /** collaboration sessionId → initiativeId (for attendance ancestry). */
  sessionMap: Map<string, string | null>;
}

/** Load parent Initiative maps used by MUST_MIGRATE transitive ancestry. */
export async function loadMustMigrateParentMaps(
  db: Db,
  initiativeIds: string[],
): Promise<MustMigrateParentMaps> {
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
    .find({
      $or: [
        { initiativeId: { $in: initiativeIds } },
        { "subject.initiativeId": { $in: initiativeIds } },
      ],
    })
    .project({ petitionId: 1, initiativeId: 1, subject: 1 })
    .toArray();
  const petitionMap = new Map<string, string | null>();
  for (const p of petitions) {
    const id = asString(p.petitionId);
    const subject =
      p.subject && typeof p.subject === "object"
        ? (p.subject as Record<string, unknown>)
        : null;
    if (id) {
      petitionMap.set(id, asString(subject?.initiativeId) ?? asString(p.initiativeId));
    }
  }

  const sessions = await db
    .collection(MONGO_COLLECTIONS.initiativeCollaborationSessions)
    .find({ initiativeId: { $in: initiativeIds } })
    .project({ sessionId: 1, initiativeId: 1 })
    .toArray();
  const sessionMap = new Map<string, string | null>();
  for (const s of sessions) {
    const id = asString(s.sessionId);
    if (id) sessionMap.set(id, asString(s.initiativeId));
  }

  return { decisionMap, trackingMap, petitionMap, sessionMap };
}

export function parentMapForAncestryMethod(
  maps: MustMigrateParentMaps,
  method: AncestryMethod,
): Map<string, string | null> | undefined {
  switch (method) {
    case "parent:decisionId":
      return maps.decisionMap;
    case "parent:trackingId":
      return maps.trackingMap;
    case "parent:petitionId":
      return maps.petitionMap;
    case "parent:sessionId":
      return maps.sessionMap;
    default:
      return undefined;
  }
}

/**
 * Build the Mongo find filter for one MUST child collection scoped to one Initiative.
 * Returns null when the ancestry method is an unwired parent:* (caller should skip).
 */
export function mustMigrateChildFilterForInitiative(input: {
  ancestryMethod: AncestryMethod;
  initiativeId: string;
  parentMaps: MustMigrateParentMaps;
}): Document | null {
  const { ancestryMethod, initiativeId, parentMaps } = input;
  if (ancestryMethod === "direct:subject.initiativeId") {
    return {
      $or: [{ initiativeId }, { "subject.initiativeId": initiativeId }],
    };
  }
  if (ancestryMethod === "pk:initiativeId") {
    return { $or: [{ initiativeId }, { _id: initiativeId }] };
  }
  if (ancestryMethod === "parent:decisionId") {
    const ids = [...parentMaps.decisionMap.entries()]
      .filter(([, iid]) => iid === initiativeId)
      .map(([id]) => id);
    return ids.length ? { decisionId: { $in: ids } } : { _id: "__none__" };
  }
  if (ancestryMethod === "parent:trackingId") {
    const ids = [...parentMaps.trackingMap.entries()]
      .filter(([, iid]) => iid === initiativeId)
      .map(([id]) => id);
    return ids.length ? { trackingId: { $in: ids } } : { _id: "__none__" };
  }
  if (ancestryMethod === "parent:petitionId") {
    const ids = [...parentMaps.petitionMap.entries()]
      .filter(([, iid]) => iid === initiativeId)
      .map(([id]) => id);
    return ids.length ? { petitionId: { $in: ids } } : { _id: "__none__" };
  }
  if (ancestryMethod === "parent:sessionId") {
    const ids = [...parentMaps.sessionMap.entries()]
      .filter(([, iid]) => iid === initiativeId)
      .map(([id]) => id);
    return ids.length ? { sessionId: { $in: ids } } : { _id: "__none__" };
  }
  if (ancestryMethod === "optional:initiativeId") {
    return { initiativeId };
  }
  if (ancestryMethod.startsWith("parent:")) {
    return null;
  }
  return { initiativeId };
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
  const parentMaps = await loadMustMigrateParentMaps(db, initiativeIds);
  const mustCollections = mustMigrateChildCollections();

  const children: CivicChildRef[] = [];
  const plannedDocuments: PlannedCivicChildDocument[] = [];
  const byCollection: Record<string, number> = {};

  for (const initiativeId of initiativeIds) {
    for (const entry of mustCollections) {
      const filter = mustMigrateChildFilterForInitiative({
        ancestryMethod: entry.ancestryMethod,
        initiativeId,
        parentMaps,
      });
      if (filter == null) continue;

      const docs = await db.collection(entry.collection).find(filter).toArray();
      for (const doc of docs) {
        const parentMap = parentMapForAncestryMethod(parentMaps, entry.ancestryMethod);
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
