import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import type { WorkspaceProjectionRecord, WorkspaceRecentActivityCard } from "../domain/workspace-projection.types.js";
import { WorkspaceProjectionNotReadyError, WorkspaceProjectionOrderingNotReadyError, WorkspaceQueryUnavailableError } from "../workspace.errors.js";
import {
  fromWorkspaceProjectionMongoDocument,
  prependRecentActivityCard,
  toWorkspaceProjectionMongoDocument,
  type WorkspaceProjectionMongoDocument,
} from "./workspace-projection.persistence.js";

let forceInsertFailureForTests = false;
let forceActivityUpdateFailureForTests = false;
let forceDiscussionUpdateFailureForTests = false;
let forceProposalUpdateFailureForTests = false;
let forceProposalSubmissionUpdateFailureForTests = false;
let forceDecisionUpdateFailureForTests = false;

export function setForceWorkspaceProjectionInsertFailureForTests(enabled: boolean): void {
  forceInsertFailureForTests = enabled;
}

export function setForceWorkspaceActivityUpdateFailureForTests(enabled: boolean): void {
  forceActivityUpdateFailureForTests = enabled;
}

export function setForceWorkspaceDiscussionUpdateFailureForTests(enabled: boolean): void {
  forceDiscussionUpdateFailureForTests = enabled;
}

export function setForceWorkspaceProposalUpdateFailureForTests(enabled: boolean): void {
  forceProposalUpdateFailureForTests = enabled;
}

export function setForceWorkspaceProposalSubmissionUpdateFailureForTests(enabled: boolean): void {
  forceProposalSubmissionUpdateFailureForTests = enabled;
}

export function setForceWorkspaceDecisionUpdateFailureForTests(enabled: boolean): void {
  forceDecisionUpdateFailureForTests = enabled;
}

async function ensureWorkspaceMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new WorkspaceQueryUnavailableError();
  }

  await connectMongoClient();
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

export type WorkspaceProjectionInsertOutcome = "created" | "idempotent_replay";

export async function insertWorkspaceProjectionIfAbsent(
  record: WorkspaceProjectionRecord,
): Promise<WorkspaceProjectionInsertOutcome> {
  await ensureWorkspaceMongoReady();

  if (forceInsertFailureForTests) {
    throw new Error("Forced workspace projection insert failure for tests.");
  }

  const collection = getMongoCollection<WorkspaceProjectionMongoDocument>(
    MONGO_COLLECTIONS.workspaceProjections,
  );

  try {
    await collection.insertOne(toWorkspaceProjectionMongoDocument(record));
    return "created";
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return "idempotent_replay";
    }

    throw error;
  }
}

export async function findWorkspaceProjectionByMemberId(
  memberId: string,
): Promise<WorkspaceProjectionRecord | null> {
  await ensureWorkspaceMongoReady();

  const collection = getMongoCollection<WorkspaceProjectionMongoDocument>(
    MONGO_COLLECTIONS.workspaceProjections,
  );
  const document = await collection.findOne({ memberId });

  return document ? fromWorkspaceProjectionMongoDocument(document) : null;
}

export async function findWorkspaceProjectionByWorkspaceId(
  workspaceId: string,
): Promise<WorkspaceProjectionRecord | null> {
  await ensureWorkspaceMongoReady();

  const collection = getMongoCollection<WorkspaceProjectionMongoDocument>(
    MONGO_COLLECTIONS.workspaceProjections,
  );
  const document = await collection.findOne({ workspaceId });

  return document ? fromWorkspaceProjectionMongoDocument(document) : null;
}

export async function countWorkspaceProjectionsByMemberId(memberId: string): Promise<number> {
  await ensureWorkspaceMongoReady();

  const collection = getMongoCollection<WorkspaceProjectionMongoDocument>(
    MONGO_COLLECTIONS.workspaceProjections,
  );

  return collection.countDocuments({ memberId });
}

export async function deleteWorkspaceProjectionByMemberId(memberId: string): Promise<boolean> {
  if (!isMongoConfigured()) {
    return false;
  }

  await connectMongoClient();
  const collection = getMongoCollection<WorkspaceProjectionMongoDocument>(
    MONGO_COLLECTIONS.workspaceProjections,
  );
  const result = await collection.deleteOne({ memberId });

  return (result.deletedCount ?? 0) > 0;
}

export async function deleteWorkspaceProjectionsByMemberIdPrefix(prefix: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const collection = getMongoCollection<WorkspaceProjectionMongoDocument>(
    MONGO_COLLECTIONS.workspaceProjections,
  );
  const result = await collection.deleteMany({ memberId: { $regex: `^${prefix}` } });

  return result.deletedCount ?? 0;
}

