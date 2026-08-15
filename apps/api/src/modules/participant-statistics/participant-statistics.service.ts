import type { ParticipantStatistics } from "@hu/types";

import {
  countActiveCollaborationsForParticipant,
  listWorkspaceAlliesForParticipant,
} from "../initiative-discussion-collaboration/workspace-allies.service.js";
import { listInitiativesBySteward } from "../initiatives/initiative.store.js";

/**
 * Profile UX Pack 02 Part 11 — the ONE shared aggregation layer behind the
 * three "Personal Statistics" cards (Workspace, Member Profile, and the
 * privacy-filtered Public Profile). Every consumer must call
 * `getParticipantStatistics` rather than recomputing any of these three
 * numbers independently.
 *
 * Definitions (kept identical across every surface — Part 6 only gates
 * whether a number is *displayed*, never how it is *calculated*):
 *  - `initiativesCount`: all Initiatives this Participant stewards
 *    (created), draft or published — "real number of initiatives created".
 *  - `collectiveDecisionsCount`: Initiatives where this Participant is
 *    themselves an ACTIVE Initiative Ally (`countActiveCollaborationsForParticipant`).
 *  - `alliesCount`: unique active Allies across Initiatives this
 *    Participant stewards (`listWorkspaceAlliesForParticipant`, Definition A).
 */
export interface ParticipantStatisticsDependencies {
  listInitiativesStewardedBy: (participantId: string) => Array<{ initiativeId: string }>;
  listWorkspaceAlliesForParticipant: (
    participantId: string,
  ) => Promise<Array<{ participantId: string }>>;
  countActiveCollaborationsForParticipant: (participantId: string) => Promise<number>;
}

const defaultParticipantStatisticsDependencies: ParticipantStatisticsDependencies = {
  listInitiativesStewardedBy: listInitiativesBySteward,
  listWorkspaceAlliesForParticipant,
  countActiveCollaborationsForParticipant,
};

export async function getParticipantStatistics(
  participantId: string,
  deps: ParticipantStatisticsDependencies = defaultParticipantStatisticsDependencies,
): Promise<ParticipantStatistics> {
  const [allies, collectiveDecisionsCount] = await Promise.all([
    deps.listWorkspaceAlliesForParticipant(participantId),
    deps.countActiveCollaborationsForParticipant(participantId),
  ]);

  return {
    initiativesCount: deps.listInitiativesStewardedBy(participantId).length,
    collectiveDecisionsCount,
    alliesCount: allies.length,
  };
}
