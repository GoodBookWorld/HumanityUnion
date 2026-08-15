import type {
  DecisionSession,
  DecisionSessionMetrics,
  PublicDecisionSessionListItem,
  PublicDecisionSessionPackage,
  PublicDecisionSessionPetitionContext,
  PublicDecisionSessionProjection,
} from "@hu/types";

import { getAnalysisById } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { toPublicInitiativeCollaborativeAnalysisListItem } from "../initiative-collaborative-analysis/public-initiative-collaborative-analysis.projection.js";
import { getProposalById } from "../initiative-improvement-proposal/initiative-improvement-proposal.store.js";
import { toPublicInitiativeImprovementProposalListItem } from "../initiative-improvement-proposal/public-initiative-improvement-proposal.projection.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getRevisionById } from "../initiative-version-revision/initiative-version-revision.store.js";
import { toPublicInitiativeVersionRevisionListItem } from "../initiative-version-revision/public-initiative-version-revision.projection.js";
import { getCurrentPublishedVersion } from "../initiative-version-revision/initiative-version-revision.store.js";
import { getMemberById } from "../member/member-access.js";
import { findMembershipByUserId } from "../membership/membership.repository.js";
import { getPetition } from "../petition/petition.store.js";
import { countPetitionVisitorSignals } from "../petition/petition-visitor-signal.service.js";
import { getDecisionSessionPackageCounts } from "./decision-session-package.js";
import {
  getSessionById,
  listPublicSessionsByInitiative,
  listSessionsByInitiative,
} from "./decision-session.store.js";

const PUBLICLY_VISIBLE_PETITION_STATUSES = new Set(["Published", "Open", "Closed", "Archived"]);

const PUBLIC_STATUSES = new Set<DecisionSession["status"]>(["published", "closed"]);

async function resolveStewardDisplayName(stewardId: string): Promise<string> {
  const member = await getMemberById(stewardId);

  return member?.profile.displayName ?? "Unknown Steward";
}

function toPublicStatus(
  status: DecisionSession["status"],
): PublicDecisionSessionProjection["status"] {
  if (!PUBLIC_STATUSES.has(status)) {
    throw new Error("Decision session status is not publicly visible.");
  }

  return status as PublicDecisionSessionProjection["status"];
}

async function buildPublicDecisionSessionPackage(
  session: DecisionSession,
): Promise<PublicDecisionSessionPackage> {
  const packageReferences = session.packageReferences ?? {
    revisionIds: [],
    analysisIds: [],
    proposalIds: [],
  };
  const currentVersion = getCurrentPublishedVersion(session.initiativeId);

  const revisions = await Promise.all(
    packageReferences.revisionIds
      .map((revisionId) => getRevisionById(revisionId))
      .filter((revision): revision is NonNullable<typeof revision> => revision !== null)
      .map((revision) => toPublicInitiativeVersionRevisionListItem(revision, currentVersion)),
  );

  const analyses = await Promise.all(
    packageReferences.analysisIds
      .map((analysisId) => getAnalysisById(analysisId))
      .filter(
        (analysis): analysis is NonNullable<typeof analysis> =>
          analysis !== null && analysis.status === "published",
      )
      .map((analysis) => toPublicInitiativeCollaborativeAnalysisListItem(analysis)),
  );

  const proposals = await Promise.all(
    packageReferences.proposalIds
      .map((proposalId) => getProposalById(proposalId))
      .filter((proposal): proposal is NonNullable<typeof proposal> => proposal !== null)
      .map((proposal) => toPublicInitiativeImprovementProposalListItem(proposal)),
  );

  return {
    initiativeVersion: session.initiativeVersion,
    revisions,
    analyses,
    proposals,
  };
}

/**
 * Initiative Lifecycle — Part F, Section 11 (Decision Session
 * Integration). "Decision Session automatically receives: Published
 * Petition, Signature statistics, Revision metadata, Proposal references.
 * No duplicated editing." Purely additive; resolves to `null` for any
 * Decision Session published before Part F, or whose Initiative never had
 * a publicly visible Petition.
 */
