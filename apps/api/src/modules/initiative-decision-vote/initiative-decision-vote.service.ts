import type {
  InitiativeDecisionVote,
  InitiativeDecisionVoteChoice,
  InitiativeDecisionVoteHistoryEntry,
} from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getMemberById } from "../member/member.store.js";
import { evaluateStoredDecisionParticipationEligibility } from "../participation-eligibility/participation-eligibility.service.js";
import { getDecisionById } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import {
  appendVoteHistoryEntry,
  getActiveVoteForParticipant,
  saveVoteRecord,
} from "./initiative-decision-vote.store.js";

export interface CastOrUpdateInitiativeDecisionVoteInput {
  choice: InitiativeDecisionVoteChoice;
}

function assertDecisionAcceptsVotes(
  decisionId: string,
): NonNullable<ReturnType<typeof getDecisionById>> {
  const decision = getDecisionById(decisionId);

  if (!decision) {
    throw new Error("Collective decision not found.");
  }

  if (decision.status !== "opened") {
    throw new Error("Collective decision is not open for voting.");
  }

  const now = Date.parse(new Date().toISOString());

  if (!decision.openedAt || Date.parse(decision.openedAt) > now) {
    throw new Error("Collective decision voting window is not open yet.");
  }

  if (Date.parse(decision.closesAt) < now) {
    throw new Error("Collective decision voting window has closed.");
  }

  return decision;
}

function evaluateVoteEligibility(
  decision: NonNullable<ReturnType<typeof getDecisionById>>,
  identity: RequestIdentity,
) {
  const member = getMemberById(identity.participantId);

  return evaluateStoredDecisionParticipationEligibility({
    participantId: identity.participantId,
    isRegistered: member !== null,
    participantStatus: member?.status ?? "unregistered",
    decisionParticipationScope: decision.participationScope,
    initiativeCommunitySlug: getInitiativeById(decision.initiativeId)?.metadata.communitySlug ?? "",
    decisionStatus: decision.status,
    openedAt: decision.openedAt,
    closesAt: decision.closesAt,
    currentTime: new Date().toISOString(),
    priorVoteExists: false,
  });
}

function recordVoteHistory(input: {
  voteId: string;
  decisionId: string;
  participantId: string;
  previousChoice?: InitiativeDecisionVoteChoice;
  newChoice: InitiativeDecisionVoteChoice;
  transparencyCohort: InitiativeDecisionVote["transparencyCohort"];
}): InitiativeDecisionVoteHistoryEntry {
  const now = new Date().toISOString();

  return appendVoteHistoryEntry({
    historyId: `vote-history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    voteId: input.voteId,
    decisionId: input.decisionId,
    participantId: input.participantId,
    previousChoice: input.previousChoice,
    newChoice: input.newChoice,
    changedAt: now,
    transparencyCohort: input.transparencyCohort,
  });
}

export function castOrUpdateInitiativeDecisionVote(
  identity: RequestIdentity,
  decisionId: string,
  input: CastOrUpdateInitiativeDecisionVoteInput,
): InitiativeDecisionVote {
  const decision = assertDecisionAcceptsVotes(decisionId);
  const eligibility = evaluateVoteEligibility(decision, identity);

  if (!eligibility.eligible) {
    throw new Error(eligibility.explanation);
  }

  const existingVote = getActiveVoteForParticipant(decisionId, identity.participantId);
  const transparencyCohort = eligibility.transparencyCohort;
  const now = new Date().toISOString();

  if (existingVote) {
    if (existingVote.choice === input.choice) {
      return existingVote;
    }

    const updatedVote: InitiativeDecisionVote = {
      ...existingVote,
      choice: input.choice,
      transparencyCohort,
      updatedAt: now,
      version: existingVote.version + 1,
    };

    recordVoteHistory({
      voteId: updatedVote.voteId,
      decisionId,
      participantId: identity.participantId,
      previousChoice: existingVote.choice,
      newChoice: input.choice,
      transparencyCohort,
    });

    return saveVoteRecord(updatedVote);
  }

  const vote: InitiativeDecisionVote = {
    voteId: `initiative-decision-vote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    decisionId,
    participantId: identity.participantId,
    choice: input.choice,
    transparencyCohort,
    castAt: now,
    updatedAt: now,
    version: 1,
  };

  recordVoteHistory({
    voteId: vote.voteId,
    decisionId,
    participantId: identity.participantId,
    newChoice: input.choice,
    transparencyCohort,
  });

  return saveVoteRecord(vote);
}

export function getMyInitiativeDecisionVote(
  identity: RequestIdentity,
  decisionId: string,
): InitiativeDecisionVote | null {
  const decision = getDecisionById(decisionId);

  if (!decision) {
    throw new Error("Collective decision not found.");
  }

  return getActiveVoteForParticipant(decisionId, identity.participantId);
}
