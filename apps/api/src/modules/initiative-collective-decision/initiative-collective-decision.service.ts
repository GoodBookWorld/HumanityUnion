import type {
  DecisionSession,
  DirectInitiativeAncestry,
  Initiative,
  InitiativeCollectiveDecision,
  InitiativeCollectiveDecisionEligibility,
  InitiativeCollectiveDecisionStatus,
  ParticipationScope,
} from "@hu/types";
import {
  canTransitionInitiativeCollectiveDecision,
  isInitiativeAdministrativelyBlocked,
  isInitiativeCollectiveDecisionTerminal,
  resolveInitiativeLifecycleProfile,
  PUBLIC_CHOICE_ELECTION_ADMIN_BLOCKED_MUTATION_MESSAGE,
} from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { generateCivicActionPackageForDecision } from "../civic-action-package/civic-action-package.service.js";
import { emitCivicNotificationEvent } from "../notifications/notification.service.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getSessionById } from "../decision-session/decision-session.store.js";
import { validateDirectInitiativeAncestry } from "../../shared/initiative-ancestry/index.js";
import {
  assessInitiativeCollectiveDecisionEligibility,
  assessInitiativeCollectiveDecisionEligibilityForResolved,
} from "./initiative-collective-decision-eligibility.js";
import {
  createDecision,
  getDecisionById,
  getNextSequenceNumber,
  listDecisions,
  listDecisionsByInitiative,
  listDecisionsBySteward,
  updateDecision,
} from "./initiative-collective-decision.store.js";

export interface CreateInitiativeCollectiveDecisionDraftInput {
  initiativeId: string;
  decisionSessionId: string;
  participationScope: ParticipationScope;
  closesAt: string;
  supersedesDecisionId?: string;
}

/**
 * Narrow, module-specific typed error for a Collective Decision whose
 * `initiativeId` does not match its referenced Decision Session's
 * `initiativeId` (Recovery Task 09). Distinct from the shared Initiative
 * ancestry errors (`apps/api/src/shared/initiative-ancestry/`), which only
 * cover Initiative existence/format, not cross-artifact consistency with a
 * *specific* upstream artifact such as Decision Session.
 */
export class CollectiveDecisionInitiativeMismatchError extends Error {
  readonly code = "COLLECTIVE_DECISION_INITIATIVE_MISMATCH";

  constructor(message = "Decision session does not belong to this initiative.") {
    super(message);
    this.name = "CollectiveDecisionInitiativeMismatchError";
  }
}

