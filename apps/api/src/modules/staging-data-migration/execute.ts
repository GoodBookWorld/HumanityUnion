import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { Db, Document, MongoClient } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { hashPassword } from "../auth/auth-password.js";
import {
  APPROVED_HISTORICAL_INITIATIVES,
  APPROVED_HISTORICAL_PARTICIPANTS,
  AUTH_SECRET_FIELDS,
  PRE_MIGRATION_SNAPSHOT_RUNTIME_RELATIVE_PATH,
} from "./constants.js";
import { StagingDataMigrationError } from "./guards.js";
import { loadRelatedRecordsForInitiatives, loadPortableCivicSourceForMigration } from "./load-sources.js";
import type { MigrationPlan } from "./types.js";
import type { MigrationWriteSummary } from "./types.js";
import { maskEmail, redactAuthDocument, stripSecretsForMigrationInsert } from "./redact.js";

const FORBIDDEN_WRITE_MARKERS = [
  "dropDatabase",
  "drop(",
  "deleteMany",
  "updateMany",
  "insertMany",
] as const;

async function insertIfAbsent(
  collection: ReturnType<Db["collection"]>,
  filter: Document,
  document: Document,
): Promise<"created" | "skipped"> {
  const existing = await collection.findOne(filter);
  if (existing) {
    return "skipped";
  }
  await collection.insertOne(document);
  return "created";
}

async function loadSourceAuthFull(
  sourceDb: Db,
  memberId: string,
): Promise<Record<string, unknown> | null> {
  const doc = await sourceDb.collection(MONGO_COLLECTIONS.authUsers).findOne({ memberId });
  return doc ? (doc as Record<string, unknown>) : null;
}

async function loadSourceMemberFull(
  sourceDb: Db,
  memberId: string,
): Promise<Record<string, unknown> | null> {
  const doc = await sourceDb.collection(MONGO_COLLECTIONS.members).findOne({ memberId });
  return doc ? (doc as Record<string, unknown>) : null;
}

async function loadSourceProfileFull(
  sourceDb: Db,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const doc = await sourceDb.collection(MONGO_COLLECTIONS.memberProfiles).findOne({ userId });
  return doc ? (doc as Record<string, unknown>) : null;
}

async function loadSourceMemberships(
  sourceDb: Db,
  memberId: string,
): Promise<Record<string, unknown>[]> {
  const docs = await sourceDb.collection(MONGO_COLLECTIONS.memberships).find({ memberId }).toArray();
  return docs as Record<string, unknown>[];
}

function assertAdminUntouched(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): boolean {
  if (!before || !after) {
    return false;
  }
  return (
    String(before.userId) === String(after.userId) &&
    String(before.memberId) === String(after.memberId) &&
    String(before.email) === String(after.email) &&
    String(before.role) === "admin" &&
    String(after.role) === "admin" &&
    String(before.passwordHash) === String(after.passwordHash)
  );
}

