import { randomUUID } from "node:crypto";

import type { ClientSession, Db, Document, MongoClient } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { resolveDocumentAncestry } from "./ancestry.js";
import { CIVIC_COLLECTION_CATALOG, listCollectionsByClassification } from "./collection-plan.js";
import {
  ALLOWED_WRITE_COLLECTIONS,
  APPROVED_PRODUCTION_PARTICIPANTS,
  CANONICAL_PRODUCTION_INITIATIVE_IDS,
  EXCLUDED_PRODUCTION_INITIATIVE_IDS,
  FORBIDDEN_MIGRATE_COLLECTIONS,
  PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  VLAD_SHAPRAN_USER_ID,
  isExcludedInitiativeId,
  isForbiddenTypoAiCommonGoodId,
} from "./constants.js";
import { ProductionInitiativeMigrationError } from "./errors.js";
import {
  assertMigrationDestinationDatabase,
  assertMigrationExecuteWriteGuards,
  assertMigrationSourceDatabase,
  resolveMigrationMode,
} from "./guards.js";
import {
  assertInlineExecutionPreflightPass,
  runInlineExecutionPreflight,
  type InlineExecutionPreflightResult,
} from "./inline-preflight.js";
import {
  DeferredMediaCopyExecutor,
  deduplicateMediaPlanItems,
  executeMediaCopyPhase,
  type MediaCopyExecutor,
  type PlannedMediaCopy,
} from "./media-copy.js";
import {
  planMediaFromInitiativeDocument,
  planMediaFromSharedDocument,
  planMediaFromUploadRecord,
} from "./media-plan.js";
import { MigrationOwnershipLedger } from "./ownership-ledger.js";
import { assertNoSecretLeak } from "./redact.js";
import {
  sanitizeBadgeApplicationForMigration,
  sanitizeInitiativeDocumentForMigration,
  sanitizeMediaUploadRecordForMigration,
  sanitizeStripeOperationalFields,
  stripPrivateFieldsForReport,
} from "./sanitize-documents.js";

export type MigrationPhase =
  | "A_identity"
  | "B_membership"
  | "C_initiative_roots"
  | "D_civic_artifacts"
  | "E_media"
  | "F_projections";

export interface DualMongoHandles {
  sourceClient: MongoClient;
  sourceDb: Db;
  sourceDatabase: string;
  destinationClient: MongoClient;
  destinationDb: Db;
  destinationDatabase: string;
}

export interface RunProductionInitiativeMigrationInput {
  handles: DualMongoHandles;
  execute: boolean;
  confirm?: string;
  allowTestIsolation?: boolean;
  /**
   * Test-only: allow non-transactional writes on hu_test_* destinations.
   * Forbidden when destination is humanity_union_production.
   * Never silently applied on production execute.
   */
  forceNonTransactional?: boolean;
  mediaExecutor?: MediaCopyExecutor;
  /** Task 07.2 default false — never copy R2 in this task. */
  performMediaCopies?: boolean;
}

export interface PhaseResult {
  phase: MigrationPhase;
  status: "planned" | "completed" | "skipped" | "failed" | "deferred";
  counts: Record<string, number>;
  notes: string[];
}

