import { randomUUID } from "node:crypto";

import type {
  Initiative,
  InitiativeImprovementProposalsCollection,
  InitiativeStructuredProposalStatus,
  InitiativeVersionRevision,
} from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { assertInitiativeImprovementProposalsCollectionOwnership } from "./initiative-improvement-proposals-stage-ownership.js";
import {
  createCollection,
  getCollectionById,
  listCollectionsByInitiativeAndAuthor,
  updateCollection,
} from "./initiative-improvement-proposals-stage.store.js";
import {
  type CreateManualInitiativeStructuredProposalInput,
  type SaveInitiativeStructuredProposalInput,
  assertProposalStatusTransitionAllowed,
  validateInitiativeStructuredProposalForPublication,
} from "./initiative-improvement-proposals-stage.validators.js";
import { buildInitiativeProposalIntelligenceSnapshot } from "./initiative-proposal-intelligence.service.js";
import { generateImprovementProposalDrafts, toStructuredProposal } from "./initiative-proposal-draft-builder.js";
import { publishInitiativeLifecycleStage } from "../../shared/initiative-lifecycle-stage/index.js";
import {
  createInitiativeRevisionDraft,
  publishInitiativeRevisionStage,
  saveInitiativeRevisionDraft,
} from "../initiative-version-revision/initiative-version-revision.service.js";
import {
  getCurrentPublishedVersion,
  getRevisionDraftByInitiativeId,
  listRevisionsByInitiative,
} from "../initiative-version-revision/initiative-version-revision.store.js";
import { filterLifecycleProgressRevisions } from "../../shared/lifecycle/lifecycle-progress-revision.js";

export interface InitiativeImprovementProposalsAncestryDependencies {
  readonly getInitiative: (initiativeId: string) => Initiative | null;
}

const defaultDeps: InitiativeImprovementProposalsAncestryDependencies = {
  getInitiative: getInitiativeById,
};

function getOwnedCollection(
  collectionId: string,
  identity: RequestIdentity,
): Promise<InitiativeImprovementProposalsCollection> {
  return getCollectionById(collectionId).then((collection) => {
    if (!collection) {
      throw new Error("Improvement Proposals collection not found.");
    }

    assertInitiativeImprovementProposalsCollectionOwnership(collection, identity);

    return collection;
  });
}

function assertDraftStatus(collection: InitiativeImprovementProposalsCollection): void {
  if (collection.status !== "draft") {
    throw new Error("Only a draft Improvement Proposals collection can be edited from this workflow.");
  }
}

/**
 * Initiative Lifecycle — Part D. "The" Improvement Proposals collection
 * the Lifecycle Stage Workspace shows this Author for this Initiative:
 * an in-progress draft takes priority, otherwise the most recently
 * published one, otherwise `null` — mirrors
 * `getMyInitiativeCollaborativeAnalysisForInitiative` (Part B) exactly.
 */
