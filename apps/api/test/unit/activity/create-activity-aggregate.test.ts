import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ACTIVITY_AGGREGATE_VERSION_INITIAL,
  ACTIVITY_STATUSES,
} from "../../../src/modules/activity/domain/activity.types.js";
import { buildActivityAggregateForCreate } from "../../../src/modules/activity/domain/create-activity.aggregate.js";
import { ActivityValidationError } from "../../../src/modules/activity/domain/activity.errors.js";
import {
  assertNoTrustedCreateActivityFields,
  validateCreateActivityInput,
} from "../../../src/modules/activity/domain/activity.validation.js";

const VALID_COMMAND = {
  title: "Community Water Quality Review",
  description: "A civic participation activity to review local water quality reporting.",
  activityType: "civic_participation" as const,
  visibility: "public" as const,
};

describe("CreateActivity aggregate", () => {
  it("builds a valid Activity with trusted internal fields", () => {
    const occurredAt = "2026-07-22T12:00:00.000Z";
    const activity = buildActivityAggregateForCreate({
      command: VALID_COMMAND,
      creatorMemberId: "member-1",
      occurredAt,
    });

    assert.match(activity.activityId, /^[0-9a-f-]{36}$/);
    assert.equal(activity.creatorMemberId, "member-1");
    assert.equal(activity.title, VALID_COMMAND.title);
    assert.equal(activity.description, VALID_COMMAND.description);
    assert.equal(activity.activityType, "civic_participation");
    assert.equal(activity.visibility, "public");
    assert.equal(activity.status, ACTIVITY_STATUSES[0]);
    assert.equal(activity.aggregateVersion, ACTIVITY_AGGREGATE_VERSION_INITIAL);
    assert.equal(activity.createdAt, occurredAt);
    assert.equal(activity.updatedAt, occurredAt);
  });

  it("normalizes and validates create input", () => {
    const command = validateCreateActivityInput({
      title: "  Valid   Title  ",
      description: "  Valid description with enough characters.  ",
      activityType: "civic_participation",
      visibility: "allies",
    });

    assert.equal(command.title, "Valid Title");
    assert.equal(command.description, "Valid description with enough characters.");
    assert.equal(command.visibility, "allies");
  });

  it("rejects invalid scope, category, and length rules", () => {
    assert.throws(
      () =>
        validateCreateActivityInput({
          title: "ab",
          description: VALID_COMMAND.description,
          activityType: "civic_participation",
          visibility: "public",
        }),
      ActivityValidationError,
    );

    assert.throws(
      () =>
        validateCreateActivityInput({
          title: VALID_COMMAND.title,
          description: "too short",
          activityType: "civic_participation",
          visibility: "public",
        }),
      ActivityValidationError,
    );

    assert.throws(
      () =>
        validateCreateActivityInput({
          title: VALID_COMMAND.title,
          description: VALID_COMMAND.description,
          activityType: "petition",
          visibility: "public",
        }),
      ActivityValidationError,
    );

    assert.throws(
      () =>
        validateCreateActivityInput({
          title: VALID_COMMAND.title,
          description: VALID_COMMAND.description,
          activityType: "civic_participation",
          visibility: "secret",
        }),
      ActivityValidationError,
    );
  });

  it("rejects client-supplied trusted fields", () => {
    assert.throws(
      () =>
        assertNoTrustedCreateActivityFields({
          ...VALID_COMMAND,
          activityId: "client-id",
        }),
      /Client must not supply "activityId"/,
    );

    assert.throws(
      () =>
        assertNoTrustedCreateActivityFields({
          ...VALID_COMMAND,
          creatorMemberId: "other-member",
        }),
      /Client must not supply "creatorMemberId"/,
    );

    assert.throws(
      () =>
        assertNoTrustedCreateActivityFields({
          ...VALID_COMMAND,
          status: "closed",
        }),
      /Client must not supply "status"/,
    );
  });
});
