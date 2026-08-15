import type {
  DecisionSession,
  InitiativeCollectiveDecisionAnalysisReference,
  InitiativeCollectiveDecisionConsistencyCheck,
  InitiativeCollectiveDecisionIntelligenceSnapshot,
  InitiativeCollectiveDecisionPetitionReference,
  InitiativeCollectiveDecisionProposalReference,
  InitiativeCollectiveDecisionRevisionReference,
  InitiativeCollectiveDecisionSessionReference,
} from "@hu/types";

import { listAnalysesByInitiativeAndAuthor } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { listPublicInitiativeImprovementProposalsCollections } from "../initiative-improvement-proposals-stage/public-initiative-improvement-proposals-stage.projection.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import {
  getCurrentPublishedVersion,
  getRevisionByInitiativeAndVersion,
} from "../initiative-version-revision/initiative-version-revision.store.js";
import { findMembershipByUserId } from "../membership/membership.repository.js";
import { getPetitionByInitiativeId } from "../petition/petition.store.js";
import { countPetitionVisitorSignals } from "../petition/petition-visitor-signal.service.js";
import { getSessionById, listPublicSessionsByInitiative } from "../decision-session/decision-session.store.js";

const PUBLICLY_VISIBLE_PETITION_STATUSES = new Set(["Published", "Open", "Closed", "Archived"]);

async function buildPetitionReference(
  initiativeId: string,
): Promise<InitiativeCollectiveDecisionPetitionReference | null> {
  const petition = await getPetitionByInitiativeId(initiativeId);

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
  };
}

