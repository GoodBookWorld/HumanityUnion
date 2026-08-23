/**
 * Pack 12A — Editor grants Mongo integration (isolated hu_test_* DB).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { EDITOR_CAPABILITY_IDS } from "@hu/types";

import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import {
  dropIsolatedTestDatabase,
  TEST_DATABASE_ENV_VAR,
} from "../../../scripts/test-mongo-isolation.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import {
  deleteAuthUsersByEmailPrefix,
  insertAuthUser,
} from "../../../src/modules/auth/auth-user.repository.js";
import {
  AdministrationForbiddenError,
  AdministrationInsufficientCapabilityError,
  AdministrationScopeMismatchError,
  AdministrationValidationError,
} from "../../../src/modules/administration/administration.errors.js";
import { listAdministrationAuditsForTarget } from "../../../src/modules/administration/audit.service.js";
import {
  activateEditorGrant,
  assignEditorGrant,
  assertEditorCanMutate,
  assertEditorCapability,
  deactivateEditorGrant,
  deleteEditorGrantsByParticipantIds,
  listAdminEditors,
  resolveEditorViewerState,
  updateEditorGrant,
} from "../../../src/modules/editor-grants/index.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const emailPrefix = `pack12a-${testRunId}`;

describe("Pack 12A — Editor grants Mongo", () => {
  let adminUserId = "";
  let adminMemberId = "";
  let memberUserId = "";
  let memberParticipantId = "";
  let otherMemberParticipantId = "";
  let cleanupSucceeded = false;

  before(async () => {
    assert.match(process.env[TEST_DATABASE_ENV_VAR] ?? "", /^hu_test_/);
    await connectMongoClient();
    await ensureMongoIndexes();

    const admin = await insertAuthUser(
      {
        email: `${emailPrefix}-admin@example.com`,
        password: "Password123!",
        displayName: "Editors Admin",
        role: "admin",
      },
      `member-admin-${testRunId}`,
    );
    adminUserId = admin.userId;
    adminMemberId = admin.memberId;

    const member = await insertAuthUser(
      {
        email: `${emailPrefix}-editor@example.com`,
        password: "Password123!",
        displayName: "Future Editor",
        role: "member",
      },
      `member-editor-${testRunId}`,
    );
    memberUserId = member.userId;
    memberParticipantId = member.memberId;

    const other = await insertAuthUser(
      {
        email: `${emailPrefix}-other@example.com`,
        password: "Password123!",
        displayName: "Other Participant",
        role: "member",
      },
      `member-other-${testRunId}`,
    );
    otherMemberParticipantId = other.memberId;
  });

  after(async () => {
    try {
      await deleteEditorGrantsByParticipantIds([
        memberParticipantId,
        otherMemberParticipantId,
        adminMemberId,
      ]);
      await deleteAuthUsersByEmailPrefix(emailPrefix);
    } catch {
      // best effort before DB drop
    }

    const isolatedName = process.env[TEST_DATABASE_ENV_VAR]?.trim();
    const uri = process.env.MONGODB_URI?.trim();
    if (isolatedName?.startsWith("hu_test_") && uri) {
      try {
        await dropIsolatedTestDatabase({ databaseName: isolatedName, uri });
        cleanupSucceeded = true;
      } catch {
        cleanupSucceeded = false;
      }
    } else {
      cleanupSucceeded = false;
    }
    await disconnectMongoClient();
    assert.equal(cleanupSucceeded, true, "isolated hu_test_* database must be dropped");
  });

  it("uses stable editor_grants collection name", () => {
    assert.equal(MONGO_COLLECTIONS.editorGrants, "editor_grants");
  });

  it("assigns Editor, blocks duplicate, activates/deactivates, audits", async () => {
    const created = await assignEditorGrant({
      actorUserId: adminUserId,
      body: {
        participantId: memberParticipantId,
        capabilities: ["INITIATIVE_EDIT", "PUBLIC_CHOICE_EDIT"],
        geographicScope: { level: "COUNTRY", countryCode: "CA" },
        status: "ACTIVE",
      },
    });

    assert.equal(created.participantId, memberParticipantId);
    assert.equal(created.status, "ACTIVE");
    assert.deepEqual(created.capabilities, ["INITIATIVE_EDIT", "PUBLIC_CHOICE_EDIT"]);
    assert.equal(created.geographicScope.level, "COUNTRY");
    assert.equal(created.geographicScope.countryCode, "CA");
    assert.ok(created.displayName);

    await assert.rejects(
      () =>
        assignEditorGrant({
          actorUserId: adminUserId,
          body: {
            participantId: memberParticipantId,
            capabilities: ["MEDIA_RESOURCE_EDIT"],
            geographicScope: { level: "WORLD" },
          },
        }),
      AdministrationValidationError,
    );

    const updated = await updateEditorGrant({
      actorUserId: adminUserId,
      editorGrantId: created.editorGrantId,
      body: {
        capabilities: ["INITIATIVE_EDIT", "MEDIA_RESOURCE_EDIT"],
        geographicScope: {
          level: "REGION",
          countryCode: "CA",
          regionCode: "BC",
        },
      },
    });
    assert.deepEqual(updated.capabilities, ["INITIATIVE_EDIT", "MEDIA_RESOURCE_EDIT"]);
    assert.equal(updated.geographicScope.level, "REGION");

    const inactive = await deactivateEditorGrant({
      actorUserId: adminUserId,
      editorGrantId: created.editorGrantId,
    });
    assert.equal(inactive.status, "INACTIVE");

    const active = await activateEditorGrant({
      actorUserId: adminUserId,
      editorGrantId: created.editorGrantId,
    });
    assert.equal(active.status, "ACTIVE");

    const listed = await listAdminEditors({ actorUserId: adminUserId });
    assert.ok(listed.editors.some((row) => row.editorGrantId === created.editorGrantId));
    assert.ok(listed.activeCount >= 1);

    const audits = await listAdministrationAuditsForTarget({
      targetType: "editor_grant",
      targetId: created.editorGrantId,
      limit: 20,
    });
    const actions = new Set(audits.map((entry) => entry.action));
    assert.ok(actions.has("editor.assign"));
    assert.ok(actions.has("editor.update_permissions"));
    assert.ok(actions.has("editor.update_scope"));
    assert.ok(actions.has("editor.deactivate"));
    assert.ok(actions.has("editor.activate"));
  });

  it("enforces capability + geography; Admin bypasses; inactive denied", async () => {
    const grant = await listAdminEditors({ actorUserId: adminUserId });
    const editorRow = grant.editors.find((row) => row.participantId === memberParticipantId);
    assert.ok(editorRow);

    await updateEditorGrant({
      actorUserId: adminUserId,
      editorGrantId: editorRow.editorGrantId,
      body: {
        status: "ACTIVE",
        capabilities: ["INITIATIVE_EDIT"],
        geographicScope: { level: "COUNTRY", countryCode: "CA" },
      },
    });

    await assertEditorCapability({
      actorUserId: memberUserId,
      capability: "INITIATIVE_EDIT",
    });

    await assert.rejects(
      () =>
        assertEditorCapability({
          actorUserId: memberUserId,
          capability: "MEDIA_RESOURCE_EDIT",
        }),
      AdministrationInsufficientCapabilityError,
    );

    await assertEditorCanMutate({
      actorUserId: memberUserId,
      capability: "INITIATIVE_EDIT",
      content: { countryCode: "CA" },
    });

    await assert.rejects(
      () =>
        assertEditorCanMutate({
          actorUserId: memberUserId,
          capability: "INITIATIVE_EDIT",
          content: { countryCode: "UA" },
        }),
      AdministrationScopeMismatchError,
    );

    // Admin bypass
    await assertEditorCanMutate({
      actorUserId: adminUserId,
      capability: "MEDIA_RESOURCE_EDIT",
      content: { countryCode: "UA" },
    });

    await deactivateEditorGrant({
      actorUserId: adminUserId,
      editorGrantId: editorRow.editorGrantId,
    });

    await assert.rejects(
      () =>
        assertEditorCapability({
          actorUserId: memberUserId,
          capability: "INITIATIVE_EDIT",
        }),
      AdministrationForbiddenError,
    );

    // Participant account remains a normal member — auth role unchanged.
    // (Deactivation does not touch auth_users.)
  });

  it("non-admin cannot assign Editor; Editor cannot manage grants", async () => {
    await assert.rejects(
      () =>
        assignEditorGrant({
          actorUserId: memberUserId,
          body: {
            participantId: otherMemberParticipantId,
            capabilities: [...EDITOR_CAPABILITY_IDS],
            geographicScope: { level: "WORLD" },
          },
        }),
      AdministrationForbiddenError,
    );
  });

  it("projects active/inactive Editor viewer state for Workspace eligibility", async () => {
    const grant = await listAdminEditors({ actorUserId: adminUserId });
    const editorRow = grant.editors.find((row) => row.participantId === memberParticipantId);
    assert.ok(editorRow);

    await activateEditorGrant({
      actorUserId: adminUserId,
      editorGrantId: editorRow.editorGrantId,
    });

    const active = await resolveEditorViewerState(memberParticipantId);
    assert.equal(active.isEditor, true);
    if (active.isEditor) {
      assert.equal(active.status, "ACTIVE");
      assert.ok(active.capabilities.includes("INITIATIVE_EDIT"));
      assert.ok(active.geographicScope.summary);
      assert.equal("assignedByAdminParticipantId" in active, false);
    }

    await deactivateEditorGrant({
      actorUserId: adminUserId,
      editorGrantId: editorRow.editorGrantId,
    });

    const inactive = await resolveEditorViewerState(memberParticipantId);
    assert.equal(inactive.isEditor, true);
    if (inactive.isEditor) {
      assert.equal(inactive.status, "INACTIVE");
    }

    const none = await resolveEditorViewerState(otherMemberParticipantId);
    assert.equal(none.isEditor, false);
  });
});
