import type {
  DirectInitiativeAncestry,
  Initiative,
  InitiativeCollectiveDecision,
  InitiativeImplementationCommitment,
  InitiativeImplementationCommitmentStatus,
} from "@hu/types";
import {
  canTransitionInitiativeImplementationCommitment,
  isInitiativeImplementationCommitmentTerminal,
} from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { getDecisionById } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { validateDirectInitiativeAncestry } from "../../shared/initiative-ancestry/index.js";
import type { InitiativeImplementationCommitmentEligibility } from "./initiative-implementation-commitment-eligibility.js";
import { assessInitiativeImplementationCommitmentEligibilityForResolved } from "./initiative-implementation-commitment-eligibility.js";
import { emitCivicNotificationEvent } from "../notifications/notification.service.js";
import {
  createCommitment,
  getCommitmentById,
  listCommitmentsByDecision,
  listCommitmentsByParticipant,
  updateCommitment,
} from "./initiative-implementation-commitment.store.js";

export interface CreateInitiativeImplementationCommitmentDraftInput {
  initiativeId: string;
  decisionId: string;
  organizationName?: string;
  commitmentTitle: string;
  commitmentSummary: string;
  commitmentScope: string;
  expectedStartDate?: string;
  expectedCompletionDate?: string;
}

/**
 * Narrow, module-specific typed error for an Implementation Commitment
 * whose independently supplied `initiativeId` does not match its
 * referenced Collective Decision's `initiativeId` (Recovery Task 15).
 * Distinct from the shared Initiative ancestry errors
 * (`apps/api/src/shared/initiative-ancestry/`), which only cover Initiative
 * existence/format, not cross-artifact consistency with a *specific*
 * upstream artifact such as Collective Decision. Mirrors
 * `CollectiveDecisionInitiativeMismatchError`
 * (`initiative-collective-decision.service.ts`, Recovery Task 09).
 */
export class ImplementationCommitmentInitiativeMismatchError extends Error {
  readonly code = "IMPLEMENTATION_COMMITMENT_INITIATIVE_MISMATCH";

  constructor(message = "Collective decision does not belong to this initiative.") {
    super(message);
    this.name = "ImplementationCommitmentInitiativeMismatchError";
  }
}

/**
 * Initiative Ancestry — Recovery Task 15.
 *
 * Inspection (Part 1) found that
 * `CreateInitiativeImplementationCommitmentDraftInput` carries BOTH an
 * independent, direct `initiativeId` AND a mandatory `decisionId` — the
 * same shape Recovery Task 09 found for Initiative Collective Decision
 * (there: `initiativeId` + `decisionSessionId`). This is the task's
 * "Model C — direct artifact with mandatory Decision consistency":
 * `InitiativeImplementationCommitment` stores its own `initiativeId`
 * directly (not derived from the Decision), and Decision consistency
 * (`commitment.initiativeId === collectiveDecision.initiativeId`) is a
 * *separate*, pre-existing invariant — previously enforced only via a
 * plain reasons-list string inside
 * `assertInitiativeImplementationCommitmentEligible` — not something
 * ancestry derivation guarantees by construction.
 *
 * Consequently:
 * - Ancestry is DIRECT (`validateDirectInitiativeAncestry`).
 *   `validateTransitiveInitiativeAncestry` does not apply: an independent
 *   `initiativeId` is always supplied, so there is nothing to resolve
 *   through a parent artifact.
 * - The Initiative/Decision consistency check
 *   (`decision.initiativeId !== ancestry.initiativeId`) already existed as
 *   part of `assessInitiativeImplementationCommitmentEligibility`'s reasons
 *   list; this task formalizes it with a dedicated typed error
 *   (`ImplementationCommitmentInitiativeMismatchError`) while preserving
 *   its exact message text for the Decision-related reasons. The
 *   pre-existing `assessInitiativeImplementationCommitmentEligibility`/
 *   `assertInitiativeImplementationCommitmentEligible` functions are left
 *   untouched for any other caller (e.g. read-only eligibility checks in
 *   verification scripts) — see
 *   `initiative-implementation-commitment-eligibility.ts`.
 * - The pre-existing "Initiative not found." reason is superseded by the
 *   shared validator's `InitiativeNotFoundError` ("Referenced Initiative
 *   does not exist.") for the new ancestry-integrated creation path only,
 *   exactly mirroring the accepted Recovery Task 09 precedent
 *   (`CollectiveDecisionInitiativeMismatchError` docstring). Because the
 *   shared validator resolves and rejects a missing/malformed/nonexistent
 *   Initiative *before* the Decision is ever looked up, a compound-invalid
 *   request (both Initiative and Decision missing) now fails on the
 *   Initiative first, rather than the previous joined
 *   `"Initiative not found. Collective decision not found."` message. No
 *   route or non-verification caller depended on that joined text (there
 *   is no HTTP route for creation — see below).
 *
 * As of this task, `createInitiativeImplementationCommitmentDraft` — there
 * is no Express route for creation; the service itself is, and remains,
 * the sole enforcement boundary — validates Initiative existence via the
 * shared validator, resolves the Collective Decision exactly once, and
 * reuses both resolved records for the pre-existing eligibility rule. This
 * closes a real, pre-existing inefficiency: the previous implementation
 * performed the Initiative lookup once and the Decision lookup once inside
 * `assertInitiativeImplementationCommitmentEligible`, but did so using raw
 * ad-hoc lookups rather than the shared, single-resolution ancestry
 * pattern, and never captured the resolved `Initiative`/`InitiativeCollectiveDecision`
 * objects for reuse.
 *
 * No ownership/authorization check exists today on creation (any
 * authenticated participant, on their own or an organization's behalf, may
 * record a commitment once the Decision is closed — "voluntary public
 * accountability"). This is preserved unchanged: ancestry validation does
 * NOT add an Initiative-steward gate that did not previously exist.
 * Ownership IS enforced, unchanged, on later operations via
 * `getOwnedCommitment` (`commitment.participantId === identity.participantId`).
 *
 * Persistence is unchanged: commitments continue to store plain
 * `initiativeId`/`decisionId` strings, not a nested ancestry object. The
 * pre-existing "0..N commitments per Decision, 0..N per Initiative, no
 * duplicate protection" cardinality (Part 11) is preserved unchanged and
 * unconditionally.
 *
 * Aggregate boundary: INITIATIVE remains the sole canonical civic root.
 * Collective Decision is a specific upstream civic artifact belonging to
 * that same Initiative — it is not itself a civic root and cannot anchor
 * ancestry independently. `InitiativeImplementationCommitment` owns its
 * own responsible participant/organization, commitment title/summary/
 * scope, expected dates, and draft/published/withdrawn/completed
 * lifecycle; it does NOT own Initiative lifecycle, Collective Decision
 * lifecycle/outcome, Decision Session deliberation, or implementation
 * execution/tracking (those remain the responsibility of the Initiative,
 * Collective Decision, Decision Session, and Implementation Tracking
 * modules respectively).
 */
