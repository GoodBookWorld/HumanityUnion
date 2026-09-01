import type {
  Initiative,
  InitiativeImplementationTracking,
  InitiativePublicImpact,
  InitiativePublicImpactStatus,
  PublicImpactEvidence,
  PublicImpactEvidenceReferenceType,
  TransitiveInitiativeAncestry,
} from "@hu/types";
import {
  canTransitionInitiativePublicImpact,
  isInitiativePublicImpactTerminal,
  PUBLIC_IMPACT_EVIDENCE_REFERENCE_TYPES,
} from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getTrackingById } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { assessInitiativePublicImpactEligibilityForResolved } from "./initiative-public-impact-eligibility.js";
import {
  InitiativeAncestryMissingError,
  ParentArtifactNotFoundError,
  validateTransitiveInitiativeAncestry,
  type InitiativeExistenceChecker,
  type ParentArtifactInitiativeResolver,
} from "../../shared/initiative-ancestry/index.js";
import {
  appendPublicImpactEvidence,
  countEvidenceForImpact,
  createImpact,
  getImpactById,
  listEvidenceByImpact,
  listImpactsByParticipant,
  listImpactsByTracking,
  updateImpact,
} from "./initiative-public-impact.store.js";
import { emitCivicNotificationEvent } from "../notifications/notification.service.js";
import { scheduleContentTranslationWarmAfterMutation } from "../language/content-translation-warm-enqueue.js";

export interface CreateInitiativePublicImpactDraftInput {
  trackingId: string;
  title: string;
  summary: string;
  observedImpact: string;
  affectedCommunity: string;
  evidenceSummary: string;
}

/**
 * Initiative Ancestry — Recovery Task 17.
 *
 * Domain classification: `InitiativePublicImpact` stores its own
 * `initiativeId` field, but `CreateInitiativePublicImpactDraftInput` carries
 * only a `trackingId` — there is no independently-supplied `initiativeId`
 * anywhere in the creation path. Initiative identity has always been derived
 * entirely from the referenced, completed Implementation Tracking record
 * (`initiativeId: tracking.initiativeId`, pre-Task-17). This is the same
 * **Model B — transitive Tracking child** shape Task 16 found for
 * Implementation Tracking's own relationship to Implementation Commitment:
 * there is no second, independently-supplied Initiative reference to
 * reconcile, so no mismatch is structurally reachable and no
 * `PublicImpactInitiativeMismatchError` is introduced. Public Impact remains
 * an independent aggregate root (own store, id, lifecycle) — not embedded in
 * Tracking and not a mere projection (the separate
 * `public-initiative-public-impact.projection.ts` is a downstream read
 * projection built FROM this aggregate, not the aggregate itself) — but its
 * Initiative *ancestry* is transitive through Tracking, matching Recovery
 * Task 11's canonical vocabulary: `"impact"` (this module) is a transitive
 * child reachable via the `"implementation"` parent type
 * (= `initiative-implementation-tracking`, per Task 11).
 *
 * Ancestry mechanism: `resolvePublicImpactInitiativeAncestry` is the second
 * production consumer of `validateTransitiveInitiativeAncestry` with a
 * `"implementation"` parent type (after Task 16's own consumption of
 * `"implementation_commitment"` for Tracking), using an Impact-local
 * `ParentArtifactInitiativeResolver` (`createImpactParentTrackingResolver`)
 * that resolves exclusively through
 * `initiative-implementation-tracking.store.js`. Any other
 * `parentArtifactType` fails explicitly (`{ found: false }`) — unreachable in
 * production since this module always supplies the literal
 * `"implementation"`.
 *
 * This closes a real gap: before Task 17, Initiative existence was never
 * checked at all — `tracking.initiativeId` was copied blindly. The shared
 * validator's `InitiativeExistenceChecker` now verifies the Initiative still
 * exists before a Public Impact draft can be created.
 *
 * Single resolution (Part 5/13): both the parent resolver and the Initiative
 * existence checker capture their resolved object into a box, so Tracking
 * and Initiative are each looked up exactly once per creation call, and the
 * resolved Tracking is reused by eligibility assessment
 * (`assessInitiativePublicImpactEligibilityForResolved`) instead of being
 * looked up a second time (pre-Task-17 looked it up twice: once inside
 * `assertInitiativePublicImpactEligible`, once again in the service body).
 * Commitment and Decision are never looked up — unchanged, since this module
 * never stored, accepted, or needed a `commitmentId`/`decisionId` before or
 * after this task (0 lookups each).
 *
 * `verifyInitiativePublicImpact` performs its own, separate
 * `getInitiativeById(impact.initiativeId)` lookup for Initiative-steward
 * verification authorization — this is untouched by Task 17: it operates on
 * an already-persisted Impact record whose `initiativeId` is now guaranteed
 * ancestry-validated at creation time, and its own lookup/ownership check is
 * an authorization concern, not a creation-time ancestry concern.
 *
 * Error-message compatibility (Part 15): `ParentArtifactNotFoundError` and
 * `InitiativeAncestryMissingError` (tracking id resolves to nothing / is not
 * supplied) are both translated back to the pre-existing
 * `"Implementation tracking not found."` message, preserving the exact
 * wording eligibility assessment already used. `InitiativeIdMalformedError`,
 * `InitiativeNotFoundError`, and `ParentArtifactMissingInitiativeAncestryError`
 * are left untranslated (new, more accurate failure surfaces for cases that
 * were previously silently unchecked); the last is unreachable for any
 * Tracking created through the real service (Task 16 validates Initiative
 * ancestry at Tracking creation).
 */
