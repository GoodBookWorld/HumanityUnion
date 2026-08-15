import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createActivityCreatedEvent } from "../../../src/modules/activity/domain/activity-created.event.js";
import { buildActivityAggregateForCreate } from "../../../src/modules/activity/domain/create-activity.aggregate.js";
import { fromActivityMongoDocument, type ActivityMongoDocument } from "../../../src/modules/activity/infrastructure/activity.persistence.js";
import type { ActivityRecord } from "../../../src/modules/activity/domain/activity.types.js";

/**
 * Recovery Task 20 — Discover the Correct Retargeting Path from Legacy
 * Activity to Initiative-Scoped Member Action Infrastructure.
 *
 * This task is discovery-only (see the Task 20 report). No production
 * behavior changed. These tests pin the exact CURRENT behaviors that any
 * future Phase 4 "retarget Activity as participation-trace infrastructure"
 * implementation (ADR §12, roadmap P4.1–P4.3) must either preserve or
 * deliberately, visibly change:
 *
 *  1. The exact `ActivityCreated` event payload shape today (narrower than
 *     the full `ActivityRecord` — no `description`, no `initiativeId`).
 *  2. That `fromActivityMongoDocument` is forward-tolerant of unknown extra
 *     fields, which is what makes an additive, non-migrating schema
 *     evolution (Reuse Model A/B) *possible* without breaking existing
 *     persisted records.
 *  3. That Activity creation has NO content-based idempotency/duplicate
 *     protection today — two structurally identical creation commands
 *     produce two distinct Activity records. Any future event-driven
 *     Member Action ledger must supply its own idempotency key (e.g. source
 *     event ID) rather than assume Activity already deduplicates.
 *
 * These are not duplicates of Recovery Task 19's boundary tests (which pin
 * the absence of `initiativeId`/`impactId`/`archiveId` and vocabulary
 * exclusion). This file pins event-payload shape, forward-compatibility,
 * and idempotency — the three properties Task 20's migration-option
 * analysis depends on.
 */

const VALID_COMMAND = {
  title: "Community Water Quality Review",
  description: "A civic participation activity to review local water quality reporting.",
  activityType: "civic_participation" as const,
  visibility: "public" as const,
};

describe("Activity → Member Action migration-safety characterization (Recovery Task 20)", () => {
  describe("ActivityCreated event payload shape", () => {
    it("contains exactly the current documented fields, no more, no fewer", () => {
      const activity = buildActivityAggregateForCreate({
        command: VALID_COMMAND,
        creatorMemberId: "member-migration-1",
        occurredAt: "2026-07-28T12:00:00.000Z",
      });

      const event = createActivityCreatedEvent({ activity, actorId: "member-migration-1" });

      assert.deepEqual(Object.keys(event.payload).sort(), [
        "activityId",
        "activityType",
        "createdAt",
        "creatorMemberId",
        "status",
        "title",
        "visibility",
      ]);
    });

    it("does not include description, initiativeId, or any parent-artifact reference", () => {
      const activity = buildActivityAggregateForCreate({
        command: VALID_COMMAND,
        creatorMemberId: "member-migration-2",
      });

      const event = createActivityCreatedEvent({ activity, actorId: "member-migration-2" });

      assert.equal("description" in event.payload, false);
      assert.equal("initiativeId" in event.payload, false);
      assert.equal("sourceArtifactId" in event.payload, false);
      assert.equal("sourceArtifactType" in event.payload, false);
    });

    it("carries the aggregate type, aggregate id, and a stable, reproducible event id derived from activityId", () => {
      const activity = buildActivityAggregateForCreate({
        command: VALID_COMMAND,
        creatorMemberId: "member-migration-3",
      });

      const event = createActivityCreatedEvent({ activity, actorId: "member-migration-3" });

      assert.equal(event.aggregateType, "Activity");
      assert.equal(event.aggregateId, activity.activityId);
      assert.equal(event.eventId, `activity-created:${activity.activityId}`);
    });
  });

  describe("forward-compatibility of the Mongo document reader", () => {
    it("ignores unknown extra fields instead of throwing (a precondition for additive schema evolution)", () => {
      const baseDocument: ActivityMongoDocument = {
        activityId: "activity-forward-compat-1",
        creatorMemberId: "member-forward-1",
        title: "Forward compatibility check",
        description: "Confirms unknown future fields do not break the current reader.",
        activityType: "civic_participation",
        visibility: "public",
        status: "open",
        aggregateVersion: 1,
        createdAt: "2026-07-28T12:00:00.000Z",
        updatedAt: "2026-07-28T12:00:00.000Z",
      };

      // Simulate a hypothetical future document shape (e.g. a Phase 4
      // Member-action-derived Activity with an added initiativeId or
      // sourceEventId) being read by TODAY's unchanged reader.
      const futureShapedDocument = {
        ...baseDocument,
        initiativeId: "initiative-future-1",
        sourceEventId: "member-action-recorded:future-1",
      } as ActivityMongoDocument;

      const record = fromActivityMongoDocument(futureShapedDocument);

      const expected: ActivityRecord = {
        activityId: baseDocument.activityId,
        creatorMemberId: baseDocument.creatorMemberId,
        title: baseDocument.title,
        description: baseDocument.description,
        activityType: baseDocument.activityType,
        visibility: baseDocument.visibility,
        status: baseDocument.status,
        aggregateVersion: baseDocument.aggregateVersion,
        createdAt: baseDocument.createdAt,
        updatedAt: baseDocument.updatedAt,
      };

      assert.deepEqual(record, expected);
      assert.equal("initiativeId" in record, false);
      assert.equal("sourceEventId" in record, false);
    });
  });

  describe("no content-based idempotency or duplicate protection exists today", () => {
    it("building the aggregate twice from identical input produces two distinct activityIds", () => {
      const first = buildActivityAggregateForCreate({
        command: VALID_COMMAND,
        creatorMemberId: "member-idempotency-1",
        occurredAt: "2026-07-28T12:00:00.000Z",
      });
      const second = buildActivityAggregateForCreate({
        command: VALID_COMMAND,
        creatorMemberId: "member-idempotency-1",
        occurredAt: "2026-07-28T12:00:00.000Z",
      });

      assert.notEqual(first.activityId, second.activityId);
      assert.deepEqual(
        { ...first, activityId: undefined },
        { ...second, activityId: undefined },
      );
    });

    it("the ActivityCreated event id is derived only from the generated activityId, not from any source-action identity", () => {
      const first = buildActivityAggregateForCreate({
        command: VALID_COMMAND,
        creatorMemberId: "member-idempotency-2",
      });
      const second = buildActivityAggregateForCreate({
        command: VALID_COMMAND,
        creatorMemberId: "member-idempotency-2",
      });

      const firstEvent = createActivityCreatedEvent({ activity: first, actorId: "member-idempotency-2" });
      const secondEvent = createActivityCreatedEvent({ activity: second, actorId: "member-idempotency-2" });

      // Two independently created Activities for the identical logical
      // action produce two independent event ids — replaying or retrying a
      // "record this action" request today creates a duplicate record.
      // A future event-derived Member Action ledger must dedupe using the
      // *source* event id (see apps/api/src/infrastructure/outbox/processed-events.repository.ts's
      // (consumerId, eventId) claim pattern), not Activity's own generated id.
      assert.notEqual(firstEvent.eventId, secondEvent.eventId);
    });
  });
});
