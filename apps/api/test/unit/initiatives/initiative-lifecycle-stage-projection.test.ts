import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { Initiative } from "@hu/types";

import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import {
  resetInitiativeAlliesStoreForTests,
  upsertAlly,
} from "../../../src/modules/initiative-discussion-collaboration/initiative-ally.store.js";
import { buildInitiativeLifecycleStageProjection } from "../../../src/modules/initiatives/initiative-lifecycle-stage-projection.service.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

/**
 * Initiative Lifecycle — Part A Completion Part 2/19: selected-stage
 * projection boundary tests.
 *
 * Covers: one stage loaded per call, viewer role resolution (author /
 * active ally / guest), Initiative status/lifecyclePhase/public-stage
 * independence, and that unrelated lifecycle domains never leak into an
 * unrelated stage's projection.
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("initiative-lifecycle-stage-projection");
const STEWARD_ID = `${TEST_PREFIX}-steward`;
const ALLY_ID = `${TEST_PREFIX}-ally`;
const GUEST_LIKE_ID = `${TEST_PREFIX}-other-participant`;

function buildInitiativeFixture(): Initiative {
  const now = new Date().toISOString();

  return {
    initiativeId: `${TEST_PREFIX}-initiative`,
    stewardId: STEWARD_ID,
    createdAt: now,
    updatedAt: now,
    title: "Lifecycle Stage Projection Fixture Initiative",
    description: "Fixture Initiative used to verify the selected-stage projection boundary.",
    status: "proposal",
    lifecyclePhase: "published",
    visibility: { policy: "public" },
    metadata: {
      category: "Community",
      tags: [],
      region: "Test Region",
      language: "en",
      communitySlug: "test-community",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

describe("buildInitiativeLifecycleStageProjection — selected-stage projection boundary", () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  after(async () => {
    await resetInitiativeAlliesStoreForTests(`${TEST_PREFIX}-initiative`);
    await disconnectMongoClient();
  });

  it("resolves the Author as viewerRole 'author' with presentationMode 'author_workspace' on Collaborative Analysis", async () => {
    const initiative = buildInitiativeFixture();

    const projection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "analysis",
      viewerParticipantId: STEWARD_ID,
    });

    assert.ok(projection);
    assert.equal(projection?.viewerRole, "author");
    assert.equal(projection?.presentationMode, "author_workspace");
    assert.equal(projection?.stageId, "analysis");
  });

  it("resolves the Author as viewerRole 'author' but presentationMode 'public' on the root Initiative stage", async () => {
    const initiative = buildInitiativeFixture();

    const projection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "initiative",
      viewerParticipantId: STEWARD_ID,
    });

    assert.equal(projection?.viewerRole, "author");
    assert.equal(projection?.presentationMode, "public");
    assert.equal(projection?.authorActions.length, 0, "no Author actions leak into public presentation mode");
  });

  it("resolves a real Active Ally as viewerRole 'active_ally', always presentationMode 'public'", async () => {
    const initiative = buildInitiativeFixture();

    await upsertAlly({
      initiativeId: initiative.initiativeId,
      participantId: ALLY_ID,
      status: "active",
      requestedByParticipantId: ALLY_ID,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const projection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "analysis",
      viewerParticipantId: ALLY_ID,
    });

    assert.equal(projection?.viewerRole, "active_ally");
    assert.equal(projection?.presentationMode, "public");
    assert.equal(projection?.authorActions.length, 0);
  });

  it("resolves an authenticated non-Author, non-Ally participant as 'participant', and a signed-out viewer as 'guest' — both public", async () => {
    const initiative = buildInitiativeFixture();

    const participantProjection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "analysis",
      viewerParticipantId: GUEST_LIKE_ID,
    });
    assert.equal(participantProjection?.viewerRole, "participant");
    assert.equal(participantProjection?.presentationMode, "public");

    const guestProjection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "analysis",
      viewerParticipantId: null,
    });
    assert.equal(guestProjection?.viewerRole, "guest");
    assert.equal(guestProjection?.presentationMode, "public");
  });

  it("a route/client-only flag cannot grant Author Mode — only a real steward match does", async () => {
    const initiative = buildInitiativeFixture();

    // Simulates a caller who is NOT actually the steward attempting to view
    // as if they were — the projection must never trust anything except
    // initiative.stewardId === viewerParticipantId.
    const projection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "analysis",
      viewerParticipantId: `${TEST_PREFIX}-impersonator`,
    });

    assert.notEqual(projection?.viewerRole, "author");
    assert.equal(projection?.presentationMode, "public");
  });

  it("keeps Initiative.status, Initiative.lifecyclePhase, and the stage's presentationStatus as three independent values", async () => {
    const initiative = buildInitiativeFixture();
    assert.equal(initiative.status, "proposal");
    assert.equal(initiative.lifecyclePhase, "published");

    const projection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "analysis",
      viewerParticipantId: STEWARD_ID,
    });

    // The Initiative itself is still exactly as constructed — this
    // function never mutates or reinterprets `status`/`lifecyclePhase`.
    assert.equal(initiative.status, "proposal");
    assert.equal(initiative.lifecyclePhase, "published");
    // The "analysis" stage's own presentation status is computed from the
    // Collaborative Analysis domain (empty for this fixture — no analysis
    // exists), not from either Initiative-level field above.
    assert.equal(projection?.metadata.presentationStatus, "not_started");
  });

  it("loads only the requested stage — a different stage's projection never reflects another stage's adapter result", async () => {
    const initiative = buildInitiativeFixture();

    const analysisProjection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "analysis",
      viewerParticipantId: STEWARD_ID,
    });
    const petitionProjection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "petition",
      viewerParticipantId: STEWARD_ID,
    });

    assert.equal(analysisProjection?.stageId, "analysis");
    assert.equal(petitionProjection?.stageId, "petition");
    assert.notEqual(analysisProjection?.stageLabel, petitionProjection?.stageLabel);
    // Both are empty-state for this brand-new fixture, but each carries its
    // OWN stage identity/hash — never one bleeding into the other.
    assert.equal(analysisProjection?.stageHash, "collaborative-analysis");
    assert.equal(petitionProjection?.stageHash, "petition");
  });

  it("computes correct previous/next stage neighbors from the canonical registry", async () => {
    const initiative = buildInitiativeFixture();

    const projection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "analysis",
      viewerParticipantId: STEWARD_ID,
    });

    assert.equal(projection?.previousStage?.stageId, "initiative");
    assert.equal(projection?.nextStage?.stageId, "proposal");
  });

  it("the Civic Archive stage (last in the registry) has no next stage", async () => {
    const initiative = buildInitiativeFixture();

    const projection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "archive",
      viewerParticipantId: STEWARD_ID,
    });

    assert.equal(projection?.nextStage, null);
    assert.equal(projection?.previousStage?.stageId, "public_impact");
  });

  it("reports callable Lifecycle AI Assist capabilities for the Analysis stage Author Workspace", async () => {
    const initiative = buildInitiativeFixture();

    const projection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "analysis",
      viewerParticipantId: STEWARD_ID,
    });

    assert.ok(projection);
    assert.equal(projection!.aiCapabilities.canGenerateDraft, true);
    assert.equal(projection!.aiCapabilities.canRegenerateSection, true);
    assert.equal(projection!.aiCapabilities.canImproveWording, true);
    assert.equal(projection!.aiCapabilities.canIdentifyGaps, true);
    assert.equal(projection!.aiCapabilities.canIdentifyContradictions, true);
    assert.equal(projection!.aiCapabilities.canSummarize, true);
    assert.equal(projection!.aiCapabilities.canExplain, true);
    assert.equal(projection!.aiCapabilities.canAnswerQuestions, true);
  });

  it("reports only canGenerateDraft for the Petition stage Author Workspace (Part F's deterministic Petition Builder) — every other AI capability stays false, per the 'no fake button' rule", async () => {
    const initiative = buildInitiativeFixture();

    const projection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "petition",
      viewerParticipantId: STEWARD_ID,
    });

    assert.ok(projection);
    assert.equal(projection!.aiCapabilities.canGenerateDraft, true);
    assert.equal(projection!.aiCapabilities.canRegenerateSection, false);
    assert.equal(projection!.aiCapabilities.canImproveWording, false);
    assert.equal(projection!.aiCapabilities.canIdentifyGaps, false);
    assert.equal(projection!.aiCapabilities.canIdentifyContradictions, false);
  });

  it("reports only canGenerateDraft for the Decision Session stage Author Workspace (Part G's deterministic Decision Builder) — every other AI capability stays false, per the 'no fake button' rule", async () => {
    const initiative = buildInitiativeFixture();

    const projection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "decision_session",
      viewerParticipantId: STEWARD_ID,
    });

    assert.ok(projection);
    assert.equal(projection!.aiCapabilities.canGenerateDraft, true);
    assert.equal(projection!.aiCapabilities.canRegenerateSection, false);
    assert.equal(projection!.aiCapabilities.canImproveWording, false);
    assert.equal(projection!.aiCapabilities.canIdentifyGaps, false);
    assert.equal(projection!.aiCapabilities.canIdentifyContradictions, false);
  });

  it("reports only canGenerateDraft for the Collective Decision stage Author Workspace (Part H's deterministic Decision Result Builder) — every other AI capability stays false, per the 'no fake button' rule", async () => {
    const initiative = buildInitiativeFixture();

    const projection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "collective_decision",
      viewerParticipantId: STEWARD_ID,
    });

    assert.ok(projection);
    assert.equal(projection!.aiCapabilities.canGenerateDraft, true);
    assert.equal(projection!.aiCapabilities.canRegenerateSection, false);
    assert.equal(projection!.aiCapabilities.canImproveWording, false);
    assert.equal(projection!.aiCapabilities.canIdentifyGaps, false);
    assert.equal(projection!.aiCapabilities.canIdentifyContradictions, false);
  });

  it("reports only canGenerateDraft for the Implementation Commitment stage Author Workspace (Part I's deterministic Commitment Candidate Builder) — every other AI capability stays false, per the 'no fake button' rule", async () => {
    const initiative = buildInitiativeFixture();

    const projection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "commitment",
      viewerParticipantId: STEWARD_ID,
    });

    assert.ok(projection);
    assert.equal(projection!.aiCapabilities.canGenerateDraft, true);
    assert.equal(projection!.aiCapabilities.canRegenerateSection, false);
    assert.equal(projection!.aiCapabilities.canImproveWording, false);
    assert.equal(projection!.aiCapabilities.canIdentifyGaps, false);
    assert.equal(projection!.aiCapabilities.canIdentifyContradictions, false);
  });

  it("reports only canGenerateDraft for the Implementation Tracking stage Author Workspace (Part J's deterministic Tracking Candidate Builder) — every other AI capability stays false, per the 'no fake button' rule", async () => {
    const initiative = buildInitiativeFixture();

    const projection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "tracking",
      viewerParticipantId: STEWARD_ID,
    });

    assert.ok(projection);
    assert.equal(projection!.aiCapabilities.canGenerateDraft, true);
    assert.equal(projection!.aiCapabilities.canRegenerateSection, false);
    assert.equal(projection!.aiCapabilities.canImproveWording, false);
    assert.equal(projection!.aiCapabilities.canIdentifyGaps, false);
    assert.equal(projection!.aiCapabilities.canIdentifyContradictions, false);
  });

  it("reports only canGenerateDraft for the Official Response stage Author Workspace (Part K's deterministic Response Candidate Builder) — every other AI capability stays false, per the 'no fake button' rule", async () => {
    const initiative = buildInitiativeFixture();

    const projection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "official_response",
      viewerParticipantId: STEWARD_ID,
    });

    assert.ok(projection);
    assert.equal(projection!.aiCapabilities.canGenerateDraft, true);
    assert.equal(projection!.aiCapabilities.canRegenerateSection, false);
    assert.equal(projection!.aiCapabilities.canImproveWording, false);
    assert.equal(projection!.aiCapabilities.canIdentifyGaps, false);
    assert.equal(projection!.aiCapabilities.canIdentifyContradictions, false);
  });

  it("never reports canGenerateDraft to a non-Author viewer of the Analysis stage — Draft generation is an Author-only action", async () => {
    const initiative = buildInitiativeFixture();

    const projection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "analysis",
      viewerParticipantId: GUEST_LIKE_ID,
    });

    assert.ok(projection);
    for (const value of Object.values(projection!.aiCapabilities)) {
      assert.equal(value, false);
    }
  });

  it("produces a stable public deep link matching the existing hash-route convention", async () => {
    const initiative = buildInitiativeFixture();

    const projection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "analysis",
      viewerParticipantId: STEWARD_ID,
    });

    assert.equal(
      projection?.publicDeepLink,
      `/initiatives/public/${initiative.initiativeId}#collaborative-analysis`,
    );
  });

  it("returns null for an unknown stage id instead of throwing", async () => {
    const initiative = buildInitiativeFixture();

    const projection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "not-a-real-stage" as never,
      viewerParticipantId: STEWARD_ID,
    });

    assert.equal(projection, null);
  });
});
