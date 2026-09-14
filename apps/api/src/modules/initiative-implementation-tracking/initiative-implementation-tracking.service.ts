import type {
  ImplementationTrackingUpdate,
  Initiative,
  InitiativeImplementationCommitment,
  InitiativeImplementationTracking,
  InitiativeImplementationTrackingStatus,
  TransitiveInitiativeAncestry,
} from "@hu/types";
import {
  canTransitionInitiativeImplementationTracking,
  isInitiativeImplementationTrackingTerminal,
} from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getCommitmentById } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { hasAcceptedImplementationResponsibility } from "../initiative-implementation-commitment/initiative-implementation-commitment-responsibility.js";
import { assessInitiativeImplementationTrackingEligibilityForResolved } from "./initiative-implementation-tracking-eligibility.js";
import { emitCivicNotificationEvent } from "../notifications/notification.service.js";
import { scheduleContentTranslationWarmAfterMutation } from "../language/content-translation-warm-enqueue.js";
import {
  InitiativeAncestryMissingError,
  ParentArtifactNotFoundError,
  validateTransitiveInitiativeAncestry,
  type InitiativeExistenceChecker,
  type ParentArtifactInitiativeResolver,
} from "../../shared/initiative-ancestry/index.js";
import {
  appendTrackingUpdate,
  countUpdatesForTracking,
  createTracking,
  getTrackingById,
  listTrackingsByCommitment,
  listTrackingsByParticipant,
  listUpdatesByParticipant,
  listUpdatesByTracking,
  updateTracking,
} from "./initiative-implementation-tracking.store.js";

export interface CreateInitiativeImplementationTrackingDraftInput {
  commitmentId: string;
  currentStage: string;
  summary: string;
}

/**
 * Initiative Ancestry — Recovery Task 16.
 *
 * Domain classification: `InitiativeImplementationTracking` stores its own
 * `initiativeId` field, but `CreateInitiativeImplementationTrackingDraftInput`
 * carries only a `commitmentId` — there is no independently-supplied
 * `initiativeId` anywhere in the creation path. Initiative identity has
 * always been derived entirely from the referenced, published Implementation
 * Commitment (`initiativeId: commitment.initiativeId`, pre-Task-16). This is
 * **Model B — a transitive Commitment child** (the same shape Task 12 found
 * for Vote's "decision" parent), NOT Model C (direct with mandatory
 * Commitment consistency, used by Task 15's Implementation Commitment for
 * its Decision parent): there is no second, independently-supplied
 * Initiative reference to reconcile, so no mismatch is structurally
 * reachable and no
 * `ImplementationTrackingInitiativeMismatchError` is introduced. Tracking
 * remains an independent aggregate root (its own store, id, and lifecycle) —
 * it is not embedded within Commitment and not a mere projection — but its
 * Initiative *ancestry* is transitive through Commitment, matching Recovery
 * Task 11's canonical vocabulary: `"implementation"` (this module) is a
 * transitive child reachable via the `"implementation_commitment"` parent
 * type.
 *
 * Ancestry mechanism: `resolveTrackingInitiativeAncestry` is the first
 * production consumer of `validateTransitiveInitiativeAncestry` with
 * `{ parentArtifactType: "implementation_commitment", parentArtifactId }`,
 * using a Tracking-local `ParentArtifactInitiativeResolver`
 * (`createTrackingParentCommitmentResolver`) that resolves exclusively
 * through `initiative-implementation-commitment.store.js`. Any other
 * `parentArtifactType` fails explicitly (`{ found: false }`) — unreachable in
 * production since this module always supplies the literal
 * `"implementation_commitment"`.
 *
 * This closes a real gap: before Task 16, Initiative existence was never
 * checked at all — `commitment.initiativeId` was copied blindly. The shared
 * validator's `InitiativeExistenceChecker` now verifies the Initiative still
 * exists before a Tracking draft can be created.
 *
 * Single resolution (Part 5/13): both the parent resolver and the Initiative
 * existence checker capture their resolved object into a box, so Commitment
 * and Initiative are each looked up exactly once per creation call, and the
 * resolved Commitment is reused by eligibility assessment
 * (`assessInitiativeImplementationTrackingEligibilityForResolved`) instead of
 * being looked up a second time (pre-Task-16 looked it up twice: once inside
 * `assertInitiativeImplementationTrackingEligible`, once again in the
 * service body). Decision is never looked up — unchanged, since this module
 * never stored, accepted, or needed a `decisionId` before or after this task.
 *
 * Error-message compatibility (Part 15): `ParentArtifactNotFoundError` and
 * `InitiativeAncestryMissingError` (commitment id resolves to nothing / is
 * not supplied) are both translated back to the pre-existing
 * `"Implementation commitment not found."` message, preserving the exact
 * wording eligibility assessment already used. `InitiativeIdMalformedError`,
 * `InitiativeNotFoundError`, and `ParentArtifactMissingInitiativeAncestryError`
 * are left untranslated (new, more accurate failure surfaces for cases that
 * were previously silently unchecked); the last is unreachable for any
 * Commitment created through the real service (Task 15 validates Initiative
 * ancestry at Commitment creation).
 */
