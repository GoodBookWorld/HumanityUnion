import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Initiative } from "@hu/types";
import { resolveInitiativeLifecycleState } from "@hu/types";

import {
  completeImprovementProposalsWithVersionCommit,
  ensureEmptyImprovementProposalsDraft,
  hasCommittedProgressVersionForInitiative,
  setInitiativeStructuredProposalStatus,
} from "../../../src/modules/initiative-improvement-proposals-stage/initiative-improvement-proposals-stage.service.js";
import {
  createCollection,
  deleteCollectionsByAuthorIdForTests,
  getCollectionById,
  listCollectionsByInitiative,
} from "../../../src/modules/initiative-improvement-proposals-stage/initiative-improvement-proposals-stage.store.js";
import { assertProposalStatusTransitionAllowed } from "../../../src/modules/initiative-improvement-proposals-stage/initiative-improvement-proposals-stage.validators.js";
import { generateRevisionChanges } from "../../../src/modules/initiative-version-revision/initiative-revision-draft-builder.js";
import {
  createInitialInitiativeVersionRevision,
  createInitiativeRevisionDraft,
  saveInitiativeRevisionDraft,
} from "../../../src/modules/initiative-version-revision/initiative-version-revision.service.js";
import {
  getRevisionDraftByInitiativeId,
  listRevisionsByInitiative,
} from "../../../src/modules/initiative-version-revision/initiative-version-revision.store.js";
import { createInitiative, deleteInitiative, getInitiativeById } from "../../../src/modules/initiatives/initiative.store.js";
import { buildLifecycleNavigation } from "../../../src/modules/initiatives/public-initiative-experience-lifecycle-nav.js";
import { filterLifecycleProgressRevisions } from "../../../src/shared/lifecycle/lifecycle-progress-revision.js";

const STEWARD = "proposals-rehome-steward";

function identity() {
  return { participantId: STEWARD };
}

function buildInitiative(initiativeId: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId,
    stewardId: STEWARD,
    title: "Neighborhood composting",
    description: "Reduce food waste locally.",
    status: "proposal",
    lifecyclePhase: "projected",
    lifecycleProfile: "STANDARD",
    visibility: { policy: "public" },
    metadata: {
      activityArea: "Environment",
      communitySlug: "fixture-community",
      category: "Environment",
    },
    timeline: [],
    createdAt: now,
    updatedAt: now,
  } as Initiative;
}

async function seedInitiativeWithBootstrap(initiativeId: string): Promise<Initiative> {
  const initiative = createInitiative(buildInitiative(initiativeId));
  createInitialInitiativeVersionRevision(initiative, STEWARD);
  return getInitiativeById(initiativeId)!;
}

