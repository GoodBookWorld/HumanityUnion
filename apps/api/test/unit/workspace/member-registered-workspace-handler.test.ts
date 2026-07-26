import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDomainEvent } from "../../../src/infrastructure/events/event-envelope.js";
import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
import {
  buildWorkspaceId,
  createEmptyParticipationSummary,
} from "../../../src/modules/workspace/domain/workspace-projection.types.js";
import {
  buildWorkspaceProjectionFromMemberRegistered,
  toWorkspaceOverviewDto,
} from "../../../src/modules/workspace/infrastructure/workspace-projection.persistence.js";
import {
  initializeWorkspaceFromMemberRegisteredEnvelope,
  validateMemberRegisteredWorkspaceEnvelope,
  WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID,
} from "../../../src/modules/workspace/application/member-registered.workspace-handler.js";
import { WorkspaceProjectionValidationError } from "../../../src/modules/workspace/workspace.errors.js";

describe("MemberRegistered workspace projection handler", () => {
  it("builds deterministic empty Workspace projection from valid payload", () => {
    const event = createDomainEvent({
      eventId: "member-registered:test-member",
      eventName: CATALOGUE_EVENTS.memberRegistered,
      aggregateType: "Member",
      aggregateId: "test-member",
      payload: {
        memberId: "test-member",
        identityId: "identity-1",
        displayName: "Test Member",
        uniqueName: "test-member-unique",
        verificationLevel: "email",
        registeredAt: "2026-07-22T12:00:00.000Z",
      },
      correlationId: "corr-1",
    });

    const payload = validateMemberRegisteredWorkspaceEnvelope(event);
    const record = buildWorkspaceProjectionFromMemberRegistered({
      payload,
      eventId: event.eventId,
      correlationId: event.metadata.correlationId,
      occurredAt: event.metadata.occurredAt,
    });

    assert.equal(record.workspaceId, buildWorkspaceId("test-member"));
    assert.equal(record.memberId, "test-member");
    assert.deepEqual(record.participationSummary, createEmptyParticipationSummary());
    assert.deepEqual(record.recentActivities, []);
    assert.deepEqual(record.nextActions, []);
    assert.equal(record.projectionVersion, 1);
    assert.equal("password" in event.payload, false);

    const dto = toWorkspaceOverviewDto(record);
    assert.equal(dto.projectionStatus, "materialized");
    assert.equal(dto.participationSummary.activeActivityCount, 0);
  });

  it("rejects invalid payloads and credential fields", () => {
    const invalid = createDomainEvent({
      eventName: CATALOGUE_EVENTS.memberRegistered,
      aggregateType: "Member",
      aggregateId: "bad",
      payload: { memberId: "bad" },
    });

    assert.throws(
      () => validateMemberRegisteredWorkspaceEnvelope(invalid),
      WorkspaceProjectionValidationError,
    );

    const withPassword = createDomainEvent({
      eventName: CATALOGUE_EVENTS.memberRegistered,
      aggregateType: "Member",
      aggregateId: "bad",
      payload: {
        memberId: "bad",
        identityId: "id",
        displayName: "Name",
        uniqueName: "name",
        verificationLevel: "email",
        registeredAt: "2026-07-22T12:00:00.000Z",
        password: "secret",
      },
    });

    assert.throws(
      () => validateMemberRegisteredWorkspaceEnvelope(withPassword),
      /credential field "password"/,
    );
  });

  it("uses the canonical consumer identifier", () => {
    assert.equal(WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID, "workspace.member-registered.v1");
  });
});

describe("initializeWorkspaceFromMemberRegisteredEnvelope", () => {
  it("is exported for integration tests", () => {
    assert.equal(typeof initializeWorkspaceFromMemberRegisteredEnvelope, "function");
  });
});
