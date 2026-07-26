import { evaluateDecisionParticipationEligibility } from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { getMemberById } from "../member/member-access.js";
import {
  getPendingParticipationAreaTransitionForParticipant,
  resolveActiveParticipationArea,
} from "../participation-area/participation-area.store.js";
import type { CivicNominationVotingSession } from "@hu/types";
import { resolveCivicNominationVotingScope } from "@hu/types";
import type { CivicNomination } from "@hu/types";

import { buildNominationScopeMetadata } from "./civic-nomination-vote-scope.js";

function assertVotingSessionIsOpen(
  session: CivicNominationVotingSession | null,
): CivicNominationVotingSession {
  if (!session) {
    throw new Error("Civic nomination voting is not open.");
  }

  if (session.status !== "open") {
    throw new Error("Civic nomination voting is not open.");
  }

  const now = Date.parse(new Date().toISOString());

  if (!session.openedAt || Date.parse(session.openedAt) > now) {
    throw new Error("Civic nomination voting window is not open yet.");
  }

  if (Date.parse(session.closesAt) < now) {
    throw new Error("Civic nomination voting window has closed.");
  }

  return session;
}

export async function evaluateCivicNominationVoteEligibility(input: {
  nomination: CivicNomination;
  session: CivicNominationVotingSession | null;
  identity: RequestIdentity;
  currentTime?: string;
}) {
  const session = assertVotingSessionIsOpen(input.session);
  const member = await getMemberById(input.identity.participantId);
  const scopeMetadata = buildNominationScopeMetadata(input.nomination);
  const participationScope = resolveCivicNominationVotingScope(input.nomination.institutionRole);
  const currentTime = input.currentTime ?? new Date().toISOString();
  const activeArea = resolveActiveParticipationArea(input.identity.participantId, currentTime);
  const pendingTransition = getPendingParticipationAreaTransitionForParticipant(
    input.identity.participantId,
  );

  return evaluateDecisionParticipationEligibility({
    participantId: input.identity.participantId,
    isRegistered: member !== null,
    participantStatus: member?.status ?? "unregistered",
    activeParticipationArea: activeArea
      ? {
          countrySlug: activeArea.countrySlug,
          regionSlug: activeArea.regionSlug,
          communitySlug: activeArea.communitySlug,
        }
      : null,
    verificationStatus: activeArea?.verificationStatus ?? "unverified",
    pendingTransition,
    decisionParticipationScope: participationScope,
    initiativeScopeMetadata: scopeMetadata,
    decisionStatus: "opened",
    openedAt: session.openedAt,
    closesAt: session.closesAt,
    currentTime,
    priorVoteExists: false,
  });
}

export { assertVotingSessionIsOpen };
