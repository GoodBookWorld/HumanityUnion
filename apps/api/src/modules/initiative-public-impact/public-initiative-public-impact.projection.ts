import type {
  InitiativePublicImpact,
  InitiativePublicImpactMetrics,
  PublicImpactEvidenceListItem,
  PublicInitiativePublicImpactListItem,
  PublicInitiativePublicImpactProjection,
} from "@hu/types";

import { getMemberById } from "../member/member.store.js";
import {
  countEvidenceForImpact,
  getImpactById,
  listEvidenceByImpact,
  listImpactsByInitiative,
  listPublicImpactsByInitiative,
  listPublicImpactsByTracking,
} from "./initiative-public-impact.store.js";

const PUBLIC_STATUSES = new Set<InitiativePublicImpact["status"]>([
  "published",
  "verified",
  "archived",
]);

function resolveAuthorDisplayName(participantId: string): string {
  const member = getMemberById(participantId);

  return member?.profile.displayName ?? "Unknown Participant";
}

function toPublicStatus(
  status: InitiativePublicImpact["status"],
): PublicInitiativePublicImpactProjection["status"] {
  if (!PUBLIC_STATUSES.has(status)) {
    throw new Error("Public impact status is not publicly visible.");
  }

  return status as PublicInitiativePublicImpactProjection["status"];
}

function toPublicEvidenceListItem(
  evidence: ReturnType<typeof listEvidenceByImpact>[number],
): PublicImpactEvidenceListItem {
  return {
    evidenceId: evidence.evidenceId,
    title: evidence.title,
    description: evidence.description,
    referenceUrl: evidence.referenceUrl,
    referenceType: evidence.referenceType,
    createdAt: evidence.createdAt,
    authorDisplayName: resolveAuthorDisplayName(evidence.authorId),
  };
}

function toPublicListItem(impact: InitiativePublicImpact): PublicInitiativePublicImpactListItem {
  return {
    impactId: impact.impactId,
    trackingId: impact.trackingId,
    title: impact.title,
    summary: impact.summary,
    observedImpact: impact.observedImpact,
    affectedCommunity: impact.affectedCommunity,
    status: toPublicStatus(impact.status),
    publishedAt: impact.publishedAt,
    verifiedAt: impact.verifiedAt,
    authorDisplayName: resolveAuthorDisplayName(impact.participantId),
    evidenceCount: countEvidenceForImpact(impact.impactId),
  };
}

export function toPublicInitiativePublicImpactProjection(
  impact: InitiativePublicImpact,
): PublicInitiativePublicImpactProjection {
  return {
    impactId: impact.impactId,
    initiativeId: impact.initiativeId,
    trackingId: impact.trackingId,
    title: impact.title,
    summary: impact.summary,
    observedImpact: impact.observedImpact,
    affectedCommunity: impact.affectedCommunity,
    evidenceSummary: impact.evidenceSummary,
    status: toPublicStatus(impact.status),
    publishedAt: impact.publishedAt,
    verifiedAt: impact.verifiedAt,
    archivedAt: impact.archivedAt,
    authorDisplayName: resolveAuthorDisplayName(impact.participantId),
    evidence: listEvidenceByImpact(impact.impactId).map((item) => toPublicEvidenceListItem(item)),
  };
}

export function computeInitiativePublicImpactMetrics(
  initiativeId: string,
): InitiativePublicImpactMetrics {
  const impacts = listImpactsByInitiative(initiativeId);
  const totalEvidence = impacts.reduce(
    (sum, impact) => sum + countEvidenceForImpact(impact.impactId),
    0,
  );

  return {
    impactCount: impacts.length,
    publishedImpactCount: impacts.filter((impact) => impact.status === "published").length,
    verifiedImpactCount: impacts.filter((impact) => impact.status === "verified").length,
    averageEvidencePerImpact:
      impacts.length === 0 ? 0 : Number((totalEvidence / impacts.length).toFixed(2)),
  };
}

export function listPublicInitiativePublicImpactsForInitiative(
  initiativeId: string,
): PublicInitiativePublicImpactListItem[] {
  return listPublicImpactsByInitiative(initiativeId).map((impact) => toPublicListItem(impact));
}

export function listPublicInitiativePublicImpactsForTracking(
  trackingId: string,
): PublicInitiativePublicImpactListItem[] {
  return listPublicImpactsByTracking(trackingId).map((impact) => toPublicListItem(impact));
}

export function getPublicInitiativePublicImpact(
  impactId: string,
): PublicInitiativePublicImpactProjection | null {
  const impact = getImpactById(impactId);

  if (!impact || !PUBLIC_STATUSES.has(impact.status)) {
    return null;
  }

  return toPublicInitiativePublicImpactProjection(impact);
}