export interface InitiativeImplementationTrackingAncestryDependencies {
  readonly getCommitment: (commitmentId: string) => InitiativeImplementationCommitment | null;
  readonly getInitiative: (initiativeId: string) => Initiative | null;
}

const defaultInitiativeImplementationTrackingAncestryDependencies: InitiativeImplementationTrackingAncestryDependencies =
  {
    getCommitment: getCommitmentById,
    getInitiative: getInitiativeById,
  };

/**
 * Production `ParentArtifactInitiativeResolver` for Tracking's sole
 * supported transitive parent type, canonical `"implementation_commitment"`
 * (= `initiative-implementation-commitment`, per Recovery Task 11). Captures
 * the resolved Commitment into `resolvedCommitmentBox` so the caller can
 * reuse it after ancestry succeeds instead of looking it up again.
 *
 * Exported so its "fail explicitly for any non-commitment parent type" and
 * single-resolution capture behavior can be tested directly, since
 * `resolveTrackingInitiativeAncestry` always supplies the literal
 * `"implementation_commitment"` and can never exercise those branches itself.
 */
export function createTrackingParentCommitmentResolver(
  getCommitment: InitiativeImplementationTrackingAncestryDependencies["getCommitment"],
  resolvedCommitmentBox: { value: InitiativeImplementationCommitment | null },
): ParentArtifactInitiativeResolver {
  return {
    resolveParentInitiativeId(parentArtifactType, parentArtifactId) {
      if (parentArtifactType !== "implementation_commitment") {
        // Fail explicitly instead of silently resolving another module.
        // Unreachable in production: this adapter is only ever invoked
        // (below) with the literal "implementation_commitment" parent type.
        return { found: false };
      }

      const commitment = getCommitment(parentArtifactId);
      resolvedCommitmentBox.value = commitment;

      return commitment
        ? { found: true, initiativeId: commitment.initiativeId }
        : { found: false };
    },
  };
}

/**
 * Production `InitiativeExistenceChecker` for Tracking. Captures the
 * resolved Initiative into `resolvedInitiativeBox` for parity with the
 * pattern used by Vote (Task 12) and Implementation Commitment (Task 15),
 * even though this module does not currently reuse the Initiative object
 * itself (eligibility only needs the resolved Commitment).
 *
 * Exported for the same direct-testability reason as
 * {@link createTrackingParentCommitmentResolver}.
 */
export function createTrackingInitiativeExistenceChecker(
  getInitiative: InitiativeImplementationTrackingAncestryDependencies["getInitiative"],
  resolvedInitiativeBox: { value: Initiative | null },
): InitiativeExistenceChecker {
  return {
    initiativeExists(initiativeId) {
      const initiative = getInitiative(initiativeId);
      resolvedInitiativeBox.value = initiative;
      return initiative !== null;
    },
  };
}

/**
 * Exported (in addition to being used internally by
 * `createInitiativeImplementationTrackingDraft`) so ancestry enforcement can
 * be tested in isolation with fully in-memory fakes.
 */
