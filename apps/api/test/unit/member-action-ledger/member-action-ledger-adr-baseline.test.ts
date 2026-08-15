import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PersistedMemberRecord } from "../../../src/modules/member/domain/member.types.js";
import { toMemberDomain } from "../../../src/modules/member/infrastructure/member.persistence.js";
import { sampleMember } from "../../../src/modules/member/member.sample.js";
import { updateLegacyFixtureMemberProfile } from "../../../src/modules/member/infrastructure/member-fixture.store.js";
import * as memberAccess from "../../../src/modules/member/member-access.js";
import type { CivicNotificationEventInput } from "../../../src/modules/notifications/notification.recipients.js";
import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";

/**
 * Recovery Task 21 — Define the Canonical Member Action Ledger and Legacy
 * Activity Disposition (`architecture/decisions/ADR-MEMBER-ACTION-LEDGER-v1.0.md`).
 *
 * This file pins the exact pre-implementation baseline the ADR's decisions
 * depend on. It does not implement, and must not be read as implementing,
 * any part of the Member Action ledger. Each `describe` block corresponds to
 * a specific ADR claim that a future implementation task must either
 * preserve or deliberately, visibly change:
 *
 *  1. `Member.fair` is a structurally-present but operationally inert
 *     placeholder (ADR §5 fact 5, §8) — not absent, and not mutable via any
 *     known exported Member write path.
 *  2. `emitCivicNotificationEvent`'s input contract is not, and does not
 *     resemble, a durable `DomainEvent` (ADR §8, §13) — it lacks the
 *     identity/replay fields a Member Action consumer would require.
 *  3. `ActivityCreated` remains the only Activity event with an actual
 *     factory/producer; `ActivityRevised`/`ActivityClosed` remain reserved
 *     catalogue names with no implementation (ADR §22).
 *  4. No `member-action` production module exists yet — this is a snapshot
 *     of today's baseline, not a permanent prohibition. This specific test
 *     MUST be removed or updated once Phase 1 (ADR §20) creates that module;
 *     it does not forbid that module from ever being created.
 */

describe("Member.fair — structural placeholder, not an operational Fair ledger (ADR-MEMBER-ACTION-LEDGER-v1.0 §5/§8)", () => {
  it("sampleMember.fair is present and initialized to all zeros", () => {
    assert.deepEqual(sampleMember.fair, {
      personal: 0,
      community: 0,
      regional: 0,
      global: 0,
    });
  });

  it("toMemberDomain always produces an all-zero fair balance, regardless of the persisted record's contents", () => {
    const record: PersistedMemberRecord = {
      memberId: "member-fair-baseline-1",
      identityId: "identity-fair-baseline-1",
      displayName: "Fair Baseline Member",
      uniqueName: "fair-baseline-member",
      languages: ["en"],
      status: "active",
      verificationLevel: "email",
      roles: ["member"],
      registrationStatus: "registered",
      version: 1,
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    };

    const member = toMemberDomain(record);

    assert.deepEqual(member.fair, { personal: 0, community: 0, regional: 0, global: 0 });

    // Even a record carrying an out-of-contract "fair"-shaped property (simulating a
    // future, buggy, or malicious persisted document) must not influence the mapped
    // domain value — proving the zero is hardcoded in the mapper, not derived from input.
    const recordWithForeignFairData = {
      ...record,
      fair: { personal: 999, community: 999, regional: 999, global: 999 },
    } as PersistedMemberRecord;

    const memberFromTaintedRecord = toMemberDomain(recordWithForeignFairData);

    assert.deepEqual(memberFromTaintedRecord.fair, { personal: 0, community: 0, regional: 0, global: 0 });
  });

  it("the Member module's declared public API surface (member-access.ts) exports nothing Fair-related", () => {
    const exportedNames = Object.keys(memberAccess);

    assert.deepEqual(exportedNames.sort(), [
      "getMemberById",
      "getMemberByIdSync",
      "getMemberByUniqueName",
      "getMemberByUniqueNameSync",
      "listMembers",
      "updateMemberProfile",
    ]);

    for (const name of exportedNames) {
      assert.equal(/fair/i.test(name), false, `expected exported member "${name}" to not reference Fair`);
    }
  });

  it("updateLegacyFixtureMemberProfile ignores an out-of-contract fair field smuggled past the EditableMemberProfileFields type", () => {
    const beforeUpdate = updateLegacyFixtureMemberProfile(sampleMember.id, { displayName: sampleMember.profile.displayName });
    assert.ok(beforeUpdate, "expected the sample fixture member to exist for this test");
    assert.deepEqual(beforeUpdate!.fair, { personal: 0, community: 0, regional: 0, global: 0 });

    const smuggledFields = {
      displayName: "Updated Via Fair Smuggling Test",
      fair: { personal: 1000, community: 1000, regional: 1000, global: 1000 },
    } as unknown as Parameters<typeof updateLegacyFixtureMemberProfile>[1];

    const updated = updateLegacyFixtureMemberProfile(sampleMember.id, smuggledFields);

    assert.ok(updated);
    assert.equal(updated!.profile.displayName, "Updated Via Fair Smuggling Test");
    assert.deepEqual(updated!.fair, { personal: 0, community: 0, regional: 0, global: 0 });

    // Restore the shared in-memory fixture to its original display name so this test
    // does not leak state into other test files that also read the sample fixture.
    updateLegacyFixtureMemberProfile(sampleMember.id, { displayName: sampleMember.profile.displayName });
  });
});

