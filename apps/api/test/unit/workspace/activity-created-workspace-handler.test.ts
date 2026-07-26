import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDomainEvent } from "../../../src/infrastructure/events/event-envelope.js";
import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
import {
  validateActivityCreatedWorkspaceEnvelope,
  WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID,
} from "../../../src/modules/workspace/application/activity-created.workspace-handler.js";
import { buildWorkspaceRecentActivityCard } from "../../../src/modules/workspace/infrastructure/workspace-projection.persistence.js";
import { WorkspaceProjectionValidationError } from "../../../src/modules/workspace/workspace.errors.js";

describe("ActivityCreated workspace projection handler", () => {
  it("validates canonical ActivityCreated payload for Workspace projection", () => {
    const event = createDomainEvent({
      eventId: "activity-created:activity-1",
      eventName: CATALOGUE_EVENTS.activityCreated,
      aggregateType: "Activity",
      aggregateId: "activity-1",
      payload: {
        activityId: "activity-1",
        creatorMemberId: "member-1",
        title: "Sample Activity",
        activityType: "civic_participation",
        visibility: "public",
        status: "open",
        createdAt: "2026-07-22T12:00:00.000Z",
      },
      correlationId: "corr-1",
    });

    const payload = validateActivityCreatedWorkspaceEnvelope(event);

    assert.equal(payload.activityId, "activity-1");
    assert.equal(payload.creatorMemberId, "member-1");
    assert.equal(WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID, "workspace.activity-created.v1");

    const card = buildWorkspaceRecentActivityCard({
      activityId: payload.activityId,
      title: payload.title,
      status: payload.status,
      createdAt: payload.createdAt,
      sourceEventId: event.eventId,
    });

    assert.equal(card.activityId, "activity-1");
    assert.equal(card.sourceEventId, event.eventId);
  });

  it("rejects invalid payloads and credential fields", () => {
    assert.throws(
      () =>
        validateActivityCreatedWorkspaceEnvelope(
          createDomainEvent({
            eventId: "activity-created:bad",
            eventName: CATALOGUE_EVENTS.memberRegistered,
            aggregateType: "Activity",
            aggregateId: "activity-1",
            payload: {},
          }),
        ),
      WorkspaceProjectionValidationError,
    );

    assert.throws(
      () =>
        validateActivityCreatedWorkspaceEnvelope(
          createDomainEvent({
            eventId: "activity-created:bad",
            eventName: CATALOGUE_EVENTS.activityCreated,
            aggregateType: "Activity",
            aggregateId: "activity-1",
            payload: {
              activityId: "activity-1",
              creatorMemberId: "member-1",
              title: "Sample",
              activityType: "civic_participation",
              visibility: "public",
              status: "open",
              createdAt: "2026-07-22T12:00:00.000Z",
              password: "secret",
            },
          }),
        ),
      /credential field "password"/,
    );
  });
});