export async function resolveTrackingInitiativeAncestry(
  commitmentId: string,
  deps: InitiativeImplementationTrackingAncestryDependencies,
): Promise<{
  commitment: InitiativeImplementationCommitment;
  initiative: Initiative;
  ancestry: TransitiveInitiativeAncestry;
}> {
  const resolvedCommitmentBox: { value: InitiativeImplementationCommitment | null } = {
    value: null,
  };
  const resolvedInitiativeBox: { value: Initiative | null } = { value: null };

  let ancestry: TransitiveInitiativeAncestry;

  try {
    ancestry = await validateTransitiveInitiativeAncestry(
      { parentArtifactType: "implementation_commitment", parentArtifactId: commitmentId },
      {
        ...createTrackingParentCommitmentResolver(deps.getCommitment, resolvedCommitmentBox),
        ...createTrackingInitiativeExistenceChecker(deps.getInitiative, resolvedInitiativeBox),
      },
    );
  } catch (error) {
    if (
      error instanceof ParentArtifactNotFoundError ||
      error instanceof InitiativeAncestryMissingError
    ) {
      throw new Error("Implementation commitment not found.");
    }

    throw error;
  }

  const commitment = resolvedCommitmentBox.value;
  const initiative = resolvedInitiativeBox.value;

  if (!commitment) {
    // Unreachable: the resolver only reports found:true after storing a
    // non-null commitment in the box.
    throw new Error("Implementation commitment not found.");
  }

  if (!initiative) {
    // Unreachable in practice (see module doc comment above); defensive
    // guard only, matching the pattern used by Tasks 09-15.
    throw new Error("Initiative not found.");
  }

  return { commitment, initiative, ancestry };
}

export interface UpdateInitiativeImplementationTrackingDraftInput {
  currentStage?: string;
  summary?: string;
}

export interface AddImplementationTrackingUpdateInput {
  title: string;
  summary: string;
  evidence: string;
  references?: string[];
  currentStage?: string;
}

function getOwnedTracking(
  trackingId: string,
  identity: RequestIdentity,
): InitiativeImplementationTracking {
  const tracking = getTrackingById(trackingId);

  if (!tracking) {
    throw new Error("Implementation tracking not found.");
  }

  const commitment = getCommitmentById(tracking.commitmentId);

  if (!commitment || !hasAcceptedImplementationResponsibility(commitment, identity.participantId)) {
    throw new Error("You do not have access to this implementation tracking.");
  }

  return tracking;
}

function assertTransitionAllowed(
  tracking: InitiativeImplementationTracking,
  nextStatus: InitiativeImplementationTrackingStatus,
): void {
  if (isInitiativeImplementationTrackingTerminal(tracking.status)) {
    throw new Error(`Implementation tracking in status "${tracking.status}" cannot be changed.`);
  }

  if (!canTransitionInitiativeImplementationTracking(tracking.status, nextStatus)) {
    throw new Error(
      `Implementation tracking cannot transition from "${tracking.status}" to "${nextStatus}".`,
    );
  }
}

function assertDraftEditable(tracking: InitiativeImplementationTracking): void {
  if (tracking.status !== "draft") {
    throw new Error("Only draft implementation tracking can be edited.");
  }
}

export function listMyInitiativeImplementationTrackings(
  identity: RequestIdentity,
): InitiativeImplementationTracking[] {
  return listTrackingsByParticipant(identity.participantId);
}

export function listMyInitiativeImplementationTrackingUpdates(
  identity: RequestIdentity,
): ImplementationTrackingUpdate[] {
  return listUpdatesByParticipant(identity.participantId);
}

export function listMyInitiativeImplementationTrackingsForCommitment(
  identity: RequestIdentity,
  commitmentId: string,
): InitiativeImplementationTracking[] {
  return listTrackingsByCommitment(commitmentId).filter(
    (tracking) => tracking.participantId === identity.participantId,
  );
}

export function getMyInitiativeImplementationTracking(
  identity: RequestIdentity,
  trackingId: string,
): InitiativeImplementationTracking {
  return getOwnedTracking(trackingId, identity);
}

export function listImplementationTrackingUpdates(
  identity: RequestIdentity,
  trackingId: string,
): ImplementationTrackingUpdate[] {
  getOwnedTracking(trackingId, identity);

  return listUpdatesByTracking(trackingId);
}

