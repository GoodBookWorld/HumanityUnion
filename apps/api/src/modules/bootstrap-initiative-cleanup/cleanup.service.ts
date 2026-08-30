/**
 * Staging / non-production operator cleanup for obsolete bootstrap Initiative.
 * Dry-run by default; Mongo writes only with explicit confirm + --execute.
 */

import type { ClientSession, Db, Document, Filter } from "mongodb";

import { getMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import {
  BOOTSTRAP_INITIATIVE_CLEANUP_CONTRACT,
  BOOTSTRAP_INITIATIVE_UNEXPECTED_PARENT_COLLECTIONS,
  buildCleanupFilter,
} from "./cleanup-contract.js";
import {
  BOOTSTRAP_INITIATIVE_CLEANUP_EXPECTED_TITLE,
  BOOTSTRAP_INITIATIVE_CLEANUP_ID,
} from "./constants.js";
import {
  BootstrapInitiativeCleanupUnexpectedDataError,
  BootstrapInitiativeCleanupValidationError,
} from "./errors.js";
import { assertCleanupTargetsAllowListedId } from "./guards.js";

export interface CollectionCountRow {
  readonly collection: string;
  readonly kind: string;
  readonly matchedCount: number;
}

export interface BootstrapInitiativeCleanupPlan {
  readonly initiativeId: typeof BOOTSTRAP_INITIATIVE_CLEANUP_ID;
  readonly expectedTitle: typeof BOOTSTRAP_INITIATIVE_CLEANUP_EXPECTED_TITLE;
  readonly rootPresent: boolean;
  readonly rootTitle: string | null;
  readonly alreadyClean: boolean;
  readonly contractCounts: readonly CollectionCountRow[];
  readonly totalMatched: number;
}

export interface BootstrapInitiativeCleanupResult {
  readonly mode: "dry-run" | "execute";
  readonly plan: BootstrapInitiativeCleanupPlan;
  readonly deletedCounts: readonly CollectionCountRow[];
  readonly totalDeleted: number;
}

function asTitle(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

async function loadRootDocument(
  db: Db,
  initiativeId: string,
): Promise<Document | null> {
  const collection = db.collection("initiatives");
  const byId = await collection.findOne(
    {
      $or: [{ _id: initiativeId }, { initiativeId }],
    } as Filter<Document>,
  );
  return byId;
}

async function countContractMatches(db: Db, initiativeId: string): Promise<CollectionCountRow[]> {
  const rows: CollectionCountRow[] = [];

  for (const entry of BOOTSTRAP_INITIATIVE_CLEANUP_CONTRACT) {
    const filter = buildCleanupFilter(entry.kind, initiativeId);
    const matchedCount = await db.collection(entry.collection).countDocuments(filter);
    rows.push({
      collection: entry.collection,
      kind: entry.kind,
      matchedCount,
    });
  }

  return rows;
}

async function collectIds(
  db: Db,
  collection: string,
  filter: Document,
  field: string,
): Promise<string[]> {
  const docs = await db
    .collection(collection)
    .find(filter, { projection: { [field]: 1, _id: 0 } })
    .toArray();
  return docs
    .map((doc) => String(doc[field] ?? "").trim())
    .filter((value) => value.length > 0);
}

/**
 * Parent-linked rows are outside the direct delete contract. If any exist for
 * parents belonging to this Initiative, refuse (no unsafe cascade).
 */
async function assertNoUnexpectedParentLinkedData(
  db: Db,
  initiativeId: string,
): Promise<void> {
  const decisionIds = await collectIds(
    db,
    "initiative_collective_decisions",
    { initiativeId },
    "decisionId",
  );
  const sessionIds = await collectIds(db, "decision_sessions", { initiativeId }, "sessionId");
  const petitionIds = await collectIds(
    db,
    "petitions",
    { $or: [{ "subject.initiativeId": initiativeId }, { initiativeId }] },
    "petitionId",
  );
  const collaborationSessionIds = await collectIds(
    db,
    "initiative_collaboration_sessions",
    { initiativeId },
    "sessionId",
  );
  const trackingIds = await collectIds(
    db,
    "initiative_implementation_trackings",
    { initiativeId },
    "trackingId",
  );
  const impactIds = await collectIds(
    db,
    "initiative_public_impacts",
    { initiativeId },
    "impactId",
  );

  const probes: Array<{ collection: (typeof BOOTSTRAP_INITIATIVE_UNEXPECTED_PARENT_COLLECTIONS)[number]; filter: Document | null }> =
    [
      {
        collection: "initiative_decision_votes",
        filter: decisionIds.length ? { decisionId: { $in: decisionIds } } : null,
      },
      {
        collection: "initiative_decision_vote_history",
        filter: decisionIds.length ? { decisionId: { $in: decisionIds } } : null,
      },
      {
        collection: "petition_signatures",
        filter: petitionIds.length ? { petitionId: { $in: petitionIds } } : null,
      },
      {
        collection: "initiative_collaboration_session_attendances",
        filter: collaborationSessionIds.length
          ? { sessionId: { $in: collaborationSessionIds } }
          : null,
      },
      {
        collection: "implementation_tracking_updates",
        filter: trackingIds.length ? { trackingId: { $in: trackingIds } } : null,
      },
      {
        collection: "public_impact_evidence",
        filter: impactIds.length ? { impactId: { $in: impactIds } } : null,
      },
    ];

  // Session-scoped decision votes may key by sessionId on some paths.
  if (sessionIds.length > 0) {
    probes.push({
      collection: "initiative_decision_votes",
      filter: { sessionId: { $in: sessionIds } },
    });
  }

  const unexpected: string[] = [];
  for (const probe of probes) {
    if (!probe.filter) {
      continue;
    }
    const count = await db.collection(probe.collection).countDocuments(probe.filter);
    if (count > 0) {
      unexpected.push(`${probe.collection}=${count}`);
    }
  }

  // Also fail if parent-linked collections oddly store initiativeId directly.
  for (const collection of BOOTSTRAP_INITIATIVE_UNEXPECTED_PARENT_COLLECTIONS) {
    const count = await db.collection(collection).countDocuments({ initiativeId });
    if (count > 0) {
      unexpected.push(`${collection}.initiativeId=${count}`);
    }
  }

  if (unexpected.length > 0) {
    throw new BootstrapInitiativeCleanupUnexpectedDataError(
      `Fail closed: parent-linked data exists for ${initiativeId} and is not covered by cascade delete (${unexpected.join(", ")}).`,
    );
  }
}

/**
 * Inventory allow-listed bootstrap Initiative + contract collections.
 * Does not mutate Mongo. Never logs document payloads.
 */
export async function planBootstrapInitiativeCleanup(
  db: Db,
  initiativeId: string = BOOTSTRAP_INITIATIVE_CLEANUP_ID,
): Promise<BootstrapInitiativeCleanupPlan> {
  assertCleanupTargetsAllowListedId(initiativeId);

  const root = await loadRootDocument(db, initiativeId);
  const rootTitle = root ? asTitle(root.title) : null;

  if (root) {
    if (rootTitle !== BOOTSTRAP_INITIATIVE_CLEANUP_EXPECTED_TITLE) {
      throw new BootstrapInitiativeCleanupUnexpectedDataError(
        `Fail closed: root title mismatch for ${initiativeId} (expected exact bootstrap title).`,
      );
    }
  }

  const contractCounts = await countContractMatches(db, initiativeId);
  const totalMatched = contractCounts.reduce((sum, row) => sum + row.matchedCount, 0);

  if (!root && totalMatched > 0) {
    throw new BootstrapInitiativeCleanupUnexpectedDataError(
      `Fail closed: linked contract data exists for ${initiativeId} without root Initiative document.`,
    );
  }

  await assertNoUnexpectedParentLinkedData(db, initiativeId);

  return {
    initiativeId: BOOTSTRAP_INITIATIVE_CLEANUP_ID,
    expectedTitle: BOOTSTRAP_INITIATIVE_CLEANUP_EXPECTED_TITLE,
    rootPresent: Boolean(root),
    rootTitle,
    alreadyClean: totalMatched === 0,
    contractCounts,
    totalMatched,
  };
}

async function deleteContractMatches(
  db: Db,
  initiativeId: string,
  session: ClientSession,
): Promise<CollectionCountRow[]> {
  const deleted: CollectionCountRow[] = [];

  // Delete non-root first, then root last within the transaction.
  const ordered = [
    ...BOOTSTRAP_INITIATIVE_CLEANUP_CONTRACT.filter((entry) => entry.kind !== "root"),
    ...BOOTSTRAP_INITIATIVE_CLEANUP_CONTRACT.filter((entry) => entry.kind === "root"),
  ];

  for (const entry of ordered) {
    const filter = buildCleanupFilter(entry.kind, initiativeId);
    const result = await db.collection(entry.collection).deleteMany(filter, { session });
    deleted.push({
      collection: entry.collection,
      kind: entry.kind,
      matchedCount: result.deletedCount,
    });
  }

  return deleted;
}

/**
 * Execute allow-listed deletes inside a Mongo transaction when possible.
 */
export async function executeBootstrapInitiativeCleanup(
  db: Db,
  initiativeId: string = BOOTSTRAP_INITIATIVE_CLEANUP_ID,
): Promise<BootstrapInitiativeCleanupResult> {
  assertCleanupTargetsAllowListedId(initiativeId);

  const plan = await planBootstrapInitiativeCleanup(db, initiativeId);

  if (plan.alreadyClean) {
    return {
      mode: "execute",
      plan,
      deletedCounts: plan.contractCounts.map((row) => ({ ...row, matchedCount: 0 })),
      totalDeleted: 0,
    };
  }

  const client = getMongoClient();
  const session = client.startSession();
  let deletedCounts: CollectionCountRow[] = [];

  try {
    await session.withTransaction(async () => {
      deletedCounts = await deleteContractMatches(db, initiativeId, session);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown transaction error";
    throw new BootstrapInitiativeCleanupValidationError(
      `Mongo cleanup transaction failed (no partial commit expected): ${message}`,
    );
  } finally {
    await session.endSession();
  }

  const totalDeleted = deletedCounts.reduce((sum, row) => sum + row.matchedCount, 0);

  // Idempotency check — plan again; must be clean.
  const after = await planBootstrapInitiativeCleanup(db, initiativeId);
  if (!after.alreadyClean) {
    throw new BootstrapInitiativeCleanupUnexpectedDataError(
      `Cleanup did not reach a clean state (remaining matched=${after.totalMatched}).`,
    );
  }

  return {
    mode: "execute",
    plan,
    deletedCounts,
    totalDeleted,
  };
}

export function formatBootstrapInitiativeCleanupPlan(
  plan: BootstrapInitiativeCleanupPlan,
): string {
  const lines: string[] = [
    `initiativeId=${plan.initiativeId}`,
    `expectedTitle=${plan.expectedTitle}`,
    `rootPresent=${plan.rootPresent}`,
    `rootTitle=${plan.rootTitle ?? "(none)"}`,
    `alreadyClean=${plan.alreadyClean}`,
    `totalMatched=${plan.totalMatched}`,
    "contractCounts:",
  ];

  for (const row of plan.contractCounts) {
    if (row.matchedCount > 0) {
      lines.push(`  ${row.collection} (${row.kind}): ${row.matchedCount}`);
    }
  }

  if (plan.totalMatched === 0) {
    lines.push("  (none)");
  }

  return lines.join("\n");
}

export function formatBootstrapInitiativeCleanupResult(
  result: BootstrapInitiativeCleanupResult,
): string {
  const lines: string[] = [
    `mode=${result.mode}`,
    `totalDeleted=${result.totalDeleted}`,
    formatBootstrapInitiativeCleanupPlan(result.plan),
    "deletedCounts:",
  ];

  for (const row of result.deletedCounts) {
    if (row.matchedCount > 0) {
      lines.push(`  ${row.collection}: ${row.matchedCount}`);
    }
  }

  if (result.totalDeleted === 0) {
    lines.push("  (none)");
  }

  return lines.join("\n");
}
