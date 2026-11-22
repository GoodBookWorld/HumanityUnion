import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { findActiveSuspensionsByParticipantIds } from "../participant-suspension/participant-suspension.repository.js";
import type {
  PrivacyPolicyNoticeAccount,
  PrivacyPolicyNoticeAccountPage,
} from "./privacy-policy-notice.js";

interface PrivacyNoticeAuthDocument {
  userId?: string;
  memberId?: string;
  role?: "member" | "admin";
  status?: "active" | "disabled";
  createdAt?: string;
  accountDeletion?: { phase?: PrivacyPolicyNoticeAccount["deletionPhase"] };
}

export function buildPrivacyPolicyNoticeAccountFilter(input: {
  afterUserId: string | null;
  createdBefore: string;
}): Record<string, unknown> {
  return {
    createdAt: { $type: "string", $lt: input.createdBefore },
    ...(input.afterUserId ? { userId: { $gt: input.afterUserId } } : {}),
  };
}

export function toPrivacyPolicyNoticeAccount(
  document: PrivacyNoticeAuthDocument,
  suspensionActive: boolean,
): PrivacyPolicyNoticeAccount | null {
  if (
    !document.userId ||
    !document.memberId ||
    (document.role !== "member" && document.role !== "admin") ||
    (document.status !== "active" && document.status !== "disabled") ||
    !document.createdAt
  ) {
    return null;
  }

  return {
    userId: document.userId,
    memberId: document.memberId,
    role: document.role,
    status: document.status,
    createdAt: document.createdAt,
    ...(document.accountDeletion?.phase ? { deletionPhase: document.accountDeletion.phase } : {}),
    suspensionActive,
  };
}

/**
 * One bounded page of auth accounts, ordered by stable userId.
 * Email and password fields are not requested or returned.
 */
export async function listPrivacyPolicyNoticeAccountPage(input: {
  afterUserId: string | null;
  limit: number;
  createdBefore: string;
}): Promise<PrivacyPolicyNoticeAccountPage> {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is required to select Privacy Policy notice recipients.");
  }

  await connectMongoClient();
  const collection = getMongoCollection<PrivacyNoticeAuthDocument>(MONGO_COLLECTIONS.authUsers);
  const documents = await collection
    .find(buildPrivacyPolicyNoticeAccountFilter(input), {
      projection: {
        userId: 1,
        memberId: 1,
        role: 1,
        status: 1,
        createdAt: 1,
        "accountDeletion.phase": 1,
      },
    })
    .sort({ userId: 1 })
    .limit(input.limit)
    .toArray();

  const disabledMemberIds = documents
    .filter((document) => document.status === "disabled" && document.memberId)
    .map((document) => document.memberId as string);
  const suspensions = await findActiveSuspensionsByParticipantIds(disabledMemberIds);

  const accounts: PrivacyPolicyNoticeAccount[] = [];
  for (const document of documents) {
    const account = toPrivacyPolicyNoticeAccount(
      document,
      Boolean(document.memberId && suspensions.has(document.memberId)),
    );
    if (account) {
      accounts.push(account);
    }
  }

  return {
    accounts,
    hasMore: documents.length === input.limit,
  };
}
