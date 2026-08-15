import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
import {
  buildInitiativeLifecycleStagePublishedEventId,
  createInitiativeLifecycleStagePublishedEvent,
  INITIATIVE_LIFECYCLE_STAGE_AGGREGATE_TYPE,
} from "../../../src/shared/initiative-lifecycle-stage/initiative-lifecycle-stage-published.event.js";
import { buildInitiativeLifecycleStageNotificationCopy } from "../../../src/shared/initiative-lifecycle-stage/initiative-lifecycle-stage-notification-copy.js";

describe("Initiative Lifecycle Part A — universal stage publication event factory", () => {
  it("builds a deterministic event id per (initiativeId, stageId, stageVersion, publicationKind)", () => {
    const id1 = buildInitiativeLifecycleStagePublishedEventId({
      initiativeId: "initiative-1",
      stageId: "analysis",
      stageVersion: 1,
      publicationKind: "published",
    });
    const id2 = buildInitiativeLifecycleStagePublishedEventId({
      initiativeId: "initiative-1",
      stageId: "analysis",
      stageVersion: 1,
      publicationKind: "published",
    });

    assert.equal(id1, id2);
  });

  it("produces a different event id for a different stageVersion — a real new publication is a new event", () => {
    const id1 = buildInitiativeLifecycleStagePublishedEventId({
      initiativeId: "initiative-1",
      stageId: "analysis",
      stageVersion: 1,
      publicationKind: "published",
    });
    const id2 = buildInitiativeLifecycleStagePublishedEventId({
      initiativeId: "initiative-1",
      stageId: "analysis",
      stageVersion: 2,
      publicationKind: "published",
    });

    assert.notEqual(id1, id2);
  });

  it("uses the canonical CATALOGUE_EVENTS name and aggregate type", () => {
    const event = createInitiativeLifecycleStagePublishedEvent({
      initiativeId: "initiative-1",
      initiativeTitle: "Title",
      stageId: "analysis",
      stageLabel: "Collaborative Analysis",
      stageArtifactId: "record-1",
      stageVersion: 1,
      actorParticipantId: "participant-1",
      publicationKind: "published",
      relatedUrl: "/initiatives/public/initiative-1#collaborative-analysis",
    });

    assert.equal(event.eventName, CATALOGUE_EVENTS.initiativeLifecycleStagePublished);
    assert.equal(event.aggregateType, INITIATIVE_LIFECYCLE_STAGE_AGGREGATE_TYPE);
    assert.equal(event.aggregateId, "initiative-1");
    assert.equal(event.payload.stageId, "analysis");
    assert.equal(event.metadata.actorId, "participant-1");
  });

  it("never includes any forbidden/private field in the payload", () => {
    const event = createInitiativeLifecycleStagePublishedEvent({
      initiativeId: "initiative-1",
      initiativeTitle: "Title",
      stageId: "analysis",
      stageLabel: "Collaborative Analysis",
      stageArtifactId: "record-1",
      stageVersion: 1,
      actorParticipantId: "participant-1",
      publicationKind: "published",
      relatedUrl: "/initiatives/public/initiative-1#collaborative-analysis",
    });

    for (const forbidden of ["password", "passwordHash", "token", "email", "refreshToken"]) {
      assert.equal(forbidden in event.payload, false);
    }
  });
});

describe("Initiative Lifecycle Part A — universal notification copy", () => {
  it("builds distinct wording per publicationKind, always naming the stage and Initiative", () => {
    const kinds: Array<Parameters<typeof buildInitiativeLifecycleStageNotificationCopy>[0]["publicationKind"]> = [
      "published",
      "opened",
      "finalized",
      "fixed",
      "superseded",
      "archived",
    ];

    const seenMessages = new Set<string>();

    for (const publicationKind of kinds) {
      const copy = buildInitiativeLifecycleStageNotificationCopy({
        stageLabel: "Collaborative Analysis",
        initiativeTitle: "Community Water Quality Review",
        publicationKind,
      });

      assert.match(copy.message, /Collaborative Analysis/);
      assert.match(copy.message, /Community Water Quality Review/);
      assert.equal(seenMessages.has(copy.message), false, `duplicate message for ${publicationKind}`);
      seenMessages.add(copy.message);
    }

    assert.equal(seenMessages.size, kinds.length);
  });
});
