import { randomUUID } from "node:crypto";

import type { CivicNominationVotingSession } from "@hu/types";
import { resolveCivicNominationVotingScope } from "@hu/types";

import { getCivicNominationById } from "../civic-nomination/civic-nomination.store.js";
import { findMemberProfileByProfileId } from "../member-profile/member-profile.repository.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { emitCivicNotificationEvent } from "../notifications/notification.service.js";
import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";

import {
  assertPublishedNomination,
  assertInstitutionRoleSupportsVoting,
} from "./civic-nomination-vote-scope.js";
import { getVotingSessionForNomination, saveVotingSession } from "./civic-nomination-vote.store.js";

function assertInstitutionModerator(identity: RequestIdentity): void {
  if (identity.role !== "admin" && identity.role !== "moderator") {
    throw new Error("Institution moderation privileges are required.");
  }
}

export function getCivicNominationVotingSession(
  nominationId: string,
): CivicNominationVotingSession | null {
  return getVotingSessionForNomination(nominationId);
}

export async function openCivicNominationVoting(
  nominationId: string,
  identity: RequestIdentity,
  closesAt: string,
): Promise<CivicNominationVotingSession> {
  assertInstitutionModerator(identity);

  const nomination = assertPublishedNomination(getCivicNominationById(nominationId));
  assertInstitutionRoleSupportsVoting(nomination.institutionRole);

  const existing = getVotingSessionForNomination(nominationId);

  if (existing?.status === "open") {
    throw new Error("Civic nomination voting is already open.");
  }

  if (existing?.status === "closed") {
    throw new Error("Civic nomination voting has already closed.");
  }

  const now = new Date().toISOString();
  const closeTime = Date.parse(closesAt);

  if (Number.isNaN(closeTime) || closeTime <= Date.parse(now)) {
    throw new Error("Civic nomination voting close time must be in the future.");
  }

  const session: CivicNominationVotingSession = {
    votingSessionId: existing?.votingSessionId ?? `civic-nomination-voting-${randomUUID()}`,
    nominationId,
    institutionRole: nomination.institutionRole,
    participationScope: resolveCivicNominationVotingScope(nomination.institutionRole),
    status: "open",
    openedAt: now,
    closesAt,
    nominationVersion: nomination.nominationVersion,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const saved = saveVotingSession(session);

  const nominatorProfile = await findMemberProfileByProfileId(nomination.nominatedByProfileId);
  const nominatorUser = nominatorProfile ? await findAuthUserById(nominatorProfile.userId) : null;

  emitCivicNotificationEvent({
    eventType: "civic_nomination_voting_opened",
    entityType: "civic_nomination",
    entityId: nominationId,
    actorMemberId: nominatorUser?.memberId,
  });

  return saved;
}

export async function closeCivicNominationVoting(
  nominationId: string,
  identity: RequestIdentity,
): Promise<CivicNominationVotingSession> {
  assertInstitutionModerator(identity);

  const session = getVotingSessionForNomination(nominationId);

  if (!session) {
    throw new Error("Civic nomination voting session not found.");
  }

  if (session.status !== "open") {
    throw new Error("Civic nomination voting is not open.");
  }

  const now = new Date().toISOString();
  const closed: CivicNominationVotingSession = {
    ...session,
    status: "closed",
    closedAt: now,
    updatedAt: now,
  };

  const saved = saveVotingSession(closed);
  const nomination = getCivicNominationById(nominationId);

  if (nomination) {
    const nominatorProfile = await findMemberProfileByProfileId(nomination.nominatedByProfileId);
    const nominatorUser = nominatorProfile ? await findAuthUserById(nominatorProfile.userId) : null;

    emitCivicNotificationEvent({
      eventType: "civic_nomination_voting_closed",
      entityType: "civic_nomination",
      entityId: nominationId,
      actorMemberId: nominatorUser?.memberId,
    });
  }

  return saved;
}

export async function cancelCivicNominationVoting(
  nominationId: string,
  identity: RequestIdentity,
): Promise<CivicNominationVotingSession> {
  assertInstitutionModerator(identity);

  const session = getVotingSessionForNomination(nominationId);

  if (!session) {
    throw new Error("Civic nomination voting session not found.");
  }

  if (session.status === "closed" || session.status === "cancelled") {
    throw new Error("Civic nomination voting cannot be cancelled.");
  }

  const now = new Date().toISOString();

  return saveVotingSession({
    ...session,
    status: "cancelled",
    cancelledAt: now,
    updatedAt: now,
  });
}