describe("emitCivicNotificationEvent's input contract is not a durable DomainEvent (ADR §8, §13)", () => {
  it("CivicNotificationEventInput carries no eventId, aggregateType, aggregateId, or metadata envelope", () => {
    const input: CivicNotificationEventInput = {
      eventType: "proposal_submitted",
      entityType: "improvement_proposal",
      entityId: "proposal-adr-baseline-1",
      initiativeId: "initiative-adr-baseline-1",
      actorMemberId: "member-adr-baseline-1",
    };

    assert.equal("eventId" in input, false);
    assert.equal("aggregateType" in input, false);
    assert.equal("aggregateId" in input, false);
    assert.equal("metadata" in input, false);
    assert.equal("payload" in input, false);

    // A durable DomainEvent additionally requires a correlationId/causationId/schemaVersion
    // envelope (apps/api/src/infrastructure/events/domain-event.ts, EventMetadata). None of
    // these have any analog on CivicNotificationEventInput, confirming it cannot supply the
    // durability/replay/stable-ID guarantees the ADR requires of a Member Action ingestion
    // source (ADR §13's rejection of emitCivicNotificationEvent as that source).
    assert.deepEqual(Object.keys(input).sort(), ["actorMemberId", "entityId", "entityType", "eventType", "initiativeId"]);
  });
});

describe("ActivityCreated remains the only implemented Activity event (ADR-MEMBER-ACTION-LEDGER-v1.0 §22)", () => {
  it("CATALOGUE_EVENTS still reserves activityRevised and activityClosed alongside activityCreated", () => {
    assert.equal(CATALOGUE_EVENTS.activityCreated, "ActivityCreated");
    assert.equal(CATALOGUE_EVENTS.activityRevised, "ActivityRevised");
    assert.equal(CATALOGUE_EVENTS.activityClosed, "ActivityClosed");
  });

  it("no activity-revised or activity-closed event-factory module exists in the Activity domain layer", async () => {
    await assert.rejects(
      () => import("../../../src/modules/activity/domain/activity-revised.event.js"),
      /Cannot find module|ERR_MODULE_NOT_FOUND/,
    );
    await assert.rejects(
      () => import("../../../src/modules/activity/domain/activity-closed.event.js"),
      /Cannot find module|ERR_MODULE_NOT_FOUND/,
    );
  });
});

describe("no member-action production module exists yet (pre-implementation baseline, ADR §21/§26)", () => {
  it("apps/api/src/modules/member-action does not exist today", async () => {
    // This test pins TODAY's baseline only. It documents that no production
    // implementation has begun, per this task's explicit prohibition on
    // implementing the ledger now. It is NOT a permanent architectural gate:
    // once Phase 1 (ADR §20) creates apps/api/src/modules/member-action, this
    // specific assertion must be removed or updated by that implementation
    // task — it must never be used to block that future work.
    await assert.rejects(
      () => import("../../../src/modules/member-action/index.js"),
      /Cannot find module|ERR_MODULE_NOT_FOUND/,
    );
  });
});
