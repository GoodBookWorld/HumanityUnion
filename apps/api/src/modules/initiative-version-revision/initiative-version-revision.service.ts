import { randomUUID } from "node:crypto";

import type {
  Initiative,
  InitiativeRevisionChange,
  InitiativeRevisionDraft,
  InitiativeRevisionDraftContext,
  InitiativeRevisionEligibleProposal,
  InitiativeVersionRevision,
} from "@hu/types";

import { getAnalysisById } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import {
  getProposalById,
  listProposalsByInitiative,
  updateProposal,
} from "../initiative-improvement-proposal/initiative-improvement-proposal.store.js";
import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById, updateInitiative } from "../initiatives/initiative.store.js";
import { toLatestInitiativeCardProjection } from "../initiatives/initiative-latest-initiatives.projection.js";
import {
  removeProjectedInitiativeCard,
  upsertProjectedInitiativeCard,
} from "../initiatives/initiative-projection.store.js";
import { validateInitiativeForPublication } from "../initiatives/initiative.validators.js";
import { publishInitiativeLifecycleStage } from "../../shared/initiative-lifecycle-stage/index.js";
import { buildInitiativeRevisionIntelligenceSnapshot } from "./initiative-revision-intelligence.service.js";
import { generateRevisionChanges, toRevisionChange } from "./initiative-revision-draft-builder.js";
import {
  createRevision,
  deleteRevisionDraft,
  getCurrentPublishedVersion,
  getLatestRevisionForInitiative,
  getRevisionDraftByInitiativeId,
  listRevisionsByInitiative,
  updateRevisionDraft,
  upsertRevisionDraft,
} from "./initiative-version-revision.store.js";
import {
  type AddAuthorOriginatedRevisionChangeInput,
  type SaveInitiativeRevisionChangeInput,
  type SaveInitiativeRevisionDraftInput,
  validateInitiativeRevisionChangesForPublication,
  validateInitiativeRevisionDraftForPublication,
} from "./initiative-version-revision.validators.js";

function getOwnedInitiative(initiativeId: string, identity: RequestIdentity): Initiative {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);

  return initiative;
}

function assertRevisionEligibleInitiative(initiative: Initiative): void {
  if (initiative.lifecyclePhase !== "published" && initiative.lifecyclePhase !== "projected") {
    throw new Error("Revisions can only be created for published or projected initiatives.");
  }
}

function listEligibleProposals(initiativeId: string): InitiativeRevisionEligibleProposal[] {
  return listProposalsByInitiative(initiativeId)
    .filter(
      (proposal) =>
        (proposal.status === "accepted" || proposal.status === "partially_accepted") &&
        proposal.implementedInVersion === undefined,
    )
    .map((proposal) => ({
      proposalId: proposal.proposalId,
      analysisId: proposal.analysisId,
      targetSection: proposal.targetSection,
      proposedChange: proposal.proposedChange,
      status: proposal.status as "accepted" | "partially_accepted",
    }));
}

function listDeclinedProposalIds(initiativeId: string): string[] {
  return listProposalsByInitiative(initiativeId)
    .filter((proposal) => proposal.status === "declined")
    .map((proposal) => proposal.proposalId);
}

function syncProjectedInitiativeCard(initiative: Initiative, previousCommunitySlug?: string): void {
  if (previousCommunitySlug && previousCommunitySlug !== initiative.metadata.communitySlug) {
    removeProjectedInitiativeCard(previousCommunitySlug, initiative.initiativeId);
  }

  if (initiative.lifecyclePhase !== "projected") {
    return;
  }

  const card = toLatestInitiativeCardProjection(initiative, 0);
  upsertProjectedInitiativeCard(initiative.metadata.communitySlug, card);
}

function partitionAppliedProposalIds(appliedProposalIds: string[]): {
  acceptedProposalIds: string[];
  partiallyAcceptedProposalIds: string[];
} {
  const acceptedProposalIds: string[] = [];
  const partiallyAcceptedProposalIds: string[] = [];

  for (const proposalId of appliedProposalIds) {
    const proposal = getProposalById(proposalId);

    if (!proposal) {
      throw new Error(`Proposal "${proposalId}" not found.`);
    }

    if (proposal.status === "accepted") {
      acceptedProposalIds.push(proposalId);
      continue;
    }

    if (proposal.status === "partially_accepted") {
      partiallyAcceptedProposalIds.push(proposalId);
      continue;
    }

    throw new Error(`Proposal "${proposalId}" is not eligible for implementation.`);
  }

  return { acceptedProposalIds, partiallyAcceptedProposalIds };
}

