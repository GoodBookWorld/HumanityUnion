import type {
  InitiativePublicImpact,
  InitiativePublicImpactStatus,
  PublicImpactEvidence,
  PublicImpactEvidenceReferenceType,
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
import { assertInitiativePublicImpactEligible } from "./initiative-public-impact-eligibility.js";
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

export interface CreateInitiativePublicImpactDraftInput {
  trackingId: string;
  title: string;
  summary: string;
  observedImpact: string;
  affectedCommunity: string;
  evidenceSummary: string;
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

export function createInitiativePublicImpactDraft(
  identity: RequestIdentity,
  input: CreateInitiativePublicImpactDraftInput,
): InitiativePublicImpact {
  assertInitiativePublicImpactEligible(input.trackingId, identity.participantId);

  const tracking = getTrackingById(input.trackingId);

  if (!tracking) {
    throw new Error("Implementation tracking not found.");
  }

  const now = new Date().toISOString();

  const impact: InitiativePublicImpact = {
    impactId: `public-impact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    initiativeId: tracking.initiativeId,
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

  return item;
}
