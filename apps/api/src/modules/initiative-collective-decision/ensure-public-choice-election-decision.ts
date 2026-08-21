import type { Initiative, InitiativeCollectiveDecision, ParticipationScope } from "@hu/types";
import { resolveInitiativeLifecycleProfile } from "@hu/types";

import { getInitiativeById } from "../initiatives/initiative.store.js";
import {
  createDecision,
  getNextSequenceNumber,
  listDecisionsByInitiative,
  updateDecision,
} from "./initiative-collective-decision.store.js";

const DEFAULT_VOTING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function resolveParticipationScope(initiative: Initiative): ParticipationScope {
  const scope = initiative.metadata.participationScope;
  if (scope === "community" || scope === "region" || scope === "country" || scope === "world") {
    return scope;
  }
  return "community";
}

/**
 * Pack Fix 06 — canonical Public Choice voting window from Initiative dates.
 * Start of Voting → openedAt; End of Voting → closesAt.
 */
export function resolvePublicChoiceElectionVotingWindow(
  initiative: Initiative,
  nowIso: string = new Date().toISOString(),
): { openedAt: string; closesAt: string } {
  const nowMs = Date.parse(nowIso);
  const startRaw = initiative.metadata.startDate?.trim();
  const endRaw = initiative.metadata.completionDate?.trim();

  let openedAtMs = startRaw ? Date.parse(startRaw) : Number.NaN;
  if (Number.isNaN(openedAtMs)) {
    openedAtMs = Date.parse(initiative.createdAt) || nowMs;
  }

  let closesAtMs = endRaw ? Date.parse(endRaw) : Number.NaN;
  if (Number.isNaN(closesAtMs) || closesAtMs <= openedAtMs) {
    closesAtMs = openedAtMs + DEFAULT_VOTING_WINDOW_MS;
  }

  return {
    openedAt: new Date(openedAtMs).toISOString(),
    closesAt: new Date(closesAtMs).toISOString(),
  };
}

function pickExistingPublicChoiceDecision(
  decisions: readonly InitiativeCollectiveDecision[],
): InitiativeCollectiveDecision | null {
  const opened = decisions.find((decision) => decision.status === "opened");
  if (opened) {
    return opened;
  }

  const closed = [...decisions]
    .filter((decision) => decision.status === "closed")
    .sort((left, right) => right.sequenceNumber - left.sequenceNumber)[0];
  if (closed) {
    return closed;
  }

  const draft = [...decisions]
    .filter((decision) => decision.status === "draft")
    .sort((left, right) => right.sequenceNumber - left.sequenceNumber)[0];
  return draft ?? null;
}

/**
 * Fix 06 — PUBLIC_CHOICE elections must have a canonical opened Collective Decision
 * for Select/Recall + live results. Idempotent; never recreates when one exists.
 * Does not invent a second vote engine — uses InitiativeCollectiveDecision.
 */
export function ensurePublicChoiceElectionVotingDecision(
  initiativeId: string,
  nowIso: string = new Date().toISOString(),
): InitiativeCollectiveDecision | null {
  const initiative = getInitiativeById(initiativeId);
  if (!initiative) {
    return null;
  }

  if (resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) !== "PUBLIC_CHOICE") {
    return null;
  }

  // Expired retention: do not reopen voting substrate.
  if (initiative.metadata.publicChoiceResultsExpiredAt?.trim()) {
    return pickExistingPublicChoiceDecision(listDecisionsByInitiative(initiativeId));
  }

  const existing = pickExistingPublicChoiceDecision(listDecisionsByInitiative(initiativeId));
  if (existing?.status === "opened" || existing?.status === "closed") {
    return existing;
  }

  const window = resolvePublicChoiceElectionVotingWindow(initiative, nowIso);
  const electionName =
    initiative.metadata.communityAssociation?.trim() || initiative.title || "Election";
  const question = `Public Choice election: ${electionName}`;

  if (existing?.status === "draft") {
    const opened = updateDecision(existing.decisionId, {
      status: "opened",
      openedAt: window.openedAt,
    });
    // closesAt is immutable via updateDecision — draft must already have a valid closesAt.
    // If draft closesAt is missing/invalid, create a replacement opened decision below.
    if (opened && Date.parse(opened.closesAt) > Date.parse(window.openedAt)) {
      return opened;
    }
  }

  const now = nowIso;
  const decision: InitiativeCollectiveDecision = {
    decisionId: `collective-decision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    initiativeId,
    decisionSessionId: null,
    stewardId: initiative.stewardId,
    sequenceNumber: getNextSequenceNumber(initiativeId),
    participationScope: resolveParticipationScope(initiative),
    status: "opened",
    question,
    closesAt: window.closesAt,
    openedAt: window.openedAt,
    createdAt: now,
    updatedAt: now,
  };

  return createDecision(decision);
}