export type WorkspaceActivityProjectionOutcome = "updated" | "idempotent_replay";

export async function applyActivityCreatedToWorkspaceProjection(input: {
  memberId: string;
  card: WorkspaceRecentActivityCard;
  updatedAt: string;
}): Promise<WorkspaceActivityProjectionOutcome> {
  await ensureWorkspaceMongoReady();

  if (forceActivityUpdateFailureForTests) {
    throw new Error("Forced workspace activity projection update failure for tests.");
  }

  const collection = getMongoCollection<WorkspaceProjectionMongoDocument>(
    MONGO_COLLECTIONS.workspaceProjections,
  );
  const existing = await collection.findOne({ memberId: input.memberId });

  if (!existing) {
    throw new WorkspaceProjectionNotReadyError();
  }

  const record = fromWorkspaceProjectionMongoDocument(existing);

  if (record.recentActivities.some((entry) => entry.activityId === input.card.activityId)) {
    return "idempotent_replay";
  }

  const updatedRecentActivities = prependRecentActivityCard(record.recentActivities, input.card);
  const updatedParticipationSummary = {
    ...record.participationSummary,
    activeActivityCount: record.participationSummary.activeActivityCount + 1,
  };

  const updateResult = await collection.updateOne(
    {
      memberId: input.memberId,
      "recentActivities.activityId": { $ne: input.card.activityId },
    },
    {
      $set: {
        recentActivities: updatedRecentActivities,
        participationSummary: updatedParticipationSummary,
        updatedAt: input.updatedAt,
      },
    },
  );

  if ((updateResult.modifiedCount ?? 0) === 0) {
    return "idempotent_replay";
  }

  return "updated";
}

export type WorkspaceDiscussionProjectionOutcome = "updated" | "idempotent_replay";

export async function applyDiscussionCreatedToWorkspaceProjection(input: {
  memberId: string;
  card: WorkspaceRecentActivityCard;
  updatedAt: string;
}): Promise<WorkspaceDiscussionProjectionOutcome> {
  await ensureWorkspaceMongoReady();

  if (forceDiscussionUpdateFailureForTests) {
    throw new Error("Forced workspace discussion projection update failure for tests.");
  }

  const collection = getMongoCollection<WorkspaceProjectionMongoDocument>(
    MONGO_COLLECTIONS.workspaceProjections,
  );
  const existing = await collection.findOne({ memberId: input.memberId });

  if (!existing) {
    throw new WorkspaceProjectionNotReadyError();
  }

  const record = fromWorkspaceProjectionMongoDocument(existing);

  if (
    input.card.discussionId &&
    record.recentActivities.some((entry) => entry.discussionId === input.card.discussionId)
  ) {
    return "idempotent_replay";
  }

  const updatedRecentActivities = prependRecentActivityCard(record.recentActivities, input.card);

  const updateResult = await collection.updateOne(
    {
      memberId: input.memberId,
      ...(input.card.discussionId
        ? { "recentActivities.discussionId": { $ne: input.card.discussionId } }
        : {}),
    },
    {
      $set: {
        recentActivities: updatedRecentActivities,
        updatedAt: input.updatedAt,
      },
    },
  );

  if ((updateResult.modifiedCount ?? 0) === 0) {
    return "idempotent_replay";
  }

  return "updated";
}

export type WorkspaceProposalProjectionOutcome = "updated" | "idempotent_replay";

export async function applyProposalCreatedToWorkspaceProjection(input: {
  memberId: string;
  card: WorkspaceRecentActivityCard;
  updatedAt: string;
}): Promise<WorkspaceProposalProjectionOutcome> {
  await ensureWorkspaceMongoReady();

  if (forceProposalUpdateFailureForTests) {
    throw new Error("Forced workspace proposal projection update failure for tests.");
  }

  const collection = getMongoCollection<WorkspaceProjectionMongoDocument>(
    MONGO_COLLECTIONS.workspaceProjections,
  );
  const existing = await collection.findOne({ memberId: input.memberId });

  if (!existing) {
    throw new WorkspaceProjectionNotReadyError();
  }

  const record = fromWorkspaceProjectionMongoDocument(existing);

  if (
    input.card.proposalId &&
    record.recentActivities.some((entry) => entry.proposalId === input.card.proposalId)
  ) {
    return "idempotent_replay";
  }

  const updatedRecentActivities = prependRecentActivityCard(record.recentActivities, input.card);

  const updateResult = await collection.updateOne(
    {
      memberId: input.memberId,
      ...(input.card.proposalId
        ? { "recentActivities.proposalId": { $ne: input.card.proposalId } }
        : {}),
    },
    {
      $set: {
        recentActivities: updatedRecentActivities,
        updatedAt: input.updatedAt,
      },
    },
  );

  if ((updateResult.modifiedCount ?? 0) === 0) {
    return "idempotent_replay";
  }

  return "updated";
}