function validateAppliedProposalIds(initiativeId: string, appliedProposalIds: string[]): void {
  const eligibleIds = new Set(
    listEligibleProposals(initiativeId).map((proposal) => proposal.proposalId),
  );

  for (const proposalId of appliedProposalIds) {
    if (!eligibleIds.has(proposalId)) {
      throw new Error(`Proposal "${proposalId}" is not eligible for this revision.`);
    }
  }
}

export function listInitiativeVersionRevisions(
  identity: RequestIdentity,
  initiativeId: string,
): InitiativeVersionRevision[] {
  getOwnedInitiative(initiativeId, identity);

  return listRevisionsByInitiative(initiativeId);
}

export async function getInitiativeRevisionWorkspaceContext(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeRevisionDraftContext> {
  const initiative = getOwnedInitiative(initiativeId, identity);

  assertRevisionEligibleInitiative(initiative);

  const snapshot = await buildInitiativeRevisionIntelligenceSnapshot(initiativeId);

  return {
    draft: getRevisionDraftByInitiativeId(initiativeId),
    currentVersion: getCurrentPublishedVersion(initiativeId),
    eligibleProposals: listEligibleProposals(initiativeId),
    eligibleStructuredProposals: [...snapshot.eligibleProposals],
    intelligenceSnapshot: snapshot,
    currentInitiative: {
      title: initiative.title,
      description: initiative.description,
      metadata: structuredClone(initiative.metadata),
    },
  };
}

/**
 * Initiative Lifecycle — Part E, Section 2. The one canonical
 * `InitiativeRevisionDraft` the Lifecycle Stage Workspace shows this
 * Author for this Initiative — creates it (from the Current published
 * Initiative) on first use rather than requiring a separate explicit
 * "create draft" step, mirroring how Part D's/Part B's Author Workspace
 * auto-provisions its first working document. Returns the existing draft
 * unchanged if one is already in progress — never silently resets an
 * Author's in-progress `changes`.
 */
function getOrCreateWorkingRevisionDraft(
  identity: RequestIdentity,
  initiative: Initiative,
): InitiativeRevisionDraft {
  const existing = getRevisionDraftByInitiativeId(initiative.initiativeId);

  if (existing) {
    return existing;
  }

  if (getCurrentPublishedVersion(initiative.initiativeId) === 0) {
    throw new Error("Initial version must be published before creating a revision.");
  }

  const now = new Date().toISOString();
  const draft: InitiativeRevisionDraft = {
    draftId: `initiative-revision-draft-${randomUUID()}`,
    initiativeId: initiative.initiativeId,
    authorId: identity.participantId,
    title: initiative.title,
    description: initiative.description,
    metadata: structuredClone(initiative.metadata),
    revisionSummary: "",
    appliedProposalIds: [],
    skippedProposalIds: [],
    changes: [],
    createdAt: now,
    updatedAt: now,
  };

  return upsertRevisionDraft(draft);
}

/**
 * Initiative Lifecycle — Part E, Section 2/3 (Revision Sources → Intelligent
 * Revision Builder). "Generate" is ENRICHING, never wholesale-overwriting
 * (Part D's exact discipline for the analogous Improvement Proposals
 * Generate action) — every call auto-provisions the Author's working
 * draft if none exists yet, then appends exactly one new
 * `InitiativeRevisionChange` per curated ("Included in Revision") Proposal
 * that does not already have a backing change, leaving every existing
 * change's fields untouched.
 */
export async function generateInitiativeRevisionChanges(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeRevisionDraft> {
  const initiative = getOwnedInitiative(initiativeId, identity);
  assertRevisionEligibleInitiative(initiative);

  const draft = getOrCreateWorkingRevisionDraft(identity, initiative);
  const snapshot = await buildInitiativeRevisionIntelligenceSnapshot(initiativeId);
  const existingReferencedProposalIds = new Set(draft.changes.flatMap((change) => change.proposalIds));

  const generatedItems = await generateRevisionChanges({ snapshot, existingReferencedProposalIds });

  if (generatedItems.length === 0) {
    return draft;
  }

  const now = new Date().toISOString();
  const newChanges = generatedItems.map((item) => toRevisionChange(item, now));

  const updated = updateRevisionDraft(initiativeId, {
    changes: [...draft.changes, ...newChanges],
  });

  if (!updated) {
    throw new Error("Revision draft not found.");
  }

  return updated;
}

/** Part 8 — an Author-originated improvement with no Proposal backing, explicitly marked with a reason so it still participates in full traceability (Part 5). */
export function addAuthorOriginatedRevisionChange(
  identity: RequestIdentity,
  initiativeId: string,
  input: AddAuthorOriginatedRevisionChangeInput,
): InitiativeRevisionDraft {
  const initiative = getOwnedInitiative(initiativeId, identity);
  assertRevisionEligibleInitiative(initiative);

  const draft = getOrCreateWorkingRevisionDraft(identity, initiative);
  const now = new Date().toISOString();

  const change: InitiativeRevisionChange = {
    changeId: `initiative-revision-change-${randomUUID()}`,
    section: input.section,
    sectionLabel: input.sectionLabel && input.sectionLabel.trim() ? input.sectionLabel : input.section,
    before: input.before,
    after: input.after,
    origin: "author_originated",
    proposalIds: [],
    authorOriginatedReason: input.authorOriginatedReason,
    explanation: input.explanation,
    createdAt: now,
    updatedAt: now,
  };

  const updated = updateRevisionDraft(initiativeId, { changes: [...draft.changes, change] });

  if (!updated) {
    throw new Error("Revision draft not found.");
  }

  return updated;
}

/** Part 4/7 — the Author edits a suggested or manual change's text/explanation before deciding whether to fold it into the draft's real title/description. */
export function saveRevisionChange(
  identity: RequestIdentity,
  initiativeId: string,
  changeId: string,
  input: SaveInitiativeRevisionChangeInput,
): InitiativeRevisionDraft {
  getOwnedInitiative(initiativeId, identity);

  const draft = getRevisionDraftByInitiativeId(initiativeId);

  if (!draft) {
    throw new Error("Revision draft not found.");
  }

  const changeIndex = draft.changes.findIndex((change) => change.changeId === changeId);

  if (changeIndex === -1) {
    throw new Error("Revision change not found.");
  }

  const now = new Date().toISOString();
  const nextChanges = [...draft.changes];
  const current = nextChanges[changeIndex]!;
  nextChanges[changeIndex] = {
    ...current,
    before: input.before ?? current.before,
    after: input.after ?? current.after,
    explanation: input.explanation ?? current.explanation,
    authorOriginatedReason:
      current.origin === "author_originated"
        ? (input.authorOriginatedReason ?? current.authorOriginatedReason)
        : current.authorOriginatedReason,
    updatedAt: now,
  };

  const updated = updateRevisionDraft(initiativeId, { changes: nextChanges });

  if (!updated) {
    throw new Error("Revision draft not found.");
  }

  return updated;
}

/** Part 6 — the Author discards a suggested or manual change before publish; it never appears in the published revision's Before/After trace. */
export function removeRevisionChange(
  identity: RequestIdentity,
  initiativeId: string,
  changeId: string,
): InitiativeRevisionDraft {
  getOwnedInitiative(initiativeId, identity);

  const draft = getRevisionDraftByInitiativeId(initiativeId);

  if (!draft) {
    throw new Error("Revision draft not found.");
  }

  const updated = updateRevisionDraft(initiativeId, {
    changes: draft.changes.filter((change) => change.changeId !== changeId),
  });

  if (!updated) {
    throw new Error("Revision draft not found.");
  }

  return updated;
}

/**
 * Part 6/7 — a real, deterministic, Author-triggered "Apply" action: copies
 * one change's reviewed `after` text into the draft's actual `title`/
 * `description` field (never automatic — the Author must click Apply for
 * each change individually). A `"custom"`-section change has no matching
 * Initiative field and is a no-op here; it still remains fully tracked in
 * `changes` for traceability.
 */
export function applyRevisionChangeToDraft(
  identity: RequestIdentity,
  initiativeId: string,
  changeId: string,
): InitiativeRevisionDraft {
  getOwnedInitiative(initiativeId, identity);

  const draft = getRevisionDraftByInitiativeId(initiativeId);

  if (!draft) {
    throw new Error("Revision draft not found.");
  }

  const change = draft.changes.find((entry) => entry.changeId === changeId);

  if (!change) {
    throw new Error("Revision change not found.");
  }

  if (change.section !== "title" && change.section !== "description") {
    return draft;
  }

  const updated = updateRevisionDraft(initiativeId, {
    title: change.section === "title" ? change.after : undefined,
    description: change.section === "description" ? change.after : undefined,
  });

  if (!updated) {
    throw new Error("Revision draft not found.");
  }

  return updated;
}

export function createInitiativeRevisionDraft(
  identity: RequestIdentity,
  initiativeId: string,
): InitiativeRevisionDraft {
  const initiative = getOwnedInitiative(initiativeId, identity);

  assertRevisionEligibleInitiative(initiative);

  if (getCurrentPublishedVersion(initiativeId) === 0) {
    throw new Error("Initial version must be published before creating a revision.");
  }

  const now = new Date().toISOString();
  const draft: InitiativeRevisionDraft = {
    draftId: `initiative-revision-draft-${Date.now()}`,
    initiativeId,
    authorId: identity.participantId,
    title: initiative.title,
    description: initiative.description,
    metadata: structuredClone(initiative.metadata),
    revisionSummary: "",
    appliedProposalIds: [],
    skippedProposalIds: [],
    changes: [],
    createdAt: now,
    updatedAt: now,
  };

  return upsertRevisionDraft(draft);
}

export function saveInitiativeRevisionDraft(
  identity: RequestIdentity,
  initiativeId: string,
  input: SaveInitiativeRevisionDraftInput,
): InitiativeRevisionDraft {
  getOwnedInitiative(initiativeId, identity);

  const existing = getRevisionDraftByInitiativeId(initiativeId);

  if (!existing) {
    throw new Error("Revision draft not found.");
  }

  if (input.appliedProposalIds !== undefined) {
    validateAppliedProposalIds(initiativeId, input.appliedProposalIds);
  }

  const updated = updateRevisionDraft(initiativeId, {
    title: input.title,
    description: input.description,
    metadata:
      input.communitySlug !== undefined || input.activityArea !== undefined
        ? {
            communitySlug: input.communitySlug,
            activityArea: input.activityArea,
            category: input.activityArea,
          }
        : undefined,
    revisionSummary: input.revisionSummary,
    appliedProposalIds: input.appliedProposalIds,
    skippedProposalIds: input.skippedProposalIds,
  });

  if (!updated) {
    throw new Error("Revision draft not found.");
  }

  return updated;
}

export function publishInitiativeRevision(
  identity: RequestIdentity,
  initiativeId: string,
): {
  revision: InitiativeVersionRevision;
  initiative: Initiative;
} {
  const initiative = getOwnedInitiative(initiativeId, identity);

  assertRevisionEligibleInitiative(initiative);

  const draft = getRevisionDraftByInitiativeId(initiativeId);

  if (!draft) {
    throw new Error("Revision draft not found.");
  }

  validateInitiativeRevisionDraftForPublication(draft);
  validateAppliedProposalIds(initiativeId, draft.appliedProposalIds);
  validateInitiativeRevisionChangesForPublication(draft.changes);

  validateInitiativeForPublication({
    ...initiative,
    title: draft.title,
    description: draft.description,
    metadata: draft.metadata,
  });

  const currentVersion = getCurrentPublishedVersion(initiativeId);
  const nextVersion = currentVersion + 1;
  const publishedAt = new Date().toISOString();
  const { acceptedProposalIds, partiallyAcceptedProposalIds } = partitionAppliedProposalIds(
    draft.appliedProposalIds,
  );

  const revision: InitiativeVersionRevision = {
    revisionId: `initiative-version-revision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    initiativeId,
    version: nextVersion,
    previousVersion: currentVersion > 0 ? currentVersion : null,
    authorId: identity.participantId,
    createdAt: publishedAt,
    publishedAt,
    revisionSummary: draft.revisionSummary,
    title: draft.title,
    description: draft.description,
    metadata: structuredClone(draft.metadata),
    acceptedProposalIds,
    partiallyAcceptedProposalIds,
    declinedProposalIds: listDeclinedProposalIds(initiativeId),
    changes: [...draft.changes],
  };

  const previousCommunitySlug = initiative.metadata.communitySlug;
  const updatedInitiative = updateInitiative(initiativeId, {
    title: draft.title,
    description: draft.description,
    metadata: {
      communitySlug: draft.metadata.communitySlug,
      activityArea: draft.metadata.activityArea,
      category: draft.metadata.activityArea,
    },
    timeline: [
      ...initiative.timeline,
      {
        eventId: `timeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        eventType: "initiative_revision_published",
        timestamp: publishedAt,
        metadata: {
          version: nextVersion,
          revisionId: revision.revisionId,
        },
      },
    ],
  });

  if (!updatedInitiative) {
    throw new Error("Initiative not found.");
  }

  const createdRevision = createRevision(revision);

  for (const proposalId of draft.appliedProposalIds) {
    updateProposal(proposalId, {
      implementedInRevisionId: createdRevision.revisionId,
      implementedInVersion: nextVersion,
    });
  }

  deleteRevisionDraft(initiativeId);
  syncProjectedInitiativeCard(updatedInitiative, previousCommunitySlug);

  return {
    revision: createdRevision,
    initiative: updatedInitiative,
  };
}