/**
 * Initiative Ancestry — Recovery Task 09.
 *
 * Inspection (Part 1/2) found that `CreateInitiativeCollectiveDecisionDraftInput`
 * carries BOTH an independent, direct `initiativeId` AND a mandatory
 * `decisionSessionId` — unlike Decision Session (Recovery Task 08), which
 * has no upstream-artifact reference at all, and unlike Improvement
 * Proposal (Recovery Task 07), whose `initiativeId` is entirely derived
 * from its parent. This matches the task's "Model A — direct ancestry plus
 * parent consistency": `InitiativeCollectiveDecision` stores its own
 * `initiativeId` directly, and Decision Session consistency
 * (`decision.initiativeId === decisionSession.initiativeId`) is a
 * *separate* invariant from Initiative existence, not something ancestry
 * derivation guarantees by construction.
 *
 * Consequently:
 * - Ancestry is DIRECT (`validateDirectInitiativeAncestry`).
 *   `validateTransitiveInitiativeAncestry` does not apply: an independent
 *   `initiativeId` is always supplied, so there is nothing to resolve
 *   through a parent. (Note: the canonical `CivicArtifactType` vocabulary
 *   in `packages/types/src/domain/initiative-ancestry.ts` also has no
 *   `"decision-session"` member today, which would have blocked a
 *   transitive design without a separate, explicit shared-contract task —
 *   moot here since direct ancestry is the correct mechanism.)
 * - The Initiative/Decision-Session consistency check
 *   (`session.initiativeId !== ancestry.initiativeId`) already existed as
 *   part of `assessInitiativeCollectiveDecisionEligibility`'s reasons list;
 *   this task formalizes it with a dedicated typed error
 *   (`CollectiveDecisionInitiativeMismatchError`) while preserving its
 *   exact message text and reason precedence for the pre-existing
 *   `assessInitiativeCollectiveDecisionEligibility`/
 *   `getInitiativeCollectiveDecisionEligibility` read path, which is left
 *   untouched.
 *
 * As of this task, `createInitiativeCollectiveDecisionDraft` — there is no
 * Express route for creation; the service itself is, and remains, the sole
 * enforcement boundary — validates Initiative existence via the shared
 * validator, resolves the Decision Session exactly once, and reuses both
 * resolved records for the pre-existing eligibility rule. This closes a
 * real, pre-existing inefficiency: the previous implementation performed
 * the Initiative lookup twice (once directly, once inside
 * `assertInitiativeCollectiveDecisionEligible`) and the Decision Session
 * lookup twice (once inside eligibility, once directly afterward). The
 * pre-existing check ORDER is preserved exactly (Initiative existence →
 * ownership → Session/eligibility → supersedes → duplicate-decision), so
 * compound-invalid requests fail with the same error as before.
 *
 * Persistence is unchanged: decisions continue to store plain
 * `initiativeId`/`decisionSessionId` strings, not a nested ancestry object.
 * The pre-existing "one Collective Decision per Decision Session" rule
 * (`existingForSession`) and the `supersedesDecisionId` reopening flow are
 * both preserved unchanged and unconditionally on Decision Session identity
 * (not status) — see Part 6 of the task for the documented cardinality.
 *
 * Aggregate boundary: INITIATIVE remains the sole canonical civic root.
 * Decision Session is a specific upstream civic artifact belonging to that
 * same Initiative — it is not itself a civic root and cannot anchor
 * ancestry independently. `InitiativeCollectiveDecision` owns its own
 * decision statement/question, participation scope, status, and
 * open/close/cancel timestamps; it does NOT own Initiative lifecycle,
 * Decision Session deliberation lifecycle, or implementation/impact
 * tracking (those remain the responsibility of the Initiative,
 * Decision Session, and Implementation/Impact modules respectively).
 */
export interface InitiativeCollectiveDecisionAncestryDependencies {
  readonly getInitiative: (initiativeId: string) => Initiative | null;
  readonly getSession: (decisionSessionId: string) => DecisionSession | null;
  readonly assessEligibility: (
    initiative: Initiative,
    session: DecisionSession | null,
  ) => InitiativeCollectiveDecisionEligibility;
}

const defaultInitiativeCollectiveDecisionAncestryDependencies: InitiativeCollectiveDecisionAncestryDependencies =
  {
    getInitiative: getInitiativeById,
    getSession: getSessionById,
    assessEligibility: assessInitiativeCollectiveDecisionEligibilityForResolved,
  };

async function assertInitiativeAncestry(
  initiativeId: string,
  deps: Pick<InitiativeCollectiveDecisionAncestryDependencies, "getInitiative">,
): Promise<{ ancestry: DirectInitiativeAncestry; initiative: Initiative }> {
  const resolvedInitiativeBox: { value: Initiative | null } = { value: null };

  // Enforcement boundary: confirms the Initiative exists and is well-formed
  // before ownership, Session/eligibility checks, or persistence,
  // regardless of caller.
  const ancestry = await validateDirectInitiativeAncestry(
    { initiativeId },
    {
      initiativeExists(id) {
        resolvedInitiativeBox.value = deps.getInitiative(id);
        return resolvedInitiativeBox.value !== null;
      },
    },
  );

  const initiative = resolvedInitiativeBox.value;

  if (!initiative) {
    // Unreachable: validateDirectInitiativeAncestry only resolves once
    // initiativeExists() returned true.
    throw new Error("Initiative not found.");
  }

  return { ancestry, initiative };
}

/**
 * Resolves the Decision Session exactly once and applies the pre-existing,
 * Initiative-scoped eligibility rule (which includes the Initiative/Session
 * consistency invariant). Must be called AFTER ownership has been asserted,
 * to preserve the pre-existing error precedence for compound-invalid
 * requests (a non-owner with an ineligible session previously received —
 * and still receives — the ownership failure, not an eligibility failure).
 */