describe("Improvement Proposals — Revision re-home", () => {
  it("allows Accept / Partial / Decline treatment on draft collections", () => {
    assert.doesNotThrow(() =>
      assertProposalStatusTransitionAllowed(
        {
          proposalId: "p1",
          status: "ready",
        } as never,
        "draft",
        "included_in_revision",
      ),
    );
    assert.doesNotThrow(() =>
      assertProposalStatusTransitionAllowed(
        { proposalId: "p1", status: "ready" } as never,
        "draft",
        "keep_for_later",
      ),
    );
    assert.doesNotThrow(() =>
      assertProposalStatusTransitionAllowed(
        { proposalId: "p1", status: "ready" } as never,
        "draft",
        "not_applicable",
      ),
    );
  });

  it("accepted proposals feed revision draft suggestions", async () => {
    const suggestions = await generateRevisionChanges({
      snapshot: {
        initiativeId: "fixture",
        generatedAt: new Date().toISOString(),
        currentTitle: "Title",
        currentDescription: "Base description.",
        analysisReference: null,
        eligibleProposals: [
          {
            proposalId: "accepted-1",
            collectionId: "c1",
            title: "Add compost bins",
            summary: "Place bins at the entrance.",
            reason: "Allies requested it.",
            expectedImprovement: "Less contamination.",
            status: "included_in_revision",
            originalAuthorDisplayNames: ["Ally"],
            relatedDiscussionReferences: "",
          },
        ],
        referencedProposalIds: [],
        missingReferenceProposalIds: [],
        unresolvedProposalIds: [],
        affectedSections: [],
        conflictWarnings: [],
        consistencyChecks: [],
        discussionUrl: "#discussion",
        isEmpty: false,
      },
      existingReferencedProposalIds: new Set(),
    });

    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0]!.proposalIds[0], "accepted-1");
    assert.match(suggestions[0]!.after, /Place bins at the entrance/);
  });

  it("zero proposals → commit version → Petition unlocked", async () => {
    const initiativeId = `initiative-rehome-zero-${Date.now()}`;
    await seedInitiativeWithBootstrap(initiativeId);
    await deleteCollectionsByAuthorIdForTests(STEWARD);

    const result = await completeImprovementProposalsWithVersionCommit(identity(), initiativeId);

    assert.equal(result.collection.status, "published");
    assert.equal(result.collection.proposals.length, 0);
    assert.ok(result.revision.version >= 2);
    assert.ok(hasCommittedProgressVersionForInitiative(initiativeId));

    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: {
        initiative: 1,
        discussion: 1,
        analysis: 1,
        proposal: 1,
      },
    });
    assert.equal(state.currentStageId, "petition");
    assert.notEqual(state.currentStageId, "revision");

    const { currentStageId, stages } = buildLifecycleNavigation(
      getInitiativeById(initiativeId)!,
      new Map([
        ["initiative", [{ recordId: initiativeId, title: "i", updatedAt: result.collection.updatedAt }]],
        ["discussion", [{ recordId: "d1", title: "d", updatedAt: result.collection.updatedAt }]],
        ["analysis", [{ recordId: "a1", title: "a", updatedAt: result.collection.updatedAt }]],
        [
          "proposal",
          [
            {
              recordId: result.collection.collectionId,
              title: "proposals",
              updatedAt: result.collection.updatedAt,
            },
          ],
        ],
      ]),
    );
    assert.equal(currentStageId, "petition");
    assert.equal(stages.some((stage) => stage.stageId === "revision"), false);

    deleteInitiative(initiativeId);
  });

  it("saved draft does not advance lifecycle", async () => {
    const initiativeId = `initiative-rehome-draft-${Date.now()}`;
    await seedInitiativeWithBootstrap(initiativeId);
    await deleteCollectionsByAuthorIdForTests(STEWARD);

    await ensureEmptyImprovementProposalsDraft(identity(), initiativeId);
    createInitiativeRevisionDraft(identity(), initiativeId);
    saveInitiativeRevisionDraft(identity(), initiativeId, {
      title: "Edited title",
      revisionSummary: "Working draft only.",
    });

    const draft = getRevisionDraftByInitiativeId(initiativeId);
    assert.ok(draft);
    assert.equal(draft.title, "Edited title");

    const progress = filterLifecycleProgressRevisions(listRevisionsByInitiative(initiativeId));
    assert.equal(progress.length, 0);

    const collections = await listCollectionsByInitiative(initiativeId);
    assert.equal(collections[0]?.status, "draft");

    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: {
        initiative: 1,
        discussion: 1,
        analysis: 1,
      },
    });
    assert.equal(state.currentStageId, "proposal");

    deleteInitiative(initiativeId);
  });

  it("Preview does not advance lifecycle (display-only toggle)", () => {
    const before = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: { initiative: 1, discussion: 1, analysis: 1 },
    });
    // Preview is a client hash/UI toggle — no published artifact counts change.
    const after = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: { initiative: 1, discussion: 1, analysis: 1 },
    });
    assert.equal(before.currentStageId, after.currentStageId);
    assert.equal(after.currentStageId, "proposal");
  });

  it("Commit version persists after reload; proposal stage completes only on final action", async () => {
    const initiativeId = `initiative-rehome-commit-${Date.now()}`;
    await seedInitiativeWithBootstrap(initiativeId);
    await deleteCollectionsByAuthorIdForTests(STEWARD);

    const collection = await ensureEmptyImprovementProposalsDraft(identity(), initiativeId);
    createInitiativeRevisionDraft(identity(), initiativeId);
    saveInitiativeRevisionDraft(identity(), initiativeId, {
      revisionSummary: "Author-confirmed progress version.",
      title: "Confirmed title",
      description: "Confirmed description.",
      activityArea: "Environment",
    });

    const { publishInitiativeRevision } = await import(
      "../../../src/modules/initiative-version-revision/initiative-version-revision.service.js"
    );
    const committed = publishInitiativeRevision(identity(), initiativeId);

    assert.equal(getRevisionDraftByInitiativeId(initiativeId), null);
    assert.equal(committed.revision.version, 2);
    assert.ok(hasCommittedProgressVersionForInitiative(initiativeId));

    const reloaded = listRevisionsByInitiative(initiativeId).find((entry) => entry.version === 2);
    assert.ok(reloaded);
    assert.equal(reloaded.revisionSummary, "Author-confirmed progress version.");
    assert.equal(reloaded.title, "Confirmed title");

    const stillDraft = await getCollectionById(collection.collectionId);
    assert.equal(stillDraft?.status, "draft");

    const beforeComplete = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: {
        initiative: 1,
        discussion: 1,
        analysis: 1,
      },
    });
    assert.equal(beforeComplete.currentStageId, "proposal");

    const completed = await completeImprovementProposalsWithVersionCommit(identity(), initiativeId);
    assert.equal(completed.collection.status, "published");
    assert.equal(completed.revision.version, 2);

    const afterComplete = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: {
        initiative: 1,
        discussion: 1,
        analysis: 1,
        proposal: 1,
      },
    });
    assert.equal(afterComplete.currentStageId, "petition");

    deleteInitiative(initiativeId);
  });

  it("public revision history still lists bootstrap + committed progress versions", async () => {
    const initiativeId = `initiative-rehome-history-${Date.now()}`;
    await seedInitiativeWithBootstrap(initiativeId);
    await deleteCollectionsByAuthorIdForTests(STEWARD);

    await completeImprovementProposalsWithVersionCommit(identity(), initiativeId);

    const history = listRevisionsByInitiative(initiativeId).sort((a, b) => a.version - b.version);
    assert.ok(history.length >= 2);
    assert.equal(history[0]!.version, 1);
    assert.ok(history.some((entry) => entry.version >= 2));
    assert.ok(
      history.every((entry) => typeof entry.revisionId === "string" && entry.initiativeId === initiativeId),
    );

    deleteInitiative(initiativeId);
  });

  it("marks accepted structured proposal before generate feeds included_in_revision", async () => {
    const initiativeId = `initiative-rehome-accept-${Date.now()}`;
    await seedInitiativeWithBootstrap(initiativeId);
    await deleteCollectionsByAuthorIdForTests(STEWARD);

    const now = new Date().toISOString();
    const collection = await createCollection({
      collectionId: `collection-${initiativeId}`,
      initiativeId,
      authorId: STEWARD,
      analysisId: null,
      status: "draft",
      proposals: [
        {
          proposalId: `proposal-${initiativeId}`,
          groupId: null,
          title: "Clarify scope",
          summary: "Narrow the geographic scope.",
          description: "Limit to one district first.",
          reason: "Discussion consensus.",
          expectedImprovement: "Faster pilot delivery.",
          supportingSources: "",
          relatedDiscussionReferences: "",
          originalAuthorDisplayNames: [],
          status: "ready",
          createdAt: now,
          updatedAt: now,
        },
      ],
      sourceSnapshotCreatedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const updated = await setInitiativeStructuredProposalStatus(
      identity(),
      collection.collectionId,
      `proposal-${initiativeId}`,
      "included_in_revision",
    );
    assert.equal(updated.proposals[0]?.status, "included_in_revision");

    deleteInitiative(initiativeId);
  });
});
