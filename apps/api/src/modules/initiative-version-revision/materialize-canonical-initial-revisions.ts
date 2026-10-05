/**
 * Canonical initial-revision materialization.
 * Public reads must not create these rows. Boot and readiness call this once
 * per process, then again only as an idempotent no-op.
 */

import type { Initiative, InitiativeVersionRevision } from "@hu/types";
import type { Document, Filter } from "mongodb";

import { isMongoPersistenceMode } from "../../config/production-persistence-contract.js";
import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { scheduleContentTranslationWarmAfterMutation } from "../language/content-translation-warm-enqueue.js";
import { isInitiativeEligibleForPublicProjection } from "../initiatives/initiative-public-projection.access.js";
import { listInitiatives } from "../initiatives/initiative.store.js";
import {
  buildInitialInitiativeVersionRevision,
  createInitialInitiativeVersionRevision,
} from "./initiative-version-revision.service.js";
import {
  getLatestRevisionForInitiative,
  rememberRevisionWithoutPersist,
} from "./initiative-version-revision.store.js";

export type MaterializeCanonicalInitialRevisionsResult = {
  readonly created: number;
  readonly converged: true;
};

let canonicalRevisionInventoryConverged = false;
let materializeTail: Promise<void> = Promise.resolve();

export function isCanonicalRevisionInventoryConverged(): boolean {
  if (canonicalRevisionInventoryConverged) {
    return true;
  }
  // Only Mongo can hide durable rows behind an import-time empty map.
  return !isMongoPersistenceMode("INITIATIVE_VERSION_REVISION_PERSISTENCE");
}

export function resetCanonicalRevisionInventoryForTests(): void {
  canonicalRevisionInventoryConverged = false;
  materializeTail = Promise.resolve();
}

async function findDurableRevision(
  initiativeId: string,
): Promise<InitiativeVersionRevision | null> {
  if (!isMongoPersistenceMode("INITIATIVE_VERSION_REVISION_PERSISTENCE")) {
    return null;
  }
  const collection = getMongoCollection(MONGO_COLLECTIONS.initiativeVersionRevisions);
  const doc = await collection.findOne({ initiativeId });
  if (!doc) {
    return null;
  }
  const { _id: _ignored, ...record } = doc;
  return record as unknown as InitiativeVersionRevision;
}

async function insertInitialRevisionIfAbsent(
  revision: InitiativeVersionRevision,
): Promise<"inserted" | "exists"> {
  const collection = getMongoCollection(MONGO_COLLECTIONS.initiativeVersionRevisions);
  const result = await collection.updateOne(
    { _id: revision.revisionId } as unknown as Filter<Document>,
    {
      $setOnInsert: {
        _id: revision.revisionId,
        ...revision,
        revisionId: revision.revisionId,
      },
    },
    { upsert: true },
  );
  return result.upsertedCount === 1 ? "inserted" : "exists";
}

async function materializeBody(initiatives: readonly Initiative[]): Promise<MaterializeCanonicalInitialRevisionsResult> {
  let created = 0;
  for (const initiative of initiatives) {
    if (!initiative?.initiativeId) {
      continue;
    }
    if (getLatestRevisionForInitiative(initiative.initiativeId)) {
      continue;
    }

    const durable = await findDurableRevision(initiative.initiativeId);
    if (durable) {
      rememberRevisionWithoutPersist(durable);
      continue;
    }

    if (isMongoPersistenceMode("INITIATIVE_VERSION_REVISION_PERSISTENCE")) {
      const revision = buildInitialInitiativeVersionRevision(
        initiative,
        initiative.stewardId,
      );
      const outcome = await insertInitialRevisionIfAbsent(revision);
      if (outcome === "inserted") {
        rememberRevisionWithoutPersist(revision);
        scheduleContentTranslationWarmAfterMutation({
          sourceKind: "initiative_revision",
          sourceRecordId: revision.revisionId,
          reason: "public_mutation",
        });
        created += 1;
      } else {
        const winner = await findDurableRevision(initiative.initiativeId);
        if (winner) {
          rememberRevisionWithoutPersist(winner);
        }
      }
      continue;
    }

    createInitialInitiativeVersionRevision(initiative, initiative.stewardId);
    created += 1;
  }

  canonicalRevisionInventoryConverged = true;
  return { created, converged: true };
}

/**
 * Idempotent. A second pass over an already-converged inventory creates no rows
 * and does not schedule translation work.
 */
export function materializeCanonicalInitialInitiativeRevisions(options?: {
  readonly initiatives?: readonly Initiative[];
}): Promise<MaterializeCanonicalInitialRevisionsResult> {
  const initiatives =
    options?.initiatives ??
    listInitiatives().filter(isInitiativeEligibleForPublicProjection);
  const run = materializeTail.then(() => materializeBody(initiatives));
  materializeTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