function assertEligibleDecisionSession(
  initiative: Initiative,
  ancestry: DirectInitiativeAncestry,
  decisionSessionId: string,
  deps: Pick<InitiativeCollectiveDecisionAncestryDependencies, "getSession" | "assessEligibility">,
): { session: DecisionSession; initiativeVersion: number } {
  const session = deps.getSession(decisionSessionId);
  const eligibility = deps.assessEligibility(initiative, session);

  if (!eligibility.eligible) {
    const reason = eligibility.reasons[0] ?? "Initiative is not eligible for a collective decision.";

    // Distinguishes the specific Initiative/Session mismatch invariant with
    // a dedicated typed error while preserving the exact pre-existing
    // message text and reason precedence for every other case.
    if (session && session.initiativeId !== ancestry.initiativeId) {
      throw new CollectiveDecisionInitiativeMismatchError(reason);
    }

    throw new Error(reason);
  }

  if (!session) {
    // Unreachable: assessEligibility can only return eligible: true when a
    // non-null session was supplied (see assessInitiativeCollectiveDecisionEligibilityForResolved).
    throw new Error("Decision session not found.");
  }

  return { session, initiativeVersion: eligibility.initiativeVersion };
}

function getOwnedDecision(
  decisionId: string,
  identity: RequestIdentity,
): InitiativeCollectiveDecision {
  const decision = getDecisionById(decisionId);

  if (!decision) {
    throw new Error("Collective decision not found.");
  }

  if (decision.stewardId !== identity.participantId) {
    throw new Error("You do not have access to this collective decision.");
  }

  return decision;
}

function assertTransitionAllowed(
  decision: InitiativeCollectiveDecision,
  nextStatus: InitiativeCollectiveDecisionStatus,
): void {
  if (isInitiativeCollectiveDecisionTerminal(decision.status)) {
    throw new Error(`Collective decision in status "${decision.status}" cannot be changed.`);
  }

  if (!canTransitionInitiativeCollectiveDecision(decision.status, nextStatus)) {
    throw new Error(
      `Collective decision cannot transition from "${decision.status}" to "${nextStatus}".`,
    );
  }
}

export function getInitiativeCollectiveDecisionEligibility(
  initiativeId: string,
  decisionSessionId: string,
) {
  return assessInitiativeCollectiveDecisionEligibility(initiativeId, decisionSessionId);
}

export function listMyInitiativeCollectiveDecisions(
  identity: RequestIdentity,
): InitiativeCollectiveDecision[] {
  return listDecisionsBySteward(identity.participantId);
}

export function listMyInitiativeCollectiveDecisionsForInitiative(
  identity: RequestIdentity,
  initiativeId: string,
): InitiativeCollectiveDecision[] {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);

  return listDecisionsByInitiative(initiativeId).filter(
    (decision) => decision.stewardId === identity.participantId,
  );
}

export function getMyInitiativeCollectiveDecision(
  identity: RequestIdentity,
  decisionId: string,
): InitiativeCollectiveDecision {
  return getOwnedDecision(decisionId, identity);
}