export interface InitiativePublicImpactAncestryDependencies {
  readonly getTracking: (trackingId: string) => InitiativeImplementationTracking | null;
  readonly getInitiative: (initiativeId: string) => Initiative | null;
}

const defaultInitiativePublicImpactAncestryDependencies: InitiativePublicImpactAncestryDependencies =
  {
    getTracking: getTrackingById,
    getInitiative: getInitiativeById,
  };

/**
 * Production `ParentArtifactInitiativeResolver` for Public Impact's sole
 * supported transitive parent type, canonical `"implementation"`
 * (= `initiative-implementation-tracking`, per Recovery Task 11). Captures
 * the resolved Tracking into `resolvedTrackingBox` so the caller can reuse
 * it after ancestry succeeds instead of looking it up again.
 *
 * Exported so its "fail explicitly for any non-tracking parent type" and
 * single-resolution capture behavior can be tested directly, since
 * `resolvePublicImpactInitiativeAncestry` always supplies the literal
 * `"implementation"` and can never exercise those branches itself.
 */
export function createImpactParentTrackingResolver(
  getTracking: InitiativePublicImpactAncestryDependencies["getTracking"],
  resolvedTrackingBox: { value: InitiativeImplementationTracking | null },
): ParentArtifactInitiativeResolver {
  return {
    resolveParentInitiativeId(parentArtifactType, parentArtifactId) {
      if (parentArtifactType !== "implementation") {
        // Fail explicitly instead of silently resolving another module.
        // Unreachable in production: this adapter is only ever invoked
        // (below) with the literal "implementation" parent type.
        return { found: false };
      }

      const tracking = getTracking(parentArtifactId);
      resolvedTrackingBox.value = tracking;

      return tracking ? { found: true, initiativeId: tracking.initiativeId } : { found: false };
    },
  };
}

/**
 * Production `InitiativeExistenceChecker` for Public Impact. Captures the
 * resolved Initiative into `resolvedInitiativeBox` for parity with the
 * pattern used by Vote (Task 12), Implementation Commitment (Task 15), and
 * Implementation Tracking (Task 16), even though this module does not
 * currently reuse the Initiative object itself (eligibility only needs the
 * resolved Tracking).
 *
 * Exported for the same direct-testability reason as
 * {@link createImpactParentTrackingResolver}.
 */
export function createImpactInitiativeExistenceChecker(
  getInitiative: InitiativePublicImpactAncestryDependencies["getInitiative"],
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
 * `createInitiativePublicImpactDraft`) so ancestry enforcement can be tested
 * in isolation with fully in-memory fakes.
 */