export async function createInitiativeImplementationTrackingDraft(
  identity: RequestIdentity,
  input: CreateInitiativeImplementationTrackingDraftInput,
  deps: InitiativeImplementationTrackingAncestryDependencies = defaultInitiativeImplementationTrackingAncestryDependencies,
): Promise<InitiativeImplementationTracking> {
  const { commitment, ancestry } = await resolveTrackingInitiativeAncestry(
    input.commitmentId,
    deps,
  );

  const eligibility = assessInitiativeImplementationTrackingEligibilityForResolved(
    commitment,
    identity.participantId,
  );

  if (!eligibility.eligible) {
    throw new Error(eligibility.reasons.join(" "));
  }

  const now = new Date().toISOString();

  const tracking: InitiativeImplementationTracking = {
    trackingId: `implementation-tracking-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    commitmentId: commitment.commitmentId,
    initiativeId: ancestry.initiativeId,
    participantId: identity.participantId,
    status: "draft",
    currentStage: input.currentStage,
    summary: input.summary,
    createdAt: now,
    updatedAt: now,
  };

  return createTracking(tracking);
}

export function updateInitiativeImplementationTrackingDraft(
  identity: RequestIdentity,
  trackingId: string,
  input: UpdateInitiativeImplementationTrackingDraftInput,
): InitiativeImplementationTracking {
  const tracking = getOwnedTracking(trackingId, identity);

  assertDraftEditable(tracking);

  const updated = updateTracking(trackingId, input);

  if (!updated) {
    throw new Error("Implementation tracking not found.");
  }

  return updated;
}

export function activateInitiativeImplementationTracking(
  identity: RequestIdentity,
  trackingId: string,
): InitiativeImplementationTracking {
  const tracking = getOwnedTracking(trackingId, identity);

  assertTransitionAllowed(tracking, "active");

  const updated = updateTracking(trackingId, {
    status: "active",
    activatedAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Implementation tracking not found.");
  }

  scheduleContentTranslationWarmAfterMutation({
    sourceKind: "implementation_tracking",
    sourceRecordId: trackingId,
    reason: "public_mutation",
  });

  return updated;
}

export function addImplementationTrackingUpdate(
  identity: RequestIdentity,
  trackingId: string,
  input: AddImplementationTrackingUpdateInput,
): ImplementationTrackingUpdate {
  const tracking = getOwnedTracking(trackingId, identity);

  if (tracking.status !== "active") {
    throw new Error("Execution updates may only be added while tracking is active.");
  }

  const now = new Date().toISOString();

  const update: ImplementationTrackingUpdate = {
    updateId: `implementation-tracking-update-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    trackingId,
    title: input.title,
    summary: input.summary,
    evidence: input.evidence,
    references: input.references ?? [],
    authorId: identity.participantId,
    createdAt: now,
  };

  appendTrackingUpdate(update);

  if (input.currentStage) {
    updateTracking(trackingId, {
      currentStage: input.currentStage,
    });
  }

  emitCivicNotificationEvent({
    eventType: "tracking_updated",
    entityType: "implementation_tracking",
    entityId: trackingId,
    initiativeId: tracking.initiativeId,
    actorMemberId: identity.participantId,
  });

  scheduleContentTranslationWarmAfterMutation({
    sourceKind: "implementation_tracking",
    sourceRecordId: trackingId,
    reason: "public_update",
  });

  return update;
}

export function completeInitiativeImplementationTracking(
  identity: RequestIdentity,
  trackingId: string,
): InitiativeImplementationTracking {
  const tracking = getOwnedTracking(trackingId, identity);

  assertTransitionAllowed(tracking, "completed");

  if (tracking.status !== "active") {
    throw new Error("Only active implementation tracking can be completed.");
  }

  if (countUpdatesForTracking(trackingId) < 1) {
    throw new Error("Implementation tracking requires at least one execution update to complete.");
  }

  const updated = updateTracking(trackingId, {
    status: "completed",
    completedAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Implementation tracking not found.");
  }

  return updated;
}

export function archiveInitiativeImplementationTracking(
  identity: RequestIdentity,
  trackingId: string,
): InitiativeImplementationTracking {
  const tracking = getOwnedTracking(trackingId, identity);

  assertTransitionAllowed(tracking, "archived");

  const updated = updateTracking(trackingId, {
    status: "archived",
    archivedAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Implementation tracking not found.");
  }

  return updated;
}
