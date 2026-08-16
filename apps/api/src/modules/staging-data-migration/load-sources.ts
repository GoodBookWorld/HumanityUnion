import fs from "node:fs";
import path from "node:path";

import type { Db, MongoClient } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import {
  APPROVED_HISTORICAL_INITIATIVES,
  APPROVED_HISTORICAL_PARTICIPANTS,
  PACK01_MANIFEST_RELATIVE_PATH,
} from "./constants.js";
import { StagingDataMigrationError } from "./guards.js";
import type { MigrationSourceBundle } from "./plan.js";
import { normalizeEmail } from "./redact.js";
import type {
  InitiativeRecord,
  SafeAuthShell,
  SafeMemberRecord,
  SafeMembershipRecord,
  SafeProfileRecord,
} from "./types.js";

function toAuthShell(doc: Record<string, unknown>): SafeAuthShell {
  return {
    userId: String(doc.userId ?? ""),
    memberId: String(doc.memberId ?? ""),
    email: String(doc.email ?? ""),
    displayName: String(doc.displayName ?? ""),
    role: String(doc.role ?? "member"),
    status: String(doc.status ?? "active"),
    emailVerificationStatus: String(doc.emailVerificationStatus ?? "pending"),
    createdAt: doc.createdAt ? String(doc.createdAt) : undefined,
    updatedAt: doc.updatedAt ? String(doc.updatedAt) : undefined,
  };
}

function loadSnapshotMap(
  filePath: string,
  mapKey: string,
): Record<string, Record<string, unknown>> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
  const map = parsed[mapKey];
  if (!map || typeof map !== "object" || Array.isArray(map)) {
    return {};
  }
  return map as Record<string, Record<string, unknown>>;
}

export function resolveRepoRoot(fromDir: string = process.cwd()): string {
  let current = path.resolve(fromDir);
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return path.resolve(fromDir);
}

export function resolveDefaultRuntimeDir(repoRoot: string): string {
  return path.join(repoRoot, "apps/api/.runtime");
}

export function validatePack01Manifest(repoRoot: string): {
  ok: boolean;
  path: string;
  pack02DecisionsPresent: boolean;
} {
  const manifestPath = path.join(repoRoot, PACK01_MANIFEST_RELATIVE_PATH);
  if (!fs.existsSync(manifestPath)) {
    throw new StagingDataMigrationError(
      `Pack 01 manifest missing at ${PACK01_MANIFEST_RELATIVE_PATH}.`,
    );
  }
  const raw = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
  if (raw.pack !== "STAGING_DATA_MIGRATION_PACK_01" && raw.mode !== "dry-run") {
    // Accept either pack field or dry-run mode from Pack 01 inspector.
  }
  if (!raw.source || !raw.target) {
    throw new StagingDataMigrationError("Pack 01 manifest missing source/target sections.");
  }
  const pack02 = raw.pack02Decisions as Record<string, unknown> | undefined;
  if (!pack02 || pack02.historicalVladGmail == null || pack02.isabellaInitiative == null) {
    throw new StagingDataMigrationError(
      "Pack 01 manifest missing pack02Decisions (historicalVladGmail / isabellaInitiative).",
    );
  }
  const vladDecision = pack02.historicalVladGmail as Record<string, unknown>;
  const isabellaDecision = pack02.isabellaInitiative as Record<string, unknown>;
  if (vladDecision.classification !== "SEPARATE_PARTICIPANT" || vladDecision.mergeWithStagingAdmin === true) {
    throw new StagingDataMigrationError(
      "Pack 02 decision invalid: historical Vlad must be SEPARATE_PARTICIPANT.",
    );
  }
  if (isabellaDecision.inScope !== true) {
    throw new StagingDataMigrationError(
      "Pack 02 decision invalid: Isabella Initiative must be inScope=true.",
    );
  }
  return {
    ok: true,
    path: manifestPath,
    pack02DecisionsPresent: true,
  };
}

export function assertApprovedSourcesPresent(bundle: MigrationSourceBundle): void {
  for (const participant of APPROVED_HISTORICAL_PARTICIPANTS) {
    if (!bundle.sourceAuthByMemberId.has(participant.memberId)) {
      throw new StagingDataMigrationError(
        `Pack 01 drift: approved Participant ${participant.key} missing in source auth.`,
      );
    }
  }
  for (const initiative of APPROVED_HISTORICAL_INITIATIVES) {
    if (!bundle.fileInitiativesById.has(initiative.initiativeId)) {
      throw new StagingDataMigrationError(
        `Pack 01 drift: approved Initiative ${initiative.initiativeId} missing in file runtime.`,
      );
    }
  }
}

