import type {
  InitiativePetitionAnalysisReference,
  InitiativePetitionConsistencyCheck,
  InitiativePetitionIntelligenceSnapshot,
  InitiativePetitionProposalReference,
  InitiativePetitionRevisionReference,
} from "@hu/types";

import { listAnalysesByInitiativeAndAuthor } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { listPublicInitiativeImprovementProposalsCollections } from "../initiative-improvement-proposals-stage/public-initiative-improvement-proposals-stage.projection.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import {
  getCurrentPublishedVersion,
  getRevisionByInitiativeAndVersion,
} from "../initiative-version-revision/initiative-version-revision.store.js";

/**
 * Initiative Lifecycle — Part F, Section 2/3 (Petition Sources / Petition
 * Draft Builder).
 *
 * Deterministic, read-only aggregation of every upstream Lifecycle stage
 * the Petition Builder draws from: the Published Revision (the Petition's
 * one mandatory source — Section 2), the Author's Published Collaborative
 * Analysis, and the Published Improvement Proposals the Revision accepted
 * (fully or partially). Never mutates any of those domains, and never
 * itself makes an AI decision — the actual title/summary/request text is
 * produced by `initiative-petition-draft-builder.ts` from this snapshot,
 * and the Petition Assistant's advisory checks below are the only
 * "intelligence" this module contributes.
 */
function buildRevisionReference(initiativeId: string): InitiativePetitionRevisionReference | null {
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
): InitiativePetitionAnalysisReference | null {
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
  revision: InitiativePetitionRevisionReference | null,
  acceptedProposalIds: readonly string[],
  partiallyAcceptedProposalIds: readonly string[],
): Promise<readonly InitiativePetitionProposalReference[]> {
  if (!revision || (acceptedProposalIds.length === 0 && partiallyAcceptedProposalIds.length === 0)) {
    return [];
  }

  const collections = await listPublicInitiativeImprovementProposalsCollections(initiativeId);
  const allProposals = collections.flatMap((collection) => collection.proposals);
  const acceptedSet = new Set(acceptedProposalIds);
  const partialSet = new Set(partiallyAcceptedProposalIds);

  const references: InitiativePetitionProposalReference[] = [];

  for (const proposalId of [...acceptedProposalIds, ...partiallyAcceptedProposalIds]) {
    const proposal = allProposals.find((candidate) => candidate.proposalId === proposalId);
    references.push({
      proposalId,
      title: proposal?.title ?? `Proposal ${proposalId}`,
      summary: proposal?.summary ?? "",
      status: acceptedSet.has(proposalId)
        ? "accepted"
        : partialSet.has(proposalId)
          ? "partially_accepted"
          : "accepted",
    });
  }

  return references;
}

function buildConsistencyChecks(input: {
  readonly revision: InitiativePetitionRevisionReference | null;
  readonly analysis: InitiativePetitionAnalysisReference | null;
  readonly proposalReferences: readonly InitiativePetitionProposalReference[];
}): readonly InitiativePetitionConsistencyCheck[] {
  const checks: InitiativePetitionConsistencyCheck[] = [];

  checks.push(
    input.revision
      ? {
          checkId: "revision-available",
          label: "Published Revision",
          status: "ok",
          detail: `Petition will reference Revision v${input.revision.version}.`,
        }
      : {
          checkId: "revision-available",
          label: "Published Revision",
          status: "warning",
          detail: "No Published Revision exists yet. Publish a Revision before generating a Petition.",
        },
  );

  checks.push(
    input.analysis
      ? {
          checkId: "analysis-available",
          label: "Collaborative Analysis",
          status: "ok",
          detail: `Petition context is consistent with Analysis "${input.analysis.title}".`,
        }
      : {
          checkId: "analysis-available",
          label: "Collaborative Analysis",
          status: "warning",
          detail: "No Published Collaborative Analysis found. Supporting context may be incomplete.",
        },
  );

  checks.push(
    input.proposalReferences.length > 0
      ? {
          checkId: "proposal-references-resolved",
          label: "Proposal References",
          status: "ok",
          detail: `${input.proposalReferences.length} Improvement Proposal(s) referenced from the Revision.`,
        }
      : {
          checkId: "proposal-references-resolved",
          label: "Proposal References",
          status: "warning",
          detail: "The current Revision did not accept any Improvement Proposals.",
        },
  );

  return checks;
}

export async function buildInitiativePetitionIntelligenceSnapshot(
  initiativeId: string,
): Promise<InitiativePetitionIntelligenceSnapshot> {
  const initiative = getInitiativeById(initiativeId);
  const revisionReference = buildRevisionReference(initiativeId);
  const analysisReference = initiative
    ? buildAnalysisReference(initiativeId, initiative.stewardId)
    : null;
  const revision = revisionReference
    ? getRevisionByInitiativeAndVersion(initiativeId, revisionReference.version)
    : null;
  const proposalReferences = await buildProposalReferences(
    initiativeId,
    revisionReference,
    revision?.acceptedProposalIds ?? [],
    revision?.partiallyAcceptedProposalIds ?? [],
  );
  const consistencyChecks = buildConsistencyChecks({
    revision: revisionReference,
    analysis: analysisReference,
    proposalReferences,
  });

  return {
    initiativeId,
    generatedAt: new Date().toISOString(),
    initiativeTitle: initiative?.title ?? "",
    initiativeDescription: initiative?.description ?? "",
    revisionReference,
    analysisReference,
    proposalReferences,
    consistencyChecks,
    isRevisionAvailable: revisionReference !== null,
    isEmpty: !initiative || !revisionReference,
  };
}
