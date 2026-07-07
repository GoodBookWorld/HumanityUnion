import type {
  CivicActionPackage,
  CivicActionPackageMetrics,
  PublicCivicActionPackageListItem,
  PublicCivicActionPackageProjection,
} from "@hu/types";

import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import {
  getCapByDecisionId,
  getCapById,
  listCaps,
  listCapsByInitiative,
} from "./civic-action-package.store.js";

function buildCivicProcessSummary(content: CivicActionPackage["content"]): string {
  return [
    `${content.collaborativeAnalysesCount} collaborative analysis record(s) informed this initiative.`,
    `${content.improvementProposalsCount} improvement proposal(s) were considered.`,
    `${content.revisionCount} initiative revision(s) preceded this decision.`,
    `Decision session "${content.decisionSessionTitle}" prepared the community for collective decision.`,
  ].join(" ");
}

function buildReferenceLinks(content: CivicActionPackage["content"]) {
  return {
    initiativeUrl: content.publicInitiativeUrl,
    decisionUrl: content.publicDecisionUrl,
    decisionSessionUrl: `/decision-sessions/public/${encodeURIComponent(content.decisionSessionId)}`,
    civicCompatibilityReviewUrl: content.civicCompatibilityReviewId
      ? `/initiatives/public/${encodeURIComponent(content.initiativeId)}#civic-compatibility-review`
      : null,
  };
}

export function toPublicCivicActionPackageListItem(
  capPackage: CivicActionPackage,
): PublicCivicActionPackageListItem {
  return {
    capId: capPackage.capId,
    capNumber: capPackage.capNumber,
    capVersion: capPackage.capVersion,
    status: capPackage.status,
    title: capPackage.title,
    summary: capPackage.summary,
    issuedAt: capPackage.issuedAt,
    initiativeId: capPackage.initiativeId,
    decisionId: capPackage.decisionId,
    decisionQuestion: capPackage.content.decisionQuestion,
    participationScope: capPackage.participationScope,
  };
}

export function toPublicCivicActionPackageProjection(
  capPackage: CivicActionPackage,
): PublicCivicActionPackageProjection {
  const content = capPackage.content;

  return {
    capId: capPackage.capId,
    capNumber: capPackage.capNumber,
    capVersion: capPackage.capVersion,
    status: capPackage.status,
    issuedAt: capPackage.issuedAt,
    title: capPackage.title,
    summary: capPackage.summary,
    participationScope: capPackage.participationScope,
    country: capPackage.country,
    region: capPackage.region,
    community: capPackage.community,
    initiativeId: capPackage.initiativeId,
    initiativeTitle: content.initiativeTitle,
    initiativeVersion: content.initiativeVersion,
    decisionId: capPackage.decisionId,
    decisionQuestion: content.decisionQuestion,
    decisionOutcome: content.decisionOutcome,
    decisionResultSummary: content.decisionResultSummary,
    support: content.verifiedStatistics.support + content.unverifiedStatistics.support,
    doNotSupport:
      content.verifiedStatistics.doNotSupport + content.unverifiedStatistics.doNotSupport,
    abstain: content.verifiedStatistics.abstain + content.unverifiedStatistics.abstain,
    verifiedStatistics: content.verifiedStatistics,
    unverifiedStatistics: content.unverifiedStatistics,
    collaborativeAnalysesCount: content.collaborativeAnalysesCount,
    improvementProposalsCount: content.improvementProposalsCount,
    revisionCount: content.revisionCount,
    civicProcessSummary: buildCivicProcessSummary(content),
    transparencyNote: content.transparencyNote,
    civicCompatibilityReviewId: content.civicCompatibilityReviewId ?? null,
    civicCompatibilityReviewStatus: content.civicCompatibilityReviewStatus ?? null,
    references: buildReferenceLinks(content),
  };
}

export function computeCivicActionPackageMetrics(): CivicActionPackageMetrics {
  const allCaps = listCaps();

  return {
    capCount: allCaps.length,
    issuedCapCount: allCaps.filter((capPackage) => capPackage.status === "issued").length,
    archivedCapCount: allCaps.filter((capPackage) => capPackage.status === "archived").length,
  };
}

export function getPublicCivicActionPackage(
  capId: string,
): PublicCivicActionPackageProjection | null {
  const capPackage = getCapById(capId);

  if (!capPackage) {
    return null;
  }

  return toPublicCivicActionPackageProjection(capPackage);
}

export function getPublicCivicActionPackageForDecision(
  decisionId: string,
): PublicCivicActionPackageProjection | null {
  const capPackage = getCapByDecisionId(decisionId);

  if (!capPackage) {
    return null;
  }

  return toPublicCivicActionPackageProjection(capPackage);
}

export function listPublicCivicActionPackagesForInitiative(
  initiativeId: string,
): PublicCivicActionPackageListItem[] {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative || !canExposePublicInitiativeProjection(initiative)) {
    return [];
  }

  return listCapsByInitiative(initiativeId).map((capPackage) =>
    toPublicCivicActionPackageListItem(capPackage),
  );
}

export function assertPublicProjectionHasNoPrivateFields(
  projection: PublicCivicActionPackageProjection,
): boolean {
  const serialized = JSON.stringify(projection);

  return (
    !serialized.includes('"participantId"') &&
    !serialized.includes('"voteId"') &&
    !serialized.includes('"authorId"') &&
    !serialized.includes('"stewardId"') &&
    !serialized.includes('"memberId"') &&
    !serialized.includes('"email"')
  );
}