export async function writePreMigrationSnapshot(input: {
  targetDb: Db;
  repoRoot: string;
  stagingAdmin: Record<string, unknown> | null;
}): Promise<string> {
  const counts: Record<string, number> = {};
  for (const name of [
    MONGO_COLLECTIONS.authUsers,
    MONGO_COLLECTIONS.members,
    MONGO_COLLECTIONS.memberProfiles,
    MONGO_COLLECTIONS.memberships,
    MONGO_COLLECTIONS.initiatives,
    MONGO_COLLECTIONS.initiativeAnalyses,
    MONGO_COLLECTIONS.initiativeImprovementProposals,
    MONGO_COLLECTIONS.initiativeVersionRevisions,
    MONGO_COLLECTIONS.initiativePetitionDrafts,
  ]) {
    counts[name] = await input.targetDb.collection(name).countDocuments({});
  }

  const authSafe = await input.targetDb
    .collection(MONGO_COLLECTIONS.authUsers)
    .find(
      {},
      {
        projection: {
          userId: 1,
          memberId: 1,
          email: 1,
          displayName: 1,
          role: 1,
          status: 1,
        },
      },
    )
    .toArray();

  const initiativesSafe = await input.targetDb
    .collection(MONGO_COLLECTIONS.initiatives)
    .find({}, { projection: { _id: 1, title: 1, stewardId: 1, status: 1, lifecyclePhase: 1 } })
    .toArray();

  const snapshot = {
    generatedAt: new Date().toISOString(),
    targetDatabase: input.targetDb.databaseName,
    counts,
    stagingAdmin: input.stagingAdmin
      ? redactAuthDocument(input.stagingAdmin)
      : null,
    authUsers: authSafe.map((doc) => ({
      userId: String(doc.userId ?? ""),
      memberId: String(doc.memberId ?? ""),
      displayName: String(doc.displayName ?? ""),
      role: String(doc.role ?? ""),
      emailMasked: maskEmail(typeof doc.email === "string" ? doc.email : undefined),
    })),
    initiatives: initiativesSafe.map((doc) => ({
      initiativeId: String(doc._id ?? doc.initiativeId ?? ""),
      title: String(doc.title ?? ""),
      stewardId: String(doc.stewardId ?? ""),
      status: doc.status ? String(doc.status) : null,
      lifecyclePhase: doc.lifecyclePhase ? String(doc.lifecyclePhase) : null,
    })),
    note: "Stored under gitignored apps/api/.runtime/recovery/ — do not commit identity metadata snapshots.",
  };

  const outPath = path.join(input.repoRoot, PRE_MIGRATION_SNAPSHOT_RUNTIME_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return outPath;
}

/**
 * Controlled write path. Call only after execute guards pass.
 * Uses insert-if-absent only — never deleteMany/updateMany/drop/insertMany.
 * Never migrates auth_sessions or token collections.
 */
export async function executeStagingHistoricalMigration(input: {
  client: MongoClient;
  sourceDatabase: string;
  targetDatabase: string;
  civicSourceDir: string;
  /** @deprecated Pack 02A */
  runtimeDir?: string;
  repoRoot: string;
  plan: MigrationPlan;
}): Promise<MigrationWriteSummary> {
  if (input.plan.conflicts.length > 0) {
    throw new StagingDataMigrationError(
      `Refusing execute: plan has conflicts: ${input.plan.conflicts.join("; ")}`,
    );
  }

  const civicSourceDir = input.civicSourceDir || input.runtimeDir;
  if (!civicSourceDir) {
    throw new StagingDataMigrationError("civicSourceDir is required for Pack 02A migration.");
  }
  const portable = loadPortableCivicSourceForMigration(civicSourceDir);

  const sourceDb = input.client.db(input.sourceDatabase);
  const targetDb = input.client.db(input.targetDatabase);

  const adminBefore = await targetDb.collection(MONGO_COLLECTIONS.authUsers).findOne({ role: "admin" });
  if (!adminBefore) {
    throw new StagingDataMigrationError("Refusing execute: staging admin not found in target.");
  }

  await writePreMigrationSnapshot({
    targetDb,
    repoRoot: input.repoRoot,
    stagingAdmin: adminBefore as Record<string, unknown>,
  });

  const summary: MigrationWriteSummary = {
    mode: "execute",
    written: {
      authUsers: 0,
      members: 0,
      profiles: 0,
      memberships: 0,
      initiatives: 0,
      analyses: 0,
      proposals: 0,
      revisions: 0,
      petitionDrafts: 0,
    },
    skipped: {
      authUsers: 0,
      members: 0,
      profiles: 0,
      memberships: 0,
      initiatives: 0,
      analyses: 0,
      proposals: 0,
      revisions: 0,
      petitionDrafts: 0,
    },
    stagingAdminUnchanged: false,
    confirmation: "",
  };

  // Participants
  for (const approved of APPROVED_HISTORICAL_PARTICIPANTS) {
    const sourceAuth = await loadSourceAuthFull(sourceDb, approved.memberId);
    if (!sourceAuth) {
      throw new StagingDataMigrationError(`Missing source auth for ${approved.key}`);
    }

    const userId = String(sourceAuth.userId);
    const memberId = String(sourceAuth.memberId);
    const email = String(sourceAuth.email).trim().toLowerCase();

    if (
      String(adminBefore.userId) === userId ||
      String(adminBefore.memberId) === memberId ||
      String(adminBefore.email).toLowerCase() === email
    ) {
      throw new StagingDataMigrationError("Refusing to write over protected staging admin identity.");
    }

    const existingAuth = await targetDb.collection(MONGO_COLLECTIONS.authUsers).findOne({
      $or: [{ userId }, { email }, { memberId }],
    });

    if (existingAuth) {
      if (
        String(existingAuth.userId) === userId &&
        String(existingAuth.memberId) === memberId &&
        String(existingAuth.email).toLowerCase() === email
      ) {
        summary.skipped.authUsers += 1;
      } else {
        throw new StagingDataMigrationError(
          `Partial/inconsistent auth collision for ${approved.key}; refusing silent overwrite.`,
        );
      }
    } else {
      const unusablePasswordHash = await hashPassword(`migration-reset-required-${randomUUID()}`);
      const authDoc = stripSecretsForMigrationInsert(sourceAuth);
      for (const field of AUTH_SECRET_FIELDS) {
        delete authDoc[field];
      }
      authDoc.passwordHash = unusablePasswordHash;
      authDoc.role = sourceAuth.role === "admin" ? "member" : (sourceAuth.role ?? "member");
      authDoc.emailVerificationStatus = "pending";
      authDoc.email = email;
      authDoc.userId = userId;
      authDoc.memberId = memberId;
      // Never copy sessions / tokens collections — only the auth_users shell.
      const result = await insertIfAbsent(
        targetDb.collection(MONGO_COLLECTIONS.authUsers),
        { userId },
        authDoc as Document,
      );
      if (result === "created") {
        summary.written.authUsers += 1;
      } else {
        summary.skipped.authUsers += 1;
      }
    }

    const sourceMember = await loadSourceMemberFull(sourceDb, memberId);
    if (sourceMember) {
      const memberDoc = { ...sourceMember };
      delete memberDoc._id;
      const result = await insertIfAbsent(
        targetDb.collection(MONGO_COLLECTIONS.members),
        { memberId },
        memberDoc as Document,
      );
      if (result === "created") {
        summary.written.members += 1;
      } else {
        summary.skipped.members += 1;
      }
    } else {
      // Synthesize Member from auth shell when historical Member row is absent.
      const uniqueBase =
        String(sourceAuth.displayName ?? "participant")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "participant";
      const now = new Date().toISOString();
      const synthesizedMember = {
        memberId,
        identityId: userId,
        displayName: String(sourceAuth.displayName ?? "Participant"),
        uniqueName: `${uniqueBase}-${memberId.slice(0, 8)}`,
        languages: ["en"],
        status: "active",
        verificationLevel: "email",
        roles: ["member"],
        registrationStatus: "registered",
        version: 1,
        createdAt: sourceAuth.createdAt ? String(sourceAuth.createdAt) : now,
        updatedAt: now,
      };
      const result = await insertIfAbsent(
        targetDb.collection(MONGO_COLLECTIONS.members),
        { memberId },
        synthesizedMember as Document,
      );
      if (result === "created") {
        summary.written.members += 1;
      } else {
        summary.skipped.members += 1;
      }
    }

    const sourceProfile = await loadSourceProfileFull(sourceDb, userId);
    if (sourceProfile) {
      const profileDoc = { ...sourceProfile };
      delete profileDoc._id;
      const result = await insertIfAbsent(
        targetDb.collection(MONGO_COLLECTIONS.memberProfiles),
        { userId },
        profileDoc as Document,
      );
      if (result === "created") {
        summary.written.profiles += 1;
      } else {
        summary.skipped.profiles += 1;
      }
    } else {
      const now = new Date().toISOString();
      const displayName = String(sourceAuth.displayName ?? "Participant");
      const synthesizedProfile = {
        profileId: randomUUID(),
        userId,
        memberNumber: `HU-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`,
        createdAt: sourceAuth.createdAt ? String(sourceAuth.createdAt) : now,
        updatedAt: now,
        displayName,
        publicName: `${displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "member"}-${userId.slice(0, 6)}`,
        skills: [],
        skillsVisibility: "members_only",
        professionalLinksVisibility: "public",
        membershipPubliclyVisible: false,
        showInitiativesStatistics: true,
        showCollectiveDecisionsStatistics: true,
        showAlliesStatistics: true,
        messagingPolicy: "active_allies",
        status: "active",
        profileVisibility: "public",
      };
      const result = await insertIfAbsent(
        targetDb.collection(MONGO_COLLECTIONS.memberProfiles),
        { userId },
        synthesizedProfile as Document,
      );
      if (result === "created") {
        summary.written.profiles += 1;
      } else {
        summary.skipped.profiles += 1;
      }
    }

    const memberships = await loadSourceMemberships(sourceDb, memberId);
    for (const membership of memberships) {
      const membershipId = String(
        membership.membershipId ?? membership._id ?? randomUUID(),
      );
      const membershipDoc: Record<string, unknown> = { ...membership, membershipId, memberId };
      delete membershipDoc._id;
      const result = await insertIfAbsent(
        targetDb.collection(MONGO_COLLECTIONS.memberships),
        { membershipId },
        membershipDoc as Document,
      );
      if (result === "created") {
        summary.written.memberships += 1;
      } else {
        summary.skipped.memberships += 1;
      }
    }
  }

  // Initiatives + related (portable civic bundle → Mongo)
  const initiativeIds = new Set(APPROVED_HISTORICAL_INITIATIVES.map((i) => i.initiativeId));
  const related = loadRelatedRecordsForInitiatives(civicSourceDir, initiativeIds);

  for (const approved of APPROVED_HISTORICAL_INITIATIVES) {
    const initiative = portable.initiativesById.get(approved.initiativeId) as
      | (Record<string, unknown> & { stewardId?: string; title?: string })
      | undefined;
    if (!initiative) {
      throw new StagingDataMigrationError(`Missing portable Initiative ${approved.initiativeId}`);
    }
    if (String(initiative.stewardId) !== approved.stewardMemberId) {
      throw new StagingDataMigrationError(
        `Steward drift for ${approved.initiativeId}: refusing write.`,
      );
    }

    const existing = await targetDb
      .collection(MONGO_COLLECTIONS.initiatives)
      .findOne({ _id: approved.initiativeId } as Document);
    if (existing) {
      if (
        String(existing.stewardId) === approved.stewardMemberId &&
        String(existing.title) === String(initiative.title)
      ) {
        summary.skipped.initiatives += 1;
      } else {
        throw new StagingDataMigrationError(
          `Initiative ${approved.initiativeId} exists with different steward/title; refusing overwrite.`,
        );
      }
    } else {
      const { initiativeId: _ignored, ...rest } = initiative;
      await targetDb.collection(MONGO_COLLECTIONS.initiatives).insertOne({
        _id: approved.initiativeId,
        ...rest,
        stewardId: approved.stewardMemberId,
      } as Document);
      summary.written.initiatives += 1;
    }
  }

  const upsertRelated = async (
    collectionName: string,
    records: Record<string, unknown>[],
    idField: string,
    counter: keyof MigrationWriteSummary["written"],
  ) => {
    for (const record of records) {
      const id = String(record[idField] ?? "");
      if (!id) {
        continue;
      }
      const existing = await targetDb.collection(collectionName).findOne({ _id: id } as Document);
      if (existing) {
        summary.skipped[counter] += 1;
        continue;
      }
      const { [idField]: _ignored, ...rest } = record;
      await targetDb.collection(collectionName).insertOne({
        _id: id,
        ...rest,
      } as Document);
      summary.written[counter] += 1;
    }
  };

  // Dependency order: analyses → proposals → revisions → petition drafts
  await upsertRelated(
    MONGO_COLLECTIONS.initiativeAnalyses,
    related.analyses,
    "analysisId",
    "analyses",
  );
  await upsertRelated(
    MONGO_COLLECTIONS.initiativeImprovementProposals,
    related.proposals,
    "proposalId",
    "proposals",
  );
  await upsertRelated(
    MONGO_COLLECTIONS.initiativeVersionRevisions,
    related.revisions,
    "revisionId",
    "revisions",
  );
  // Petition drafts are keyed by initiativeId in Mongo snapshot persistence.
  for (const draft of related.petitionDrafts) {
    const initiativeId = String(draft.initiativeId ?? "");
    if (!initiativeId) {
      continue;
    }
    const existing = await targetDb
      .collection(MONGO_COLLECTIONS.initiativePetitionDrafts)
      .findOne({ _id: initiativeId } as Document);
    if (existing) {
      summary.skipped.petitionDrafts += 1;
      continue;
    }
    const { initiativeId: _ignored, ...rest } = draft;
    await targetDb.collection(MONGO_COLLECTIONS.initiativePetitionDrafts).insertOne({
      _id: initiativeId,
      ...rest,
      initiativeId,
    } as Document);
    summary.written.petitionDrafts += 1;
  }

  const adminAfter = await targetDb.collection(MONGO_COLLECTIONS.authUsers).findOne({
    userId: adminBefore.userId,
  });
  summary.stagingAdminUnchanged = assertAdminUntouched(
    adminBefore as Record<string, unknown>,
    adminAfter as Record<string, unknown> | null,
  );
  if (!summary.stagingAdminUnchanged) {
    throw new StagingDataMigrationError(
      "Post-migration assertion failed: staging administrator was modified.",
    );
  }

  summary.confirmation =
    "STAGING WRITE COMPLETE for approved allow-list only. Legacy activities/discussions/proposals/decisions were not imported. Auth sessions/tokens were not migrated.";

  void FORBIDDEN_WRITE_MARKERS;
  return summary;
}

/** Test helper: ensure execute module source never uses forbidden bulk mutators. */
export function listForbiddenWriteMarkers(): readonly string[] {
  return FORBIDDEN_WRITE_MARKERS;
}
