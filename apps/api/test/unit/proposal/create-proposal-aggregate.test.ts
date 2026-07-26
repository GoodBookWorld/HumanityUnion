import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ActivityRecord } from "../../../src/modules/activity/domain/activity.types.js";
import { buildProposalAggregateForCreate } from "../../../src/modules/proposal/domain/create-proposal.aggregate.js";
import {
  PROPOSAL_AGGREGATE_VERSION_INITIAL,
  PROPOSAL_STATUSES,
} from "../../../src/modules/proposal/domain/proposal.types.js";
import { ProposalValidationError } from "../../../src/modules/proposal/domain/proposal.errors.js";
import {
  assertNoTrustedCreateProposalFields,
  validateCreateProposalInput,
} from "../../../src/modules/proposal/domain/proposal.validation.js";
import { buildProposalCreatedEventId } from "../../../src/modules/proposal/domain/proposal-created.event.js";

const ACTIVITY_ID = "11111111-1111-4111-8111-111111111111";
const DISCUSSION_ID = "22222222-2222-4222-8222-222222222222";

const VALID_COMMAND = {
  activityId: ACTIVITY_ID,
  discussionId: DISCUSSION_ID,
  title: "Water Quality Proposal",
  summary: "A structured proposal to improve local water quality reporting.",
  proposalText:
    "This proposal recommends coordinated review of municipal water quality disclosures with community oversight.",
};

const SAMPLE_ACTIVITY: ActivityRecord = {
  activityId: ACTIVITY_ID,
  creatorMemberId: "member-1",
  title: "Community Water Quality Review",
  description: "A civic participation activity to review local water quality reporting.",
  activityType: "civic_participation",
  visibility: "public",
  status: "open",
  aggregateVersion: 1,
  createdAt: "2026-07-22T12:00:00.000Z",
  updatedAt: "2026-07-22T12:00:00.000Z",
};

describe("CreateProposal aggregate", () => {
  it("builds a valid Proposal with trusted internal fields", () => {
    const occurredAt = "2026-07-22T12:00:00.000Z";
    const proposal = buildProposalAggregateForCreate({
      command: VALID_COMMAND,
      creatorMemberId: "member-1",
      activity: SAMPLE_ACTIVITY,
      occurredAt,
    });

    assert.match(proposal.proposalId, /^[0-9a-f-]{36}$/);
    assert.equal(proposal.activityId, ACTIVITY_ID);
    assert.equal(proposal.discussionId, DISCUSSION_ID);
    assert.equal(proposal.creatorMemberId, "member-1");
    assert.equal(proposal.title, VALID_COMMAND.title);
    assert.equal(proposal.summary, VALID_COMMAND.summary);
    assert.equal(proposal.proposalText, VALID_COMMAND.proposalText);
    assert.equal(proposal.visibility, "public");
    assert.equal(proposal.status, PROPOSAL_STATUSES[0]);
    assert.equal(proposal.aggregateVersion, PROPOSAL_AGGREGATE_VERSION_INITIAL);
    assert.equal(proposal.createdAt, occurredAt);
    assert.equal(proposal.updatedAt, occurredAt);
  });

  it("inherits visibility from Activity and allows null discussionId", () => {
    const proposal = buildProposalAggregateForCreate({
      command: {
        activityId: ACTIVITY_ID,
        title: VALID_COMMAND.title,
        summary: VALID_COMMAND.summary,
        proposalText: VALID_COMMAND.proposalText,
      },
      creatorMemberId: "member-1",
      activity: { ...SAMPLE_ACTIVITY, visibility: "allies" },
    });

    assert.equal(proposal.visibility, "allies");
    assert.equal(proposal.discussionId, null);
  });

  it("uses canonical ProposalCreated event identity", () => {
    const proposal = buildProposalAggregateForCreate({
      command: VALID_COMMAND,
      creatorMemberId: "member-1",
      activity: SAMPLE_ACTIVITY,
    });

    assert.equal(
      buildProposalCreatedEventId(proposal.proposalId),
      `proposal-created:${proposal.proposalId}`,
    );
  });

  it("normalizes and validates create input", () => {
    const command = validateCreateProposalInput({
      activityId: ACTIVITY_ID,
      title: "  Valid   Title  ",
      summary: "  Valid summary with enough characters.  ",
      proposalText: "  Valid proposal text with enough characters for draft creation.  ",
    });

    assert.equal(command.title, "Valid Title");
    assert.equal(command.summary, "Valid summary with enough characters.");
    assert.equal(
      command.proposalText,
      "Valid proposal text with enough characters for draft creation.",
    );
  });

  it("rejects invalid identifiers and length rules", () => {
    assert.throws(
      () =>
        validateCreateProposalInput({
          activityId: "not-a-uuid",
          title: VALID_COMMAND.title,
          summary: VALID_COMMAND.summary,
          proposalText: VALID_COMMAND.proposalText,
        }),
      ProposalValidationError,
    );

    assert.throws(
      () =>
        validateCreateProposalInput({
          activityId: ACTIVITY_ID,
          title: "ab",
          summary: VALID_COMMAND.summary,
          proposalText: VALID_COMMAND.proposalText,
        }),
      ProposalValidationError,
    );

    assert.throws(
      () =>
        validateCreateProposalInput({
          activityId: ACTIVITY_ID,
          title: VALID_COMMAND.title,
          summary: "too short",
          proposalText: VALID_COMMAND.proposalText,
        }),
      ProposalValidationError,
    );
  });

  it("rejects client-supplied trusted fields", () => {
    assert.throws(
      () =>
        assertNoTrustedCreateProposalFields({
          ...VALID_COMMAND,
          proposalId: "client-id",
        }),
      /Client must not supply "proposalId"/,
    );

    assert.throws(
      () =>
        assertNoTrustedCreateProposalFields({
          ...VALID_COMMAND,
          creatorMemberId: "other-member",
        }),
      /Client must not supply "creatorMemberId"/,
    );

    assert.throws(
      () =>
        assertNoTrustedCreateProposalFields({
          ...VALID_COMMAND,
          status: "submitted",
        }),
      /Client must not supply "status"/,
    );
  });
});
