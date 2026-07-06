import type {
  InitiativeCollectiveDecision,
  InitiativeCollectiveDecisionMetrics,
  PublicInitiativeCollectiveDecisionListItem,
  PublicInitiativeCollectiveDecisionProjection,
} from "@hu/types";
import {
  createEmptyInitiativeCollectiveDecisionOutcome,
  createEmptyInitiativeCollectiveDecisionStatistics,
} from "@hu/types";

import { getMemberById } from "../member/member.store.js";
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

function resolveStewardDisplayName(stewardId: string): string {
  const member = getMemberById(stewardId);

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

function buildEmptyOutcome(
  decision: InitiativeCollectiveDecision,
): PublicInitiativeCollectiveDecisionProjection["outcome"] {
  if (decision.status === "cancelled") {
    return createEmptyInitiativeCollectiveDecisionOutcome("cancelled");
  }

  if (decision.status === "closed") {
    return createEmptyInitiativeCollectiveDecisionOutcome("inconclusive");
  }

  return null;
}

export function toPublicInitiativeCollectiveDecisionListItem(
  decision: InitiativeCollectiveDecision,
): PublicInitiativeCollectiveDecisionListItem {
  return {
    decisionId: decision.decisionId,
    sequenceNumber: decision.sequenceNumber,
    status: toPublicStatus(decision.status),
    question: decision.question,
    participationScope: decision.participationScope,
    openedAt: decision.openedAt,
    closesAt: decision.closesAt,
    closedAt: decision.closedAt,
  };
}

export function toPublicInitiativeCollectiveDecisionProjection(
  decision: InitiativeCollectiveDecision,
): PublicInitiativeCollectiveDecisionProjection {
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
    stewardDisplayName: resolveStewardDisplayName(decision.stewardId),
    statistics: createEmptyInitiativeCollectiveDecisionStatistics(),
    outcome: buildEmptyOutcome(decision),
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

export function listPublicInitiativeCollectiveDecisionsForInitiative(
  initiativeId: string,
): PublicInitiativeCollectiveDecisionListItem[] {
  return listPublicDecisionsByInitiative(initiativeId).map((decision) =>
    toPublicInitiativeCollectiveDecisionListItem(decision),
  );
}

export function getPublicInitiativeCollectiveDecision(
  decisionId: string,
): PublicInitiativeCollectiveDecisionProjection | null {
  const decision = getDecisionById(decisionId);

  if (!decision || !PUBLIC_STATUSES.has(decision.status)) {
    return null;
  }

  return toPublicInitiativeCollectiveDecisionProjection(decision);
}
