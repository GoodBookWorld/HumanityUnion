/**
 * STAGING DATA MIGRATION PACK 01 — read-only / dry-run inventory.
 *
 * Defaults to DRY RUN. Performs countDocuments / find projections only.
 * Never prints MONGODB_URI or credentials.
 * Never writes, updates, deletes, or migrates.
 *
 * Usage:
 *   pnpm exec tsx apps/api/src/scripts/staging-data-migration-inspect.ts
 *   pnpm exec tsx apps/api/src/scripts/staging-data-migration-inspect.ts --source=humanity_union_dev --target=humanity_union_staging
 *   pnpm exec tsx apps/api/src/scripts/staging-data-migration-inspect.ts --json-out=architecture/recovery/STAGING_DATA_MIGRATION_MANIFEST_v1.0.json
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadApiEnvironment } from "../config/load-api-environment.js";
import { MONGO_COLLECTIONS } from "../infrastructure/mongodb/mongo-collections.js";
import {
  isMongoConfigured,
  resolveMongoConfig,
} from "../infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
  getMongoClient,
} from "../infrastructure/mongodb/mongo-connection.js";

loadApiEnvironment();

const IDENTITY_COLLECTIONS = [
  MONGO_COLLECTIONS.authUsers,
  MONGO_COLLECTIONS.members,
  MONGO_COLLECTIONS.memberProfiles,
  MONGO_COLLECTIONS.memberships,
] as const;

const CIVIC_COLLECTIONS = [
  MONGO_COLLECTIONS.initiatives,
  MONGO_COLLECTIONS.initiativeAnalyses,
  MONGO_COLLECTIONS.initiativeImprovementProposals,
  MONGO_COLLECTIONS.initiativeVersionRevisions,
  MONGO_COLLECTIONS.initiativeRevisionDrafts,
  MONGO_COLLECTIONS.decisionSessions,
  MONGO_COLLECTIONS.initiativeCollectiveDecisions,
  MONGO_COLLECTIONS.petitions,
  MONGO_COLLECTIONS.petitionSignatures,
  MONGO_COLLECTIONS.initiativeImplementationCommitments,
  MONGO_COLLECTIONS.initiativeImplementationTrackings,
  MONGO_COLLECTIONS.initiativePublicImpacts,
  MONGO_COLLECTIONS.officialResponses,
  MONGO_COLLECTIONS.publicCivicArchiveRecords,
  MONGO_COLLECTIONS.participantActions,
  MONGO_COLLECTIONS.initiativeSupportRegisteredSignals,
  MONGO_COLLECTIONS.initiativeComments,
  MONGO_COLLECTIONS.blogPosts,
] as const;

const LEGACY_COLLECTIONS = [
  MONGO_COLLECTIONS.activities,
  MONGO_COLLECTIONS.discussions,
  MONGO_COLLECTIONS.proposals,
  MONGO_COLLECTIONS.decisions,
] as const;

function parseArg(name: string): string | undefined {
  const match = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3).trim() : undefined;
}

function maskEmail(email: string | undefined): string | null {
  if (!email?.trim()) {
    return null;
  }
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  if (at < 1) {
    return "***";
  }
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!domain) {
    return "***";
  }
  const localMasked =
    local.length <= 2 ? `${local[0] ?? "*"}*` : `${local.slice(0, 2)}***`;
  return `${localMasked}@${domain}`;
}

function emailFingerprint(email: string | undefined): string | null {
  if (!email?.trim()) {
    return null;
  }
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 12);
}

function assertDryRunOnly(): void {
  if (process.argv.includes("--write") || process.argv.includes("--execute")) {
    throw new Error("This script is dry-run only. Write/execute flags are rejected.");
  }
}

async function countCollection(dbName: string, collection: string): Promise<number | null> {
  const client = getMongoClient();
  const collections = await client.db(dbName).listCollections({ name: collection }).toArray();
  if (collections.length === 0) {
    return null;
  }
  return client.db(dbName).collection(collection).countDocuments({});
}

async function inventoryDatabase(dbName: string) {
  const counts: Record<string, number | null> = {};
  for (const name of [
    ...IDENTITY_COLLECTIONS,
    ...CIVIC_COLLECTIONS,
    ...LEGACY_COLLECTIONS,
  ]) {
    counts[name] = await countCollection(dbName, name);
  }
  return counts;
}

async function listSafeAuthUsers(dbName: string) {
  const client = getMongoClient();
  const docs = await client
    .db(dbName)
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
    .limit(200)
    .toArray();

  return docs.map((doc) => ({
    userId: String(doc.userId ?? ""),
    memberId: String(doc.memberId ?? ""),
    displayName: String(doc.displayName ?? ""),
    role: String(doc.role ?? ""),
    status: String(doc.status ?? ""),
    emailVerificationStatus: String(doc.emailVerificationStatus ?? ""),
    emailMasked: maskEmail(typeof doc.email === "string" ? doc.email : undefined),
    emailFingerprint: emailFingerprint(typeof doc.email === "string" ? doc.email : undefined),
    createdAt: doc.createdAt ? String(doc.createdAt) : null,
  }));
}

async function listSafeMembers(dbName: string) {
  const client = getMongoClient();
  const docs = await client
    .db(dbName)
    .collection(MONGO_COLLECTIONS.members)
    .find(
      {},
      {
        projection: {
          memberId: 1,
          identityId: 1,
          uniqueName: 1,
          status: 1,
          verificationLevel: 1,
          createdAt: 1,
        },
      },
    )
    .limit(200)
    .toArray();

  return docs.map((doc) => ({
    memberId: String(doc.memberId ?? doc.identityId ?? ""),
    uniqueName: doc.uniqueName ? String(doc.uniqueName) : null,
    status: doc.status ? String(doc.status) : null,
    verificationLevel: doc.verificationLevel ? String(doc.verificationLevel) : null,
    createdAt: doc.createdAt ? String(doc.createdAt) : null,
  }));
}

async function listSafeProfiles(dbName: string) {
  const client = getMongoClient();
  const docs = await client
    .db(dbName)
    .collection(MONGO_COLLECTIONS.memberProfiles)
    .find(
      {},
      {
        projection: {
          userId: 1,
          profileId: 1,
          displayName: 1,
          publicName: 1,
          status: 1,
          profileVisibility: 1,
        },
      },
    )
    .limit(200)
    .toArray();

  return docs.map((doc) => ({
    userId: String(doc.userId ?? ""),
    profileId: String(doc.profileId ?? ""),
    displayName: doc.displayName ? String(doc.displayName) : null,
    publicName: doc.publicName ? String(doc.publicName) : null,
    status: doc.status ? String(doc.status) : null,
    profileVisibility: doc.profileVisibility ? String(doc.profileVisibility) : null,
  }));
}

async function listSafeInitiatives(dbName: string) {
  const client = getMongoClient();
  const docs = await client
    .db(dbName)
    .collection(MONGO_COLLECTIONS.initiatives)
    .find(
      {},
      {
        projection: {
          _id: 1,
          title: 1,
          stewardId: 1,
          lifecyclePhase: 1,
          status: 1,
          visibility: 1,
          metadata: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    )
    .limit(500)
    .toArray();

  const related = async (collection: string, initiativeId: string) => {
    const exists = await countCollection(dbName, collection);
    if (exists === null) {
      return 0;
    }
    return client.db(dbName).collection(collection).countDocuments({ initiativeId });
  };

  const initiatives = [];
  for (const doc of docs) {
    const initiativeId = String(doc._id ?? doc.initiativeId ?? "");
    initiatives.push({
      initiativeId,
      title: String(doc.title ?? ""),
      stewardId: String(doc.stewardId ?? ""),
      lifecyclePhase: String(doc.lifecyclePhase ?? ""),
      status: String(doc.status ?? ""),
      visibility:
        doc.visibility && typeof doc.visibility === "object" && "policy" in doc.visibility
          ? String((doc.visibility as { policy?: string }).policy ?? "")
          : null,
      geography: {
        region:
          doc.metadata && typeof doc.metadata === "object" && "region" in doc.metadata
            ? String((doc.metadata as { region?: string }).region ?? "")
            : null,
        countrySlug:
          doc.metadata && typeof doc.metadata === "object" && "countrySlug" in doc.metadata
            ? String((doc.metadata as { countrySlug?: string }).countrySlug ?? "")
            : null,
        regionSlug:
          doc.metadata && typeof doc.metadata === "object" && "regionSlug" in doc.metadata
            ? String((doc.metadata as { regionSlug?: string }).regionSlug ?? "")
            : null,
      },
      createdAt: doc.createdAt ? String(doc.createdAt) : null,
      updatedAt: doc.updatedAt ? String(doc.updatedAt) : null,
      relatedCounts: {
        analyses: await related(MONGO_COLLECTIONS.initiativeAnalyses, initiativeId),
        proposals: await related(MONGO_COLLECTIONS.initiativeImprovementProposals, initiativeId),
        revisions: await related(MONGO_COLLECTIONS.initiativeVersionRevisions, initiativeId),
        decisionSessions: await related(MONGO_COLLECTIONS.decisionSessions, initiativeId),
        collectiveDecisions: await related(
          MONGO_COLLECTIONS.initiativeCollectiveDecisions,
          initiativeId,
        ),
        petitions: await related(MONGO_COLLECTIONS.petitions, initiativeId),
        commitments: await related(
          MONGO_COLLECTIONS.initiativeImplementationCommitments,
          initiativeId,
        ),
        trackings: await related(
          MONGO_COLLECTIONS.initiativeImplementationTrackings,
          initiativeId,
        ),
        officialResponses: await related(MONGO_COLLECTIONS.officialResponses, initiativeId),
        publicImpacts: await related(MONGO_COLLECTIONS.initiativePublicImpacts, initiativeId),
        civicArchive: await related(MONGO_COLLECTIONS.publicCivicArchiveRecords, initiativeId),
        comments: await related(MONGO_COLLECTIONS.initiativeComments, initiativeId),
        supportSignals: await related(
          MONGO_COLLECTIONS.initiativeSupportRegisteredSignals,
          initiativeId,
        ),
      },
    });
  }

  return initiatives;
}

async function listSafeLegacyActivities(dbName: string) {
  const exists = await countCollection(dbName, MONGO_COLLECTIONS.activities);
  if (exists === null || exists === 0) {
    return { count: exists ?? 0, sample: [] as const };
  }

  const client = getMongoClient();
  const docs = await client
    .db(dbName)
    .collection(MONGO_COLLECTIONS.activities)
    .find(
      {},
      {
        projection: {
          activityId: 1,
          title: 1,
          status: 1,
          creatorMemberId: 1,
          visibility: 1,
          activityType: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    )
    .sort({ createdAt: 1 })
    .limit(20)
    .toArray();

  const creatorIds = await client
    .db(dbName)
    .collection(MONGO_COLLECTIONS.activities)
    .distinct("creatorMemberId");

  return {
    count: exists,
    distinctCreators: creatorIds.filter(Boolean).length,
    sample: docs.map((doc) => ({
      activityId: String(doc.activityId ?? ""),
      title: String(doc.title ?? ""),
      status: String(doc.status ?? ""),
      creatorMemberId: String(doc.creatorMemberId ?? ""),
      visibility: String(doc.visibility ?? ""),
      activityType: String(doc.activityType ?? ""),
      createdAt: doc.createdAt ? String(doc.createdAt) : null,
      classification: "LEGACY_DO_NOT_MIGRATE_DIRECTLY",
    })),
  };
}

function classify(source: Awaited<ReturnType<typeof buildSide>>, target: Awaited<ReturnType<typeof buildSide>>) {
  const sourceAuthIds = new Set(source.authUsers.map((u) => u.userId));
  const targetAuthIds = new Set(target.authUsers.map((u) => u.userId));
  const sourceMemberIds = new Set(source.authUsers.map((u) => u.memberId).filter(Boolean));
  const targetMemberIds = new Set(target.authUsers.map((u) => u.memberId).filter(Boolean));
  const sourceEmails = new Map(
    source.authUsers.filter((u) => u.emailFingerprint).map((u) => [u.emailFingerprint!, u]),
  );
  const targetEmails = new Map(
    target.authUsers.filter((u) => u.emailFingerprint).map((u) => [u.emailFingerprint!, u]),
  );
  const sourceInitiativeIds = new Set(source.initiatives.map((i) => i.initiativeId));
  const targetInitiativeIds = new Set(target.initiatives.map((i) => i.initiativeId));

  const participantIdCollisions = [...sourceAuthIds].filter((id) => targetAuthIds.has(id));
  const memberIdCollisions = [...sourceMemberIds].filter((id) => targetMemberIds.has(id));
  const emailCollisions = [...sourceEmails.keys()].filter((fp) => targetEmails.has(fp));
  const initiativeIdCollisions = [...sourceInitiativeIds].filter((id) =>
    targetInitiativeIds.has(id),
  );

  const stagingAdmins = target.authUsers.filter((u) => u.role === "admin");
  const adminEmailCollisions = stagingAdmins
    .map((admin) => admin.emailFingerprint)
    .filter((fp): fp is string => Boolean(fp && sourceEmails.has(fp)));

  const initiativesMissingSteward = source.initiatives.filter((initiative) => {
    if (!initiative.stewardId) {
      return true;
    }
    return !sourceMemberIds.has(initiative.stewardId);
  });

  const safeParticipants = source.authUsers.filter((user) => {
    if (user.role === "admin" && adminEmailCollisions.includes(user.emailFingerprint ?? "")) {
      return false;
    }
    if (targetAuthIds.has(user.userId) || targetMemberIds.has(user.memberId)) {
      return false;
    }
    if (user.emailFingerprint && targetEmails.has(user.emailFingerprint)) {
      return false;
    }
    return true;
  });

  const duplicateParticipants = source.authUsers.filter(
    (user) =>
      targetAuthIds.has(user.userId) ||
      targetMemberIds.has(user.memberId) ||
      (user.emailFingerprint && targetEmails.has(user.emailFingerprint)),
  );

  const safeInitiatives = source.initiatives.filter(
    (initiative) => !targetInitiativeIds.has(initiative.initiativeId),
  );
  const duplicateInitiatives = source.initiatives.filter((initiative) =>
    targetInitiativeIds.has(initiative.initiativeId),
  );

  return {
    participantIdCollisions: participantIdCollisions.length,
    memberIdCollisions: memberIdCollisions.length,
    emailCollisions: emailCollisions.length,
    initiativeIdCollisions: initiativeIdCollisions.length,
    stagingAdminCount: stagingAdmins.length,
    adminEmailCollisionCount: adminEmailCollisions.length,
    initiativesMissingStewardCount: initiativesMissingSteward.length,
    initiativesMissingStewardIds: initiativesMissingSteward.map((i) => i.initiativeId),
    safeParticipants: safeParticipants.map((u) => ({
      classification: "SAFE_TO_MIGRATE",
      userId: u.userId,
      memberId: u.memberId,
      displayName: u.displayName,
      emailMasked: u.emailMasked,
      role: u.role,
    })),
    duplicateParticipants: duplicateParticipants.map((u) => ({
      classification: "DUPLICATE_OR_ALREADY_PRESENT",
      userId: u.userId,
      memberId: u.memberId,
      displayName: u.displayName,
      emailMasked: u.emailMasked,
      reason: "Matching userId, memberId, or email fingerprint already in staging",
    })),
    safeInitiatives: safeInitiatives.map((i) => ({
      classification: "SAFE_TO_MIGRATE",
      initiativeId: i.initiativeId,
      title: i.title,
      stewardId: i.stewardId,
      lifecyclePhase: i.lifecyclePhase,
      status: i.status,
      visibility: i.visibility,
    })),
    duplicateInitiatives: duplicateInitiatives.map((i) => ({
      classification: "DUPLICATE_OR_ALREADY_PRESENT",
      initiativeId: i.initiativeId,
      title: i.title,
      reason: "Same initiativeId already present in staging",
    })),
    legacyExcluded: {
      activities: source.counts[MONGO_COLLECTIONS.activities] ?? 0,
      discussions: source.counts[MONGO_COLLECTIONS.discussions] ?? 0,
      proposals: source.counts[MONGO_COLLECTIONS.proposals] ?? 0,
      decisions: source.counts[MONGO_COLLECTIONS.decisions] ?? 0,
      reason:
        "Legacy Activity/Proposal/Decision-as-root modules must not be migrated as civic roots",
    },
  };
}

async function buildSide(dbName: string) {
  const counts = await inventoryDatabase(dbName);
  const authUsers = await listSafeAuthUsers(dbName);
  const members = await listSafeMembers(dbName);
  const profiles = await listSafeProfiles(dbName);
  const initiatives = await listSafeInitiatives(dbName);
  const legacyActivities = await listSafeLegacyActivities(dbName);
  const nonExampleAuthUsers = authUsers.filter(
    (user) => !String(user.emailMasked ?? "").endsWith("@example.com"),
  );
  return {
    database: dbName,
    counts,
    authUsers,
    nonExampleAuthUsers,
    members,
    profiles,
    initiatives,
    legacyActivities,
  };
}

async function main(): Promise<void> {
  assertDryRunOnly();

  if (!isMongoConfigured()) {
    throw new Error("MONGODB_URI is not configured in the local project environment.");
  }

  const configured = resolveMongoConfig();
  const sourceDb = parseArg("source") || "humanity_union_dev";
  const targetDb = parseArg("target") || "humanity_union_staging";
  const jsonOut =
    parseArg("json-out") ||
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../../architecture/recovery/STAGING_DATA_MIGRATION_MANIFEST_v1.0.json",
    );

  console.log("STAGING DATA MIGRATION PACK 01 — DRY RUN / READ ONLY");
  console.log(`configuredDefaultDatabase=${configured.database}`);
  console.log(`sourceDatabase=${sourceDb}`);
  console.log(`targetDatabase=${targetDb}`);
  console.log("mode=read-only");
  console.log("credentials=redacted");

  await connectMongoClient();
  const client = getMongoClient();

  let available: string[] = [];
  try {
    const listed = await client.db("admin").admin().listDatabases();
    available = listed.databases.map((db) => db.name).sort();
    console.log(`availableLogicalDatabases=${available.join(",")}`);
  } catch {
    console.log("availableLogicalDatabases=listDatabases_unavailable_trying_direct");
    available = [sourceDb, targetDb, configured.database].filter(
      (value, index, all) => all.indexOf(value) === index,
    );
  }

  async function canAccess(dbName: string): Promise<boolean> {
    if (available.includes(dbName) && available[0] !== sourceDb) {
      // When listDatabases succeeded and includes the name, trust it.
      if (available.includes("admin") || available.length > 0) {
        try {
          await client.db(dbName).listCollections({}, { nameOnly: true }).toArray();
          return true;
        } catch {
          return false;
        }
      }
    }
    try {
      await client.db(dbName).listCollections({}, { nameOnly: true }).toArray();
      return true;
    } catch {
      return false;
    }
  }

  const sourceAccessible = await canAccess(sourceDb);
  const targetAccessible = await canAccess(targetDb);

  if (!sourceAccessible) {
    console.log(`SOURCE_ACCESS=unavailable database=${sourceDb}`);
  }
  if (!targetAccessible) {
    console.log(`TARGET_ACCESS=unavailable database=${targetDb}`);
  }

  if (!sourceAccessible) {
    await disconnectMongoClient();
    throw new Error(
      `Historical source database "${sourceDb}" is not accessible with the current Mongo credentials.`,
    );
  }

  const source = await buildSide(sourceDb);
  const target = targetAccessible
    ? await buildSide(targetDb)
    : {
        database: targetDb,
        counts: {},
        authUsers: [],
        nonExampleAuthUsers: [],
        members: [],
        profiles: [],
        initiatives: [],
        legacyActivities: { count: 0, sample: [] as const },
        inaccessible: true as const,
      };

  const classification = targetAccessible
    ? classify(source, target as Awaited<ReturnType<typeof buildSide>>)
    : null;

  const manifest = {
    pack: "STAGING_DATA_MIGRATION_PACK_01",
    mode: "dry-run",
    generatedAt: new Date().toISOString(),
    source: {
      database: source.database,
      counts: source.counts,
      authUserCount: source.authUsers.length,
      nonExampleAuthUserCount: source.nonExampleAuthUsers.length,
      memberCount: source.members.length,
      profileCount: source.profiles.length,
      initiativeCount: source.initiatives.length,
      legacyActivities: source.legacyActivities,
      participants: source.authUsers.map((u) => ({
        userId: u.userId,
        memberId: u.memberId,
        displayName: u.displayName,
        role: u.role,
        status: u.status,
        emailMasked: u.emailMasked,
        emailFingerprint: u.emailFingerprint,
        referencedAsSteward: source.initiatives.some((i) => i.stewardId === u.memberId),
        likelyTestAccount: String(u.emailMasked ?? "").endsWith("@example.com"),
      })),
      nonExampleParticipants: source.nonExampleAuthUsers.map((u) => ({
        userId: u.userId,
        memberId: u.memberId,
        displayName: u.displayName,
        role: u.role,
        status: u.status,
        emailMasked: u.emailMasked,
        emailFingerprint: u.emailFingerprint,
        referencedAsSteward: source.initiatives.some((i) => i.stewardId === u.memberId),
      })),
      initiatives: source.initiatives,
    },
    target: targetAccessible
      ? {
          database: (target as Awaited<ReturnType<typeof buildSide>>).database,
          counts: (target as Awaited<ReturnType<typeof buildSide>>).counts,
          authUserCount: (target as Awaited<ReturnType<typeof buildSide>>).authUsers.length,
          nonExampleAuthUserCount: (target as Awaited<ReturnType<typeof buildSide>>)
            .nonExampleAuthUsers.length,
          memberCount: (target as Awaited<ReturnType<typeof buildSide>>).members.length,
          profileCount: (target as Awaited<ReturnType<typeof buildSide>>).profiles.length,
          initiativeCount: (target as Awaited<ReturnType<typeof buildSide>>).initiatives.length,
          legacyActivities: (target as Awaited<ReturnType<typeof buildSide>>).legacyActivities,
          participants: (target as Awaited<ReturnType<typeof buildSide>>).authUsers.map((u) => ({
            userId: u.userId,
            memberId: u.memberId,
            displayName: u.displayName,
            role: u.role,
            status: u.status,
            emailMasked: u.emailMasked,
            emailFingerprint: u.emailFingerprint,
          })),
          nonExampleParticipants: (target as Awaited<ReturnType<typeof buildSide>>).nonExampleAuthUsers.map(
            (u) => ({
              userId: u.userId,
              memberId: u.memberId,
              displayName: u.displayName,
              role: u.role,
              status: u.status,
              emailMasked: u.emailMasked,
              emailFingerprint: u.emailFingerprint,
            }),
          ),
          initiatives: (target as Awaited<ReturnType<typeof buildSide>>).initiatives,
        }
      : {
          database: targetDb,
          accessible: false,
        },
    duplicates: classification
      ? {
          participantIdCollisions: classification.participantIdCollisions,
          memberIdCollisions: classification.memberIdCollisions,
          emailCollisions: classification.emailCollisions,
          initiativeIdCollisions: classification.initiativeIdCollisions,
          duplicateParticipants: classification.duplicateParticipants,
          duplicateInitiatives: classification.duplicateInitiatives,
        }
      : null,
    transformations: [
      {
        entity: "auth_users",
        note: "Do not migrate passwordHash/session secrets; prefer invite-reset or re-verification for historical accounts",
      },
      {
        entity: "initiatives",
        note: "Preserve initiativeId and stewardId when steward Participant migrates or maps; exclude verification fixture titles",
      },
    ],
    integrityIssues: classification
      ? {
          initiativesMissingStewardCount: classification.initiativesMissingStewardCount,
          initiativesMissingStewardIds: classification.initiativesMissingStewardIds,
          adminEmailCollisionCount: classification.adminEmailCollisionCount,
          stagingAdminCount: classification.stagingAdminCount,
        }
      : { targetInaccessible: true },
    excludedLegacyRecords: classification?.legacyExcluded ?? null,
    participants: {
      safeToMigrate: classification?.safeParticipants ?? [],
      duplicates: classification?.duplicateParticipants ?? [],
    },
    initiatives: {
      safeToMigrate: classification?.safeInitiatives ?? [],
      duplicates: classification?.duplicateInitiatives ?? [],
    },
    relatedArtifacts: {
      note: "Related counts are attached per Initiative under source.initiatives[].relatedCounts",
    },
    confirmation:
      "NO DATA WAS WRITTEN, UPDATED, DELETED, OR MIGRATED BY THIS DRY-RUN INSPECTION.",
  };

  fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
  fs.writeFileSync(jsonOut, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`manifestWritten=${jsonOut}`);
  console.log(
    JSON.stringify(
      {
        sourceAuthUsers: source.authUsers.length,
        sourceInitiatives: source.initiatives.length,
        targetAuthUsers: targetAccessible
          ? (target as Awaited<ReturnType<typeof buildSide>>).authUsers.length
          : null,
        targetInitiatives: targetAccessible
          ? (target as Awaited<ReturnType<typeof buildSide>>).initiatives.length
          : null,
        participantIdCollisions: classification?.participantIdCollisions ?? null,
        initiativeIdCollisions: classification?.initiativeIdCollisions ?? null,
      },
      null,
      2,
    ),
  );

  await disconnectMongoClient();
}

const { runVerificationScript } = await import("./verification-script-lifecycle.js");
void runVerificationScript(main);