function buildRevisionReference(initiativeId: string): InitiativeCollectiveDecisionRevisionReference | null {
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
): InitiativeCollectiveDecisionAnalysisReference | null {
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
): Promise<readonly InitiativeCollectiveDecisionProposalReference[]> {
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

function buildSessionReference(session: DecisionSession): InitiativeCollectiveDecisionSessionReference {
  const structured = session.structuredContent;
  const traceability = session.traceability;

  return {
    sessionId: session.sessionId,
    title: session.title,
    decisionQuestion: session.decisionQuestion,
    purpose: session.purpose,
    publishedAt: session.publishedAt ?? null,
    status: session.status,
    version: session.initiativeVersion,
    objectives: structured?.objectives ?? [],
    options: structured?.options ?? [],
    supportingArguments: structured?.supportingArguments ?? [],
    risks: structured?.risks ?? [],
    requiredResources: structured?.requiredResources ?? [],
    suggestedTimeline: structured?.suggestedTimeline || null,
    suggestedResponsibleRoles: structured?.suggestedResponsibleRoles ?? [],
    petitionId: traceability?.petitionId ?? null,
    petitionVersion: traceability?.petitionVersion ?? null,
    revisionId: traceability?.revisionId ?? null,
    revisionVersion: traceability?.revisionVersion ?? null,
    analysisId: traceability?.analysisId ?? null,
    analysisVersion: traceability?.analysisVersion ?? null,
    proposalIds: traceability?.proposalIds ?? [],
    participantSignatures: traceability?.participantSignatures ?? 0,
    memberSignatures: traceability?.memberSignatures ?? 0,
    visitorSignals: traceability?.visitorSignals ?? 0,
  };
}

function buildConsistencyChecks(
  sessionReference: InitiativeCollectiveDecisionSessionReference | null,
): readonly InitiativeCollectiveDecisionConsistencyCheck[] {
  const checks: InitiativeCollectiveDecisionConsistencyCheck[] = [];

  checks.push(
    sessionReference
      ? {
          checkId: "decision-session-available",
          label: "Published Decision Session",
          status: "ok",
          detail: `Decision Session "${sessionReference.title}" is available as the Collective Decision source.`,
        }
      : {
          checkId: "decision-session-available",
          label: "Published Decision Session",
          status: "warning",
          detail: "A Published Decision Session is required before a Collective Decision can be generated.",
        },
  );

  checks.push(
    sessionReference && sessionReference.options.length > 0
      ? {
          checkId: "options-available",
          label: "Decision Options",
          status: "ok",
          detail: `${sessionReference.options.length} option(s) are available from the Decision Session.`,
        }
      : {
          checkId: "options-available",
          label: "Decision Options",
          status: "warning",
          detail: "The Decision Session has no options recorded.",
        },
  );

  checks.push(
    sessionReference && sessionReference.risks.length > 0
      ? {
          checkId: "risks-identified",
          label: "Risks Identified",
          status: "ok",
          detail: `${sessionReference.risks.length} risk(s) carried over from the Decision Session.`,
        }
      : {
          checkId: "risks-identified",
          label: "Risks Identified",
          status: "warning",
          detail: "The Decision Session has no risks recorded.",
        },
  );

  checks.push(
    sessionReference && sessionReference.suggestedResponsibleRoles.length > 0
      ? {
          checkId: "roles-assigned",
          label: "Responsible Roles",
          status: "ok",
          detail: `${sessionReference.suggestedResponsibleRoles.length} suggested role(s) carried over from the Decision Session.`,
        }
      : {
          checkId: "roles-assigned",
          label: "Responsible Roles",
          status: "warning",
          detail: "The Decision Session has no suggested responsible roles recorded.",
        },
  );

  checks.push(
    sessionReference && sessionReference.suggestedTimeline
      ? {
          checkId: "timeline-defined",
          label: "Implementation Timeline",
          status: "ok",
          detail: "A suggested timeline is available from the Decision Session.",
        }
      : {
          checkId: "timeline-defined",
          label: "Implementation Timeline",
          status: "warning",
          detail: "The Decision Session has no suggested timeline recorded.",
        },
  );

  return checks;
}

/**
 * Initiative Lifecycle — Part H, Section 2/3. Deterministic, read-only
 * aggregation of every upstream Lifecycle stage the Collective Decision
 * builder draws from. Never mutates those domains and never itself makes an
 * AI decision. The one mandatory source is the Initiative's Published
 * Decision Session (Part G) — every other reference stays advisory
 * traceability context, mirrored from the Decision Session's own sources.
 */
export async function buildInitiativeCollectiveDecisionIntelligenceSnapshot(
  initiativeId: string,
): Promise<InitiativeCollectiveDecisionIntelligenceSnapshot> {
  // Mirror Decision Session Intelligence: degrade gracefully when the
  // Initiative is not yet readable from the store (e.g. projection-boundary
  // unit tests that pass an in-memory fixture). Workspace/generate/publish
  // still enforce Initiative existence at the service boundary.
  const initiative = getInitiativeById(initiativeId);

  const publishedSession = listPublicSessionsByInitiative(initiativeId)[0] ?? null;
  const session = publishedSession ? getSessionById(publishedSession.sessionId) : null;
  const decisionSessionReference = session ? buildSessionReference(session) : null;

  const petitionReference = await buildPetitionReference(initiativeId);
  const revisionReference = buildRevisionReference(initiativeId);
  const analysisReference = initiative
    ? buildAnalysisReference(initiativeId, initiative.stewardId)
    : null;

  const proposalIds =
    decisionSessionReference && decisionSessionReference.proposalIds.length > 0
      ? decisionSessionReference.proposalIds
      : revisionReference
        ? [
            ...(getRevisionByInitiativeAndVersion(initiativeId, revisionReference.version)
              ?.acceptedProposalIds ?? []),
            ...(getRevisionByInitiativeAndVersion(initiativeId, revisionReference.version)
              ?.partiallyAcceptedProposalIds ?? []),
          ]
        : [];
  const proposalReferences = await buildProposalReferences(initiativeId, proposalIds);
  const consistencyChecks = buildConsistencyChecks(decisionSessionReference);

  return {
    initiativeId,
    generatedAt: new Date().toISOString(),
    initiativeTitle: initiative?.title ?? "",
    initiativeDescription: initiative?.description ?? "",
    decisionSessionReference,
    petitionReference,
    revisionReference,
    analysisReference,
    proposalReferences,
    consistencyChecks,
    isDecisionSessionAvailable: decisionSessionReference !== null,
    isEmpty: !initiative || !decisionSessionReference,
  };
}
