import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  fromActivityMongoDocument,
  toActivityDetailDto,
  toActivityMongoDocument,
  type ActivityMongoDocument,
} from "../../../src/modules/activity/infrastructure/activity.persistence.js";
import type { ActivityRecord } from "../../../src/modules/activity/domain/activity.types.js";

const SAMPLE_RECORD: ActivityRecord = {
  activityId: "activity-1",
  creatorMemberId: "member-1",
  title: "Sample Activity",
  description: "Sample description with enough characters.",
  activityType: "civic_participation",
  visibility: "public",
  status: "open",
  aggregateVersion: 1,
  createdAt: "2026-07-22T12:00:00.000Z",
  updatedAt: "2026-07-22T12:00:00.000Z",
};

describe("Activity persistence mapping", () => {
  it("maps domain to Mongo without leaking extra fields", () => {
    const document = toActivityMongoDocument(SAMPLE_RECORD);

    assert.deepEqual(document, {
      activityId: SAMPLE_RECORD.activityId,
      creatorMemberId: SAMPLE_RECORD.creatorMemberId,
      title: SAMPLE_RECORD.title,
      description: SAMPLE_RECORD.description,
      activityType: SAMPLE_RECORD.activityType,
      visibility: SAMPLE_RECORD.visibility,
      status: SAMPLE_RECORD.status,
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
    } as ActivityMongoDocument;

    const record = fromActivityMongoDocument(mongoDocument);

    assert.deepEqual(record, SAMPLE_RECORD);
    assert.equal("_id" in record, false);
  });

  it("maps domain to canonical Activity DTO without persistence fields", () => {
    const dto = toActivityDetailDto(SAMPLE_RECORD);

    assert.deepEqual(dto, SAMPLE_RECORD);
    assert.equal("initiativeId" in dto, false);
    assert.equal("_id" in dto, false);
  });
});
