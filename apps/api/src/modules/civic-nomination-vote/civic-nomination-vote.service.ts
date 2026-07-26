import type {
  CivicNominationVote,
  CivicNominationVoteChoice,
  CivicNominationVoteHistoryEntry,
} from "@hu/types";

import { findMemberProfileByUserId } from "../member-profile/member-profile.repository.js";
import { getCivicNominationById } from "../civic-nomination/civic-nomination.store.js";
import { emitCivicNotificationEvent } from "../notifications/notification.service.js";
import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";

import { evaluateCivicNominationVoteEligibility } from "./civic-nomination-vote-eligibility.js";
import { toPublicCivicNominationVotingProjection } from "./civic-nomination-vote.projection.js";
import { assertPublishedNomination } from "./civic-nomination-vote-scope.js";
import {
  appendVoteHistoryEntry,
  getActiveVoteForParticipant,
  getVotingSessionForNomination,
  saveVoteRecord,
} from "./civic-nomination-vote.store.js";

export interface CastOrUpdateCivicNominationVoteInput {
  choice: CivicNominationVoteChoice;
}

async function resolveProfileId(identity: RequestIdentity, userId?: string): Promise<string> {
  if (userId) {
    const profile = await findMemberProfileByUserId(userId);

    if (profile?.profileId) {
      return profile.profileId;
    }
  }

  return `profile-${identity.participantId}`;
}

function recordVoteHistory(input: {
  voteId: string;
  nominationId: string;
  participantId: string;
  previousChoice?: CivicNominationVoteChoice;
  newChoice: CivicNominationVoteChoice;
  transparencyCohort: CivicNominationVote["transparencyCohort"];
}): CivicNominationVoteHistoryEntry {
  const now = new Date().toISOString();

  return appendVoteHistoryEntry({
    historyId: `civic-nomination-vote-history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    voteId: input.voteId,
    nominationId: input.nominationId,
    participantId: input.participantId,
    previousChoice: input.previousChoice,
    newChoice: input.newChoice,
    changedAt: now,
    transparencyCohort: input.transparencyCohort,
  });
}

export async function castOrUpdateCivicNominationVote(
  identity: RequestIdentity,
  nominationId: string,
  input: CastOrUpdateCivicNominationVoteInput,
  userId?: string,
): Promise<CivicNominationVote> {
  const nomination = assertPublishedNomination(getCivicNominationById(nominationId));
  const session = getVotingSessionForNomination(nominationId);
  const eligibility = await evaluateCivicNominationVoteEligibility({
    nomination,
    session,
    identity,
  });

  if (!eligibility.eligible) {
    throw new Error(eligibility.explanation);
  }

  const profileId = await resolveProfileId(identity, userId);
  const existingVote = getActiveVoteForParticipant(nominationId, identity.participantId);
  const transparencyCohort = eligibility.transparencyCohort;
  const now = new Date().toISOString();

  if (existingVote) {
    if (existingVote.choice === input.choice) {
      return existingVote;
    }

    const updatedVote: CivicNominationVote = {
      ...existingVote,
      choice: input.choice,
      transparencyCohort,
      updatedAt: now,
      version: existingVote.version + 1,
    };

    recordVoteHistory({
      voteId: updatedVote.voteId,
      nominationId,
      participantId: identity.participantId,
      previousChoice: existingVote.choice,
      newChoice: input.choice,
      transparencyCohort,
    });

    const saved = saveVoteRecord(updatedVote);

    emitCivicNotificationEvent({
      eventType: "civic_nomination_vote_cast",
      entityType: "civic_nomination",
      entityId: nominationId,
      actorMemberId: identity.participantId,
    });

    return saved;
  }

  const vote: CivicNominationVote = {
    voteId: `civic-nomination-vote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nominationId,
    participantId: identity.participantId,
    profileId,
    choice: input.choice,
    transparencyCohort,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  recordVoteHistory({
    voteId: vote.voteId,
    nominationId,
    participantId: identity.participantId,
    newChoice: input.choice,
    transparencyCohort,
  });

  const saved = saveVoteRecord(vote);

  emitCivicNotificationEvent({
    eventType: "civic_nomination_vote_cast",
    entityType: "civic_nomination",
    entityId: nominationId,
    actorMemberId: identity.participantId,
  });

  return saved;
}

export function getMyCivicNominationVote(
  identity: RequestIdentity,
  nominationId: string,
): CivicNominationVote | null {
  const nomination = getCivicNominationById(nominationId);

  if (!nomination) {
    throw new Error("Civic nomination not found.");
  }

  return getActiveVoteForParticipant(nominationId, identity.participantId);
}

export function getPublicCivicNominationVotingProjection(nominationId: string) {
  const nomination = getCivicNominationById(nominationId);

  if (!nomination || nomination.status !== "published") {
    return null;
  }

  const session = getVotingSessionForNomination(nominationId);
  return toPublicCivicNominationVotingProjection(nominationId, session);
}
