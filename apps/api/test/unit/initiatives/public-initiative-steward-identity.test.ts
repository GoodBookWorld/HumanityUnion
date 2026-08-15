import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { Initiative } from "@hu/types";

import { registerAuthUser } from "../../../src/modules/auth/auth.service.js";
import { confirmRegistrationEmailCode } from "../../../src/modules/auth/auth-email-confirmation.service.js";
import {
  deleteAuthUsersByEmailPrefix,
  findAuthUserByEmail,
} from "../../../src/modules/auth/auth-user.repository.js";
import { getLastIssuedConfirmationCodeForTests } from "../../../src/modules/email/email-confirmation-code.repository.js";
import { deleteMembersByIdentityIdPrefix } from "../../../src/modules/member/infrastructure/member.repository.js";
import {
  getOrCreateMemberProfileForUser,
  updateMemberProfilePrivacyForUser,
} from "../../../src/modules/member-profile/member-profile.service.js";
import { deleteMemberProfilesByUserIdPrefix } from "../../../src/modules/member-profile/member-profile.repository.js";
import { buildStageRecords } from "../../../src/modules/initiatives/public-initiative-experience.service.js";
import { toPublicInitiativeProjection } from "../../../src/modules/initiatives/public-initiative.projection.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { deleteWorkspaceProjectionByMemberId } from "../../../src/modules/workspace/infrastructure/workspace-projection.repository.js";
import { markMemberRegisteredOutboxPublishedForTests } from "../../helpers/test-events.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("pie-steward-identity");

function buildInitiativeFixture(stewardId: string): Initiative {
  const now = new Date().toISOString();

  return {
    initiativeId: `${TEST_PREFIX}-initiative`,
    stewardId,
    createdAt: now,
    updatedAt: now,
    title: "Steward Identity Fixture Initiative",
    description: "Fixture Initiative used to verify steward identity resolution.",
    status: "draft",
    lifecyclePhase: "draft",
    visibility: { policy: "steward_only" },
    metadata: {
      category: "Community",
      tags: [],
      region: "Test Region",
      language: "en",
      communitySlug: "test-community",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

describe("Initiative steward identity — 'Unknown Steward' root-cause fix (Pack 02.4 Parts 3/4)", () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  after(async () => {
    await deleteAuthUsersByEmailPrefix(TEST_PREFIX);
    await disconnectMongoClient();
  });

  it("resolves the real display name and a /member/{publicName} link for a verified steward with a public profile", async () => {
    const email = `${TEST_PREFIX}-verified@example.com`;

    await registerAuthUser({ email, password: "Password123!", displayName: "Verified Steward" });
    const user = await findAuthUserByEmail(email);
    assert.ok(user);

    const code = getLastIssuedConfirmationCodeForTests(user.userId);
    assert.ok(code);
    await confirmRegistrationEmailCode({ userId: user.userId, code });
    await deleteWorkspaceProjectionByMemberId(user.memberId);
    await markMemberRegisteredOutboxPublishedForTests(user.memberId);

    const profile = await getOrCreateMemberProfileForUser({
      userId: user.userId,
      displayName: "Verified Steward",
    });
    await updateMemberProfilePrivacyForUser(user.userId, { profileVisibility: "public" });

    const initiative = buildInitiativeFixture(user.memberId);
    const publicInitiative = await toPublicInitiativeProjection(initiative);

    assert.notEqual(publicInitiative.stewardDisplayName, "Unknown Steward");
    assert.equal(publicInitiative.stewardDisplayName, "Verified Steward");
    assert.equal(publicInitiative.stewardProfileUrl, `/member/${profile.publicName}`);

    await deleteMemberProfilesByUserIdPrefix(user.userId);
    await deleteMembersByIdentityIdPrefix(user.userId);
  });

  it("root-cause regression: resolves a real name (never 'Unknown Steward') for a steward who never verified email (no legacy Member record)", async () => {
    const email = `${TEST_PREFIX}-unverified@example.com`;

    await registerAuthUser({ email, password: "Password123!", displayName: "Unverified Steward" });
    const user = await findAuthUserByEmail(email);
    assert.ok(user);
    // Deliberately never confirmed — this is the exact condition that
    // produced "Unknown Steward" pre-fix, since the legacy `member` module
    // only gets a record once `confirmMemberRegistration` runs.

    const initiative = buildInitiativeFixture(user.memberId);
    const publicInitiative = await toPublicInitiativeProjection(initiative);

    assert.notEqual(publicInitiative.stewardDisplayName, "Unknown Steward");
    assert.equal(publicInitiative.stewardDisplayName, "Unverified Steward");
    // No active public MemberProfile was created for this user, so no link.
    assert.equal(publicInitiative.stewardProfileUrl, undefined);
  });

  it("falls back to the generic 'Participant' label (never 'Unknown Steward') for a steward id that resolves to no auth user at all", async () => {
    const initiative = buildInitiativeFixture(`${TEST_PREFIX}-nonexistent-member-id`);
    const publicInitiative = await toPublicInitiativeProjection(initiative);

    assert.notEqual(publicInitiative.stewardDisplayName, "Unknown Steward");
    assert.equal(publicInitiative.stewardDisplayName, "Participant");
    assert.equal(publicInitiative.stewardProfileUrl, undefined);
  });

  it("Part 4 — Overview and Lifecycle 'Initiative' stage authors are the exact same value (never divergent)", async () => {
    const initiative = buildInitiativeFixture(`${TEST_PREFIX}-consistency-member-id`);
    const publicInitiative = await toPublicInitiativeProjection(initiative);
    const stageRecords = await buildStageRecords(initiative, publicInitiative);

    const initiativeStageRecord = stageRecords.get("initiative")?.[0];
    assert.ok(initiativeStageRecord, "Lifecycle 'initiative' stage must have exactly one record");
    assert.equal(initiativeStageRecord.authorDisplayName, publicInitiative.stewardDisplayName);
  });
});
