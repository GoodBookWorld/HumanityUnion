import type {
  CivicNominationVotingSession,
  PublicCivicNominationVotingProjection,
} from "@hu/types";

import {
  CIVIC_NOMINATION_LEGAL_NOTICE,
  CIVIC_NOMINATION_TRANSPARENCY_NOTE,
} from "../civic-nomination/civic-nomination.projection.js";

import { computeCivicNominationVotingResult } from "./civic-nomination-vote-aggregates.js";

const FORBIDDEN_PUBLIC_FIELDS = [
  "participantId",
  "profileId",
  "userId",
  "email",
  "voteId",
  "historyId",
] as const;

export function assertPublicCivicNominationVotingProjectionIsSafe(
  projection: Record<string, unknown>,
): void {
  for (const field of FORBIDDEN_PUBLIC_FIELDS) {
    if (field in projection) {
      throw new Error(`Public civic nomination voting projection must not expose ${field}.`);
    }
  }
}

export function toPublicCivicNominationVotingProjection(
  nominationId: string,
  session: CivicNominationVotingSession | null,
): PublicCivicNominationVotingProjection {
  const status = session?.status ?? "not_open";
  const result = computeCivicNominationVotingResult(nominationId, status);

  const projection: PublicCivicNominationVotingProjection = {
    nominationId,
    status,
    participationScope: session?.participationScope ?? "world",
    openedAt: session?.openedAt,
    closesAt: session?.closesAt,
    closedAt: session?.closedAt,
    cancelledAt: session?.cancelledAt,
    result,
    legalNotice: CIVIC_NOMINATION_LEGAL_NOTICE,
    transparencyNote: CIVIC_NOMINATION_TRANSPARENCY_NOTE,
  };

  assertPublicCivicNominationVotingProjectionIsSafe(
    projection as unknown as Record<string, unknown>,
  );

  return projection;
}