export interface MigrationExecutionReport {
  tool: string;
  mode: "dry-run" | "execute";
  migrationExecutionId: string;
  sourceDatabase: string;
  destinationDatabase: string;
  allowList: string[];
  excluded: string[];
  inlinePreflight: InlineExecutionPreflightResult | null;
  phases: PhaseResult[];
  ownership: ReturnType<MigrationOwnershipLedger["toSafeReport"]>;
  mediaPlan: {
    status: "PLANNED" | "DEFERRED" | "COPIED";
    plannedCopies: number;
    copied: number;
    deferred: boolean;
    storageKeys: string[];
  };
  rollback: {
    strategy: string;
    ownedMongoInserts: number;
    ownedMediaCopied: number;
  };
  blockers: string[];
  overallStatus: "DRY_RUN_OK" | "EXECUTE_OK" | "FAILED";
  writePathPresent: true;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function withoutMongoId(doc: Document): Document {
  const { _id: _ignored, ...rest } = doc as Document & { _id?: unknown };
  void _ignored;
  return rest;
}

function isTransactionUnsupportedMessage(message: string): boolean {
  return /Transactions? are not supported|Transaction numbers are only allowed on a replica set member|IllegalOperation.*[Tt]ransaction/i.test(
    message,
  );
}

function assertForceNonTransactionalAllowed(input: {
  forceNonTransactional?: boolean;
  allowTestIsolation?: boolean;
  destinationDatabase: string;
}): void {
  if (input.forceNonTransactional !== true) return;
  if (input.allowTestIsolation !== true) {
    throw new ProductionInitiativeMigrationError(
      "forceNonTransactional requires allowTestIsolation.",
      "TRANSACTION_BYPASS_FORBIDDEN",
    );
  }
  if (input.destinationDatabase === PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE) {
    throw new ProductionInitiativeMigrationError(
      "forceNonTransactional is forbidden against humanity_union_production.",
      "TRANSACTION_BYPASS_FORBIDDEN",
    );
  }
}

function primaryFilter(collection: string, doc: Document): Record<string, unknown> {
  const entry = CIVIC_COLLECTION_CATALOG.find((row) => row.collection === collection);
  const field = entry?.primaryIdFields?.[0];
  if (field && doc[field] != null) {
    return { [field]: doc[field] };
  }
  if (doc._id != null) return { _id: doc._id };
  if (asString(doc.initiativeId)) return { initiativeId: asString(doc.initiativeId) };
  if (asString(doc.userId) && collection === "memberships") {
    return { userId: asString(doc.userId) };
  }
  if (asString(doc.applicationId)) return { applicationId: asString(doc.applicationId) };
  if (asString(doc.contributionId)) return { contributionId: asString(doc.contributionId) };
  throw new ProductionInitiativeMigrationError(
    `Cannot build primary filter for ${collection}`,
    "MISSING_PRIMARY_KEY",
  );
}

async function assertAbsent(
  destinationDb: Db,
  collection: string,
  filter: Document,
  session?: ClientSession,
): Promise<void> {
  const hit = await destinationDb.collection(collection).findOne(filter, {
    projection: { _id: 1 },
    ...(session ? { session } : {}),
  });
  if (hit) {
    throw new ProductionInitiativeMigrationError(
      `Collision: unexpected destination record in ${collection}`,
      "COLLISION",
    );
  }
}

function assertWritableCollection(collection: string): void {
  if ((FORBIDDEN_MIGRATE_COLLECTIONS as readonly string[]).includes(collection)) {
    throw new ProductionInitiativeMigrationError(
      `Forbidden collection write attempted: ${collection}`,
      "FORBIDDEN_COLLECTION",
    );
  }
  if (!(ALLOWED_WRITE_COLLECTIONS as readonly string[]).includes(collection)) {
    throw new ProductionInitiativeMigrationError(
      `Collection not on explicit write allow-list: ${collection}`,
      "COLLECTION_NOT_ALLOWLISTED",
    );
  }
}

async function insertOwned(input: {
  mode: "dry-run" | "execute";
  destinationDb: Db;
  collection: string;
  doc: Document;
  ledger: MigrationOwnershipLedger;
  phase: string;
  initiativeId?: string;
  session?: ClientSession;
  /** Test-only sequential path; never for production destination. */
  allowExecuteWithoutSession?: boolean;
}): Promise<"planned" | "inserted"> {
  assertWritableCollection(input.collection);
  const filter = primaryFilter(input.collection, input.doc);
  // Collision check shares the write session when provided (execute path).
  await assertAbsent(input.destinationDb, input.collection, filter, input.session);

  if (input.mode === "dry-run") {
    input.ledger.recordMongoInsert({
      collection: input.collection,
      insertedId: null,
      primaryFilter: filter,
      initiativeId: input.initiativeId,
      phase: input.phase,
    });
    return "planned";
  }

  if (!input.session && input.allowExecuteWithoutSession !== true) {
    throw new ProductionInitiativeMigrationError(
      "Execute inserts require a Mongo session/transaction boundary.",
      "TRANSACTION_REQUIRED",
    );
  }

  const result = input.session
    ? await input.destinationDb
        .collection(input.collection)
        .insertOne(input.doc, { session: input.session })
    : await input.destinationDb.collection(input.collection).insertOne(input.doc);

  input.ledger.recordMongoInsert({
    collection: input.collection,
    insertedId: result.insertedId,
    primaryFilter: filter,
    initiativeId: input.initiativeId,
    phase: input.phase,
  });
  return "inserted";
}

/**
 * Compensating delete — only by exact insertedId from this execution's insertOne.
 * Never deletes by initiativeId alone.
 */
export async function rollbackOwnedMongoInserts(
  destinationDb: Db,
  ledger: MigrationOwnershipLedger,
): Promise<number> {
  let deleted = 0;
  const inserts = [...ledger.rollbackEligibleMongoInserts()].reverse();
  for (const entry of inserts) {
    if (entry.insertedId == null) continue;
    const result = await destinationDb.collection(entry.collection).deleteOne({
      _id: entry.insertedId as never,
    });
    deleted += result.deletedCount;
  }
  return deleted;
}

/**
 * Production execute: require withTransaction; unsupported → fail closed (no sequential fallback).
 * Test isolation + forceNonTransactional on hu_test_*: may run without a session.
 */
async function withRequiredTransaction(input: {
  client: MongoClient;
  allowTestIsolation?: boolean;
  forceNonTransactional?: boolean;
  destinationDatabase: string;
  phase: string;
  work: (session: ClientSession | undefined, allowWithoutSession: boolean) => Promise<void>;
}): Promise<void> {
  assertForceNonTransactionalAllowed({
    forceNonTransactional: input.forceNonTransactional,
    allowTestIsolation: input.allowTestIsolation,
    destinationDatabase: input.destinationDatabase,
  });

  const testBypass =
    input.forceNonTransactional === true && input.allowTestIsolation === true;

  if (testBypass) {
    await input.work(undefined, true);
    return;
  }

  const session = input.client.startSession();
  try {
    await session.withTransaction(async () => {
      await input.work(session, false);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isTransactionUnsupportedMessage(message)) {
      throw new ProductionInitiativeMigrationError(
        `Refusing execute: Mongo transactions required for ${input.phase}. Destination must support replica-set transactions. No sequential fallback.`,
        "TRANSACTION_REQUIRED",
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

async function phaseAIdentity(destinationDb: Db): Promise<PhaseResult> {
  const notes: string[] = [];
  let ok = 0;
  for (const participant of APPROVED_PRODUCTION_PARTICIPANTS) {
    const auth = await destinationDb.collection(MONGO_COLLECTIONS.authUsers).findOne({
      memberId: participant.memberId,
    });
    const member = await destinationDb.collection(MONGO_COLLECTIONS.members).findOne({
      memberId: participant.memberId,
    });
    const profile = await destinationDb.collection(MONGO_COLLECTIONS.memberProfiles).findOne({
      profileId: participant.profileId,
    });
    if (!auth || !member || !profile) {
      throw new ProductionInitiativeMigrationError(
        `Phase A: missing identity graph for ${participant.label}`,
        "IDENTITY_MISSING",
      );
    }
    if (asString(auth.role) !== participant.authRole) {
      throw new ProductionInitiativeMigrationError(
        `Phase A: auth.role mismatch for ${participant.label}`,
        "IDENTITY_ROLE_MISMATCH",
      );
    }
    if (
      !Array.isArray(member.roles) ||
      member.roles.length !== 1 ||
      member.roles[0] !== "member"
    ) {
      throw new ProductionInitiativeMigrationError(
        `Phase A: members.roles must be [member] for ${participant.label}`,
        "IDENTITY_ROLE_MISMATCH",
      );
    }
    ok += 1;
    notes.push(`${participant.label}: present role=${participant.authRole}`);
  }
  return {
    phase: "A_identity",
    status: "completed",
    counts: { identityGraphsVerified: ok },
    notes,
  };
}

async function phaseBMembership(input: {
  mode: "dry-run" | "execute";
  sourceDb: Db;
  destinationDb: Db;
  destinationClient: MongoClient;
  destinationDatabase: string;
  ledger: MigrationOwnershipLedger;
  forceNonTransactional?: boolean;
  allowTestIsolation?: boolean;
}): Promise<PhaseResult> {
  const notes: string[] = [];
  const counts = {
    memberships: 0,
    membershipContributions: 0,
    badgeApplications: 0,
    profileVisibilityPatches: 0,
    omittedNotStarted: 0,
  };

  const runWrites = async (
    session: ClientSession | undefined,
    allowWithoutSession: boolean,
  ) => {
    for (const participant of APPROVED_PRODUCTION_PARTICIPANTS) {
      const membership = await input.sourceDb.collection(MONGO_COLLECTIONS.memberships).findOne({
        userId: participant.userId,
      });
      const profile = await input.sourceDb.collection(MONGO_COLLECTIONS.memberProfiles).findOne({
        $or: [{ profileId: participant.profileId }, { userId: participant.userId }],
      });
      const badge = await input.sourceDb
        .collection(MONGO_COLLECTIONS.memberBadgeApplications)
        .findOne({
          $or: [{ userId: participant.userId }, { participantId: participant.memberId }],
        });

      const status = asString(membership?.status);
      if (!membership || status === "not_started") {
        counts.omittedNotStarted += 1;
        notes.push(`${participant.label}: membership omitted (not_started/absent)`);
        continue;
      }

      if (participant.userId !== VLAD_SHAPRAN_USER_ID) {
        throw new ProductionInitiativeMigrationError(
          `Phase B: refusing non-Vlad membership migration for ${participant.label} status=${status}`,
          "UNEXPECTED_MEMBERSHIP",
        );
      }

      if (status !== "active_member") {
        throw new ProductionInitiativeMigrationError(
          "Phase B: Vlad membership must be active_member",
          "VLAD_MEMBERSHIP_INVALID",
        );
      }

      // Identity graph is reused — never reinsert auth/members/profiles.
      await assertAbsent(
        input.destinationDb,
        MONGO_COLLECTIONS.memberships,
        { userId: participant.userId },
        session,
      );
      if (asString(membership.memberNumber)) {
        await assertAbsent(
          input.destinationDb,
          MONGO_COLLECTIONS.memberships,
          { memberNumber: membership.memberNumber },
          session,
        );
      }

      const membershipDoc = withoutMongoId(sanitizeStripeOperationalFields({ ...membership }));
      await insertOwned({
        mode: input.mode,
        destinationDb: input.destinationDb,
        collection: MONGO_COLLECTIONS.memberships,
        doc: membershipDoc,
        ledger: input.ledger,
        phase: "B_membership",
        session,
        allowExecuteWithoutSession: allowWithoutSession,
      });
      counts.memberships += 1;
      notes.push(
        `Vlad: membership status=active_member memberNumberPresent=${Boolean(
          membership.memberNumber,
        )} (identity graph reused)`,
      );

      if (profile && typeof profile.membershipPubliclyVisible === "boolean") {
        if (input.mode === "execute") {
          const updateOpts = session ? { session } : undefined;
          await input.destinationDb
            .collection(MONGO_COLLECTIONS.memberProfiles)
            .updateOne(
              { profileId: participant.profileId },
              { $set: { membershipPubliclyVisible: profile.membershipPubliclyVisible } },
              updateOpts,
            );
        }
        counts.profileVisibilityPatches += 1;
        notes.push(
          `Vlad: membershipPubliclyVisible=${profile.membershipPubliclyVisible} (preserve on existing profile)`,
        );
      }

      const contributions = await input.sourceDb
        .collection(MONGO_COLLECTIONS.membershipContributions)
        .find({ userId: participant.userId })
        .toArray();
      for (const contribution of contributions) {
        const doc = withoutMongoId(sanitizeStripeOperationalFields({ ...contribution }));
        await insertOwned({
          mode: input.mode,
          destinationDb: input.destinationDb,
          collection: MONGO_COLLECTIONS.membershipContributions,
          doc,
          ledger: input.ledger,
          phase: "B_membership",
          session,
          allowExecuteWithoutSession: allowWithoutSession,
        });
        counts.membershipContributions += 1;
      }

      if (badge) {
        await assertAbsent(
          input.destinationDb,
          MONGO_COLLECTIONS.memberBadgeApplications,
          { applicationId: badge.applicationId },
          session,
        );
        const badgeDoc = withoutMongoId(sanitizeBadgeApplicationForMigration({ ...badge }));
        await insertOwned({
          mode: input.mode,
          destinationDb: input.destinationDb,
          collection: MONGO_COLLECTIONS.memberBadgeApplications,
          doc: badgeDoc,
          ledger: input.ledger,
          phase: "B_membership",
          session,
          allowExecuteWithoutSession: allowWithoutSession,
        });
        counts.badgeApplications += 1;
        notes.push(
          `Vlad: badge application paymentStatus=${asString(
            badge.paymentStatus,
          )} fulfillmentStatus=${asString(
            badge.fulfillmentStatus,
          )} shippingDataPresent=${Boolean(badge.shippingAddress)}`,
        );
      }
    }
  };

  notes.push("membership_webhook_events: DO_NOT_MIGRATE");

  if (input.mode === "dry-run") {
    await runWrites(undefined, false);
    return { phase: "B_membership", status: "planned", counts, notes };
  }

  await withRequiredTransaction({
    client: input.destinationClient,
    allowTestIsolation: input.allowTestIsolation,
    forceNonTransactional: input.forceNonTransactional,
    destinationDatabase: input.destinationDatabase,
    phase: "B_membership",
    work: runWrites,
  });

  return { phase: "B_membership", status: "completed", counts, notes };
}

async function loadParentMaps(sourceDb: Db, initiativeIds: string[]) {
  const decisions = await sourceDb
    .collection(MONGO_COLLECTIONS.initiativeCollectiveDecisions)
    .find({ initiativeId: { $in: initiativeIds } })
    .project({ decisionId: 1, initiativeId: 1 })
    .toArray();
  const map = new Map<string, string | null>();
  for (const d of decisions) {
    const id = asString(d.decisionId);
    if (id) map.set(id, asString(d.initiativeId));
  }
  const trackings = await sourceDb
    .collection(MONGO_COLLECTIONS.initiativeImplementationTrackings)
    .find({ initiativeId: { $in: initiativeIds } })
    .project({ trackingId: 1, initiativeId: 1 })
    .toArray();
  const trackingMap = new Map<string, string | null>();
  for (const t of trackings) {
    const id = asString(t.trackingId);
    if (id) trackingMap.set(id, asString(t.initiativeId));
  }
  const petitions = await sourceDb
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
  return { decisionMap: map, trackingMap, petitionMap };
}

async function migrateInitiativeGraph(input: {
  mode: "dry-run" | "execute";
  sourceDb: Db;
  destinationDb: Db;
  destinationClient: MongoClient;
  destinationDatabase: string;
  ledger: MigrationOwnershipLedger;
  initiativeId: string;
  forceNonTransactional?: boolean;
  allowTestIsolation?: boolean;
}): Promise<{ roots: number; children: number }> {
  if (
    isExcludedInitiativeId(input.initiativeId) ||
    isForbiddenTypoAiCommonGoodId(input.initiativeId)
  ) {
    throw new ProductionInitiativeMigrationError(
      `Refusing excluded/typo Initiative ${input.initiativeId}`,
      "EXCLUDED_INITIATIVE",
    );
  }

  const root = await input.sourceDb.collection(MONGO_COLLECTIONS.initiatives).findOne({
    $or: [
      { _id: input.initiativeId as unknown as string },
      { initiativeId: input.initiativeId },
    ],
  } as Document);

  if (!root) {
    throw new ProductionInitiativeMigrationError(
      `Missing source Initiative ${input.initiativeId}`,
      "MISSING_SOURCE_INITIATIVE",
    );
  }

  const sanitizedRoot = sanitizeInitiativeDocumentForMigration(root);

  let roots = 0;
  let children = 0;

  const writeRootAndChildren = async (
    session: ClientSession | undefined,
    allowWithoutSession: boolean,
  ) => {
    roots = 0;
    children = 0;

    // Collision check inside the same session/transaction as the inserts.
    await assertAbsent(
      input.destinationDb,
      MONGO_COLLECTIONS.initiatives,
      { initiativeId: input.initiativeId } as Document,
      session,
    );
    await assertAbsent(
      input.destinationDb,
      MONGO_COLLECTIONS.initiatives,
      { _id: input.initiativeId } as Document,
      session,
    );

    await insertOwned({
      mode: input.mode,
      destinationDb: input.destinationDb,
      collection: MONGO_COLLECTIONS.initiatives,
      doc: sanitizedRoot,
      ledger: input.ledger,
      phase: "C_initiative_roots",
      initiativeId: input.initiativeId,
      session,
      allowExecuteWithoutSession: allowWithoutSession,
    });
    roots += 1;

    const allowList = new Set<string>([...CANONICAL_PRODUCTION_INITIATIVE_IDS]);
    const parentMaps = await loadParentMaps(input.sourceDb, [input.initiativeId]);
    const mustCollections = listCollectionsByClassification("MUST_MIGRATE").filter(
      (entry) =>
        entry.collection !== "initiatives" &&
        entry.ancestryMethod !== "participant-scoped" &&
        !entry.collection.includes(".") &&
        entry.collection !== "media_upload_records",
    );

    for (const entry of mustCollections) {
      let filter: Document = { initiativeId: input.initiativeId };
      if (entry.ancestryMethod === "direct:subject.initiativeId") {
        filter = {
          $or: [
            { initiativeId: input.initiativeId },
            { "subject.initiativeId": input.initiativeId },
          ],
        };
      } else if (entry.ancestryMethod === "pk:initiativeId") {
        filter = {
          $or: [{ initiativeId: input.initiativeId }, { _id: input.initiativeId }],
        };
      } else if (entry.ancestryMethod === "parent:decisionId") {
        const ids = [...parentMaps.decisionMap.entries()]
          .filter(([, iid]) => iid === input.initiativeId)
          .map(([id]) => id);
        filter = ids.length ? { decisionId: { $in: ids } } : { _id: "__none__" };
      } else if (entry.ancestryMethod === "parent:trackingId") {
        const ids = [...parentMaps.trackingMap.entries()]
          .filter(([, iid]) => iid === input.initiativeId)
          .map(([id]) => id);
        filter = ids.length ? { trackingId: { $in: ids } } : { _id: "__none__" };
      } else if (entry.ancestryMethod === "parent:petitionId") {
        const ids = [...parentMaps.petitionMap.entries()]
          .filter(([, iid]) => iid === input.initiativeId)
          .map(([id]) => id);
        filter = ids.length ? { petitionId: { $in: ids } } : { _id: "__none__" };
      } else if (entry.ancestryMethod === "optional:initiativeId") {
        filter = { initiativeId: input.initiativeId };
      } else if (entry.ancestryMethod.startsWith("parent:")) {
        continue;
      }

      const docs = await input.sourceDb.collection(entry.collection).find(filter).toArray();
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
        if (ancestry.ambiguous || ancestry.initiativeId !== input.initiativeId) {
          throw new ProductionInitiativeMigrationError(
            `Ambiguous/unresolved MUST ancestry in ${entry.collection} for ${input.initiativeId}`,
            "AMBIGUOUS_ANCESTRY",
          );
        }
        const copy = withoutMongoId({ ...doc });
        await insertOwned({
          mode: input.mode,
          destinationDb: input.destinationDb,
          collection: entry.collection,
          doc: copy,
          ledger: input.ledger,
          phase: "D_civic_artifacts",
          initiativeId: input.initiativeId,
          session,
          allowExecuteWithoutSession: allowWithoutSession,
        });
        children += 1;
      }
    }
  };

  if (input.mode === "dry-run") {
    await writeRootAndChildren(undefined, false);
    return { roots, children };
  }

  await withRequiredTransaction({
    client: input.destinationClient,
    allowTestIsolation: input.allowTestIsolation,
    forceNonTransactional: input.forceNonTransactional,
    destinationDatabase: input.destinationDatabase,
    phase: `initiative:${input.initiativeId}`,
    work: writeRootAndChildren,
  });

  return { roots, children };
}

export async function runProductionInitiativeMigration(
  input: RunProductionInitiativeMigrationInput,
): Promise<MigrationExecutionReport> {
  const sourceDatabase = assertMigrationSourceDatabase(input.handles.sourceDatabase, {
    allowTestIsolation: input.allowTestIsolation,
  });
  const destinationDatabase = assertMigrationDestinationDatabase(
    input.handles.destinationDatabase,
    { allowTestIsolation: input.allowTestIsolation },
  );

  assertForceNonTransactionalAllowed({
    forceNonTransactional: input.forceNonTransactional,
    allowTestIsolation: input.allowTestIsolation,
    destinationDatabase,
  });

  const mode = resolveMigrationMode({
    execute: input.execute,
    confirm: input.confirm,
  });

  if (input.execute && mode === "dry-run") {
    assertMigrationExecuteWriteGuards({
      sourceDatabase,
      destinationDatabase,
      execute: true,
      confirm: input.confirm,
      allowTestIsolation: input.allowTestIsolation,
    });
  }

  if (mode === "execute") {
    assertMigrationExecuteWriteGuards({
      sourceDatabase,
      destinationDatabase,
      execute: true,
      confirm: input.confirm,
      allowTestIsolation: input.allowTestIsolation,
    });
  }

  const migrationExecutionId = `mig_${randomUUID()}`;
  const ledger = new MigrationOwnershipLedger(migrationExecutionId);
  const phases: PhaseResult[] = [];
  const blockers: string[] = [];
  let inlinePreflight: InlineExecutionPreflightResult | null = null;

  try {
    // Immediate read-only authorization bound to these exact DB handles + 9-ID set.
    // Env flags alone are never sufficient for write authorization.
    inlinePreflight = await runInlineExecutionPreflight({
      sourceDb: input.handles.sourceDb,
      destinationDb: input.handles.destinationDb,
      sourceDatabase,
      destinationDatabase,
    });
    // Dry-run may model without requiring PASS; --execute fails closed on FAIL.
    if (mode === "execute") {
      assertInlineExecutionPreflightPass(inlinePreflight);
    }

    phases.push(await phaseAIdentity(input.handles.destinationDb));

    phases.push(
      await phaseBMembership({
        mode,
        sourceDb: input.handles.sourceDb,
        destinationDb: input.handles.destinationDb,
        destinationClient: input.handles.destinationClient,
        destinationDatabase,
        ledger,
        forceNonTransactional: input.forceNonTransactional,
        allowTestIsolation: input.allowTestIsolation,
      }),
    );

    let totalRoots = 0;
    let totalChildren = 0;
    const initiativeNotes: string[] = [];
    for (const initiativeId of CANONICAL_PRODUCTION_INITIATIVE_IDS) {
      const result = await migrateInitiativeGraph({
        mode,
        sourceDb: input.handles.sourceDb,
        destinationDb: input.handles.destinationDb,
        destinationClient: input.handles.destinationClient,
        destinationDatabase,
        ledger,
        initiativeId,
        forceNonTransactional: input.forceNonTransactional,
        allowTestIsolation: input.allowTestIsolation,
      });
      totalRoots += result.roots;
      totalChildren += result.children;
      initiativeNotes.push(`${initiativeId}: roots=${result.roots} children=${result.children}`);
    }
    phases.push({
      phase: "C_initiative_roots",
      status: mode === "dry-run" ? "planned" : "completed",
      counts: { roots: totalRoots },
      notes: initiativeNotes,
    });
    phases.push({
      phase: "D_civic_artifacts",
      status: mode === "dry-run" ? "planned" : "completed",
      counts: { children: totalChildren },
      notes: ["MUST_MIGRATE children with validated ancestry only"],
    });

    const mediaItems = [];
    for (const initiativeId of CANONICAL_PRODUCTION_INITIATIVE_IDS) {
      const root = await input.handles.sourceDb.collection(MONGO_COLLECTIONS.initiatives).findOne({
        initiativeId,
      });
      if (root) {
        mediaItems.push(
          ...planMediaFromInitiativeDocument({
            initiativeId,
            doc: root,
            mediaUploadKeys: new Set(),
          }),
        );
      }
    }
    const uploads = await input.handles.sourceDb
      .collection(MONGO_COLLECTIONS.mediaUploadRecords)
      .find({ initiativeId: { $in: [...CANONICAL_PRODUCTION_INITIATIVE_IDS] } })
      .toArray();
    for (const upload of uploads) {
      mediaItems.push(planMediaFromUploadRecord(upload));
    }
    const shared = await input.handles.sourceDb
      .collection(MONGO_COLLECTIONS.sharedDocuments)
      .find({ initiativeId: { $in: [...CANONICAL_PRODUCTION_INITIATIVE_IDS] } })
      .toArray();
    for (const doc of shared) {
      mediaItems.push(planMediaFromSharedDocument(doc));
    }

    const planned: PlannedMediaCopy[] = deduplicateMediaPlanItems(mediaItems);
    const mediaResult = await executeMediaCopyPhase({
      planned,
      ledger,
      executor: input.mediaExecutor ?? new DeferredMediaCopyExecutor(),
      performCopies: input.performMediaCopies === true,
    });

    const writeMediaRecords = async (
      session: ClientSession | undefined,
      allowWithoutSession: boolean,
    ) => {
      for (const upload of uploads) {
        const sanitized = withoutMongoId(
          sanitizeMediaUploadRecordForMigration(upload, PRODUCTION_MEDIA_PUBLIC_BASE_URL),
        );
        await insertOwned({
          mode,
          destinationDb: input.handles.destinationDb,
          collection: MONGO_COLLECTIONS.mediaUploadRecords,
          doc: sanitized,
          ledger,
          phase: "E_media",
          initiativeId: asString(upload.initiativeId) ?? undefined,
          session,
          allowExecuteWithoutSession: allowWithoutSession,
        });
      }
    };

    if (mode === "dry-run") {
      await writeMediaRecords(undefined, false);
    } else if (uploads.length > 0) {
      await withRequiredTransaction({
        client: input.handles.destinationClient,
        allowTestIsolation: input.allowTestIsolation,
        forceNonTransactional: input.forceNonTransactional,
        destinationDatabase,
        phase: "E_media",
        work: writeMediaRecords,
      });
    }

    const mediaStatus: "PLANNED" | "DEFERRED" | "COPIED" =
      mediaResult.copiedCount > 0
        ? "COPIED"
        : mediaResult.plannedCount > 0
          ? "DEFERRED"
          : "PLANNED";

    phases.push({
      phase: "E_media",
      status: mediaResult.copiedCount > 0 ? "completed" : "deferred",
      counts: {
        plannedCopies: mediaResult.plannedCount,
        copied: mediaResult.copiedCount,
        mediaUploadRecords: uploads.length,
      },
      notes: [
        mediaResult.deferred || mediaResult.copiedCount === 0
          ? "R2 object copy DEFERRED (Task 07.2 plan-only; Mongo must not claim media COMPLETE)"
          : "R2 object copy executed",
        `mediaPlan.status=${mediaStatus}`,
        `publicBaseUrl=${PRODUCTION_MEDIA_PUBLIC_BASE_URL}`,
        "system-media-recovery remains NON_IDENTITY",
      ],
    });

    phases.push({
      phase: "F_projections",
      status: mode === "dry-run" ? "planned" : "completed",
      counts: { rebuildProjectedInitiativeCards: totalRoots },
      notes: [
        "REBUILD: rebuildProjectedInitiativeCards after hydrate",
        "DO_NOT_COPY: workspace_projections, outbox, processed_events, notifications",
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    blockers.push(message);
    if (mode === "execute" && ledger.rollbackEligibleMongoInserts().length > 0) {
      try {
        const deleted = await rollbackOwnedMongoInserts(input.handles.destinationDb, ledger);
        blockers.push(
          `Compensating rollback of owned Mongo inserts completed deleted=${deleted}`,
        );
      } catch (rollbackError) {
        blockers.push(
          `Rollback failed: ${
            rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
          }`,
        );
      }
    }
  }

  const mediaObjects = ledger.listMediaObjects();
  const mediaCopied = mediaObjects.filter((row) => row.copied).length;
  const mediaPlanStatus: "PLANNED" | "DEFERRED" | "COPIED" =
    mediaCopied > 0 ? "COPIED" : mediaObjects.length > 0 ? "DEFERRED" : "PLANNED";

  const report: MigrationExecutionReport = {
    tool: "execute-production-initiative-migration",
    mode,
    migrationExecutionId,
    sourceDatabase,
    destinationDatabase,
    allowList: [...CANONICAL_PRODUCTION_INITIATIVE_IDS],
    excluded: [...EXCLUDED_PRODUCTION_INITIATIVE_IDS],
    inlinePreflight,
    phases,
    ownership: ledger.toSafeReport(),
    mediaPlan: {
      status: mediaPlanStatus,
      plannedCopies: mediaObjects.length,
      copied: mediaCopied,
      deferred: mediaCopied === 0,
      storageKeys: mediaObjects.map((row) => row.storageKey),
    },
    rollback: {
      strategy:
        "Compensating deleteOne by exact insertedId owned by this migrationExecutionId only; never by initiativeId alone; R2 delete only for copied=true keys owned by this executionId",
      ownedMongoInserts: ledger.rollbackEligibleMongoInserts().length,
      ownedMediaCopied: ledger.rollbackEligibleMediaKeys().length,
    },
    blockers,
    overallStatus:
      blockers.length > 0 ? "FAILED" : mode === "execute" ? "EXECUTE_OK" : "DRY_RUN_OK",
    writePathPresent: true,
  };

  const safe = stripPrivateFieldsForReport(report);
  const text = JSON.stringify(safe);
  assertNoSecretLeak(text);

  return safe as MigrationExecutionReport;
}

export function buildSafeMigrationExecutionLog(
  report: MigrationExecutionReport,
): Record<string, unknown> {
  return stripPrivateFieldsForReport(report) as Record<string, unknown>;
}

/** Exported for unit tests — structural refusal of non-allow-listed collections. */
export function assertMigrationWritableCollectionForTest(collection: string): void {
  assertWritableCollection(collection);
}
