import type {
  InitiativeDecisionSessionAnalysisReference,
  InitiativeDecisionSessionConsistencyCheck,
  InitiativeDecisionSessionIntelligenceSnapshot,
  InitiativeDecisionSessionOpenCommentReference,
  InitiativeDecisionSessionPetitionReference,
  InitiativeDecisionSessionProposalReference,
  InitiativeDecisionSessionRevisionReference,
} from "@hu/types";

import { listAnalysesByInitiativeAndAuthor } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { listApprovedInitiativeComments } from "../initiative-comments/initiative-comment.service.js";
import { listActiveAlliesByInitiative } from "../initiative-discussion-collaboration/initiative-ally.store.js";
import { listPublicInitiativeImprovementProposalsCollections } from "../initiative-improvement-proposals-stage/public-initiative-improvement-proposals-stage.projection.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import {
  getCurrentPublishedVersion,
  getRevisionByInitiativeAndVersion,
} from "../initiative-version-revision/initiative-version-revision.store.js";
import { findMembershipByUserId } from "../membership/membership.repository.js";
import { getPetitionByInitiativeId } from "../petition/petition.store.js";
import { countPetitionVisitorSignals } from "../petition/petition-visitor-signal.service.js";
import { listRecommendationsByInitiative } from "./initiative-decision-session-recommendation.store.js";

const PUBLICLY_VISIBLE_PETITION_STATUSES = new Set(["Published", "Open", "Closed", "Archived"]);

async function buildPetitionReference(
  initiativeId: string,
): Promise<InitiativeDecisionSessionPetitionReference | null> {
  // Petition is SOURCE_OPTIONAL — Mongo/infrastructure failure must not block Author DS.
  let petition;
  try {
    petition = await getPetitionByInitiativeId(initiativeId);
  } catch {
    return null;
  }

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
  const visitorSignals = await countPetitionVisitorSignals(petition.petitionId);

  return {
    petitionId: petition.petitionId,
    title: petition.subject.title,
    summary: petition.subject.summary,
    publishedAt: petition.shareLink?.createdAt ?? null,
    participantSignatures: activeSignatures.length,
    memberSignatures: memberFlags.filter(Boolean).length,
    visitorSignals,
    revisionId: petition.traceability?.revisionId ?? null,
    revisionVersion: petition.traceability?.revisionVersion ?? null,
    proposalIds: petition.traceability?.proposalIds ?? [],
    analysisId: petition.traceability?.analysisId ?? null,
    analysisVersion: petition.traceability?.analysisVersion ?? null,
  };
}

function buildRevisionReference(initiativeId: string): InitiativeDecisionSessionRevisionReference | null {
  const currentVersion = getCurrentPublishedVersion(initiativeId);

  if (currentVersion === 0) {
    return null;
  }

  const revision = getRevisionByInitiativeAndVersion(initiativeId, currentVersion);

  if (!revision) {
    return null;
  }

  return {
    revisionId: revision.revisionId,
    version: revision.version,
    revisionSummary: revision.revisionSummary,
    publishedAt: revision.publishedAt,
    title: revision.title,
    description: revision.description,
  };
}

function buildAnalysisReference(
  initiativeId: string,
  stewardId: string,
): InitiativeDecisionSessionAnalysisReference | null {
  const authored = listAnalysesByInitiativeAndAuthor(initiativeId, stewardId);
  const published = authored
    .filter((analysis) => analysis.status === "published")
    .sort((left, right) => (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""));
  const latest = published[0] ?? null;

  if (!latest) {
    return null;
  }

  return {
    analysisId: latest.analysisId,
    title: latest.title,
    summary: latest.summary,
    initiativeVersion: latest.initiativeVersion,
  };
}

async function buildProposalReferences(
  initiativeId: string,
  proposalIds: readonly string[],
): Promise<readonly InitiativeDecisionSessionProposalReference[]> {
  if (proposalIds.length === 0) {
    return [];
  }

  const collections = await listPublicInitiativeImprovementProposalsCollections(initiativeId);
  const allProposals = collections.flatMap((collection) => collection.proposals);

  return proposalIds.map((proposalId) => {
    const proposal = allProposals.find((candidate) => candidate.proposalId === proposalId);

    return {
      proposalId,
      title: proposal?.title ?? `Proposal ${proposalId}`,
      summary: proposal?.summary ?? "",
      status: "accepted" as const,
    };
  });
}

async function buildOpenComments(
  initiativeId: string,
): Promise<readonly InitiativeDecisionSessionOpenCommentReference[]> {
  try {
    const result = await listApprovedInitiativeComments({ initiativeId, limit: 8 });
    return result.comments.map((comment) => ({
      commentId: comment.commentId,
      excerpt: comment.body.trim().slice(0, 240),
      authorDisplayName: comment.authorDisplayName || "Participant",
      createdAt: comment.createdAt,
    }));
  } catch {
    return [];
  }
}

