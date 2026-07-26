import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDomainEvent } from "../../../src/infrastructure/events/event-envelope.js";
import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
import {
  validateProposalCreatedWorkspaceEnvelope,
  WORKSPACE_PROPOSAL_CREATED_CONSUMER_ID,
} from "../../../src/modules/workspace/application/proposal-created.workspace-handler.js";
import { buildWorkspaceRecentProposalCard } from "../../../src/modules/workspace/infrastructure/workspace-projection.persistence.js";
import { WorkspaceProjectionValidationError } from "../../../src/modules/workspace/workspace.errors.js";

describe("ProposalCreated workspace projection handler", () => {
  it("validates canonical ProposalCreated payload for Workspace projection", () => {
    const event = createDomainEvent({
      eventId: "proposal-created:proposal-1",
      eventName: CATALOGUE_EVENTS.proposalCreated,
      aggregateType: "Proposal",
      aggregateId: "proposal-1",
      payload: {
        proposalId: "proposal-1",
        activityId: "activity-1",
        discussionId: "discussion-1",
        creatorMemberId: "member-1",
        title: "Sample Proposal",
        visibility: "public",
        status: "draft",
        createdAt: "2026-07-22T12:00:00.000Z",
      },
      correlationId: "corr-1",
    });

    const payload = validateProposalCreatedWorkspaceEnvelope(event);

    assert.equal(payload.proposalId, "proposal-1");
    assert.equal(payload.activityId, "activity-1");
    assert.equal(payload.discussionId, "discussion-1");
    assert.equal(payload.creatorMemberId, "member-1");
    assert.equal(WORKSPACE_PROPOSAL_CREATED_CONSUMER_ID, "workspace.proposal-created.v1");

    const card = buildWorkspaceRecentProposalCard({
      activityId: payload.activityId,
      proposalId: payload.proposalId,
      title: payload.title,
      status: payload.status,
      createdAt: payload.createdAt,
      sourceEventId: event.eventId,
    });

    assert.equal(card.proposalId, "proposal-1");
    assert.equal(card.referenceType, "proposal");
    assert.equal(card.sourceEventId, event.eventId);
  });

  it("rejects invalid payloads and forbidden fields", () => {
    assert.throws(
      () =>
        validateProposalCreatedWorkspaceEnvelope(
          createDomainEvent({
            eventId: "proposal-created:bad",
            eventName: CATALOGUE_EVENTS.memberRegistered,
            aggregateType: "Proposal",
            aggregateId: "proposal-1",
            payload: {},
          }),
        ),
      WorkspaceProjectionValidationError,
    );

    assert.throws(
      () =>
        validateProposalCreatedWorkspaceEnvelope(
          createDomainEvent({
            eventId: "proposal-created:bad",
            eventName: CATALOGUE_EVENTS.proposalCreated,
            aggregateType: "Proposal",
            aggregateId: "proposal-1",
            payload: {
              proposalId: "proposal-1",
              activityId: "activity-1",
              discussionId: null,
              creatorMemberId: "member-1",
              title: "Sample",
              visibility: "public",
              status: "draft",
              createdAt: "2026-07-22T12:00:00.000Z",
              proposalText: "secret body",
            },
          }),
        ),
      /forbidden field "proposalText"/,
    );
  });
});