export type WorkspaceProposalSubmissionProjectionOutcome = "updated" | "idempotent_replay";

export async function applyProposalSubmittedToWorkspaceProjection(input: {
  memberId: string;
  proposalId: string;
  status: string;
  sourceEventId: string;
  transitionAt: string;
  workspaceUpdatedAt: string;
}): Promise<WorkspaceProposalSubmissionProjectionOutcome> {
  await ensureWorkspaceMongoReady();

  if (forceProposalSubmissionUpdateFailureForTests) {
    throw new Error("Forced workspace proposal submission projection update failure for tests.");
  }

  const collection = getMongoCollection<WorkspaceProjectionMongoDocument>(
    MONGO_COLLECTIONS.workspaceProjections,
  );
  const existing = await collection.findOne({ memberId: input.memberId });

  if (!existing) {
    throw new WorkspaceProjectionNotReadyError();
  }

  const record = fromWorkspaceProjectionMongoDocument(existing);
  const cardIndex = record.recentActivities.findIndex(
    (entry) => entry.proposalId === input.proposalId,
  );

  if (cardIndex < 0) {
    throw new WorkspaceProjectionOrderingNotReadyError();
  }

  const currentCard = record.recentActivities[cardIndex];

  if (!currentCard) {
    throw new WorkspaceProjectionOrderingNotReadyError();
  }

  if (
    currentCard.status === input.status &&
    currentCard.sourceEventId === input.sourceEventId
  ) {
    return "idempotent_replay";
  }

  if (currentCard.status === input.status) {
    return "idempotent_replay";
  }

  const updatedRecentActivities = [...record.recentActivities];
  updatedRecentActivities[cardIndex] = {
    ...currentCard,
    status: input.status,
    createdAt: input.transitionAt,
    sourceEventId: input.sourceEventId,
  };

  const updateResult = await collection.updateOne(
    {
      memberId: input.memberId,
      [`recentActivities.${cardIndex}.proposalId`]: input.proposalId,
      [`recentActivities.${cardIndex}.status`]: currentCard.status,
    },
    {
      $set: {
        recentActivities: updatedRecentActivities,
        updatedAt: input.workspaceUpdatedAt,
      },
    },
  );

  if ((updateResult.modifiedCount ?? 0) === 0) {
    const reloaded = await collection.findOne({ memberId: input.memberId });
    const reloadedRecord = reloaded ? fromWorkspaceProjectionMongoDocument(reloaded) : null;
    const reloadedCard = reloadedRecord?.recentActivities.find(
      (entry) => entry.proposalId === input.proposalId,
    );

    if (reloadedCard?.status === input.status) {
      return "idempotent_replay";
    }

    if (!reloadedRecord?.recentActivities.some((entry) => entry.proposalId === input.proposalId)) {
      throw new WorkspaceProjectionOrderingNotReadyError();
    }

    throw new WorkspaceProjectionOrderingNotReadyError();
  }

  return "updated";
}

export type WorkspaceDecisionProjectionOutcome = "updated" | "idempotent_replay";

export async function applyDecisionOpenedToWorkspaceProjection(input: {
  memberId: string;
  card: WorkspaceRecentActivityCard;
  updatedAt: string;
}): Promise<WorkspaceDecisionProjectionOutcome> {
  await ensureWorkspaceMongoReady();

  if (forceDecisionUpdateFailureForTests) {
    throw new Error("Forced workspace decision projection update failure for tests.");
  }

  const collection = getMongoCollection<WorkspaceProjectionMongoDocument>(
    MONGO_COLLECTIONS.workspaceProjections,
  );
  const existing = await collection.findOne({ memberId: input.memberId });

  if (!existing) {
    throw new WorkspaceProjectionNotReadyError();
  }

  const record = fromWorkspaceProjectionMongoDocument(existing);

  if (
    input.card.decisionId &&
    record.recentActivities.some((entry) => entry.decisionId === input.card.decisionId)
  ) {
    return "idempotent_replay";
  }

  const updatedRecentActivities = prependRecentActivityCard(record.recentActivities, input.card);

  const updateResult = await collection.updateOne(
    {
      memberId: input.memberId,
      ...(input.card.decisionId
        ? { "recentActivities.decisionId": { $ne: input.card.decisionId } }
        : {}),
    },
    {
      $set: {
        recentActivities: updatedRecentActivities,
        updatedAt: input.updatedAt,
      },
    },
  );

  if ((updateResult.modifiedCount ?? 0) === 0) {
    return "idempotent_replay";
  }

  return "updated";
}