export async function resolvePublicImpactInitiativeAncestry(
  trackingId: string,
  deps: InitiativePublicImpactAncestryDependencies,
): Promise<{
  tracking: InitiativeImplementationTracking;
  initiative: Initiative;
  ancestry: TransitiveInitiativeAncestry;
}> {
  const resolvedTrackingBox: { value: InitiativeImplementationTracking | null } = { value: null };
  const resolvedInitiativeBox: { value: Initiative | null } = { value: null };

  let ancestry: TransitiveInitiativeAncestry;

  try {
    ancestry = await validateTransitiveInitiativeAncestry(
      { parentArtifactType: "implementation", parentArtifactId: trackingId },
      {
        ...createImpactParentTrackingResolver(deps.getTracking, resolvedTrackingBox),
        ...createImpactInitiativeExistenceChecker(deps.getInitiative, resolvedInitiativeBox),
      },
    );
  } catch (error) {
    if (
      error instanceof ParentArtifactNotFoundError ||
      error instanceof InitiativeAncestryMissingError
    ) {
      throw new Error("Implementation tracking not found.");
    }

    throw error;
  }

  const tracking = resolvedTrackingBox.value;
  const initiative = resolvedInitiativeBox.value;

  if (!tracking) {
    // Unreachable: the resolver only reports found:true after storing a
    // non-null tracking in the box.
    throw new Error("Implementation tracking not found.");
  }

  if (!initiative) {
    // Unreachable in practice (see module doc comment above); defensive
    // guard only, matching the pattern used by Tasks 09-16.
    throw new Error("Initiative not found.");
  }

  return { tracking, initiative, ancestry };
}

export interface UpdateInitiativePublicImpactDraftInput {
  title?: string;
  summary?: string;
  observedImpact?: string;
  affectedCommunity?: string;
  evidenceSummary?: string;
}

export interface AddPublicImpactEvidenceInput {
  title: string;
  description: string;
  referenceUrl?: string;
  referenceType: PublicImpactEvidenceReferenceType;
}

function getOwnedImpact(impactId: string, identity: RequestIdentity): InitiativePublicImpact {
  const impact = getImpactById(impactId);

  if (!impact) {
    throw new Error("Public impact record not found.");
  }

  if (impact.participantId !== identity.participantId) {
    throw new Error("You do not have access to this public impact record.");
  }

  return impact;
}

function assertTransitionAllowed(
  impact: InitiativePublicImpact,
  nextStatus: InitiativePublicImpactStatus,
): void {
  if (isInitiativePublicImpactTerminal(impact.status)) {
    throw new Error(`Public impact in status "${impact.status}" cannot be changed.`);
  }

  if (!canTransitionInitiativePublicImpact(impact.status, nextStatus)) {
    throw new Error(`Public impact cannot transition from "${impact.status}" to "${nextStatus}".`);
  }
}

function assertDraftEditable(impact: InitiativePublicImpact): void {
  if (impact.status !== "draft") {
    throw new Error("Only draft public impact records can be edited.");
  }
}

function assertEvidenceReferenceType(referenceType: PublicImpactEvidenceReferenceType): void {
  if (!PUBLIC_IMPACT_EVIDENCE_REFERENCE_TYPES.includes(referenceType)) {
    throw new Error("Invalid public impact evidence reference type.");
  }
}

function assertEvidenceExpandable(impact: InitiativePublicImpact): void {
  if (impact.status === "archived") {
    throw new Error("Evidence cannot be added to archived public impact records.");
  }
}

export function listMyInitiativePublicImpacts(identity: RequestIdentity): InitiativePublicImpact[] {
  return listImpactsByParticipant(identity.participantId);
}

export function listMyInitiativePublicImpactsForTracking(
  identity: RequestIdentity,
  trackingId: string,
): InitiativePublicImpact[] {
  return listImpactsByTracking(trackingId).filter(
    (impact) => impact.participantId === identity.participantId,
  );
}

export function getMyInitiativePublicImpact(
  identity: RequestIdentity,
  impactId: string,
): InitiativePublicImpact {
  return getOwnedImpact(impactId, identity);
}

export function listPublicImpactEvidence(
  identity: RequestIdentity,
  impactId: string,
): PublicImpactEvidence[] {
  getOwnedImpact(impactId, identity);

  return listEvidenceByImpact(impactId);
}

