import type { ClientSession, Db, Document, MongoClient } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { prepareAdminDocuments } from "./build-documents.js";
import { assertNoAdminBootstrapCollisions } from "./collisions.js";
import {
  APPROVED_PRODUCTION_ADMIN,
  PROTECTED_PRODUCTION_STEWARD_IDS,
} from "./constants.js";
import { ProductionAdminBootstrapError } from "./errors.js";
import {
  assertAdminBootstrapTargetDatabase,
  resolveAdminBootstrapMode,
} from "./guards.js";
import type {
  AdminBootstrapMode,
  AdminBootstrapPlanRow,
  AdminBootstrapResult,
  AdminPreparedDocuments,
  SourceAdminIdentity,
} from "./types.js";

export interface RunProductionAdminBootstrapInput {
  client: MongoClient;
  databaseName: string;
  identity: SourceAdminIdentity;
  execute: boolean;
  confirm?: string;
  adminConfirm?: string;
  allowTestIsolation?: boolean;
  forceNonTransactional?: boolean;
}

async function insertPreparedDocuments(
  db: Db,
  prepared: AdminPreparedDocuments,
  session?: ClientSession,
): Promise<void> {
  const options = session ? { session } : undefined;
  await db.collection(MONGO_COLLECTIONS.authUsers).insertOne(prepared.auth as Document, options);
  await db.collection(MONGO_COLLECTIONS.members).insertOne(prepared.member as Document, options);
  await db
    .collection(MONGO_COLLECTIONS.memberProfiles)
    .insertOne(prepared.profile as Document, options);
}

async function compensatingRollback(db: Db, prepared: AdminPreparedDocuments): Promise<void> {
  await db.collection(MONGO_COLLECTIONS.memberProfiles).deleteMany({
    $or: [{ profileId: prepared.profileId }, { userId: prepared.userId }],
  });
  await db.collection(MONGO_COLLECTIONS.members).deleteMany({
    $or: [{ memberId: prepared.memberId }, { identityId: prepared.userId }],
  });
  await db.collection(MONGO_COLLECTIONS.authUsers).deleteMany({
    $or: [{ memberId: prepared.memberId }, { userId: prepared.userId }],
  });
}

function toPlanRow(
  prepared: AdminPreparedDocuments,
  operation: AdminBootstrapPlanRow["operation"],
): AdminBootstrapPlanRow {
  return {
    label: prepared.label,
    memberId: prepared.memberId,
    userId: prepared.userId,
    profileId: prepared.profileId,
    emailMasked: prepared.emailMasked,
    publicName: prepared.publicName,
    uniqueName: prepared.uniqueName,
    authRole: "admin",
    memberRoles: ["member"],
    operation,
  };
}

async function snapshotProtectedStewards(db: Db): Promise<Map<string, string>> {
  const memberIds = PROTECTED_PRODUCTION_STEWARD_IDS.map((row) => row.memberId);
  const [auths, members] = await Promise.all([
    db
      .collection(MONGO_COLLECTIONS.authUsers)
      .find(
        { memberId: { $in: memberIds } },
        { projection: { memberId: 1, userId: 1, role: 1, status: 1, email: 1, updatedAt: 1 } },
      )
      .toArray(),
    db
      .collection(MONGO_COLLECTIONS.members)
      .find(
        { memberId: { $in: memberIds } },
        {
          projection: {
            memberId: 1,
            identityId: 1,
            uniqueName: 1,
            roles: 1,
            status: 1,
            updatedAt: 1,
          },
        },
      )
      .toArray(),
  ]);

  const map = new Map<string, string>();
  for (const doc of auths) {
    map.set(
      `auth:${String(doc.memberId)}`,
      JSON.stringify({
        userId: doc.userId,
        role: doc.role,
        status: doc.status,
        email: doc.email,
        updatedAt: doc.updatedAt,
      }),
    );
  }
  for (const doc of members) {
    map.set(
      `member:${String(doc.memberId)}`,
      JSON.stringify({
        identityId: doc.identityId,
        uniqueName: doc.uniqueName,
        roles: doc.roles,
        status: doc.status,
        updatedAt: doc.updatedAt,
      }),
    );
  }
  for (const steward of PROTECTED_PRODUCTION_STEWARD_IDS) {
    if (!map.has(`auth:${steward.memberId}`)) {
      map.set(`auth:${steward.memberId}`, "__absent__");
    }
    if (!map.has(`member:${steward.memberId}`)) {
      map.set(`member:${steward.memberId}`, "__absent__");
    }
  }
  return map;
}

async function assertProtectedStewardsUntouched(
  db: Db,
  before: Map<string, string>,
): Promise<boolean> {
  const after = await snapshotProtectedStewards(db);
  if (before.size !== after.size) {
    return false;
  }
  for (const [key, value] of before) {
    if (after.get(key) !== value) {
      return false;
    }
  }
  return true;
}

export function buildSafeAdminBootstrapLog(
  result: AdminBootstrapResult,
): Record<string, unknown> {
  return {
    mode: result.mode,
    database: result.database,
    transactionUsed: result.transactionUsed,
    rollbackPerformed: result.rollbackPerformed,
    written: result.written,
    sessionsWritten: result.sessionsWritten,
    tokensWritten: result.tokensWritten,
    protectedStewardsUntouched: result.protectedStewardsUntouched,
    admin: {
      label: result.admin.label,
      memberId: result.admin.memberId,
      userId: result.admin.userId,
      profileId: result.admin.profileId,
      emailMasked: result.admin.emailMasked,
      publicName: result.admin.publicName,
      uniqueName: result.admin.uniqueName,
      authRole: result.admin.authRole,
      memberRoles: result.admin.memberRoles,
      operation: result.admin.operation,
    },
  };
}

