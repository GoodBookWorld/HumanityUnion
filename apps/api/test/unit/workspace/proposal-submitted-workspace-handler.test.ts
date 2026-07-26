import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDomainEvent } from "../../../src/infrastructure/events/event-envelope.js";
import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
import {
  validateProposalSubmittedWorkspaceEnvelope,
  WORKSPACE_PROPOSAL_SUBMITTED_CONSUMER_ID,
} from "../../../src/modules/workspace/application/proposal-submitted.workspace-handler.js";
import { WorkspaceProjectionValidationError } from "../../../src/modules/workspace/workspace.errors.js";

describe("ProposalSubmitted workspace projection handler", () => {
  it("validates canonical ProposalSubmitted payload for Workspace projection", () => {
    const event = createDomainEvent({
      eventId: "proposal-submitted:proposal-1",
      eventName: CATALOGUE_EVENTS.proposalSubmitted,
      aggregateType: "Proposal",
      aggregateId: "proposal-1",
      payload: {
        proposalId: "proposal-1",
        activityId: "activity-1",
        discussionId: "discussion-1",
        creatorMemberId: "member-1",
        title: "Sample Proposal",
        status: "submitted",
        visibility: "public",
        aggregateVersion: 2,
        updatedAt: "2026-07-22T13:00:00.000Z",
      },
      correlationId: "corr-1",
    });

    const payload = validateProposalSubmittedWorkspaceEnvelope(event);

    assert.equal(payload.proposalId, "proposal-1");
    assert.equal(payload.status, "submitted");
    assert.equal(payload.aggregateVersion, 2);
    assert.equal(WORKSPACE_PROPOSAL_SUBMITTED_CONSUMER_ID, "workspace.proposal-submitted.v1");
  });

  it("rejects invalid payloads and forbidden fields", () => {
    assert.throws(
      () =>
        validateProposalSubmittedWorkspaceEnvelope(
          createDomainEvent({
            eventId: "proposal-submitted:bad",
            eventName: CATALOGUE_EVENTS.proposalCreated,
            aggregateType: "Proposal",
            aggregateId: "proposal-1",
            payload: {},
          }),
        ),
      WorkspaceProjectionValidationError,
    );

    assert.throws(
      () =>
        validateProposalSubmittedWorkspaceEnvelope(
          createDomainEvent({
            eventId: "proposal-submitted:bad",
            eventName: CATALOGUE_EVENTS.proposalSubmitted,
            aggregateType: "Proposal",
            aggregateId: "proposal-1",
            payload: {
              proposalId: "proposal-1",
              activityId: "activity-1",
              discussionId: null,
              creatorMemberId: "member-1",
              title: "Sample",
              status: "submitted",
              visibility: "public",
              aggregateVersion: 2,
              updatedAt: "2026-07-22T13:00:00.000Z",
              proposalText: "secret body",
            },
          }),
        ),
      /forbidden field "proposalText"/,
    );
  });
});
