/**
 * Pack 02A — in-process Decision Vote records for extended ballot/visitor casts.
 * Lives inside the Decision Vote module (not a parallel engine). Used when Mongo
 * is unavailable in tests, and as the authoritative path for visitor + SELECT_ONE
 * until Mongo unique indexes for visitorKey are migrated in production.
 */
import type { InitiativeDecisionVote, PublicChoiceVoterCategory } from "@hu/types";
import { assertDecisionVoteVoterIdentity } from "@hu/types";

const votesById = new Map<string, InitiativeDecisionVote & { initiativeId: string }>();

export function resetPack02aDecisionVoteMemoryForTests(): void {
  votesById.clear();
}

export function buildDecisionVoteIdForVoter(input: {
  decisionId: string;
  participantId?: string;
  visitorKey?: string;
}): string {
  assertDecisionVoteVoterIdentity(input);
  if (input.participantId) {
    return `initiative-decision-vote:${input.decisionId}:participant:${input.participantId}`;
  }

  return `initiative-decision-vote:${input.decisionId}:visitor:${input.visitorKey}`;
}

export function listPack02aVotesForDecision(decisionId: string): InitiativeDecisionVote[] {
  return [...votesById.values()]
    .filter((vote) => vote.decisionId === decisionId)
    .map(({ initiativeId: _initiativeId, ...vote }) => vote);
}

export function findPack02aVoteForVoter(input: {
  decisionId: string;
  participantId?: string;
  visitorKey?: string;
}): (InitiativeDecisionVote & { initiativeId: string }) | null {
  const voteId = buildDecisionVoteIdForVoter(input);
  return votesById.get(voteId) ?? null;
}

export function castOrChangePack02aDecisionVote(input: {
  decisionId: string;
  initiativeId: string;
  participantId?: string;
  visitorKey?: string;
  choice: InitiativeDecisionVote["choice"];
  candidateId?: string;
  voterCategory: PublicChoiceVoterCategory;
  transparencyCohort: InitiativeDecisionVote["transparencyCohort"];
}): InitiativeDecisionVote {
  assertDecisionVoteVoterIdentity(input);
  const voteId = buildDecisionVoteIdForVoter(input);
  const existing = votesById.get(voteId);
  const now = new Date().toISOString();

  if (existing) {
    if (
      existing.choice === input.choice &&
      (existing.candidateId ?? undefined) === (input.candidateId ?? undefined) &&
      existing.voterCategory === input.voterCategory
    ) {
      const { initiativeId: _i, ...response } = existing;
      return response;
    }

    const updated = {
      ...existing,
      choice: input.choice,
      candidateId: input.candidateId,
      voterCategory: input.voterCategory,
      transparencyCohort: input.transparencyCohort,
      updatedAt: now,
      version: existing.version + 1,
    };
    votesById.set(voteId, updated);
    const { initiativeId: _i, ...response } = updated;
    return response;
  }

  const created = {
    voteId,
    decisionId: input.decisionId,
    initiativeId: input.initiativeId,
    participantId: input.participantId,
    visitorKey: input.visitorKey,
    choice: input.choice,
    candidateId: input.candidateId,
    voterCategory: input.voterCategory,
    transparencyCohort: input.transparencyCohort,
    castAt: now,
    updatedAt: now,
    version: 1,
  };
  votesById.set(voteId, created);
  const { initiativeId: _i, ...response } = created;
  return response;
}
