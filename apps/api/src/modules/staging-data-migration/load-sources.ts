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
import {
  loadAndValidatePortableCivicSource,
  resolvePortableCivicSourceDir,
  type LoadedPortableCivicSource,
} from "./portable-source-bundle.js";
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
  // Pack 02A: civic Initiatives come from the portable recovery bundle, not .runtime.
  return resolvePortableCivicSourceDir(repoRoot);
}

export function resolveCivicSourceDir(repoRoot: string, overrideDir?: string): string {
  return resolvePortableCivicSourceDir(repoRoot, overrideDir);
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

export async function loadMigrationSourceBundle(input: {
  client: MongoClient;
  sourceDatabase: string;
  targetDatabase: string;
  civicSourceDir: string;
  /** @deprecated Pack 02A — ignored; portable civic source is required. */
  runtimeDir?: string;
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

  const portable = loadAndValidatePortableCivicSource(input.civicSourceDir);

  return {
    sourceDatabase: input.sourceDatabase,
    targetDatabase: input.targetDatabase,
    fileRuntimePath: portable.bundleDir,
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
    fileInitiativesById: portable.initiativesById,
    relatedCountsByInitiativeId: portable.relatedCountsByInitiativeId,
    stagingAdmin: targetAuth.admin,
  };
}

export function loadRelatedRecordsForInitiatives(
  civicSourceDir: string,
  initiativeIds: Set<string>,
): {
  analyses: Record<string, unknown>[];
  proposals: Record<string, unknown>[];
  revisions: Record<string, unknown>[];
  petitionDrafts: Record<string, unknown>[];
} {
  const portable = loadAndValidatePortableCivicSource(civicSourceDir);
  const filter = (records: Record<string, unknown>[]) =>
    records.filter((record) => initiativeIds.has(String(record.initiativeId ?? "")));

  return {
    analyses: filter(portable.analyses),
    proposals: filter(portable.proposals),
    revisions: filter(portable.revisions),
    petitionDrafts: filter(portable.petitionDrafts),
  };
}

export function loadPortableCivicSourceForMigration(
  civicSourceDir: string,
): LoadedPortableCivicSource {
  return loadAndValidatePortableCivicSource(civicSourceDir);
}
