import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ActivityRecord } from "../../../src/modules/activity/domain/activity.types.js";
import { buildDiscussionAggregateForCreate } from "../../../src/modules/discussion/domain/create-discussion.aggregate.js";
import {
  DISCUSSION_AGGREGATE_VERSION_INITIAL,
  DISCUSSION_STATUSES,
} from "../../../src/modules/discussion/domain/discussion.types.js";
import { DiscussionValidationError } from "../../../src/modules/discussion/domain/discussion.errors.js";
import {
  assertNoTrustedCreateDiscussionFields,
  validateCreateDiscussionInput,
} from "../../../src/modules/discussion/domain/discussion.validation.js";
import { buildDiscussionCreatedEventId } from "../../../src/modules/discussion/domain/discussion-created.event.js";

const ACTIVITY_ID = "11111111-1111-4111-8111-111111111111";

const VALID_COMMAND = {
  activityId: ACTIVITY_ID,
  title: "Water Quality Discussion",
  openingMessage: "Let's review the latest water quality reporting together.",
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

describe("CreateDiscussion aggregate", () => {
  it("builds a valid Discussion with trusted internal fields", () => {
    const occurredAt = "2026-07-22T12:00:00.000Z";
    const discussion = buildDiscussionAggregateForCreate({
      command: VALID_COMMAND,
      creatorMemberId: "member-1",
      activity: SAMPLE_ACTIVITY,
      occurredAt,
    });

    assert.match(discussion.discussionId, /^[0-9a-f-]{36}$/);
    assert.equal(discussion.activityId, ACTIVITY_ID);
    assert.equal(discussion.creatorMemberId, "member-1");
    assert.equal(discussion.title, VALID_COMMAND.title);
    assert.equal(discussion.openingMessage, VALID_COMMAND.openingMessage);
    assert.equal(discussion.visibility, "public");
    assert.equal(discussion.status, DISCUSSION_STATUSES[0]);
    assert.equal(discussion.aggregateVersion, DISCUSSION_AGGREGATE_VERSION_INITIAL);
    assert.equal(discussion.createdAt, occurredAt);
    assert.equal(discussion.updatedAt, occurredAt);
  });

  it("inherits visibility from Activity", () => {
    const discussion = buildDiscussionAggregateForCreate({
      command: VALID_COMMAND,
      creatorMemberId: "member-1",
      activity: { ...SAMPLE_ACTIVITY, visibility: "allies" },
    });

    assert.equal(discussion.visibility, "allies");
  });

  it("uses canonical DiscussionCreated event identity", () => {
    const discussion = buildDiscussionAggregateForCreate({
      command: VALID_COMMAND,
      creatorMemberId: "member-1",
      activity: SAMPLE_ACTIVITY,
    });

    assert.equal(
      buildDiscussionCreatedEventId(discussion.discussionId),
      `discussion-created:${discussion.discussionId}`,
    );
  });

  it("normalizes and validates create input", () => {
    const command = validateCreateDiscussionInput({
      activityId: ACTIVITY_ID,
      title: "  Valid   Title  ",
      openingMessage: "  Valid opening message with enough characters.  ",
    });

    assert.equal(command.title, "Valid Title");
    assert.equal(command.openingMessage, "Valid opening message with enough characters.");
  });

  it("rejects invalid activityId and length rules", () => {
    assert.throws(
      () =>
        validateCreateDiscussionInput({
          activityId: "not-a-uuid",
          title: VALID_COMMAND.title,
          openingMessage: VALID_COMMAND.openingMessage,
        }),
      DiscussionValidationError,
    );

    assert.throws(
      () =>
        validateCreateDiscussionInput({
          activityId: ACTIVITY_ID,
          title: "ab",
          openingMessage: VALID_COMMAND.openingMessage,
        }),
      DiscussionValidationError,
    );

    assert.throws(
      () =>
        validateCreateDiscussionInput({
          activityId: ACTIVITY_ID,
          title: VALID_COMMAND.title,
          openingMessage: "too short",
        }),
      DiscussionValidationError,
    );
  });

  it("rejects client-supplied trusted fields", () => {
    assert.throws(
      () =>
        assertNoTrustedCreateDiscussionFields({
          ...VALID_COMMAND,
          discussionId: "client-id",
        }),
      /Client must not supply "discussionId"/,
    );

    assert.throws(
      () =>
        assertNoTrustedCreateDiscussionFields({
          ...VALID_COMMAND,
          creatorMemberId: "other-member",
        }),
      /Client must not supply "creatorMemberId"/,
    );

    assert.throws(
      () =>
        assertNoTrustedCreateDiscussionFields({
          ...VALID_COMMAND,
          status: "closed",
        }),
      /Client must not supply "status"/,
    );
  });
});
