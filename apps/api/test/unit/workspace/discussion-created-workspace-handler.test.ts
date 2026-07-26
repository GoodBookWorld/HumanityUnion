import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDomainEvent } from "../../../src/infrastructure/events/event-envelope.js";
import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
import {
  validateDiscussionCreatedWorkspaceEnvelope,
  WORKSPACE_DISCUSSION_CREATED_CONSUMER_ID,
} from "../../../src/modules/workspace/application/discussion-created.workspace-handler.js";
import { buildWorkspaceRecentDiscussionCard } from "../../../src/modules/workspace/infrastructure/workspace-projection.persistence.js";
import { WorkspaceProjectionValidationError } from "../../../src/modules/workspace/workspace.errors.js";

describe("DiscussionCreated workspace projection handler", () => {
  it("validates canonical DiscussionCreated payload for Workspace projection", () => {
    const event = createDomainEvent({
      eventId: "discussion-created:discussion-1",
      eventName: CATALOGUE_EVENTS.discussionCreated,
      aggregateType: "Discussion",
      aggregateId: "discussion-1",
      payload: {
        discussionId: "discussion-1",
        activityId: "activity-1",
        creatorMemberId: "member-1",
        title: "Sample Discussion",
        visibility: "public",
        status: "open",
        createdAt: "2026-07-22T12:00:00.000Z",
      },
      correlationId: "corr-1",
    });

    const payload = validateDiscussionCreatedWorkspaceEnvelope(event);

    assert.equal(payload.discussionId, "discussion-1");
    assert.equal(payload.activityId, "activity-1");
    assert.equal(payload.creatorMemberId, "member-1");
    assert.equal(WORKSPACE_DISCUSSION_CREATED_CONSUMER_ID, "workspace.discussion-created.v1");

    const card = buildWorkspaceRecentDiscussionCard({
      activityId: payload.activityId,
      discussionId: payload.discussionId,
      title: payload.title,
      status: payload.status,
      createdAt: payload.createdAt,
      sourceEventId: event.eventId,
    });

    assert.equal(card.discussionId, "discussion-1");
    assert.equal(card.referenceType, "discussion");
    assert.equal(card.sourceEventId, event.eventId);
  });

  it("rejects invalid payloads and forbidden fields", () => {
    assert.throws(
      () =>
        validateDiscussionCreatedWorkspaceEnvelope(
          createDomainEvent({
            eventId: "discussion-created:bad",
            eventName: CATALOGUE_EVENTS.memberRegistered,
            aggregateType: "Discussion",
            aggregateId: "discussion-1",
            payload: {},
          }),
        ),
      WorkspaceProjectionValidationError,
    );

    assert.throws(
      () =>
        validateDiscussionCreatedWorkspaceEnvelope(
          createDomainEvent({
            eventId: "discussion-created:bad",
            eventName: CATALOGUE_EVENTS.discussionCreated,
            aggregateType: "Discussion",
            aggregateId: "discussion-1",
            payload: {
              discussionId: "discussion-1",
              activityId: "activity-1",
              creatorMemberId: "member-1",
              title: "Sample",
              visibility: "public",
              status: "open",
              createdAt: "2026-07-22T12:00:00.000Z",
              openingMessage: "secret body",
            },
          }),
        ),
      /forbidden field "openingMessage"/,
    );
  });
});
