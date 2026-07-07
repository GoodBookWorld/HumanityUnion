import type { CivicActionPackage, CivicActionPackageContent } from "@hu/types";

import { getLatestReviewForInitiativeVersion } from "../civic-compatibility-review/civic-compatibility-review.store.js";
import { getSessionById } from "../decision-session/decision-session.store.js";
import { buildPublicCollectiveDecisionResults } from "../initiative-collective-decision/initiative-collective-decision-results.js";
import { getDecisionById } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { listPublishedAnalysesByInitiative } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { listProposalsByInitiative } from "../initiative-improvement-proposal/initiative-improvement-proposal.store.js";
import { getLatestRevisionForInitiative } from "../initiative-version-revision/initiative-version-revision.store.js";
import { listRevisionsByInitiative } from "../initiative-version-revision/initiative-version-revision.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getMemberById } from "../member/member.store.js";
import {
  createCapPackage,
  getCapByDecisionId,
  getCapById,
  getNextCapNumber,
} from "./civic-action-package.store.js";

function buildCapContent(decisionId: string): CivicActionPackageContent {
  const decision = getDecisionById(decisionId);

  if (!decision) {
    throw new Error("Collective decision not found.");
  }

  if (decision.status !== "closed") {
    throw new Error(
      "Civic Action Package can only be generated from a closed collective decision.",
    );
  }

  const initiative = getInitiativeById(decision.initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  const session = getSessionById(decision.decisionSessionId);

  if (!session) {
    throw new Error("Decision session not found.");
  }

  const latestRevision = getLatestRevisionForInitiative(decision.initiativeId);
  const initiativeVersion = latestRevision?.version ?? 1;
  const results = buildPublicCollectiveDecisionResults(decision);
  const compatibilityReview = getLatestReviewForInitiativeVersion(
    decision.initiativeId,
    initiativeVersion,
  );

  const publicInitiativeUrl = `/initiatives/public/${encodeURIComponent(decision.initiativeId)}`;
  const publicDecisionUrl = `/collective-decisions/public/${encodeURIComponent(decision.decisionId)}`;

  return {
    initiativeId: decision.initiativeId,
    initiativeTitle: initiative.title,
    initiativeVersion,
    collaborativeAnalysesCount: listPublishedAnalysesByInitiative(decision.initiativeId).length,
    improvementProposalsCount: listProposalsByInitiative(decision.initiativeId).filter(
      (proposal) => proposal.status !== "draft",
    ).length,
    revisionCount: listRevisionsByInitiative(decision.initiativeId).length,
    decisionSessionId: decision.decisionSessionId,
    decisionSessionTitle: session.title,
    decisionId: decision.decisionId,
    decisionQuestion: decision.question,
    decisionResultSummary: results.outcomeSummary,
    decisionOutcome: results.outcome.outcome,
    verifiedStatistics: results.outcome.verifiedStatistics,
    unverifiedStatistics: results.outcome.unverifiedStatistics,
    transparencyNote: results.transparencyNote,
    civicCompatibilityReviewId: compatibilityReview?.reviewId,
    civicCompatibilityReviewStatus: compatibilityReview?.compatibilityStatus,
    publicInitiativeUrl,
    publicDecisionUrl,
  };
}

function resolveCountry(initiativeId: string): string {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    return "Unknown";
  }

  const steward = getMemberById(initiative.stewardId);

  return steward?.profile.country ?? "Canada";
}

function buildCapTitle(content: CivicActionPackageContent): string {
  return `${content.initiativeTitle} — Civic Action Package`;
}

function buildCapSummary(content: CivicActionPackageContent): string {
  return content.decisionResultSummary;
}

/**
 * Idempotent generation — one CAP per closed collective decision.
 * Safe to call from close workflow and verification scripts.
 */
export function generateCivicActionPackageForDecision(decisionId: string): CivicActionPackage {
  const existing = getCapByDecisionId(decisionId);

  if (existing) {
    return existing;
  }

  const decision = getDecisionById(decisionId);

  if (!decision) {
    throw new Error("Collective decision not found.");
  }

  if (decision.status !== "closed") {
    throw new Error("Collective decision must be closed before issuing a Civic Action Package.");
  }

  const content = buildCapContent(decisionId);
  const initiative = getInitiativeById(decision.initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  const now = new Date().toISOString();
  const capId = `cap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const capPackage: CivicActionPackage = {
    capId,
    initiativeId: decision.initiativeId,
    decisionId: decision.decisionId,
    issuedAt: decision.closedAt ?? now,
    capNumber: getNextCapNumber(),
    capVersion: 1,
    status: "issued",
    title: buildCapTitle(content),
    summary: buildCapSummary(content),
    participationScope: decision.participationScope,
    country: resolveCountry(decision.initiativeId),
    region: initiative.metadata.region || undefined,
    community: initiative.metadata.communitySlug.replace(/-/g, " ") || undefined,
    content,
    createdAt: now,
    updatedAt: now,
  };

  return createCapPackage(capPackage);
}

export function getCivicActionPackageById(capId: string): CivicActionPackage | null {
  return getCapById(capId);
}

export function getCivicActionPackageForDecision(decisionId: string): CivicActionPackage | null {
  return getCapByDecisionId(decisionId);
}
