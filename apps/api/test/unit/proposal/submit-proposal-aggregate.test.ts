import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ProposalRecord } from "../../../src/modules/proposal/domain/proposal.types.js";
import {
  PROPOSAL_AGGREGATE_VERSION_INITIAL,
  PROPOSAL_AGGREGATE_VERSION_SUBMITTED,
} from "../../../src/modules/proposal/domain/proposal.types.js";
import {
  ProposalAlreadySubmittedError,
  ProposalSubmissionValidationError,
} from "../../../src/modules/proposal/domain/proposal.errors.js";
import {
  applyProposalSubmissionTransition,
  validateProposalSubmissionReadiness,
} from "../../../src/modules/proposal/domain/submit-proposal.aggregate.js";
import { buildProposalSubmittedEventId } from "../../../src/modules/proposal/domain/proposal-submitted.event.js";
import {
  assertNoTrustedSubmitProposalFields,
  validateSubmitProposalCommand,
} from "../../../src/modules/proposal/domain/proposal.validation.js";

const DRAFT_PROPOSAL: ProposalRecord = {
  proposalId: "33333333-3333-4333-8333-333333333333",
  activityId: "11111111-1111-4111-8111-111111111111",
  discussionId: "22222222-2222-4222-8222-222222222222",
  creatorMemberId: "member-1",
  title: "Water Quality Proposal",
  summary: "A structured proposal to improve local water quality reporting.",
  proposalText:
    "This proposal recommends coordinated review of municipal water quality disclosures with community oversight.",
  status: "draft",
  visibility: "public",
  aggregateVersion: PROPOSAL_AGGREGATE_VERSION_INITIAL,
  createdAt: "2026-07-22T12:00:00.000Z",
  updatedAt: "2026-07-22T12:00:00.000Z",
};

describe("SubmitProposal aggregate", () => {
  it("submits a draft Proposal and increments aggregateVersion", () => {
    const occurredAt = "2026-07-22T13:00:00.000Z";
    const submitted = applyProposalSubmissionTransition(DRAFT_PROPOSAL, occurredAt);

    assert.equal(submitted.status, "submitted");
    assert.equal(submitted.aggregateVersion, PROPOSAL_AGGREGATE_VERSION_SUBMITTED);
    assert.equal(submitted.updatedAt, occurredAt);
    assert.equal(submitted.createdAt, DRAFT_PROPOSAL.createdAt);
    assert.equal(submitted.proposalId, DRAFT_PROPOSAL.proposalId);
    assert.equal(submitted.activityId, DRAFT_PROPOSAL.activityId);
    assert.equal(submitted.discussionId, DRAFT_PROPOSAL.discussionId);
    assert.equal(submitted.creatorMemberId, DRAFT_PROPOSAL.creatorMemberId);
    assert.equal(submitted.title, DRAFT_PROPOSAL.title);
    assert.equal(submitted.summary, DRAFT_PROPOSAL.summary);
    assert.equal(submitted.proposalText, DRAFT_PROPOSAL.proposalText);
    assert.equal(submitted.visibility, DRAFT_PROPOSAL.visibility);
  });

  it("uses canonical ProposalSubmitted event identity", () => {
    assert.equal(
      buildProposalSubmittedEventId(DRAFT_PROPOSAL.proposalId),
      `proposal-submitted:${DRAFT_PROPOSAL.proposalId}`,
    );
  });

  it("rejects submitting an already submitted Proposal", () => {
    const submitted = applyProposalSubmissionTransition(DRAFT_PROPOSAL, "2026-07-22T13:00:00.000Z");

    assert.throws(
      () => applyProposalSubmissionTransition(submitted, "2026-07-22T14:00:00.000Z"),
      ProposalAlreadySubmittedError,
    );
  });

  it("rejects unsupported state transitions", () => {
    assert.throws(
      () =>
        applyProposalSubmissionTransition(
          { ...DRAFT_PROPOSAL, status: "submitted" as const, aggregateVersion: 2 },
          "2026-07-22T13:00:00.000Z",
        ),
      ProposalAlreadySubmittedError,
    );
  });

  it("enforces submission completeness rules", () => {
    assert.throws(
      () =>
        validateProposalSubmissionReadiness({
          ...DRAFT_PROPOSAL,
          title: "ab",
        }),
      ProposalSubmissionValidationError,
    );

    assert.throws(
      () =>
        validateProposalSubmissionReadiness({
          ...DRAFT_PROPOSAL,
          summary: "too short",
        }),
      ProposalSubmissionValidationError,
    );

    assert.throws(
      () =>
        validateProposalSubmissionReadiness({
          ...DRAFT_PROPOSAL,
          proposalText: "short",
        }),
      ProposalSubmissionValidationError,
    );
  });

  it("validates submit command and rejects trusted client fields", () => {
    const command = validateSubmitProposalCommand(DRAFT_PROPOSAL.proposalId);
    assert.equal(command.proposalId, DRAFT_PROPOSAL.proposalId);

    assert.throws(
      () => assertNoTrustedSubmitProposalFields({ status: "submitted" }),
      /Client must not supply "status"/,
    );

    assert.throws(
      () => assertNoTrustedSubmitProposalFields({ creatorMemberId: "other-member" }),
      /Client must not supply "creatorMemberId"/,
    );
  });
});