export interface InitiativeImplementationCommitmentAncestryDependencies {
  readonly getInitiative: (initiativeId: string) => Initiative | null;
  readonly getDecision: (decisionId: string) => InitiativeCollectiveDecision | null;
  readonly assessEligibility: (
    initiative: Initiative,
    decision: InitiativeCollectiveDecision | null,
  ) => InitiativeImplementationCommitmentEligibility;
}

const defaultInitiativeImplementationCommitmentAncestryDependencies: InitiativeImplementationCommitmentAncestryDependencies =
  {
    getInitiative: getInitiativeById,
    getDecision: getDecisionById,
    assessEligibility: assessInitiativeImplementationCommitmentEligibilityForResolved,
  };

async function assertInitiativeAncestry(
  initiativeId: string,
  deps: Pick<InitiativeImplementationCommitmentAncestryDependencies, "getInitiative">,
): Promise<{ ancestry: DirectInitiativeAncestry; initiative: Initiative }> {
  const resolvedInitiativeBox: { value: Initiative | null } = { value: null };

  // Enforcement boundary: confirms the Initiative exists and is well-formed
  // before Decision eligibility or persistence, regardless of caller.
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
 * Resolves the Collective Decision exactly once and applies the
 * pre-existing, Initiative-scoped eligibility rule (which includes the
 * Initiative/Decision consistency invariant). Distinguishes the specific
 * Initiative/Decision mismatch invariant with a dedicated typed error
 * while preserving the exact pre-existing message text for every other
 * Decision-related reason ("not found", "must be closed").
 */
function assertEligibleDecision(
  initiative: Initiative,
  ancestry: DirectInitiativeAncestry,
  decisionId: string,
  deps: Pick<InitiativeImplementationCommitmentAncestryDependencies, "getDecision" | "assessEligibility">,
): { decision: InitiativeCollectiveDecision } {
  const decision = deps.getDecision(decisionId);
  const eligibility = deps.assessEligibility(initiative, decision);

  if (!eligibility.eligible) {
    const reason =
      eligibility.reasons[0] ?? "Initiative is not eligible for an implementation commitment.";

    if (decision && decision.initiativeId !== ancestry.initiativeId) {
      throw new ImplementationCommitmentInitiativeMismatchError(reason);
    }

    throw new Error(reason);
  }

  if (!decision) {
    // Unreachable: assessEligibility can only return eligible: true when a
    // non-null decision was supplied (see
    // assessInitiativeImplementationCommitmentEligibilityForResolved).
    throw new Error("Collective decision not found.");
  }

  return { decision };
}

export interface UpdateInitiativeImplementationCommitmentDraftInput {
  organizationName?: string;
  commitmentTitle?: string;
  commitmentSummary?: string;
  commitmentScope?: string;
  expectedStartDate?: string;
  expectedCompletionDate?: string;
}

function getOwnedCommitment(
  commitmentId: string,
  identity: RequestIdentity,
): InitiativeImplementationCommitment {
  const commitment = getCommitmentById(commitmentId);

  if (!commitment) {
    throw new Error("Implementation commitment not found.");
  }

  if (commitment.participantId !== identity.participantId) {
    throw new Error("You do not have access to this implementation commitment.");
  }

  return commitment;
}

function assertTransitionAllowed(
  commitment: InitiativeImplementationCommitment,
  nextStatus: InitiativeImplementationCommitmentStatus,
): void {
  if (isInitiativeImplementationCommitmentTerminal(commitment.status)) {
    throw new Error(
      `Implementation commitment in status "${commitment.status}" cannot be changed.`,
    );
  }

  if (!canTransitionInitiativeImplementationCommitment(commitment.status, nextStatus)) {
    throw new Error(
      `Implementation commitment cannot transition from "${commitment.status}" to "${nextStatus}".`,
    );
  }
}

function assertDraftEditable(commitment: InitiativeImplementationCommitment): void {
  if (commitment.status !== "draft") {
    throw new Error("Only draft implementation commitments can be edited.");
  }
}

export function listMyInitiativeImplementationCommitments(
  identity: RequestIdentity,
): InitiativeImplementationCommitment[] {
  return listCommitmentsByParticipant(identity.participantId);
}

export function listMyInitiativeImplementationCommitmentsForDecision(
  identity: RequestIdentity,
  decisionId: string,
): InitiativeImplementationCommitment[] {
  return listCommitmentsByDecision(decisionId).filter(
    (commitment) => commitment.participantId === identity.participantId,
  );
}

export function getMyInitiativeImplementationCommitment(
  identity: RequestIdentity,
  commitmentId: string,
): InitiativeImplementationCommitment {
  return getOwnedCommitment(commitmentId, identity);
}

export async function createInitiativeImplementationCommitmentDraft(
  identity: RequestIdentity,
  input: CreateInitiativeImplementationCommitmentDraftInput,
  deps: InitiativeImplementationCommitmentAncestryDependencies = defaultInitiativeImplementationCommitmentAncestryDependencies,
): Promise<InitiativeImplementationCommitment> {
  const { ancestry, initiative } = await assertInitiativeAncestry(input.initiativeId, deps);

  assertEligibleDecision(initiative, ancestry, input.decisionId, deps);

  const now = new Date().toISOString();

  const commitment: InitiativeImplementationCommitment = {
    commitmentId: `implementation-commitment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    // Persisted initiativeId is sourced from the validated ancestry result,
    // not directly from the unchecked input.
    initiativeId: ancestry.initiativeId,
    decisionId: input.decisionId,
    participantId: identity.participantId,
    organizationName: input.organizationName,
    commitmentTitle: input.commitmentTitle,
    commitmentSummary: input.commitmentSummary,
    commitmentScope: input.commitmentScope,
    expectedStartDate: input.expectedStartDate,
    expectedCompletionDate: input.expectedCompletionDate,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  return createCommitment(commitment);
}

export function updateInitiativeImplementationCommitmentDraft(
  identity: RequestIdentity,
  commitmentId: string,
  input: UpdateInitiativeImplementationCommitmentDraftInput,
): InitiativeImplementationCommitment {
  const commitment = getOwnedCommitment(commitmentId, identity);

  assertDraftEditable(commitment);

  const updated = updateCommitment(commitmentId, input);

  if (!updated) {
    throw new Error("Implementation commitment not found.");
  }

  return updated;
}

export function publishInitiativeImplementationCommitment(
  identity: RequestIdentity,
  commitmentId: string,
): InitiativeImplementationCommitment {
  const commitment = getOwnedCommitment(commitmentId, identity);

  assertTransitionAllowed(commitment, "published");

  const updated = updateCommitment(commitmentId, {
    status: "published",
    publishedAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Implementation commitment not found.");
  }

  emitCivicNotificationEvent({
    eventType: "commitment_published",
    entityType: "implementation_commitment",
    entityId: commitmentId,
    initiativeId: updated.initiativeId,
    actorMemberId: identity.participantId,
  });

  return updated;
}

export function withdrawInitiativeImplementationCommitment(
  identity: RequestIdentity,
  commitmentId: string,
): InitiativeImplementationCommitment {
  const commitment = getOwnedCommitment(commitmentId, identity);

  assertTransitionAllowed(commitment, "withdrawn");

  const updated = updateCommitment(commitmentId, {
    status: "withdrawn",
    withdrawnAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Implementation commitment not found.");
  }

  return updated;
}

export function completeInitiativeImplementationCommitment(
  identity: RequestIdentity,
  commitmentId: string,
): InitiativeImplementationCommitment {
  const commitment = getOwnedCommitment(commitmentId, identity);

  assertTransitionAllowed(commitment, "completed");

  const updated = updateCommitment(commitmentId, {
    status: "completed",
    completedAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Implementation commitment not found.");
  }

  return updated;
}
