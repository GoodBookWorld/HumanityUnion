import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ProposalRecord } from "../../../src/modules/proposal/domain/proposal.types.js";
import {
  fromProposalMongoDocument,
  toProposalDetailDto,
  toProposalMongoDocument,
  type ProposalMongoDocument,
} from "../../../src/modules/proposal/infrastructure/proposal.persistence.js";

const SAMPLE_RECORD: ProposalRecord = {
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
  aggregateVersion: 1,
  createdAt: "2026-07-22T12:00:00.000Z",
  updatedAt: "2026-07-22T12:00:00.000Z",
};

describe("Proposal persistence mapping", () => {
  it("maps domain to Mongo without leaking extra fields", () => {
    const document = toProposalMongoDocument(SAMPLE_RECORD);

    assert.deepEqual(document, {
      proposalId: SAMPLE_RECORD.proposalId,
      activityId: SAMPLE_RECORD.activityId,
      discussionId: SAMPLE_RECORD.discussionId,
      creatorMemberId: SAMPLE_RECORD.creatorMemberId,
      title: SAMPLE_RECORD.title,
      summary: SAMPLE_RECORD.summary,
      proposalText: SAMPLE_RECORD.proposalText,
      status: SAMPLE_RECORD.status,
      visibility: SAMPLE_RECORD.visibility,
      aggregateVersion: SAMPLE_RECORD.aggregateVersion,
      createdAt: SAMPLE_RECORD.createdAt,
      updatedAt: SAMPLE_RECORD.updatedAt,
    });
    assert.equal("_id" in document, false);
  });

  it("maps Mongo to domain and preserves timestamps and version", () => {
    const mongoDocument = {
      _id: "mongo-object-id",
      ...SAMPLE_RECORD,
    } as ProposalMongoDocument;

    const record = fromProposalMongoDocument(mongoDocument);

    assert.deepEqual(record, SAMPLE_RECORD);
    assert.equal("_id" in record, false);
  });

  it("maps domain to canonical Proposal DTO without persistence fields", () => {
    const dto = toProposalDetailDto(SAMPLE_RECORD);

    assert.deepEqual(dto, SAMPLE_RECORD);
    assert.equal("_id" in dto, false);
    assert.equal("initiativeId" in dto, false);
  });

  it("maps submitted status and aggregateVersion 2 through persistence round-trip", () => {
    const submittedRecord: ProposalRecord = {
      ...SAMPLE_RECORD,
      status: "submitted",
      aggregateVersion: 2,
      updatedAt: "2026-07-22T13:00:00.000Z",
    };

    const document = toProposalMongoDocument(submittedRecord);
    const record = fromProposalMongoDocument({
      _id: "mongo-object-id",
      ...document,
    } as ProposalMongoDocument);
    const dto = toProposalDetailDto(record);

    assert.equal(record.status, "submitted");
    assert.equal(record.aggregateVersion, 2);
    assert.equal(record.updatedAt, "2026-07-22T13:00:00.000Z");
    assert.equal(record.createdAt, SAMPLE_RECORD.createdAt);
    assert.equal(dto.status, "submitted");
    assert.equal(dto.aggregateVersion, 2);
    assert.equal("_id" in dto, false);
    assert.equal("submittedAt" in dto, false);
  });
});
