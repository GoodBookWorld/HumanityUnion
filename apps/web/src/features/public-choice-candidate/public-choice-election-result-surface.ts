/**
 * Fix 07C — one canonical public result surface loader for OPEN/CLOSED elections.
 * Prefers live Decision Vote aggregates from public CD list/detail (same server path).
 * Soft-fails initiative GET so Visitors still see candidates + tallies when roster APIs work.
 */

import type {
  InitiativeDecisionSelectOneAggregates,
  PublicChoiceCandidatePublicProjection,
  PublicInitiativeCollectiveDecisionListItem,
  PublicInitiativeCollectiveDecisionProjection,
  PublicInitiativeProjection,
} from "@hu/types";

import {
  getPublicInitiativeCollectiveDecision,
  listPublicInitiativeCollectiveDecisions,
} from "../initiative-collective-decision/api";
import { getPublicInitiative } from "../initiatives/api";
import { listPublicChoiceCandidates } from "./api";

export function createZeroSelectOneAggregates(
  candidateIds: readonly string[],
): InitiativeDecisionSelectOneAggregates {
  const sorted = [...candidateIds].sort((left, right) => left.localeCompare(right));
  const isTie = sorted.length > 1;
  return {
    ballotMode: "SELECT_ONE_CANDIDATE",
    candidates: sorted.map((candidateId) => ({
      candidateId,
      count: 0,
      percentage: 0,
      rank: 1,
      isTie,
    })),
    abstain: 0,
    abstainPercentage: 0,
    totalEffectiveVoters: 0,
    participationBreakdown: {
      visitors: 0,
      participants: 0,
      members: 0,
      totalEffectiveVoters: 0,
      visitorPercentage: 0,
      participantPercentage: 0,
      memberPercentage: 0,
    },
  };
}

/**
 * Prefer server SELECT_ONE aggregates; if missing/empty while roster exists,
 * synthesize zero rows so CD / Election never render a blank panel.
 */
export function resolveSelectOneAggregates(
  ballotAggregates: PublicInitiativeCollectiveDecisionProjection["ballotAggregates"] | undefined,
  candidateIds: readonly string[],
): InitiativeDecisionSelectOneAggregates {
  if (ballotAggregates?.ballotMode === "SELECT_ONE_CANDIDATE") {
    if (ballotAggregates.candidates.length > 0 || candidateIds.length === 0) {
      return ballotAggregates;
    }
  }
  return createZeroSelectOneAggregates(candidateIds);
}

function listItemAsProjection(
  item: PublicInitiativeCollectiveDecisionListItem,
  initiativeId: string,
): PublicInitiativeCollectiveDecisionProjection {
  return {
    decisionId: item.decisionId,
    initiativeId,
    decisionSessionId: null,
    sequenceNumber: item.sequenceNumber,
    participationScope: item.participationScope,
    status: item.status,
    question: item.question,
    openedAt: item.openedAt,
    closesAt: item.closesAt,
    closedAt: item.closedAt,
    stewardDisplayName: "Election",
    statistics: item.statistics,
    outcome: item.outcome,
    participationConfidenceLevel: item.participationConfidenceLevel,
    outcomeSummary: item.outcomeSummary,
    transparencyNote: item.transparencyNote,
    structuredContent: null,
    traceability: null,
    ballotMode: item.ballotMode,
    ballotAggregates: item.ballotAggregates,
    resultsRetention: item.resultsRetention,
  };
}

export interface PublicChoiceElectionResultSurface {
  initiative: PublicInitiativeProjection | null;
  candidates: PublicChoiceCandidatePublicProjection[];
  decision: PublicInitiativeCollectiveDecisionProjection | null;
  selectOneAggregates: InitiativeDecisionSelectOneAggregates;
  /** True when initiative GET failed but candidates/aggregates may still load. */
  initiativeLoadFailed: boolean;
}

export async function loadPublicChoiceElectionResultSurface(
  initiativeId: string,
): Promise<PublicChoiceElectionResultSurface> {
  const [initiativeOutcome, candidates, listed] = await Promise.all([
    getPublicInitiative(initiativeId)
      .then((initiative) => ({ ok: true as const, initiative }))
      .catch(() => ({ ok: false as const, initiative: null })),
    // Fix 07B — do not swallow roster failures as []. Callers catch if needed.
    listPublicChoiceCandidates(initiativeId),
    listPublicInitiativeCollectiveDecisions(initiativeId).catch(() => ({
      decisions: [] as PublicInitiativeCollectiveDecisionListItem[],
      metrics: {
        decisionCount: 0,
        openedCount: 0,
        closedCount: 0,
        cancelledCount: 0,
      },
    })),
  ]);

  const opened =
    listed.decisions.find((item) => item.status === "opened") ?? listed.decisions[0] ?? null;

  let decision: PublicInitiativeCollectiveDecisionProjection | null = null;
  if (opened) {
    const detail = await getPublicInitiativeCollectiveDecision(opened.decisionId);
    decision = detail ?? listItemAsProjection(opened, initiativeId);
  }

  const candidateIds = candidates.map((candidate) => candidate.candidateId);
  const selectOneAggregates = resolveSelectOneAggregates(
    decision?.ballotAggregates ?? opened?.ballotAggregates,
    candidateIds,
  );

  return {
    initiative: initiativeOutcome.initiative,
    candidates,
    decision,
    selectOneAggregates,
    initiativeLoadFailed: !initiativeOutcome.ok,
  };
}
