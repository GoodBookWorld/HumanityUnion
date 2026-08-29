import type { ClientSession, Db, Document, MongoClient } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { prepareStewardDocuments } from "./build-documents.js";
import { assertNoBootstrapCollisions } from "./collisions.js";
import { ProductionStewardBootstrapError } from "./errors.js";
import { assertBootstrapTargetDatabase, resolveBootstrapMode } from "./guards.js";
import type {
  BootstrapMode,
  SourceStewardIdentity,
  StewardBootstrapPlanRow,
  StewardBootstrapResult,
  StewardPreparedDocuments,
} from "./types.js";

export interface RunProductionStewardBootstrapInput {
  client: MongoClient;
  databaseName: string;
  identities: SourceStewardIdentity[];
  /** When true with confirm YES, writes. Otherwise dry-run. */
  execute: boolean;
  confirm?: string;
  /** Test-only: allow hu_test_* database names. */
  allowTestIsolation?: boolean;
  /** Force non-transaction path (tests). */
  forceNonTransactional?: boolean;
}

async function insertPreparedDocuments(
  db: Db,
  prepared: StewardPreparedDocuments[],
  session?: ClientSession,
): Promise<void> {
  const options = session ? { session } : undefined;
  // Order: auth_users → members → member_profiles
  for (const steward of prepared) {
    await db.collection(MONGO_COLLECTIONS.authUsers).insertOne(steward.auth as Document, options);
  }
  for (const steward of prepared) {
    await db.collection(MONGO_COLLECTIONS.members).insertOne(steward.member as Document, options);
  }
  for (const steward of prepared) {
    await db
      .collection(MONGO_COLLECTIONS.memberProfiles)
      .insertOne(steward.profile as Document, options);
  }
}

async function compensatingRollback(
  db: Db,
  prepared: StewardPreparedDocuments[],
): Promise<void> {
  const memberIds = prepared.map((row) => row.memberId);
  const userIds = prepared.map((row) => row.userId);
  const profileIds = prepared.map((row) => row.profileId);

  await db.collection(MONGO_COLLECTIONS.memberProfiles).deleteMany({
    $or: [{ profileId: { $in: profileIds } }, { userId: { $in: userIds } }],
  });
  await db.collection(MONGO_COLLECTIONS.members).deleteMany({
    $or: [{ memberId: { $in: memberIds } }, { identityId: { $in: userIds } }],
  });
  await db.collection(MONGO_COLLECTIONS.authUsers).deleteMany({
    $or: [{ memberId: { $in: memberIds } }, { userId: { $in: userIds } }],
  });
}

function toPlanRows(
  prepared: StewardPreparedDocuments[],
  operation: StewardBootstrapPlanRow["operation"],
): StewardBootstrapPlanRow[] {
  return prepared.map((steward) => ({
    label: steward.label,
    memberId: steward.memberId,
    userId: steward.userId,
    profileId: steward.profileId,
    emailMasked: steward.emailMasked,
    publicName: steward.publicName,
    uniqueName: steward.uniqueName,
    operation,
  }));
}

export function buildSafeBootstrapLog(result: StewardBootstrapResult): Record<string, unknown> {
  return {
    mode: result.mode,
    database: result.database,
    transactionUsed: result.transactionUsed,
    rollbackPerformed: result.rollbackPerformed,
    written: result.written,
    sessionsWritten: result.sessionsWritten,
    tokensWritten: result.tokensWritten,
    stewards: result.stewards.map((steward) => ({
      label: steward.label,
      memberId: steward.memberId,
      userId: steward.userId,
      profileId: steward.profileId,
      emailMasked: steward.emailMasked,
      publicName: steward.publicName,
      uniqueName: steward.uniqueName,
      operation: steward.operation,
    })),
  };
}

export async function runProductionStewardBootstrap(
  input: RunProductionStewardBootstrapInput,
): Promise<StewardBootstrapResult> {
  const databaseName = assertBootstrapTargetDatabase(input.databaseName, {
    allowTestIsolation: input.allowTestIsolation,
  });

  const mode: BootstrapMode = resolveBootstrapMode({
    execute: input.execute,
    confirm: input.confirm,
  });

  if (input.execute && mode === "dry-run") {
    throw new ProductionStewardBootstrapError(
      "Refusing write: confirmation flag missing. Dry-run only.",
      "MISSING_CONFIRMATION",
    );
  }

  const prepared = await prepareStewardDocuments(input.identities);
  const db = input.client.db(databaseName);

  await assertNoBootstrapCollisions(db, prepared);

  if (mode === "dry-run") {
    return {
      mode: "dry-run",
      database: databaseName,
      transactionUsed: false,
      rollbackPerformed: false,
      stewards: toPlanRows(prepared, "would_create"),
      written: { authUsers: 0, members: 0, memberProfiles: 0 },
      sessionsWritten: 0,
      tokensWritten: 0,
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

      // Fallback: sequential inserts with compensating delete on failure.
      try {
        await insertPreparedDocuments(db, prepared);
      } catch (writeError) {
        await compensatingRollback(db, prepared);
        rollbackPerformed = true;
        throw new ProductionStewardBootstrapError(
          `Bootstrap write failed and compensating rollback ran: ${
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
      throw new ProductionStewardBootstrapError(
        `Bootstrap write failed and compensating rollback ran: ${
          writeError instanceof Error ? writeError.message : String(writeError)
        }`,
        "WRITE_FAILED_ROLLED_BACK",
      );
    }
  }

  // Defense: never write sessions/tokens in this tool.
  const sessionsWritten = 0;
  const tokensWritten = 0;

  return {
    mode: "execute",
    database: databaseName,
    transactionUsed,
    rollbackPerformed,
    stewards: toPlanRows(prepared, "created"),
    written: {
      authUsers: prepared.length,
      members: prepared.length,
      memberProfiles: prepared.length,
    },
    sessionsWritten,
    tokensWritten,
  };
}
