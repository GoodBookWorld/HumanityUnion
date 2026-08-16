import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import type { Initiative } from "@hu/types";

import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import {
  getAdminInitiativeDetail,
  listAdminInitiatives,
} from "../../../src/modules/administration/admin-initiative-directory.service.js";
import {
  hideAdminInitiativeFromPublic,
  restoreAdminInitiativePublicVisibility,
} from "../../../src/modules/administration/admin-initiative-visibility.service.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../../../src/modules/administration/administration.errors.js";
import {
  deleteAdministrationAuditByActorIdsForTests,
  listAdministrationAuditsForTarget,
  resetAdministrationAuditMemoryForTests,
} from "../../../src/modules/administration/index.js";
import {
  deleteAuthUsersByEmailPrefix,
  insertAuthUser,
} from "../../../src/modules/auth/auth-user.repository.js";
import { isInitiativeEligibleForPublicProjection } from "../../../src/modules/initiatives/initiative-public-projection.access.js";
import {
  createInitiative,
  deleteInitiative,
  getInitiativeById,
} from "../../../src/modules/initiatives/initiative.store.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("admin-i05");
const INITIATIVE_ID = `${TEST_PREFIX}-initiative`;
const createdParticipantIds: string[] = [];

async function insertAccount(label: string, role: "admin" | "member") {
  const memberId = randomUUID();
  const email = `${TEST_PREFIX}-${label}@admin-initiatives.test`;
  const user = await insertAuthUser(
    {
      email,
      password: "Password123!",
      displayName: `AdminInit ${label}`,
      role,
    },
    memberId,
  );
  createdParticipantIds.push(memberId);
  return { userId: user.userId, participantId: memberId };
}

function buildInitiative(stewardId: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: INITIATIVE_ID,
    stewardId,
    createdAt: now,
    updatedAt: now,
    title: "Pack 05 Admin Visibility Initiative",
    description: "Used only for Pack 05 admin visibility command tests.",
    status: "discussion",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    metadata: {
      category: "environment",
      tags: [],
      region: "Test Region",
      language: "en",
      communitySlug: "pack05-community",
      activityArea: "Environment",
      countrySlug: "testland",
      regionSlug: "test-region",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

describe("Admin Panel Pack 05 — Initiative directory & visibility commands", () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();
    resetAdministrationAuditMemoryForTests();
  });

  after(async () => {
    deleteInitiative(INITIATIVE_ID);
    await deleteAdministrationAuditByActorIdsForTests(createdParticipantIds);
    resetAdministrationAuditMemoryForTests();
    await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
    await disconnectMongoClient();
  });

  it("rejects unauthenticated and non-admin directory access", async () => {
    await assert.rejects(
      () => listAdminInitiatives({ actorUserId: "" }),
      AdministrationUnauthorizedError,
    );

    const member = await insertAccount("member-deny", "member");
    await assert.rejects(
      () => listAdminInitiatives({ actorUserId: member.userId }),
      AdministrationForbiddenError,
    );
  });

  it("lists and details initiatives for admin; hide/restore require reason and audit", async () => {
    const admin = await insertAccount("admin", "admin");
    const steward = await insertAccount("steward", "member");

    deleteInitiative(INITIATIVE_ID);
    createInitiative(buildInitiative(steward.participantId));

    const page = await listAdminInitiatives({
      actorUserId: admin.userId,
      search: "Pack 05 Admin Visibility",
      lifecyclePhase: "projected",
      visibility: "public",
      limit: 10,
      offset: 0,
    });

    assert.ok(page.initiatives.some((row) => row.initiativeId === INITIATIVE_ID));
    assert.equal(typeof page.aggregates.total, "number");
    assert.doesNotMatch(JSON.stringify(page), /passwordHash|refreshToken|accessToken/);

    const detail = await getAdminInitiativeDetail({
      actorUserId: admin.userId,
      initiativeId: INITIATIVE_ID,
    });
    assert.equal(detail.initiativeId, INITIATIVE_ID);
    assert.ok(detail.lifecycleStages.length >= 13);
    assert.ok(detail.adminActions.canHideFromPublic);

    await assert.rejects(
      () =>
        hideAdminInitiativeFromPublic({
          actorUserId: admin.userId,
          initiativeId: INITIATIVE_ID,
          reason: "short",
        }),
      AdministrationValidationError,
    );

    const hidden = await hideAdminInitiativeFromPublic({
      actorUserId: admin.userId,
      initiativeId: INITIATIVE_ID,
      reason: "Temporary public moderation for Pack 05 test",
    });

    const afterHide = getInitiativeById(INITIATIVE_ID)!;
    assert.equal(hidden.visibility, "steward_only");
    assert.equal(afterHide.visibility.policy, "steward_only");
    assert.equal(afterHide.stewardId, steward.participantId);
    assert.equal(afterHide.title, "Pack 05 Admin Visibility Initiative");
    assert.equal(afterHide.lifecyclePhase, "projected");
    assert.equal(isInitiativeEligibleForPublicProjection(afterHide), false);

    const audits = await listAdministrationAuditsForTarget({
      targetType: "initiative",
      targetId: INITIATIVE_ID,
    });
    assert.ok(audits.some((entry) => entry.action === "initiative.visibility.hide"));

    const restored = await restoreAdminInitiativePublicVisibility({
      actorUserId: admin.userId,
      initiativeId: INITIATIVE_ID,
      reason: "Restore after Pack 05 moderation test",
    });
    assert.equal(restored.visibility, "public");
    assert.equal(isInitiativeEligibleForPublicProjection(getInitiativeById(INITIATIVE_ID)!), true);

    await assert.rejects(
      () =>
        hideAdminInitiativeFromPublic({
          actorUserId: steward.userId,
          initiativeId: INITIATIVE_ID,
          reason: "Member must not hide initiatives administratively",
        }),
      AdministrationForbiddenError,
    );
  });
});
