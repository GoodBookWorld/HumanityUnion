import { findAlly } from "../initiative-discussion-collaboration/initiative-ally.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";

import { InitiativeCollaborationChannelAccessDeniedError, InitiativeCollaborationChannelNotFoundError } from "./initiative-collaboration-channel.errors.js";

/**
 * Part 2/13 — single authorization boundary for the Collaboration Channel:
 * Author (Initiative `stewardId`) or an Ally whose row status is exactly
 * `"active"`. Reuses the existing Initiative store and the single-row
 * `findAlly` lookup (already the authority `initiative-active-allies
 * .service.ts` and `respondToCollaborationInterest`/`respondToAlliesInvitation`
 * rely on) — never a second Ally listing or a duplicated participant
 * query, and never a new ownership projection.
 */
export interface InitiativeCollaborationChannelAccessSummary {
  initiativeId: string;
  stewardId: string;
  role: "author" | "active_ally";
}

export interface InitiativeCollaborationChannelAccessDependencies {
  getInitiative(initiativeId: string): { initiativeId: string; stewardId: string } | null;
  findActiveAlly(initiativeId: string, participantId: string): Promise<{ status: string } | null>;
}

const defaultDependencies: InitiativeCollaborationChannelAccessDependencies = {
  getInitiative(initiativeId) {
    const initiative = getInitiativeById(initiativeId);
    return initiative ? { initiativeId: initiative.initiativeId, stewardId: initiative.stewardId } : null;
  },
  findActiveAlly: findAlly,
};

export async function resolveInitiativeCollaborationChannelAccess(
  initiativeId: string,
  participantId: string,
  deps: InitiativeCollaborationChannelAccessDependencies = defaultDependencies,
): Promise<InitiativeCollaborationChannelAccessSummary> {
  const initiative = deps.getInitiative(initiativeId);

  if (!initiative) {
    throw new InitiativeCollaborationChannelNotFoundError();
  }

  if (initiative.stewardId === participantId) {
    return { initiativeId: initiative.initiativeId, stewardId: initiative.stewardId, role: "author" };
  }

  const ally = await deps.findActiveAlly(initiativeId, participantId);

  if (ally?.status === "active") {
    return { initiativeId: initiative.initiativeId, stewardId: initiative.stewardId, role: "active_ally" };
  }

  // Part 2 — everyone else (including a Participant with a merely pending
  // Ally request) and every guest are denied.
  throw new InitiativeCollaborationChannelAccessDeniedError();
}
