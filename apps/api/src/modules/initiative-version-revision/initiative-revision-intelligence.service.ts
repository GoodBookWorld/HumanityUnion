import type {
  InitiativeRevisionChange,
  InitiativeRevisionConflictWarning,
  InitiativeRevisionConsistencyCheck,
  InitiativeRevisionEligibleStructuredProposal,
  InitiativeRevisionIntelligenceSnapshot,
} from "@hu/types";

import { listAnalysesByInitiativeAndAuthor } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { listCollectionsByInitiative } from "../initiative-improvement-proposals-stage/initiative-improvement-proposals-stage.store.js";
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
 * Part 2 — Improvement Proposals eligible to feed Revision changes.
 * Includes published collections (public) and the Author's in-progress draft
 * collection so Accept / Partial decisions can generate suggested Initiative
 * text before the proposal collection itself is published.
 */
async function listEligibleStructuredProposals(
  initiativeId: string,
): Promise<InitiativeRevisionEligibleStructuredProposal[]> {
  const eligible: InitiativeRevisionEligibleStructuredProposal[] = [];
  const seenProposalIds = new Set<string>();

  function pushEligible(
    collectionId: string,
    proposal: {
      proposalId: string;
      title: string;
      summary: string;
      reason: string;
      expectedImprovement: string;
      status: string;
      originalAuthorDisplayNames: readonly string[];
      relatedDiscussionReferences: string;
    },
  ): void {
    if (seenProposalIds.has(proposal.proposalId)) {
      return;
    }

    if (proposal.status !== "published" && proposal.status !== "included_in_revision") {
      return;
    }

    seenProposalIds.add(proposal.proposalId);
    eligible.push({
      proposalId: proposal.proposalId,
      collectionId,
      title: proposal.title,
      summary: proposal.summary,
      reason: proposal.reason,
      expectedImprovement: proposal.expectedImprovement,
      status: proposal.status,
      originalAuthorDisplayNames: [...proposal.originalAuthorDisplayNames],
      relatedDiscussionReferences: proposal.relatedDiscussionReferences,
    });
  }

  const collections = await listPublicInitiativeImprovementProposalsCollections(initiativeId);

  for (const collection of collections) {
    for (const proposal of collection.proposals) {
      pushEligible(collection.collectionId, proposal);
    }
  }

  for (const collection of await listCollectionsByInitiative(initiativeId)) {
    if (collection.status !== "draft") {
      continue;
    }

    for (const proposal of collection.proposals) {
      pushEligible(collection.collectionId, proposal);
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
    const changeCount = entries.length;
    warnings.push({
      code: "multiple_changes_same_section",
      section: section as InitiativeRevisionChange["section"],
      sectionLabel,
      changeIds: entries.map((entry) => entry.changeId),
      proposalIds: [...new Set(entries.flatMap((entry) => entry.proposalIds))],
      params: { changeCount },
      message: `${changeCount} changes target the ${sectionLabel} section — review before publishing to avoid conflicting edits.`,
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
  const missingCount = missingReferenceProposalIds.length;
  const untracedCount = changes.length - tracedCount;

  return [
    {
      checkId: "accepted-proposals-traced",
      label: "Accepted proposals traced into a change",
      status: missingCount === 0 ? "ok" : "warning",
      detail:
        missingCount === 0
          ? "Every proposal marked for inclusion is referenced by a change."
          : `${missingCount} proposal(s) marked "Included in Revision" have no backing change yet.`,
      params: { count: missingCount },
    },
    {
      checkId: "changes-have-origin",
      label: "Every change has an identifiable origin",
      status: untracedCount === 0 ? "ok" : "warning",
      detail:
        untracedCount === 0
          ? "Every drafted change references a Proposal or is marked Author-originated."
          : `${untracedCount} change(s) are missing a Proposal reference or an Author-originated reason.`,
      params: { count: untracedCount },
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