/**
 * Initiative Lifecycle — Part E, Section 10/13. Reuses the Part A/B/C/D
 * Lifecycle notification foundation verbatim — no new notification
 * plumbing exists for this stage; `publishInitiativeLifecycleStage` is
 * stage-agnostic, so calling it with `stageId: "revision"` alone is
 * sufficient for the existing consumer to fan out one Notification to
 * every Active Ally (Author excluded), advance Lifecycle Progress, and
 * generate the standard "continue to next stage" (Petition) Reminder —
 * see `mapLifecycleStageIdToReminderCategory` in
 * `initiative-lifecycle-stage-notification.consumer.ts`, which already
 * maps `"revision"` → its own reminder category and `"petition"` → the
 * next-stage Reminder this publish produces.
 */
async function notifyLifecycleStageRevisionPublished(
  revision: InitiativeVersionRevision,
  actorParticipantId: string,
): Promise<void> {
  const initiative = getInitiativeById(revision.initiativeId);

  try {
    await publishInitiativeLifecycleStage({
      initiativeId: revision.initiativeId,
      initiativeTitle: initiative?.title ?? revision.initiativeId,
      lifecycleProfile: initiative?.lifecycleProfile,
      stageId: "revision",
      stageLabel: "Revision",
      stageArtifactId: revision.revisionId,
      stageVersion: revision.version,
      actorParticipantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(revision.initiativeId)}#revision`,
    });
  } catch (error) {
    console.warn(`[initiative-version-revision] Lifecycle stage notification skipped: ${String(error)}`);
  }
}