async function loadAuthMaps(db: Db): Promise<{
  byUserId: Map<string, SafeAuthShell>;
  byEmail: Map<string, SafeAuthShell>;
  byMemberId: Map<string, SafeAuthShell>;
  admin: SafeAuthShell | null;
}> {
  const docs = await db
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
          emailVerificationStatus: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    )
    .toArray();

  const byUserId = new Map<string, SafeAuthShell>();
  const byEmail = new Map<string, SafeAuthShell>();
  const byMemberId = new Map<string, SafeAuthShell>();
  let admin: SafeAuthShell | null = null;

  for (const doc of docs) {
    const shell = toAuthShell(doc as Record<string, unknown>);
    if (!shell.userId) {
      continue;
    }
    byUserId.set(shell.userId, shell);
    if (shell.email) {
      byEmail.set(normalizeEmail(shell.email), shell);
    }
    if (shell.memberId) {
      byMemberId.set(shell.memberId, shell);
    }
    if (shell.role === "admin") {
      admin = shell;
    }
  }

  return { byUserId, byEmail, byMemberId, admin };
}

async function loadMembers(db: Db): Promise<Map<string, SafeMemberRecord>> {
  const docs = await db
    .collection(MONGO_COLLECTIONS.members)
    .find(
      {},
      {
        projection: {
          memberId: 1,
          identityId: 1,
          uniqueName: 1,
          status: 1,
          createdAt: 1,
        },
      },
    )
    .toArray();
  const map = new Map<string, SafeMemberRecord>();
  for (const doc of docs) {
    const memberId = String(doc.memberId ?? doc.identityId ?? "");
    if (!memberId) {
      continue;
    }
    map.set(memberId, {
      memberId,
      identityId: doc.identityId ? String(doc.identityId) : undefined,
      uniqueName: doc.uniqueName ? String(doc.uniqueName) : null,
      status: doc.status ? String(doc.status) : null,
      createdAt: doc.createdAt ? String(doc.createdAt) : null,
    });
  }
  return map;
}

async function loadProfiles(db: Db): Promise<Map<string, SafeProfileRecord>> {
  const docs = await db
    .collection(MONGO_COLLECTIONS.memberProfiles)
    .find(
      {},
      {
        projection: {
          profileId: 1,
          userId: 1,
          displayName: 1,
          publicName: 1,
          status: 1,
        },
      },
    )
    .toArray();
  const map = new Map<string, SafeProfileRecord>();
  for (const doc of docs) {
    const userId = String(doc.userId ?? "");
    if (!userId) {
      continue;
    }
    map.set(userId, {
      profileId: String(doc.profileId ?? ""),
      userId,
      displayName: doc.displayName ? String(doc.displayName) : null,
      publicName: doc.publicName ? String(doc.publicName) : null,
      status: doc.status ? String(doc.status) : null,
    });
  }
  return map;
}

async function loadMemberships(db: Db): Promise<Map<string, SafeMembershipRecord[]>> {
  const docs = await db.collection(MONGO_COLLECTIONS.memberships).find({}).toArray();
  const map = new Map<string, SafeMembershipRecord[]>();
  for (const doc of docs) {
    const memberId = String(doc.memberId ?? "");
    if (!memberId) {
      continue;
    }
    const list = map.get(memberId) ?? [];
    list.push({
      membershipId: doc.membershipId ? String(doc.membershipId) : undefined,
      memberId,
      status: doc.status,
      createdAt: doc.createdAt,
    });
    map.set(memberId, list);
  }
  return map;
}

async function loadInitiatives(db: Db): Promise<Map<string, InitiativeRecord>> {
  const docs = await db.collection(MONGO_COLLECTIONS.initiatives).find({}).toArray();
  const map = new Map<string, InitiativeRecord>();
  for (const doc of docs) {
    const initiativeId = String(doc.initiativeId ?? doc._id ?? "");
    if (!initiativeId) {
      continue;
    }
    map.set(initiativeId, {
      initiativeId,
      title: String(doc.title ?? ""),
      stewardId: String(doc.stewardId ?? ""),
      lifecyclePhase: doc.lifecyclePhase ? String(doc.lifecyclePhase) : undefined,
      status: doc.status ? String(doc.status) : undefined,
      visibility: doc.visibility,
      metadata: doc.metadata,
      createdAt: doc.createdAt ? String(doc.createdAt) : undefined,
      updatedAt: doc.updatedAt ? String(doc.updatedAt) : undefined,
      description: doc.description ? String(doc.description) : undefined,
    });
  }
  return map;
}

function loadFileInitiatives(runtimeDir: string): Map<string, InitiativeRecord> {
  const filePath = path.join(runtimeDir, "initiatives.json");
  const mapRaw = loadSnapshotMap(filePath, "initiatives");
  const map = new Map<string, InitiativeRecord>();
  for (const [id, record] of Object.entries(mapRaw)) {
    map.set(id, {
      ...(record as InitiativeRecord),
      initiativeId: String(record.initiativeId ?? id),
      title: String(record.title ?? ""),
      stewardId: String(record.stewardId ?? ""),
    });
  }
  return map;
}