function buildConsistencyChecks(input: {
  readonly petition: InitiativeDecisionSessionPetitionReference | null;
  readonly revision: InitiativeDecisionSessionRevisionReference | null;
  readonly analysis: InitiativeDecisionSessionAnalysisReference | null;
  readonly proposalReferences: readonly InitiativeDecisionSessionProposalReference[];
  readonly allyRecommendationCount: number;
}): readonly InitiativeDecisionSessionConsistencyCheck[] {
  const checks: InitiativeDecisionSessionConsistencyCheck[] = [];

  checks.push(
    input.petition
      ? {
          checkId: "petition-available",
          label: "Published Petition",
          status: "ok",
          detail: `Petition "${input.petition.title}" is available as the Decision Session source.`,
          params: {},
          civic: { title: input.petition.title },
        }
      : {
          checkId: "petition-available",
          label: "Published Petition",
          status: "warning",
          detail: "No published Petition yet — Decision Session can use Initiative / Analysis / Proposal context instead.",
          params: {},
        },
  );

  checks.push(
    input.revision
      ? {
          checkId: "revision-available",
          label: "Published Revision",
          status: "ok",
          detail: `Revision v${input.revision.version} is referenced.`,
          params: { version: input.revision.version },
        }
      : {
          checkId: "revision-available",
          label: "Published Revision",
          status: "warning",
          detail: "No published Revision is available for traceability.",
          params: {},
        },
  );

  checks.push(
    input.analysis
      ? {
          checkId: "analysis-available",
          label: "Collaborative Analysis",
          status: "ok",
          detail: `Analysis "${input.analysis.title}" is referenced.`,
          params: {},
          civic: { title: input.analysis.title },
        }
      : {
          checkId: "analysis-available",
          label: "Collaborative Analysis",
          status: "warning",
          detail: "No published Collaborative Analysis is available.",
          params: {},
        },
  );

  checks.push({
    checkId: "proposal-references",
    label: "Improvement Proposals",
    status: input.proposalReferences.length > 0 ? "ok" : "warning",
    detail:
      input.proposalReferences.length > 0
        ? `${input.proposalReferences.length} proposal reference(s) are available.`
        : "No accepted Improvement Proposals are referenced yet.",
    params: { count: input.proposalReferences.length },
  });

  checks.push({
    checkId: "ally-recommendations",
    label: "Active Ally recommendations",
    status: "ok",
    detail:
      input.allyRecommendationCount > 0
        ? `${input.allyRecommendationCount} advisory recommendation(s) from Active Allies.`
        : "No Active Ally recommendations yet — recommendations remain optional and advisory.",
    params: { count: input.allyRecommendationCount },
  });

  return checks;
}

/**
 * Initiative Lifecycle — Part G, Section 2/3. Deterministic, read-only
 * aggregation of every upstream Lifecycle stage the Decision Builder draws
 * from. Never mutates those domains and never itself makes an AI decision.
 */
export async function buildInitiativeDecisionSessionIntelligenceSnapshot(
  initiativeId: string,
): Promise<InitiativeDecisionSessionIntelligenceSnapshot> {
  // Mirror Petition Intelligence: degrade gracefully when the Initiative is
  // not yet readable from the store (e.g. projection-boundary unit tests that
  // pass an in-memory fixture). Workspace/generate/publish still enforce
  // Initiative existence at the service boundary.
  const initiative = getInitiativeById(initiativeId);

  const [petitionReference, allies, openComments] = await Promise.all([
    buildPetitionReference(initiativeId),
    listActiveAlliesByInitiative(initiativeId),
    buildOpenComments(initiativeId),
  ]);

  const revisionReference = buildRevisionReference(initiativeId);
  const analysisReference = initiative
    ? buildAnalysisReference(initiativeId, initiative.stewardId)
    : null;
  const proposalIds =
    petitionReference?.proposalIds ??
    (revisionReference
      ? [
          ...(getRevisionByInitiativeAndVersion(initiativeId, revisionReference.version)
            ?.acceptedProposalIds ?? []),
          ...(getRevisionByInitiativeAndVersion(initiativeId, revisionReference.version)
            ?.partiallyAcceptedProposalIds ?? []),
        ]
      : []);
  const proposalReferences = await buildProposalReferences(initiativeId, proposalIds);
  const allyRecommendations = listRecommendationsByInitiative(initiativeId);
  const consistencyChecks = buildConsistencyChecks({
    petition: petitionReference,
    revision: revisionReference,
    analysis: analysisReference,
    proposalReferences,
    allyRecommendationCount: allyRecommendations.length,
  });

  return {
    initiativeId,
    generatedAt: new Date().toISOString(),
    initiativeTitle: initiative?.title ?? "",
    initiativeDescription: initiative?.description ?? "",
    petitionReference,
    revisionReference,
    analysisReference,
    proposalReferences,
    openComments,
    allyRecommendations,
    activeAllyCount: allies.length,
    consistencyChecks,
    isPetitionAvailable: petitionReference !== null,
    isEmpty:
      !initiative ||
      (!petitionReference && !revisionReference && proposalReferences.length === 0),
  };
}