export async function runProductionAdminBootstrap(
  input: RunProductionAdminBootstrapInput,
): Promise<AdminBootstrapResult> {
  const databaseName = assertAdminBootstrapTargetDatabase(input.databaseName, {
    allowTestIsolation: input.allowTestIsolation,
  });

  if (input.identity.memberId !== APPROVED_PRODUCTION_ADMIN.memberId) {
    throw new ProductionAdminBootstrapError(
      "Refuse Admin bootstrap: identity is not the hard allow-listed Volody memberId.",
      "ADMIN_ALLOWLIST_MISMATCH",
    );
  }
  if (input.identity.authRole !== "admin") {
    throw new ProductionAdminBootstrapError(
      "Refuse Admin bootstrap: authRole must be explicitly admin.",
      "INVALID_ADMIN_ROLE",
    );
  }

  const mode: AdminBootstrapMode = resolveAdminBootstrapMode({
    execute: input.execute,
    confirm: input.confirm,
    adminConfirm: input.adminConfirm,
  });

  if (input.execute && mode === "dry-run") {
    if (input.confirm !== "YES") {
      throw new ProductionAdminBootstrapError(
        "Refusing write: production steward confirmation flag missing. Dry-run only.",
        "MISSING_CONFIRMATION",
      );
    }
    throw new ProductionAdminBootstrapError(
      "Refusing Admin write: PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM=YES required.",
      "MISSING_ADMIN_CONFIRMATION",
    );
  }

  const prepared = await prepareAdminDocuments(input.identity);
  if (prepared.auth.role !== "admin") {
    throw new ProductionAdminBootstrapError(
      "Refuse write: prepared auth role is not admin.",
      "INVALID_ADMIN_ROLE",
    );
  }
  if (prepared.member.roles.length !== 1 || prepared.member.roles[0] !== "member") {
    throw new ProductionAdminBootstrapError(
      "Refuse write: members.roles must remain exactly [member].",
      "INVALID_MEMBER_ROLES",
    );
  }

  const db = input.client.db(databaseName);
  const stewardSnapshot = await snapshotProtectedStewards(db);

  await assertNoAdminBootstrapCollisions(db, prepared);

  if (mode === "dry-run") {
    const protectedStewardsUntouched = await assertProtectedStewardsUntouched(db, stewardSnapshot);
    return {
      mode: "dry-run",
      database: databaseName,
      transactionUsed: false,
      rollbackPerformed: false,
      admin: toPlanRow(prepared, "would_create"),
      written: { authUsers: 0, members: 0, memberProfiles: 0, memberships: 0 },
      sessionsWritten: 0,
      tokensWritten: 0,
      protectedStewardsUntouched,
    };
  }

  let transactionUsed = false;
  let rollbackPerformed = false;

  if (!input.forceNonTransactional) {
    const session = input.client.startSession();
    try {
      await session.withTransaction(async () => {
        await insertPreparedDocuments(db, prepared, session);
      });
      transactionUsed = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const looksLikeTransactionUnsupported =
        /Transactions? are not supported|Transaction numbers are only allowed on a replica set member|IllegalOperation.*[Tt]ransaction/i.test(
          message,
        );

      if (!looksLikeTransactionUnsupported) {
        throw error;
      }

      try {
        await insertPreparedDocuments(db, prepared);
      } catch (writeError) {
        await compensatingRollback(db, prepared);
        rollbackPerformed = true;
        throw new ProductionAdminBootstrapError(
          `Admin bootstrap write failed and compensating rollback ran: ${
            writeError instanceof Error ? writeError.message : String(writeError)
          }`,
          "WRITE_FAILED_ROLLED_BACK",
        );
      }
    } finally {
      await session.endSession();
    }
  } else {
    try {
      await insertPreparedDocuments(db, prepared);
    } catch (writeError) {
      await compensatingRollback(db, prepared);
      rollbackPerformed = true;
      throw new ProductionAdminBootstrapError(
        `Admin bootstrap write failed and compensating rollback ran: ${
          writeError instanceof Error ? writeError.message : String(writeError)
        }`,
        "WRITE_FAILED_ROLLED_BACK",
      );
    }
  }

  // Explicitly never create memberships / sessions / tokens in this tool.
  const protectedStewardsUntouched = await assertProtectedStewardsUntouched(db, stewardSnapshot);
  if (!protectedStewardsUntouched) {
    throw new ProductionAdminBootstrapError(
      "Post-write check failed: protected steward identities changed during Admin bootstrap.",
      "PROTECTED_STEWARD_MUTATED",
    );
  }

  return {
    mode: "execute",
    database: databaseName,
    transactionUsed,
    rollbackPerformed,
    admin: toPlanRow(prepared, "created"),
    written: {
      authUsers: 1,
      members: 1,
      memberProfiles: 1,
      memberships: 0,
    },
    sessionsWritten: 0,
    tokensWritten: 0,
    protectedStewardsUntouched: true,
  };
}