async function buildRelatedPetitionContext(
  session: DecisionSession,
): Promise<PublicDecisionSessionPetitionContext | null> {
  const petitionId = session.packageReferences?.petitionId;

  if (!petitionId) {
    return null;
  }

  const petition = await getPetition(petitionId);

  if (!petition || !PUBLICLY_VISIBLE_PETITION_STATUSES.has(petition.status)) {
    return null;
  }

  const activeSignatures = petition.signatures.filter((signature) => signature.status === "Active");
  const memberFlags = await Promise.all(
    activeSignatures.map(async (signature) => {
      try {
        const membership = await findMembershipByUserId(signature.participantId);
        return membership?.status === "active_member";
      } catch {
        return false;
      }
    }),
  );
  const visitorSignals = await countPetitionVisitorSignals(petitionId);

  return {
    petitionId: petition.petitionId,
    title: petition.subject.title,
    publishedAt: petition.shareLink?.createdAt ?? null,
    participantSignatures: activeSignatures.length,
    memberSignatures: memberFlags.filter(Boolean).length,
    visitorSignals,
    revisionVersion: petition.traceability?.revisionVersion ?? null,
    proposalIds: petition.traceability?.proposalIds ?? [],
  };
}

export function toPublicDecisionSessionListItem(
  session: DecisionSession,
): PublicDecisionSessionListItem {
  return {
    sessionId: session.sessionId,
    title: session.title,
    status: toPublicStatus(session.status),
    opensAt: session.opensAt,
    closesAt: session.closesAt,
    publishedAt: session.publishedAt ?? session.updatedAt,
  };
}

export async function toPublicDecisionSessionProjection(
  session: DecisionSession,
): Promise<PublicDecisionSessionProjection> {
  return {
    sessionId: session.sessionId,
    initiativeId: session.initiativeId,
    initiativeVersion: session.initiativeVersion,
    title: session.title,
    purpose: session.purpose,
    decisionQuestion: session.decisionQuestion,
    status: toPublicStatus(session.status),
    opensAt: session.opensAt,
    closesAt: session.closesAt,
    stewardDisplayName: await resolveStewardDisplayName(session.stewardId),
    publishedAt: session.publishedAt ?? session.updatedAt,
    closedAt: session.closedAt,
    decisionPackage: await buildPublicDecisionSessionPackage(session),
    relatedPetitionContext: await buildRelatedPetitionContext(session),
    structuredContent: session.structuredContent ?? null,
    traceability: session.traceability ?? null,
  };
}

export function computeDecisionSessionMetrics(initiativeId: string): DecisionSessionMetrics {
  const sessions = listSessionsByInitiative(initiativeId).filter((session) =>
    PUBLIC_STATUSES.has(session.status),
  );
  const initiative = getInitiativeById(initiativeId);

  if (sessions.length === 0) {
    return {
      decisionSessionCount: 0,
      averagePreparationTimeDays: null,
      averageRevisionCountBeforeDecision: 0,
      averageAnalysisCountBeforeDecision: 0,
      averageProposalCountBeforeDecision: 0,
    };
  }

  const preparationTimes: number[] = [];
  let totalRevisionCount = 0;
  let totalAnalysisCount = 0;
  let totalProposalCount = 0;

  for (const session of sessions) {
    if (session.packageReferences) {
      const counts = getDecisionSessionPackageCounts(session.packageReferences);
      totalRevisionCount += counts.revisionCount;
      totalAnalysisCount += counts.analysisCount;
      totalProposalCount += counts.proposalCount;
    }

    if (initiative && session.publishedAt) {
      const start = new Date(initiative.createdAt).getTime();
      const end = new Date(session.publishedAt).getTime();
      preparationTimes.push((end - start) / (1000 * 60 * 60 * 24));
    }
  }

  return {
    decisionSessionCount: sessions.length,
    averagePreparationTimeDays:
      preparationTimes.length > 0
        ? preparationTimes.reduce((sum, value) => sum + value, 0) / preparationTimes.length
        : null,
    averageRevisionCountBeforeDecision: totalRevisionCount / sessions.length,
    averageAnalysisCountBeforeDecision: totalAnalysisCount / sessions.length,
    averageProposalCountBeforeDecision: totalProposalCount / sessions.length,
  };
}

export function listPublicDecisionSessionsForInitiative(
  initiativeId: string,
): PublicDecisionSessionListItem[] {
  return listPublicSessionsByInitiative(initiativeId).map((session) =>
    toPublicDecisionSessionListItem(session),
  );
}

export async function getPublicDecisionSession(
  sessionId: string,
): Promise<PublicDecisionSessionProjection | null> {
  const session = getSessionById(sessionId);

  if (!session || !PUBLIC_STATUSES.has(session.status)) {
    return null;
  }

  return await toPublicDecisionSessionProjection(session);
}