export async function createInitiativeCollectiveDecisionDraft(
  identity: RequestIdentity,
  input: CreateInitiativeCollectiveDecisionDraftInput,
  deps: InitiativeCollectiveDecisionAncestryDependencies = defaultInitiativeCollectiveDecisionAncestryDependencies,
): Promise<InitiativeCollectiveDecision> {
  const { ancestry, initiative } = await assertInitiativeAncestry(input.initiativeId, deps);

  assertInitiativeOwnership(initiative, identity);

  const { session } = assertEligibleDecisionSession(
    initiative,
    ancestry,
    input.decisionSessionId,
    deps,
  );

  if (input.supersedesDecisionId) {
    const priorDecision = getDecisionById(input.supersedesDecisionId);

    if (!priorDecision) {
      throw new Error("Prior collective decision not found.");
    }

    if (priorDecision.initiativeId !== ancestry.initiativeId) {
      throw new Error("Prior collective decision does not belong to this initiative.");
    }

    if (!isInitiativeCollectiveDecisionTerminal(priorDecision.status)) {
      throw new Error("Prior collective decision must be closed or cancelled before reopening.");
    }
  }

  const existingForSession = listDecisionsByInitiative(ancestry.initiativeId).some(
    (decision) => decision.decisionSessionId === input.decisionSessionId,
  );

  if (existingForSession) {
    throw new Error("A collective decision already exists for this decision session.");
  }

  const now = new Date().toISOString();

  const decision: InitiativeCollectiveDecision = {
    decisionId: `collective-decision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    // Persisted initiativeId is sourced from the validated ancestry result,
    // not directly from the unchecked input.
    initiativeId: ancestry.initiativeId,
    decisionSessionId: input.decisionSessionId,
    stewardId: identity.participantId,
    sequenceNumber: getNextSequenceNumber(ancestry.initiativeId),
    participationScope: input.participationScope,
    status: "draft",
    question: session.decisionQuestion,
    closesAt: input.closesAt,
    supersedesDecisionId: input.supersedesDecisionId,
    createdAt: now,
    updatedAt: now,
  };

  return createDecision(decision);
}

export function openInitiativeCollectiveDecision(
  identity: RequestIdentity,
  decisionId: string,
): InitiativeCollectiveDecision {
  const decision = getOwnedDecision(decisionId, identity);

  assertTransitionAllowed(decision, "opened");

  const openedAt = new Date().toISOString();

  if (Date.parse(decision.closesAt) <= Date.parse(openedAt)) {
    throw new Error("Closing date must be after the decision opens.");
  }

  const updated = updateDecision(decisionId, {
    status: "opened",
    openedAt,
  });

  if (!updated) {
    throw new Error("Collective decision not found.");
  }

  emitCivicNotificationEvent({
    eventType: "decision_opened",
    entityType: "collective_decision",
    entityId: decisionId,
    initiativeId: updated.initiativeId,
    actorMemberId: identity.participantId,
  });

  return updated;
}

export async function closeInitiativeCollectiveDecision(
  identity: RequestIdentity,
  decisionId: string,
): Promise<InitiativeCollectiveDecision> {
  const decision = getOwnedDecision(decisionId, identity);

  assertTransitionAllowed(decision, "closed");

  return finalizeCollectiveDecisionClose(decision, new Date().toISOString(), identity.participantId);
}

/**
 * Pack 04A — shared close/finalize (manual + scheduled).
 * Sets status=closed, persists closedAt once, freezes PUBLIC_CHOICE Final Results.
 */
async function finalizeCollectiveDecisionClose(
  decision: InitiativeCollectiveDecision,
  closedAt: string,
  actorParticipantId: string | null,
): Promise<InitiativeCollectiveDecision> {
  const updated = updateDecision(decision.decisionId, {
    status: "closed",
    closedAt,
  });

  if (!updated) {
    throw new Error("Collective decision not found.");
  }

  if (updated.decisionSessionId) {
    try {
      await generateCivicActionPackageForDecision(updated.decisionId);
    } catch {
      // PUBLIC_CHOICE / scheduled close must not fail if CAP generation has no Decision Session.
    }
  }

  if (actorParticipantId) {
    emitCivicNotificationEvent({
      eventType: "decision_closed",
      entityType: "collective_decision",
      entityId: decision.decisionId,
      initiativeId: updated.initiativeId,
      actorMemberId: actorParticipantId,
    });
  }

  // Pack 02C — freeze temporary Final Results snapshot for PUBLIC_CHOICE retention.
  try {
    const initiative = getInitiativeById(updated.initiativeId);
    if (
      initiative &&
      resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) === "PUBLIC_CHOICE" &&
      updated.closedAt
    ) {
      const { ensurePublicChoiceResultsFrozenForClosedDecision } = await import(
        "../public-choice-results-retention/public-choice-results-retention.service.js"
      );
      await ensurePublicChoiceResultsFrozenForClosedDecision({
        initiative,
        decision: updated,
      });
    }
  } catch {
    // Closing must succeed even if snapshot freeze fails; scheduler can retry.
  }

  return updated;
}

/**
 * Pack 04A — scheduled End of Voting auto-close (system path, no steward identity).
 * Idempotent: already-closed decisions are returned unchanged (closedAt preserved).
 * closedAt = scheduled closesAt so late scheduler discovery does not extend retention.
 */
export async function closeInitiativeCollectiveDecisionAtScheduledEnd(
  decisionId: string,
  nowIso?: string,
): Promise<InitiativeCollectiveDecision | null> {
  const decision = getDecisionById(decisionId);
  if (!decision) {
    return null;
  }

  if (decision.status === "closed") {
    const initiative = getInitiativeById(decision.initiativeId);
    if (
      initiative &&
      resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) === "PUBLIC_CHOICE"
    ) {
      const { ensurePublicChoiceResultsFrozenForClosedDecision } = await import(
        "../public-choice-results-retention/public-choice-results-retention.service.js"
      );
      await ensurePublicChoiceResultsFrozenForClosedDecision({
        initiative,
        decision,
        nowIso,
      });
    }
    return decision;
  }

  if (decision.status !== "opened") {
    return null;
  }

  const now = Date.parse(nowIso ?? new Date().toISOString());
  const closesAt = Date.parse(decision.closesAt);
  if (Number.isNaN(now) || Number.isNaN(closesAt) || now < closesAt) {
    return null;
  }

  return finalizeCollectiveDecisionClose(decision, decision.closesAt, null);
}

/**
 * Pack 04A — discover overdue opened PUBLIC_CHOICE elections and close them once.
 * Invoked from the existing retention scheduler (no second scheduler).
 */
export async function closeOverduePublicChoiceElections(nowIso?: string): Promise<{
  closedCount: number;
  decisionIds: string[];
}> {
  const now = nowIso ?? new Date().toISOString();
  const nowMs = Date.parse(now);
  const closedIds: string[] = [];

  for (const decision of listDecisions()) {
    if (decision.status !== "opened") {
      continue;
    }

    const initiative = getInitiativeById(decision.initiativeId);
    if (
      !initiative ||
      resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) !== "PUBLIC_CHOICE"
    ) {
      continue;
    }

    const closesAt = Date.parse(decision.closesAt);
    if (Number.isNaN(nowMs) || Number.isNaN(closesAt) || nowMs < closesAt) {
      continue;
    }

    const closed = await closeInitiativeCollectiveDecisionAtScheduledEnd(
      decision.decisionId,
      now,
    );
    if (closed?.status === "closed") {
      closedIds.push(closed.decisionId);
    }
  }

  return { closedCount: closedIds.length, decisionIds: closedIds };
}

/**
 * Pack 04 — Author Manage "Close election": close the open PUBLIC_CHOICE
 * Collective Decision. Sets canonical closedAt for 72h retention.
 */
export async function closePublicChoiceElectionForInitiative(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeCollectiveDecision> {
  const initiative = getInitiativeById(initiativeId);
  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);

  if (resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) !== "PUBLIC_CHOICE") {
    throw new Error("Close election is only available for Public Choice initiatives.");
  }

  if (isInitiativeAdministrativelyBlocked(initiative)) {
    throw new Error(PUBLIC_CHOICE_ELECTION_ADMIN_BLOCKED_MUTATION_MESSAGE);
  }

  const openDecision = listDecisionsByInitiative(initiativeId).find(
    (decision) => decision.status === "opened",
  );

  if (!openDecision) {
    throw new Error("No open election to close.");
  }

  return closeInitiativeCollectiveDecision(identity, openDecision.decisionId);
}

export function cancelInitiativeCollectiveDecision(
  identity: RequestIdentity,
  decisionId: string,
): InitiativeCollectiveDecision {
  const decision = getOwnedDecision(decisionId, identity);

  assertTransitionAllowed(decision, "cancelled");

  const updated = updateDecision(decisionId, {
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Collective decision not found.");
  }

  return updated;
}