function countRelated(
  runtimeDir: string,
  fileName: string,
  mapKey: string,
  initiativeIds: Set<string>,
): Map<string, number> {
  const mapRaw = loadSnapshotMap(path.join(runtimeDir, fileName), mapKey);
  const counts = new Map<string, number>();
  for (const record of Object.values(mapRaw)) {
    const initiativeId = String(record.initiativeId ?? "");
    if (!initiativeIds.has(initiativeId)) {
      continue;
    }
    counts.set(initiativeId, (counts.get(initiativeId) ?? 0) + 1);
  }
  return counts;
}

export async function loadMigrationSourceBundle(input: {
  client: MongoClient;
  sourceDatabase: string;
  targetDatabase: string;
  runtimeDir: string;
}): Promise<MigrationSourceBundle> {
  const sourceDb = input.client.db(input.sourceDatabase);
  const targetDb = input.client.db(input.targetDatabase);

  const sourceAuth = await loadAuthMaps(sourceDb);
  const targetAuth = await loadAuthMaps(targetDb);

  const approvedMemberIds = new Set<string>(
    APPROVED_HISTORICAL_PARTICIPANTS.map((p) => p.memberId),
  );
  const sourceAuthByMemberId = new Map<string, SafeAuthShell>();
  for (const [memberId, shell] of sourceAuth.byMemberId) {
    if (approvedMemberIds.has(memberId)) {
      sourceAuthByMemberId.set(memberId, shell);
    }
  }

  const initiativeIds = new Set(APPROVED_HISTORICAL_INITIATIVES.map((i) => i.initiativeId));
  const fileInitiativesById = loadFileInitiatives(input.runtimeDir);
  const analyses = countRelated(input.runtimeDir, "initiative-analyses.json", "analyses", initiativeIds);
  const proposals = countRelated(
    input.runtimeDir,
    "initiative-improvement-proposals.json",
    "proposals",
    initiativeIds,
  );
  const revisions = countRelated(
    input.runtimeDir,
    "initiative-version-revisions.json",
    "revisions",
    initiativeIds,
  );
  const petitionDrafts = countRelated(
    input.runtimeDir,
    "initiative-petition-drafts.json",
    "drafts",
    initiativeIds,
  );

  const relatedCountsByInitiativeId = new Map<
    string,
    { analyses: number; proposals: number; revisions: number; petitionDrafts: number }
  >();
  for (const id of initiativeIds) {
    relatedCountsByInitiativeId.set(id, {
      analyses: analyses.get(id) ?? 0,
      proposals: proposals.get(id) ?? 0,
      revisions: revisions.get(id) ?? 0,
      petitionDrafts: petitionDrafts.get(id) ?? 0,
    });
  }

  return {
    sourceDatabase: input.sourceDatabase,
    targetDatabase: input.targetDatabase,
    fileRuntimePath: input.runtimeDir,
    sourceAuthByMemberId,
    sourceMembersById: await loadMembers(sourceDb),
    sourceProfilesByUserId: await loadProfiles(sourceDb),
    sourceMembershipsByMemberId: await loadMemberships(sourceDb),
    targetAuthByUserId: targetAuth.byUserId,
    targetAuthByEmail: targetAuth.byEmail,
    targetAuthByMemberId: targetAuth.byMemberId,
    targetMembersById: await loadMembers(targetDb),
    targetProfilesByUserId: await loadProfiles(targetDb),
    targetMembershipsByMemberId: await loadMemberships(targetDb),
    targetInitiativesById: await loadInitiatives(targetDb),
    fileInitiativesById,
    relatedCountsByInitiativeId,
    stagingAdmin: targetAuth.admin,
  };
}

export function loadRelatedRecordsForInitiatives(
  runtimeDir: string,
  initiativeIds: Set<string>,
): {
  analyses: Record<string, unknown>[];
  proposals: Record<string, unknown>[];
  revisions: Record<string, unknown>[];
  petitionDrafts: Record<string, unknown>[];
} {
  const filter = (records: Record<string, Record<string, unknown>>) =>
    Object.values(records).filter((record) => initiativeIds.has(String(record.initiativeId ?? "")));

  return {
    analyses: filter(loadSnapshotMap(path.join(runtimeDir, "initiative-analyses.json"), "analyses")),
    proposals: filter(
      loadSnapshotMap(path.join(runtimeDir, "initiative-improvement-proposals.json"), "proposals"),
    ),
    revisions: filter(
      loadSnapshotMap(path.join(runtimeDir, "initiative-version-revisions.json"), "revisions"),
    ),
    petitionDrafts: filter(
      loadSnapshotMap(path.join(runtimeDir, "initiative-petition-drafts.json"), "drafts"),
    ),
  };
}