export async function getMyImprovementProposalsCollectionForInitiative(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeImprovementProposalsCollection | null> {
  const mine = await listCollectionsByInitiativeAndAuthor(initiativeId, identity.participantId);
  const draft = mine.find((collection) => collection.status === "draft");

  if (draft) {
    return draft;
  }

  const published = mine
    .filter((collection) => collection.status === "published")
    .sort((left, right) => (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""));

  return published[0] ?? null;
}

export async function getMyImprovementProposalsCollection(
  identity: RequestIdentity,
  collectionId: string,
): Promise<InitiativeImprovementProposalsCollection> {
  return getOwnedCollection(collectionId, identity);
}

/**
 * Initiative Lifecycle — Part D, Section 2/4: "Generate" is ENRICHING,
 * never wholesale-overwriting (see `initiative-proposal-draft-builder.ts`
 * for why) — every call creates exactly one new draft
 * `InitiativeStructuredProposal` per detected group that does not already
 * have one, leaves every existing proposal's fields untouched, and is
 * therefore safe to call repeatedly as Discussion accumulates new
 * Proposal-marked comments.
 */
export async function generateImprovementProposalsDraft(
  identity: RequestIdentity,
  initiativeId: string,
  deps: InitiativeImprovementProposalsAncestryDependencies = defaultDeps,
): Promise<InitiativeImprovementProposalsCollection> {
  const initiative = deps.getInitiative(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  const snapshot = await buildInitiativeProposalIntelligenceSnapshot(initiativeId);
  const existing = await getMyImprovementProposalsCollectionForInitiative(identity, initiativeId);
  const workingDraft = existing && existing.status === "draft" ? existing : null;

  const existingGroupIds = new Set(
    (workingDraft?.proposals ?? [])
      .map((proposal) => proposal.groupId)
      .filter((groupId): groupId is string => groupId !== null),
  );

  const generatedItems = await generateImprovementProposalDrafts({ snapshot, existingGroupIds });
  const now = new Date().toISOString();
  const newProposals = generatedItems.map((item) => toStructuredProposal(item, now));

  if (workingDraft) {
    const updated = await updateCollection(workingDraft.collectionId, {
      proposals: [...workingDraft.proposals, ...newProposals],
      sourceSnapshotCreatedAt: snapshot.generatedAt,
      analysisId: snapshot.analysisReference?.analysisId ?? workingDraft.analysisId,
    });

    if (!updated) {
      throw new Error("Improvement Proposals collection not found.");
    }

    return updated;
  }

  const collection: InitiativeImprovementProposalsCollection = {
    collectionId: `initiative-proposals-collection-${randomUUID()}`,
    initiativeId,
    authorId: identity.participantId,
    analysisId: snapshot.analysisReference?.analysisId ?? null,
    status: "draft",
    proposals: newProposals,
    sourceSnapshotCreatedAt: snapshot.generatedAt,
    createdAt: now,
    updatedAt: now,
  };

  return createCollection(collection);
}

export async function saveInitiativeStructuredProposal(
  identity: RequestIdentity,
  collectionId: string,
  proposalId: string,
  input: SaveInitiativeStructuredProposalInput,
): Promise<InitiativeImprovementProposalsCollection> {
  const collection = await getOwnedCollection(collectionId, identity);
  assertDraftStatus(collection);

  const proposalIndex = collection.proposals.findIndex((proposal) => proposal.proposalId === proposalId);

  if (proposalIndex === -1) {
    throw new Error("Proposal not found in this collection.");
  }

  const now = new Date().toISOString();
  const nextProposals = [...collection.proposals];
  const current = nextProposals[proposalIndex]!;
  nextProposals[proposalIndex] = {
    ...current,
    title: input.title ?? current.title,
    summary: input.summary ?? current.summary,
    description: input.description ?? current.description,
    reason: input.reason ?? current.reason,
    expectedImprovement: input.expectedImprovement ?? current.expectedImprovement,
    supportingSources: input.supportingSources ?? current.supportingSources,
    relatedDiscussionReferences: input.relatedDiscussionReferences ?? current.relatedDiscussionReferences,
    updatedAt: now,
  };

  const updated = await updateCollection(collectionId, { proposals: nextProposals });

  if (!updated) {
    throw new Error("Improvement Proposals collection not found.");
  }

  return updated;
}

/** Part 6/12 — an Author-originated proposal with no automatic Discussion source (`groupId: null`, no `sourceCommentIds`). */
export async function addManualInitiativeStructuredProposal(
  identity: RequestIdentity,
  collectionId: string,
  input: CreateManualInitiativeStructuredProposalInput,
): Promise<InitiativeImprovementProposalsCollection> {
  const collection = await getOwnedCollection(collectionId, identity);
  assertDraftStatus(collection);

  const now = new Date().toISOString();
  const proposal = {
    proposalId: `initiative-structured-proposal-${randomUUID()}`,
    title: input.title,
    summary: input.summary,
    description: input.description,
    reason: input.reason,
    expectedImprovement: input.expectedImprovement,
    supportingSources: input.supportingSources,
    relatedDiscussionReferences: input.relatedDiscussionReferences,
    originalAuthorDisplayNames: [] as readonly string[],
    sourceCommentIds: [] as readonly string[],
    groupId: null,
    status: "draft" as const,
    createdAt: now,
    updatedAt: now,
  };

  const updated = await updateCollection(collectionId, {
    proposals: [...collection.proposals, proposal],
  });

  if (!updated) {
    throw new Error("Improvement Proposals collection not found.");
  }

  return updated;
}

export async function setInitiativeStructuredProposalStatus(
  identity: RequestIdentity,
  collectionId: string,
  proposalId: string,
  status: InitiativeStructuredProposalStatus,
): Promise<InitiativeImprovementProposalsCollection> {
  const collection = await getOwnedCollection(collectionId, identity);
  const proposalIndex = collection.proposals.findIndex((proposal) => proposal.proposalId === proposalId);

  if (proposalIndex === -1) {
    throw new Error("Proposal not found in this collection.");
  }

  const current = collection.proposals[proposalIndex]!;
  assertProposalStatusTransitionAllowed(current, collection.status, status);

  const nextProposals = [...collection.proposals];
  nextProposals[proposalIndex] = { ...current, status, updatedAt: new Date().toISOString() };

  const updated = await updateCollection(collectionId, { proposals: nextProposals });

  if (!updated) {
    throw new Error("Improvement Proposals collection not found.");
  }

  return updated;
}

/**
 * Initiative Lifecycle — Part D, Section 10/13. Reuses the Part A/B/C
 * Lifecycle notification foundation verbatim — no new notification
 * plumbing exists for this stage; `publishInitiativeLifecycleStage` is
 * stage-agnostic (Part C, Part 12), so calling it with
 * `stageId: "proposal"` alone is sufficient for the existing consumer to
 * fan out one Notification to every Active Ally (Author excluded) and
 * generate the standard "continue to next stage" Reminder.
 */
async function notifyLifecycleStageProposalPublished(
  published: InitiativeImprovementProposalsCollection,
  actorParticipantId: string,
  publishedCount: number,
): Promise<void> {
  const initiative = getInitiativeById(published.initiativeId);

  try {
    await publishInitiativeLifecycleStage({
      initiativeId: published.initiativeId,
      initiativeTitle: initiative?.title ?? published.initiativeId,
      lifecycleProfile: initiative?.lifecycleProfile,
      stageId: "proposal",
      stageLabel: "Improvement Proposals",
      stageArtifactId: published.collectionId,
      stageVersion: publishedCount,
      actorParticipantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(published.initiativeId)}#improvement-proposals`,
    });
  } catch (error) {
    console.warn(
      `[initiative-improvement-proposals-stage] Lifecycle stage notification skipped: ${String(error)}`,
    );
  }
}

/**
 * Publishes every `"ready"` proposal in this draft collection in bulk
 * (Part 6). Proposals already given Accept / Partial / Decline treatment
 * keep their curation status. Any proposal still `"draft"` is left
 * untouched and carries forward for the next drafting round.
 *
 * Zero proposals is a valid Author outcome — continue after confirming the
 * Initiative version without community contributions.
 */
export async function publishImprovementProposalsCollection(
  identity: RequestIdentity,
  collectionId: string,
): Promise<InitiativeImprovementProposalsCollection> {
  const collection = await getOwnedCollection(collectionId, identity);
  assertDraftStatus(collection);

  const readyProposals = collection.proposals.filter((proposal) => proposal.status === "ready");
  const treatedProposals = collection.proposals.filter((proposal) =>
    proposal.status === "included_in_revision" ||
    proposal.status === "keep_for_later" ||
    proposal.status === "not_applicable",
  );

  // Zero proposals is valid. If draft-only proposals exist with no Ready and
  // no treatment decision, block — Author must Ready or Accept/Partial/Decline.
  if (
    readyProposals.length === 0 &&
    treatedProposals.length === 0 &&
    collection.proposals.length > 0
  ) {
    throw new Error(
      'At least one proposal must be marked "Ready" or given Accept / Partial / Decline treatment before publishing.',
    );
  }

  for (const proposal of readyProposals) {
    validateInitiativeStructuredProposalForPublication(proposal);
  }

  const now = new Date().toISOString();
  const nextProposals = collection.proposals.map((proposal) =>
    proposal.status === "ready" ? { ...proposal, status: "published" as const, updatedAt: now } : proposal,
  );

  const published = await updateCollection(collectionId, {
    status: "published",
    proposals: nextProposals,
    publishedAt: now,
  });

  if (!published) {
    throw new Error("Improvement Proposals collection not found.");
  }

  const publishedCount = (
    await listCollectionsByInitiativeAndAuthor(published.initiativeId, published.authorId)
  ).filter((entry) => entry.status === "published").length;

  await notifyLifecycleStageProposalPublished(published, identity.participantId, publishedCount);

  return published;
}

export async function archiveImprovementProposalsCollection(
  identity: RequestIdentity,
  collectionId: string,
): Promise<InitiativeImprovementProposalsCollection> {
  const collection = await getOwnedCollection(collectionId, identity);

  if (collection.status === "archived") {
    throw new Error("This Improvement Proposals collection is already archived.");
  }

  const archived = await updateCollection(collectionId, { status: "archived" });

  if (!archived) {
    throw new Error("Improvement Proposals collection not found.");
  }

  return archived;
}

/**
 * Creates an empty draft collection so Authors can confirm / commit an
 * Initiative version and continue to Petition with zero community proposals.
 */
export async function ensureEmptyImprovementProposalsDraft(
  identity: RequestIdentity,
  initiativeId: string,
  deps: InitiativeImprovementProposalsAncestryDependencies = defaultDeps,
): Promise<InitiativeImprovementProposalsCollection> {
  const initiative = deps.getInitiative(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  if (initiative.stewardId !== identity.participantId) {
    throw new Error("You do not have access to edit Improvement Proposals for this Initiative.");
  }

  const existing = await getMyImprovementProposalsCollectionForInitiative(identity, initiativeId);

  if (existing?.status === "draft") {
    return existing;
  }

  if (existing?.status === "published") {
    throw new Error("Improvement Proposals for this Initiative are already published.");
  }

  const now = new Date().toISOString();
  const snapshot = await buildInitiativeProposalIntelligenceSnapshot(initiativeId);

  return createCollection({
    collectionId: `initiative-proposals-collection-${randomUUID()}`,
    initiativeId,
    authorId: identity.participantId,
    analysisId: snapshot.analysisReference?.analysisId ?? null,
    status: "draft",
    proposals: [],
    sourceSnapshotCreatedAt: snapshot.generatedAt,
    createdAt: now,
    updatedAt: now,
  });
}

const DEFAULT_PROPOSALS_VERSION_SUMMARY =
  "Confirmed Initiative version after Improvement Proposals review.";

/**
 * Final Author completion for Improvement Proposals:
 * 1. ensure draft collection (empty allowed)
 * 2. ensure / finalize revision draft
 * 3. commit canonical InitiativeVersionRevision progress version
 * 4. publish the proposal collection (marks proposal stage complete → unlocks Petition)
 *
 * Save Draft / Preview / Commit-version-alone must NOT call this.
 */
export async function completeImprovementProposalsWithVersionCommit(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<{
  collection: InitiativeImprovementProposalsCollection;
  revision: InitiativeVersionRevision;
  initiative: Initiative;
}> {
  const collection = await ensureEmptyImprovementProposalsDraft(identity, initiativeId);

  if (collection.status !== "draft") {
    throw new Error("Only a draft Improvement Proposals collection can be completed from this workflow.");
  }

  if (getCurrentPublishedVersion(initiativeId) === 0) {
    throw new Error("Initial version must be published before creating a revision.");
  }

  const existingProgressVersions = filterLifecycleProgressRevisions(
    listRevisionsByInitiative(initiativeId),
  );
  let revision: InitiativeVersionRevision;
  let initiative: Initiative;

  const existingDraft = getRevisionDraftByInitiativeId(initiativeId);

  if (existingDraft) {
    let draft = existingDraft;
    if (!draft.revisionSummary.trim()) {
      draft = saveInitiativeRevisionDraft(identity, initiativeId, {
        revisionSummary: DEFAULT_PROPOSALS_VERSION_SUMMARY,
      });
    }
    const published = await publishInitiativeRevisionStage(identity, initiativeId);
    revision = published.revision;
    initiative = published.initiative;
  } else if (existingProgressVersions.length === 0) {
    let draft = createInitiativeRevisionDraft(identity, initiativeId);
    if (!draft.revisionSummary.trim()) {
      draft = saveInitiativeRevisionDraft(identity, initiativeId, {
        revisionSummary: DEFAULT_PROPOSALS_VERSION_SUMMARY,
      });
    }
    const published = await publishInitiativeRevisionStage(identity, initiativeId);
    revision = published.revision;
    initiative = published.initiative;
  } else {
    const latest = existingProgressVersions[existingProgressVersions.length - 1]!;
    revision = latest;
    const current = getInitiativeById(initiativeId);
    if (!current) {
      throw new Error("Initiative not found.");
    }
    initiative = current;
  }

  const publishedCollection = await publishImprovementProposalsCollection(identity, collection.collectionId);

  return {
    collection: publishedCollection,
    revision,
    initiative,
  };
}

/**
 * True when at least one non-bootstrap progress revision exists for Petition
 * to consume after Improvement Proposals completion.
 */
export function hasCommittedProgressVersionForInitiative(initiativeId: string): boolean {
  return filterLifecycleProgressRevisions(listRevisionsByInitiative(initiativeId)).length > 0;
}