export async function createInitiativePublicImpactDraft(
  identity: RequestIdentity,
  input: CreateInitiativePublicImpactDraftInput,
  deps: InitiativePublicImpactAncestryDependencies = defaultInitiativePublicImpactAncestryDependencies,
): Promise<InitiativePublicImpact> {
  const { tracking, ancestry } = await resolvePublicImpactInitiativeAncestry(
    input.trackingId,
    deps,
  );

  const eligibility = assessInitiativePublicImpactEligibilityForResolved(
    tracking,
    identity.participantId,
  );

  if (!eligibility.eligible) {
    throw new Error(eligibility.reasons.join(" "));
  }

  const now = new Date().toISOString();

  const impact: InitiativePublicImpact = {
    impactId: `public-impact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    initiativeId: ancestry.initiativeId,
    trackingId: tracking.trackingId,
    participantId: identity.participantId,
    title: input.title,
    summary: input.summary,
    observedImpact: input.observedImpact,
    affectedCommunity: input.affectedCommunity,
    evidenceSummary: input.evidenceSummary,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  return createImpact(impact);
}

export function updateInitiativePublicImpactDraft(
  identity: RequestIdentity,
  impactId: string,
  input: UpdateInitiativePublicImpactDraftInput,
): InitiativePublicImpact {
  const impact = getOwnedImpact(impactId, identity);

  assertDraftEditable(impact);

  const updated = updateImpact(impactId, input);

  if (!updated) {
    throw new Error("Public impact record not found.");
  }

  return updated;
}

export function publishInitiativePublicImpact(
  identity: RequestIdentity,
  impactId: string,
): InitiativePublicImpact {
  const impact = getOwnedImpact(impactId, identity);

  assertTransitionAllowed(impact, "published");

  if (countEvidenceForImpact(impactId) < 1) {
    throw new Error("Public impact requires at least one evidence entry before publishing.");
  }

  const updated = updateImpact(impactId, {
    status: "published",
    publishedAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Public impact record not found.");
  }

  scheduleContentTranslationWarmAfterMutation({
    sourceKind: "public_impact",
    sourceRecordId: impactId,
    reason: "public_mutation",
  });

  return updated;
}

export function archiveInitiativePublicImpact(
  identity: RequestIdentity,
  impactId: string,
): InitiativePublicImpact {
  const impact = getOwnedImpact(impactId, identity);

  assertTransitionAllowed(impact, "archived");

  const updated = updateImpact(impactId, {
    status: "archived",
    archivedAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Public impact record not found.");
  }

  return updated;
}

export function verifyInitiativePublicImpact(
  identity: RequestIdentity,
  impactId: string,
): InitiativePublicImpact {
  const impact = getImpactById(impactId);

  if (!impact) {
    throw new Error("Public impact record not found.");
  }

  const initiative = getInitiativeById(impact.initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);
  assertTransitionAllowed(impact, "verified");

  if (impact.status !== "published") {
    throw new Error("Only published public impact records can be verified.");
  }

  if (countEvidenceForImpact(impactId) < 1) {
    throw new Error("Public impact verification requires evidence.");
  }

  const updated = updateImpact(impactId, {
    status: "verified",
    verifiedAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Public impact record not found.");
  }

  emitCivicNotificationEvent({
    eventType: "impact_verified",
    entityType: "public_impact",
    entityId: impactId,
    initiativeId: updated.initiativeId,
    actorMemberId: identity.participantId,
  });

  return updated;
}

export function addPublicImpactEvidence(
  identity: RequestIdentity,
  impactId: string,
  input: AddPublicImpactEvidenceInput,
): PublicImpactEvidence {
  const impact = getOwnedImpact(impactId, identity);

  assertEvidenceExpandable(impact);
  assertEvidenceReferenceType(input.referenceType);

  const now = new Date().toISOString();

  const item: PublicImpactEvidence = {
    evidenceId: `public-impact-evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    impactId,
    title: input.title,
    description: input.description,
    referenceUrl: input.referenceUrl,
    referenceType: input.referenceType,
    authorId: identity.participantId,
    createdAt: now,
  };

  appendPublicImpactEvidence(item);

  if (impact.status === "published" || impact.status === "verified") {
    scheduleContentTranslationWarmAfterMutation({
      sourceKind: "public_impact",
      sourceRecordId: impactId,
      reason: "public_update",
    });
  }

  return item;
}
