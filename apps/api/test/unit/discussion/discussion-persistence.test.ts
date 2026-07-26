import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DiscussionRecord } from "../../../src/modules/discussion/domain/discussion.types.js";
import {
  fromDiscussionMongoDocument,
  toDiscussionDetailDto,
  toDiscussionMongoDocument,
  type DiscussionMongoDocument,
} from "../../../src/modules/discussion/infrastructure/discussion.persistence.js";

const SAMPLE_RECORD: DiscussionRecord = {
  discussionId: "22222222-2222-4222-8222-222222222222",
  activityId: "11111111-1111-4111-8111-111111111111",
  creatorMemberId: "member-1",
  title: "Water Quality Discussion",
  openingMessage: "Let's review the latest water quality reporting together.",
  status: "open",
  visibility: "public",
  aggregateVersion: 1,
  createdAt: "2026-07-22T12:00:00.000Z",
  updatedAt: "2026-07-22T12:00:00.000Z",
};

describe("Discussion persistence mapping", () => {
  it("maps domain to Mongo without leaking extra fields", () => {
    const document = toDiscussionMongoDocument(SAMPLE_RECORD);

    assert.deepEqual(document, {
      discussionId: SAMPLE_RECORD.discussionId,
      activityId: SAMPLE_RECORD.activityId,
      creatorMemberId: SAMPLE_RECORD.creatorMemberId,
      title: SAMPLE_RECORD.title,
      openingMessage: SAMPLE_RECORD.openingMessage,
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
    } as DiscussionMongoDocument;

    const record = fromDiscussionMongoDocument(mongoDocument);

    assert.deepEqual(record, SAMPLE_RECORD);
    assert.equal("_id" in record, false);
  });

  it("maps domain to canonical Discussion DTO without persistence fields", () => {
    const dto = toDiscussionDetailDto(SAMPLE_RECORD);

    assert.deepEqual(dto, SAMPLE_RECORD);
    assert.equal("_id" in dto, false);
    assert.equal("initiativeId" in dto, false);
  });
});