/**
 * Initiative Lifecycle — Part E. The real product entry point (HTTP route)
 * for publishing a Revision: performs the exact same synchronous publish
 * as {@link publishInitiativeRevision} (kept synchronous and unchanged for
 * its many existing fixture-script callers across other Parts/Capabilities)
 * and additionally AWAITS the Lifecycle stage notification, so the
 * publication event is durably enqueued before the HTTP response returns.
 */
export async function publishInitiativeRevisionStage(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<{ revision: InitiativeVersionRevision; initiative: Initiative }> {
  const result = publishInitiativeRevision(identity, initiativeId);

  await notifyLifecycleStageRevisionPublished(result.revision, identity.participantId);

  return result;
}

export function createInitialInitiativeVersionRevision(
  initiative: Initiative,
  authorId: string,
): InitiativeVersionRevision {
  const existing = getLatestRevisionForInitiative(initiative.initiativeId);

  if (existing) {
    return existing;
  }

  const publishedAt = new Date().toISOString();
  const revision: InitiativeVersionRevision = {
    revisionId: `initiative-version-revision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    initiativeId: initiative.initiativeId,
    version: 1,
    previousVersion: null,
    authorId,
    createdAt: publishedAt,
    publishedAt,
    revisionSummary: "Initial published version.",
    title: initiative.title,
    description: initiative.description,
    metadata: structuredClone(initiative.metadata),
    acceptedProposalIds: [],
    partiallyAcceptedProposalIds: [],
    declinedProposalIds: listDeclinedProposalIds(initiative.initiativeId),
    changes: [],
  };

  return createRevision(revision);
}

export function resolveInitiativeVersionForNewAnalysis(initiativeId: string): number {
  const currentVersion = getCurrentPublishedVersion(initiativeId);

  return currentVersion > 0 ? currentVersion : 1;
}

export function resolveAnalysisInitiativeVersion(analysisId: string): number {
  const analysis = getAnalysisById(analysisId);

  if (!analysis) {
    return 1;
  }

  return analysis.initiativeVersion ?? 1;
}
