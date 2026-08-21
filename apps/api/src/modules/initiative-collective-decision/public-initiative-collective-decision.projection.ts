import type {
  InitiativeCollectiveDecision,
  InitiativeCollectiveDecisionMetrics,
  PublicInitiativeCollectiveDecisionListItem,
  PublicInitiativeCollectiveDecisionProjection,
} from "@hu/types";
import {
  computePublicChoiceResultsExpireAt,
  createEmptyInitiativeCollectiveDecisionStatistics,
  isPublicChoiceResultsDownloadAvailable,
  resolveInitiativeLifecycleProfile,
  resolvePublicChoiceBallotMode,
  resolvePublicChoiceResultsRetentionStatus,
  resolvePublicChoiceVotingCloseAt,
} from "@hu/types";

import { getMemberById } from "../member/member-access.js";
import { computeInitiativeDecisionVoteAggregates } from "../initiative-decision-vote/initiative-decision-vote-aggregates.js";
import { computePublicChoiceBallotAggregatesForDecision } from "../initiative-decision-vote/initiative-decision-vote.service.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { findPublicChoiceResultsSnapshotByDecision } from "../public-choice-results-retention/public-choice-results-snapshot.repository.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { buildPublicCollectiveDecisionResults } from "./initiative-collective-decision-results.js";
import {
  getDecisionById,
  listDecisionsByInitiative,
  listPublicDecisionsByInitiative,
} from "./initiative-collective-decision.store.js";

const PUBLIC_STATUSES = new Set<InitiativeCollectiveDecision["status"]>([
  "opened",
  "closed",
  "cancelled",
]);

async function resolveStewardDisplayName(stewardId: string): Promise<string> {
  const member = await getMemberById(stewardId);

  return member?.profile.displayName ?? "Unknown Steward";
}

function toPublicStatus(
  status: InitiativeCollectiveDecision["status"],
): PublicInitiativeCollectiveDecisionProjection["status"] {
  if (!PUBLIC_STATUSES.has(status)) {
    throw new Error("Collective decision status is not publicly visible.");
  }

  return status as PublicInitiativeCollectiveDecisionProjection["status"];
}

function isVotingWindowOpen(decision: InitiativeCollectiveDecision, nowIso: string): boolean {
  if (decision.status !== "opened" || !decision.openedAt) {
    return false;
  }
  const now = Date.parse(nowIso);
  const opened = Date.parse(decision.openedAt);
  const closes = Date.parse(decision.closesAt);
  return !Number.isNaN(now) && !Number.isNaN(opened) && !Number.isNaN(closes) && opened <= now && closes >= now;
}

async function buildPublicChoiceBallotFields(decision: InitiativeCollectiveDecision) {
  const initiative = getInitiativeById(decision.initiativeId);
  if (
    !initiative ||
    resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) !== "PUBLIC_CHOICE"
  ) {
    return {};
  }

  const nowIso = new Date().toISOString();
  const votingOpen = isVotingWindowOpen(decision, nowIso);
  const votingCloseAt = resolvePublicChoiceVotingCloseAt({
    status: decision.status,
    closedAt: decision.closedAt,
    closesAt: decision.closesAt,
    nowIso,
  });
  const resultsExpiredAt = initiative.metadata.publicChoiceResultsExpiredAt;
  const retentionStatus = resolvePublicChoiceResultsRetentionStatus({
    lifecycleProfile: initiative.lifecycleProfile,
    votingOpen,
    votingCloseAt,
    resultsExpiredAt,
    hasElectionData: Boolean(votingCloseAt) || decision.status === "opened",
    nowIso,
  });

  const expiresAt =
    votingCloseAt && !resultsExpiredAt
      ? initiative.metadata.publicChoiceResultsExpireAt ??
        computePublicChoiceResultsExpireAt(votingCloseAt)
      : undefined;

  const resultsRetention = {
    status: retentionStatus,
    downloadAvailable: isPublicChoiceResultsDownloadAvailable({
      votingOpen,
      votingCloseAt,
      resultsExpiredAt,
      nowIso,
    }),
    votingCloseAt: votingCloseAt ?? undefined,
    expiresAt,
    resultsExpiredAt: resultsExpiredAt ?? undefined,
  };

  // After retention purge / policy expiry: do not reconstruct deleted tallies.
  if (retentionStatus === "results_expired") {
    const ballotMode = resolvePublicChoiceBallotMode(initiative.metadata.ballotMode);
    return { ballotMode, resultsRetention };
  }

  // Prefer frozen Final Results snapshot during retention window when available.
  if (
    !votingOpen &&
    votingCloseAt &&
    isMongoConfigured() &&
    retentionStatus === "results_available"
  ) {
    try {
      const snapshot = await findPublicChoiceResultsSnapshotByDecision(decision.decisionId);
      if (snapshot) {
        return {
          ballotMode: snapshot.ballotMode,
          ballotAggregates: snapshot.ballotAggregates,
          resultsRetention,
        };
      }
    } catch {
      // Fall through to live aggregates.
    }
  }

  const ballotMode = resolvePublicChoiceBallotMode(initiative.metadata.ballotMode);
  const ballotAggregates = await computePublicChoiceBallotAggregatesForDecision(
    decision.decisionId,
    initiative,
  );

  return { ballotMode, ballotAggregates, resultsRetention };
}

