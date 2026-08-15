import type {
  InitiativeRevisionChange,
  InitiativeRevisionConflictWarning,
  InitiativeRevisionConsistencyCheck,
  InitiativeRevisionEligibleStructuredProposal,
  InitiativeRevisionIntelligenceSnapshot,
} from "@hu/types";

import { listAnalysesByInitiativeAndAuthor } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { listPublicInitiativeImprovementProposalsCollections } from "../initiative-improvement-proposals-stage/public-initiative-improvement-proposals-stage.projection.js";
import { getRevisionDraftByInitiativeId } from "./initiative-version-revision.store.js";

/**
 * Initiative Lifecycle — Part E, Section 2/3 (Revision Sources / Intelligent
 * Revision Builder).
 *
 * Every field here reads EXISTING persisted data only — the Current
 * published Initiative, the Author's own published Collaborative Analysis,
 * and Part D's already-published Improvement Proposals — the same
 * "no invented information" discipline as
 * `initiative-proposal-intelligence.service.ts` (Part D) and
 * `initiative-analysis-source-snapshot.service.ts` (Part B). All sources
 * remain read-only: nothing here ever mutates the Initiative, an
 * Improvement Proposal, or a Collaborative Analysis.
 */

export const REVISION_SECTION_LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
  custom: "Custom",
};

function buildDiscussionUrl(initiativeId: string): string {
  return `/initiatives/public/${encodeURIComponent(initiativeId)}#discussion`;
}

/**
 * The Author's own most recently published Collaborative Analysis, if
 * any — Part 1's "input from Published Collaborative Analysis". Purely
 * informational; never re-derives or duplicates Analysis content.
 */
function resolveAnalysisReference(
  initiativeId: string,
  authorId: string,
): { analysisId: string; title: string } | null {
  const published = listAnalysesByInitiativeAndAuthor(initiativeId, authorId)
    .filter((analysis) => analysis.status === "published")
    .sort((left, right) => (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""));
  const latest = published[0];

  return latest ? { analysisId: latest.analysisId, title: latest.title } : null;
}

/**
 * Part 2 — "Published Improvement Proposals" + "Proposal IDs" +
 * "Proposal Authors". Sourced from Part D's already-public projection
 * (never the raw draft/ready statuses a visitor would never see) across
 * every Author who has published a proposals collection for this
 * Initiative — mirrors `adaptProposalStage`'s own canonical-record choice
 * (Part D), which is likewise not restricted to the Initiative steward.
 */
async function listEligibleStructuredProposals(
  initiativeId: string,
): Promise<InitiativeRevisionEligibleStructuredProposal[]> {
  const collections = await listPublicInitiativeImprovementProposalsCollections(initiativeId);
  const eligible: InitiativeRevisionEligibleStructuredProposal[] = [];

  for (const collection of collections) {
    for (const proposal of collection.proposals) {
      if (proposal.status !== "published" && proposal.status !== "included_in_revision") {
        continue;
      }

      eligible.push({
        proposalId: proposal.proposalId,
        collectionId: collection.collectionId,
        title: proposal.title,
        summary: proposal.summary,
        reason: proposal.reason,
        expectedImprovement: proposal.expectedImprovement,
        status: proposal.status,
        originalAuthorDisplayNames: proposal.originalAuthorDisplayNames,
        relatedDiscussionReferences: proposal.relatedDiscussionReferences,
      });
    }
  }

  return eligible;
}

export function buildConflictWarnings(
  changes: readonly InitiativeRevisionChange[],
): InitiativeRevisionConflictWarning[] {
  const bySection = new Map<string, InitiativeRevisionChange[]>();

  for (const change of changes) {
    const bucket = bySection.get(change.section) ?? [];
    bucket.push(change);
    bySection.set(change.section, bucket);
  }

  const warnings: InitiativeRevisionConflictWarning[] = [];

  for (const [section, entries] of bySection) {
    if (entries.length <= 1) {
      continue;
    }

    const sectionLabel = REVISION_SECTION_LABELS[section] ?? section;
    warnings.push({
      section,
      sectionLabel,
      changeIds: entries.map((entry) => entry.changeId),
      proposalIds: [...new Set(entries.flatMap((entry) => entry.proposalIds))],
      message: `${entries.length} changes target the ${sectionLabel} section — review before publishing to avoid conflicting edits.`,
    });
  }

  return warnings;
}

export function isTracedChange(change: InitiativeRevisionChange): boolean {
  return (
    change.proposalIds.length > 0 ||
    (change.origin === "author_originated" && Boolean(change.authorOriginatedReason?.trim()))
  );
}

export function buildConsistencyChecks(
  changes: readonly InitiativeRevisionChange[],
  missingReferenceProposalIds: readonly string[],
): InitiativeRevisionConsistencyCheck[] {
  const tracedCount = changes.filter(isTracedChange).length;

  return [
    {
      checkId: "accepted-proposals-traced",
      label: "Accepted proposals traced into a change",
      status: missingReferenceProposalIds.length === 0 ? "ok" : "warning",
      detail:
        missingReferenceProposalIds.length === 0
          ? "Every proposal marked for inclusion is referenced by a change."
          : `${missingReferenceProposalIds.length} proposal(s) marked "Included in Revision" have no backing change yet.`,
    },
    {
      checkId: "changes-have-origin",
      label: "Every change has an identifiable origin",
      status: tracedCount === changes.length ? "ok" : "warning",
      detail:
        tracedCount === changes.length
          ? "Every drafted change references a Proposal or is marked Author-originated."
          : `${changes.length - tracedCount} change(s) are missing a Proposal reference or an Author-originated reason.`,
    },
  ];
}

export async function buildInitiativeRevisionIntelligenceSnapshot(
  initiativeId: string,
): Promise<InitiativeRevisionIntelligenceSnapshot> {
  const initiative = getInitiativeById(initiativeId);
  const draft = getRevisionDraftByInitiativeId(initiativeId);
  const changes = draft?.changes ?? [];
  const discussionUrl = buildDiscussionUrl(initiativeId);

  const eligibleProposals = await listEligibleStructuredProposals(initiativeId);
  const referencedProposalIds = [...new Set(changes.flatMap((change) => change.proposalIds))];
  const referencedSet = new Set(referencedProposalIds);

  const missingReferenceProposalIds = eligibleProposals
    .filter((proposal) => proposal.status === "included_in_revision" && !referencedSet.has(proposal.proposalId))
    .map((proposal) => proposal.proposalId);

  const unresolvedProposalIds = eligibleProposals
    .filter((proposal) => proposal.status === "published")
    .map((proposal) => proposal.proposalId);

  return {
    initiativeId,
    generatedAt: new Date().toISOString(),
    // The Revision Builder's working baseline: the Author's in-progress
    // draft text if one exists, otherwise the Current published Initiative
    // (Part 2) — this is deliberately what a NEW suggested change's
    // "before" should start from, not necessarily the originally-published
    // text if the Author has already accepted earlier suggestions.
    currentTitle: draft?.title ?? initiative?.title ?? "",
    currentDescription: draft?.description ?? initiative?.description ?? "",
    analysisReference: initiative ? resolveAnalysisReference(initiativeId, initiative.stewardId) : null,
    eligibleProposals,
    referencedProposalIds,
    missingReferenceProposalIds,
    unresolvedProposalIds,
    affectedSections: [...new Set(changes.map((change) => change.section))],
    conflictWarnings: buildConflictWarnings(changes),
    consistencyChecks: buildConsistencyChecks(changes, missingReferenceProposalIds),
    discussionUrl,
    isEmpty: eligibleProposals.length === 0,
  };
}