async function buildPublicResultFields(decision: InitiativeCollectiveDecision) {
  const publicChoiceFields = await buildPublicChoiceBallotFields(decision);
  const retentionStatus = publicChoiceFields.resultsRetention?.status;

  if (retentionStatus === "results_expired") {
    return {
      statistics: createEmptyInitiativeCollectiveDecisionStatistics(),
      outcome: null,
      participationConfidenceLevel: "insufficient" as const,
      outcomeSummary: "Results no longer available.",
      transparencyNote:
        "The temporary Public Choice results retention period has ended.",
      ...publicChoiceFields,
    };
  }

  const results = await buildPublicCollectiveDecisionResults(decision);

  return {
    statistics: results.statistics,
    outcome:
      decision.status === "opened" ||
      decision.status === "closed" ||
      decision.status === "cancelled"
        ? results.outcome
        : null,
    participationConfidenceLevel: results.participationConfidenceLevel,
    outcomeSummary: results.outcomeSummary,
    transparencyNote: results.transparencyNote,
    ...publicChoiceFields,
  };
}

export async function toPublicInitiativeCollectiveDecisionListItem(
  decision: InitiativeCollectiveDecision,
): Promise<PublicInitiativeCollectiveDecisionListItem> {
  return {
    decisionId: decision.decisionId,
    sequenceNumber: decision.sequenceNumber,
    status: toPublicStatus(decision.status),
    question: decision.question,
    participationScope: decision.participationScope,
    openedAt: decision.openedAt,
    closesAt: decision.closesAt,
    closedAt: decision.closedAt,
    ...(await buildPublicResultFields(decision)),
  };
}

export async function toPublicInitiativeCollectiveDecisionProjection(
  decision: InitiativeCollectiveDecision,
): Promise<PublicInitiativeCollectiveDecisionProjection> {
  return {
    decisionId: decision.decisionId,
    initiativeId: decision.initiativeId,
    decisionSessionId: decision.decisionSessionId,
    sequenceNumber: decision.sequenceNumber,
    participationScope: decision.participationScope,
    status: toPublicStatus(decision.status),
    question: decision.question,
    openedAt: decision.openedAt,
    closesAt: decision.closesAt,
    closedAt: decision.closedAt,
    cancelledAt: decision.cancelledAt,
    supersedesDecisionId: decision.supersedesDecisionId,
    stewardDisplayName: await resolveStewardDisplayName(decision.stewardId),
    structuredContent: decision.structuredContent ?? null,
    traceability: decision.traceability ?? null,
    ...(await buildPublicResultFields(decision)),
  };
}

export function computeInitiativeCollectiveDecisionMetrics(
  initiativeId: string,
): InitiativeCollectiveDecisionMetrics {
  const decisions = listDecisionsByInitiative(initiativeId);

  return {
    decisionCount: decisions.length,
    openedCount: decisions.filter((decision) => decision.status === "opened").length,
    closedCount: decisions.filter((decision) => decision.status === "closed").length,
    cancelledCount: decisions.filter((decision) => decision.status === "cancelled").length,
  };
}

export async function listPublicInitiativeCollectiveDecisionsForInitiative(
  initiativeId: string,
): Promise<PublicInitiativeCollectiveDecisionListItem[]> {
  // Fix 06 — existing PUBLIC_CHOICE elections missing a voting decision get one lazily.
  const { ensurePublicChoiceElectionVotingDecision } = await import(
    "./ensure-public-choice-election-decision.js"
  );
  ensurePublicChoiceElectionVotingDecision(initiativeId);

  return Promise.all(
    listPublicDecisionsByInitiative(initiativeId).map((decision) =>
      toPublicInitiativeCollectiveDecisionListItem(decision),
    ),
  );
}

export async function getPublicInitiativeCollectiveDecision(
  decisionId: string,
): Promise<PublicInitiativeCollectiveDecisionProjection | null> {
  const decision = getDecisionById(decisionId);

  if (!decision || !PUBLIC_STATUSES.has(decision.status)) {
    return null;
  }

  return toPublicInitiativeCollectiveDecisionProjection(decision);
}

export function assertPublicProjectionHasNoPrivateVoteData(
  projection: PublicInitiativeCollectiveDecisionProjection,
): boolean {
  const serialized = JSON.stringify(projection);

  return (
    !serialized.includes('"participantId"') &&
    !serialized.includes('"voteId"') &&
    !serialized.includes('"ipAddress"') &&
    !serialized.includes('"voteHistory"')
  );
}

export { computeInitiativeDecisionVoteAggregates };
